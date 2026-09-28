/**
 * Live connection to the hub (/agent/ws). Reconnects with backoff, keeps a heartbeat,
 * and reconnects immediately when the app returns to the foreground.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { socketUrl } from './api';

export type HubEvent = { type: string; [key: string]: any };
export type ConnectionState = 'connecting' | 'online' | 'offline';

interface Handlers {
  onEvent: (e: HubEvent) => void;
  onState: (s: ConnectionState) => void;
  onAuthFailed: () => void;
}

export class HubSocket {
  private ws: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private appSub: { remove(): void } | null = null;

  constructor(private hubUrl: string, private token: string, private h: Handlers) {}

  start() {
    this.stopped = false;
    this.appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && !this.isOpen()) this.connectNow();
    });
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.appSub?.remove();
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  setToken(token: string) {
    this.token = token;
  }

  send(msg: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  isOpen() {
    return !!this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING);
  }

  private connectNow() {
    this.attempts = 0;
    this.clearTimers();
    this.connect();
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.timer = null;
    this.heartbeat = null;
  }

  private connect() {
    if (this.stopped || this.isOpen()) return;
    this.h.onState('connecting');
    const ws = new WebSocket(socketUrl(this.hubUrl));
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.token }));
    ws.onmessage = (e) => {
      let msg: HubEvent;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (msg.type === 'hello') {
        this.attempts = 0;
        this.h.onState('online');
        if (this.heartbeat) clearInterval(this.heartbeat);
        this.heartbeat = setInterval(() => this.send({ type: 'ping' }), 25_000);
      }
      this.h.onEvent(msg);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return; // replaced or stopped
      this.ws = null;
      if (this.heartbeat) clearInterval(this.heartbeat);
      if (this.stopped) return;
      if (e.code === 4001) {
        this.h.onState('offline');
        this.h.onAuthFailed();
        return;
      }
      this.h.onState('offline');
      this.attempts += 1;
      const delay = Math.min(15_000, 1000 * 2 ** Math.min(this.attempts - 1, 4));
      this.timer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }
}
