/**
 * App-wide state: who is signed in, the live connection to the hub, the conversation
 * list, loaded transcripts, and every action a team member can take.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { api, normalizeHubUrl } from './api';
import { HubSocket, type ConnectionState, type HubEvent } from './hubSocket';
import { getPushToken, setBadge, type PushStatus } from './push';
import { KEYS, storage } from './storage';
import type { Agent, ChatMessage, ConversationSummary, NotifyPrefs, Session } from './types';

interface State {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: Session | null;
  connection: ConnectionState;
  conversations: Record<string, ConversationSummary>;
  messages: Record<string, ChatMessage[]>;
  typing: Record<string, boolean>;
  push: { status: PushStatus; message?: string } | null;
  notice: string | null;
}

type Action =
  | { type: 'restore'; session: Session | null; notice?: string | null }
  | { type: 'signedIn'; session: Session }
  | { type: 'signedOut'; notice?: string | null }
  | { type: 'agent'; agent: Agent; token?: string }
  | { type: 'connection'; value: ConnectionState }
  | { type: 'conversations'; list: ConversationSummary[]; replace?: boolean }
  | { type: 'conversation'; conv: ConversationSummary }
  | { type: 'detail'; id: string; messages: ChatMessage[] }
  | { type: 'message'; id: string; message: ChatMessage }
  | { type: 'pending'; id: string; clientId: string; text: string; author: string }
  | { type: 'ack'; id: string; clientId: string; messageId: string }
  | { type: 'failed'; id: string; clientId: string }
  | { type: 'typing'; id: string; value: boolean }
  | { type: 'push'; value: State['push'] };

const initial: State = {
  status: 'loading', session: null, connection: 'offline', conversations: {}, messages: {}, typing: {}, push: null, notice: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'restore':
      return { ...initial, status: a.session ? 'signedIn' : 'signedOut', session: a.session, notice: a.notice ?? null };
    case 'signedIn':
      return { ...initial, status: 'signedIn', session: a.session };
    case 'signedOut':
      return { ...initial, status: 'signedOut', notice: a.notice ?? null };
    case 'agent':
      if (!s.session) return s;
      return { ...s, session: { ...s.session, agent: a.agent, token: a.token ?? s.session.token } };
    case 'connection':
      return { ...s, connection: a.value };
    case 'conversations': {
      const next = a.replace ? {} as Record<string, ConversationSummary> : { ...s.conversations };
      if (a.replace) {
        // Keep closed chats that were already loaded; the hello list only includes open ones.
        for (const c of Object.values(s.conversations)) if (c.state === 'closed') next[c.id] = c;
      }
      for (const c of a.list) next[c.id] = c;
      return { ...s, conversations: next };
    }
    case 'conversation':
      return { ...s, conversations: { ...s.conversations, [a.conv.id]: a.conv } };
    case 'detail':
      return { ...s, messages: { ...s.messages, [a.id]: a.messages } };
    case 'message': {
      const list = s.messages[a.id];
      if (!list) return s; // transcript not open; the list preview updates via conversation.updated
      if (list.some((m) => m.id === a.message.id)) return s;
      // Our own message echoed back before its ack: replace the pending copy.
      const pendingIdx = a.message.role === 'agent' ? list.findIndex((m) => m.pending && m.text === a.message.text) : -1;
      const next = pendingIdx >= 0 ? list.map((m, i) => (i === pendingIdx ? a.message : m)) : [...list, a.message];
      return { ...s, messages: { ...s.messages, [a.id]: next } };
    }
    case 'pending': {
      const list = s.messages[a.id] || [];
      const msg: ChatMessage = { id: a.clientId, role: 'agent', text: a.text, ts: new Date().toISOString(), author: { name: a.author }, pending: true };
      return { ...s, messages: { ...s.messages, [a.id]: [...list, msg] } };
    }
    case 'ack': {
      const list = s.messages[a.id];
      if (!list) return s;
      const exists = list.some((m) => m.id === a.messageId);
      const next = exists
        ? list.filter((m) => m.id !== a.clientId)
        : list.map((m) => (m.id === a.clientId ? { ...m, id: a.messageId, pending: false } : m));
      return { ...s, messages: { ...s.messages, [a.id]: next } };
    }
    case 'failed': {
      const list = s.messages[a.id];
      if (!list) return s;
      return { ...s, messages: { ...s.messages, [a.id]: list.filter((m) => m.id !== a.clientId) } };
    }
    case 'typing':
      return { ...s, typing: { ...s.typing, [a.id]: a.value } };
    case 'push':
      return { ...s, push: a.value };
  }
}

interface Ctx extends State {
  signIn(hubUrl: string, email: string, password: string): Promise<void>;
  signOut(notice?: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  open(id: string): void;
  refresh(includeClosed?: boolean): void;
  send(id: string, text: string): void;
  accept(id: string): void;
  returnToAi(id: string): void;
  close(id: string): void;
  typingSignal(id: string, value: boolean): void;
  suggest(id: string): Promise<string>;
  enablePush(): Promise<void>;
  updateNotifications(prefs: NotifyPrefs): Promise<void>;
  setViewing(id: string | null): void;
  testPush(): Promise<number>;
  lastHub: () => Promise<string | null>;
}

const SessionContext = createContext<Ctx | null>(null);

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const socket = useRef<HubSocket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const suggestions = useRef(new Map<string, (text: string) => void>());
  const pendingSends = useRef(new Map<string, string>()); // client_id → conversation id
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const viewing = useRef<string | null>(null); // conversation currently on screen
  sessionRef.current = state.session;

  const persist = useCallback(async (s: Session | null) => {
    if (s) await storage.set(KEYS.session, JSON.stringify(s));
    else await storage.remove(KEYS.session);
  }, []);

  /* ---------- Restore on launch ---------- */
  useEffect(() => {
    (async () => {
      const raw = await storage.get(KEYS.session);
      let session: Session | null = null;
      try {
        session = raw ? (JSON.parse(raw) as Session) : null;
      } catch {
        session = null;
      }
      dispatch({ type: 'restore', session });
    })();
  }, []);

  /* ---------- Sign out ---------- */
  const signOut = useCallback(async (notice?: string) => {
    const s = sessionRef.current;
    socket.current?.stop();
    socket.current = null;
    const pushToken = await storage.get(KEYS.pushToken);
    if (s && pushToken) await api.removeDevice(s.hubUrl, s.token, pushToken).catch(() => {});
    await storage.remove(KEYS.pushToken);
    await persist(null);
    await setBadge(0);
    dispatch({ type: 'signedOut', notice: notice ?? null });
  }, [persist]);

  /* ---------- Hub events ---------- */
  const onEvent = useCallback((e: HubEvent) => {
    switch (e.type) {
      case 'hello': {
        dispatch({ type: 'conversations', list: e.conversations || [], replace: true });
        const s = sessionRef.current;
        if (s && e.agent) {
          const agent = { ...s.agent, ...e.agent } as Agent;
          dispatch({ type: 'agent', agent });
          persist({ ...s, agent });
        }
        break;
      }
      case 'conversations':
        dispatch({ type: 'conversations', list: e.conversations || [] });
        break;
      case 'conversation.updated':
        if (e.conversation) dispatch({ type: 'conversation', conv: e.conversation });
        break;
      case 'conversation.detail':
        if (e.conversation) {
          dispatch({ type: 'conversation', conv: e.conversation });
          dispatch({ type: 'detail', id: e.conversation.id, messages: e.messages || [] });
        }
        break;
      case 'message':
        if (e.conversation_id && e.message) dispatch({ type: 'message', id: e.conversation_id, message: e.message });
        break;
      case 'ack': {
        const convId = e.conversation_id || pendingSends.current.get(e.client_id);
        if (convId && e.client_id) {
          dispatch({ type: 'ack', id: convId, clientId: e.client_id, messageId: String(e.id) });
          pendingSends.current.delete(e.client_id);
        }
        break;
      }
      case 'typing':
        if (e.role === 'visitor' && e.conversation_id) {
          dispatch({ type: 'typing', id: e.conversation_id, value: Boolean(e.state) });
          const t = typingTimers.current.get(e.conversation_id);
          if (t) clearTimeout(t);
          typingTimers.current.set(
            e.conversation_id,
            setTimeout(() => dispatch({ type: 'typing', id: e.conversation_id, value: false }), 6000),
          );
        }
        break;
      case 'alert': {
        // Sent for new chats, visitor messages and handoffs, to the people whose settings ask for them.
        const me = sessionRef.current?.agent.id;
        if (!me || !Array.isArray(e.to) || !e.to.includes(me) || Platform.OS === 'web') break;
        if (viewing.current === e.conversation_id && e.kind !== 'handoff') {
          // Already looking at this chat: a tap on the wrist is enough.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          break;
        }
        Notifications.scheduleNotificationAsync({
          content: { title: String(e.title || 'LiveAssist'), body: String(e.body || ''), sound: 'default', data: { conversation_id: e.conversation_id, kind: e.kind } },
          trigger: Platform.OS === 'android' ? { channelId: 'chats' } : null,
        }).catch(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}));
        break;
      }
      case 'suggestion': {
        const resolve = suggestions.current.get(e.conversation_id);
        suggestions.current.delete(e.conversation_id);
        resolve?.(String(e.text || ''));
        break;
      }
      case 'error':
        // Resolve a waiting suggestion so its button doesn't spin forever.
        for (const [, resolve] of suggestions.current) resolve('');
        suggestions.current.clear();
        Alert.alert('Action not completed', String(e.message || 'Please try again.'));
        break;
    }
  }, [persist]);

  /* ---------- Connect while signed in ---------- */
  const hubUrl = state.session?.hubUrl;
  const signedIn = state.status === 'signedIn';
  useEffect(() => {
    if (!signedIn || !hubUrl || !sessionRef.current) return;
    const sock = new HubSocket(hubUrl, sessionRef.current.token, {
      onEvent,
      onState: (value) => dispatch({ type: 'connection', value }),
      onAuthFailed: () => void signOut('Your session ended. Sign in again.'),
    });
    socket.current = sock;
    sock.start();
    return () => {
      sock.stop();
      if (socket.current === sock) socket.current = null;
    };
  }, [signedIn, hubUrl, onEvent, signOut]);

  /* ---------- Push ---------- */
  const enablePush = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const res = await getPushToken();
    if (res.status === 'enabled' && res.token) {
      try {
        await api.registerDevice(s.hubUrl, s.token, res.token, Platform.OS);
        await storage.set(KEYS.pushToken, res.token);
        dispatch({ type: 'push', value: { status: 'enabled' } });
      } catch (e) {
        dispatch({ type: 'push', value: { status: 'error', message: e instanceof Error ? e.message : String(e) } });
      }
    } else {
      dispatch({ type: 'push', value: { status: res.status, message: res.message } });
    }
  }, []);

  const mustChange = state.session?.agent.must_change_password;
  useEffect(() => {
    // Register as soon as the person is fully signed in (older saved sessions may lack the flag).
    if (signedIn && !mustChange) void enablePush();
  }, [signedIn, mustChange, enablePush]);

  /* ---------- App icon badge: chats waiting for a person ---------- */
  const waitingCount = useMemo(
    () => Object.values(state.conversations).filter((c) => c.state === 'waiting_human').length,
    [state.conversations],
  );
  useEffect(() => {
    if (signedIn) void setBadge(waitingCount);
  }, [signedIn, waitingCount]);

  /* ---------- Actions ---------- */
  const value = useMemo<Ctx>(() => {
    const send = (msg: Record<string, unknown>) => {
      if (!socket.current?.send(msg)) {
        Alert.alert('Not connected', 'Reconnecting to the hub. Try again in a moment.');
        return false;
      }
      return true;
    };

    return {
      ...state,

      async signIn(hub, email, password) {
        const hubUrl = normalizeHubUrl(hub);
        const res = await api.login(hubUrl, email.trim(), password);
        const session: Session = { hubUrl, token: res.token, agent: res.agent };
        await persist(session);
        await storage.set(KEYS.lastHub, hubUrl);
        dispatch({ type: 'signedIn', session });
      },

      signOut,

      async changePassword(current, next) {
        const s = sessionRef.current;
        if (!s) throw new Error('Not signed in.');
        const res = await api.changePassword(s.hubUrl, s.token, current, next);
        const updated: Session = { ...s, token: res.token, agent: res.agent };
        await persist(updated);
        socket.current?.setToken(res.token);
        dispatch({ type: 'agent', agent: res.agent, token: res.token });
      },

      open(id) {
        socket.current?.send({ type: 'open', conversation_id: id });
      },

      refresh(includeClosed) {
        socket.current?.send({ type: 'list', include_closed: Boolean(includeClosed) });
      },

      send(id, text) {
        const clientId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (!send({ type: 'send', conversation_id: id, text, client_id: clientId })) return;
        pendingSends.current.set(clientId, id);
        dispatch({ type: 'pending', id, clientId, text, author: state.session?.agent.name || 'You' });
        // If no acknowledgement arrives, drop the pending copy so it isn't mistaken for sent.
        setTimeout(() => {
          if (pendingSends.current.has(clientId)) {
            pendingSends.current.delete(clientId);
            dispatch({ type: 'failed', id, clientId });
            Alert.alert('Message not sent', 'Check your connection and send it again.');
          }
        }, 15_000);
      },

      accept(id) {
        send({ type: 'accept', conversation_id: id });
      },
      returnToAi(id) {
        send({ type: 'return_to_ai', conversation_id: id });
      },
      close(id) {
        send({ type: 'close', conversation_id: id });
      },
      typingSignal(id, v) {
        socket.current?.send({ type: 'typing', conversation_id: id, state: v });
      },

      suggest(id) {
        return new Promise<string>((resolve) => {
          if (!send({ type: 'suggest', conversation_id: id })) return resolve('');
          suggestions.current.set(id, resolve);
          setTimeout(() => {
            if (suggestions.current.get(id) === resolve) {
              suggestions.current.delete(id);
              resolve('');
            }
          }, 30_000);
        });
      },

      enablePush,

      async updateNotifications(prefs) {
        const s = sessionRef.current;
        if (!s) return;
        const res = await api.updateNotifications(s.hubUrl, s.token, prefs);
        await persist({ ...s, agent: res.agent });
        dispatch({ type: 'agent', agent: res.agent });
      },

      setViewing(id) {
        viewing.current = id;
      },

      async testPush() {
        const s = sessionRef.current;
        if (!s) return 0;
        const res = await api.testPush(s.hubUrl, s.token);
        return res.devices;
      },

      lastHub: () => storage.get(KEYS.lastHub),
    };
  }, [state, persist, signOut, enablePush]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
