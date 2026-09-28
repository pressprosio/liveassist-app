import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { FormattedText } from '@/components/FormattedText';
import { StateBadge } from '@/components/StateBadge';
import { clock } from '@/components/time';
import { useSession } from '@/lib/session';
import { colors, radius, space, topicLabel } from '@/lib/theme';
import type { ChatMessage } from '@/lib/types';

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useSession();
  const insets = useSafeAreaInsets();
  const conv = s.conversations[id];
  const messages = s.messages[id];
  const [draft, setDraft] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingOn = useRef(false);

  // While this chat is on screen, new messages in it don't trigger a banner and sound.
  useFocusEffect(
    useCallback(() => {
      s.setViewing(id);
      return () => s.setViewing(null);
    }, [id]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Load (and reload after reconnecting) the full transcript.
  useEffect(() => {
    if (s.connection === 'online') s.open(id);
  }, [id, s.connection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages?.length]);

  const mine = conv?.state === 'human_active' && conv.agent_id === s.session?.agent.id;
  const closed = conv?.state === 'closed';

  function onChange(text: string) {
    setDraft(text);
    if (!typingOn.current) {
      typingOn.current = true;
      s.typingSignal(id, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingOn.current = false;
      s.typingSignal(id, false);
    }, 2500);
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    s.send(id, text);
    setDraft('');
    typingOn.current = false;
    s.typingSignal(id, false);
  }

  async function suggest() {
    setSuggesting(true);
    const text = await s.suggest(id);
    setSuggesting(false);
    if (text) setDraft(text);
    else Alert.alert('No suggestion', "The assistant couldn't draft a reply this time.");
  }

  function endChat() {
    Alert.alert('End this chat?', 'The visitor will see that the chat has ended.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End chat', style: 'destructive', onPress: () => s.close(id) },
    ]);
  }

  const title = conv ? conv.name || conv.email || 'Visitor' : '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen options={{ title }} />
      <ConnectionBanner />

      {conv ? (
        <View style={styles.info}>
          <View style={styles.infoTop}>
            <StateBadge state={conv.state} suffix={conv.state === 'human_active' ? (mine ? 'you' : conv.agent_name || undefined) : undefined} />
            <Text style={styles.meta} numberOfLines={1}>{conv.site_name} · {topicLabel[conv.topic] || conv.topic}</Text>
          </View>
          {conv.email ? <Text style={styles.meta} selectable>{conv.email}</Text> : null}
          {conv.page_url ? (
            <Text style={styles.link} numberOfLines={1} onPress={() => Linking.openURL(conv.page_url!)}>
              Started on {conv.page_title || conv.page_url}
            </Text>
          ) : null}
          {!closed ? (
            <View style={styles.actions}>
              {!mine ? (
                <Button small label={conv.state === 'waiting_human' ? 'Join chat' : 'Take over'} onPress={() => s.accept(id)} />
              ) : null}
              {conv.state !== 'ai_active' ? <Button small variant="secondary" label="Hand back to AI" onPress={() => s.returnToAi(id)} /> : null}
              <Button small variant="danger" label="End chat" onPress={endChat} />
            </View>
          ) : null}
        </View>
      ) : null}

      {!messages ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble m={item} />}
          contentContainerStyle={styles.thread}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={s.typing[id] ? <Text style={styles.typing}>Visitor is typing…</Text> : null}
        />
      )}

      {closed ? (
        <Text style={[styles.ended, { paddingBottom: insets.bottom + space.md }]}>This chat has ended.</Text>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
          {!mine ? <Text style={styles.hint}>Sending a message takes over the chat from the AI.</Text> : null}
          <View style={styles.composeRow}>
            <TextInput
              value={draft}
              onChangeText={onChange}
              placeholder="Write a reply"
              placeholderTextColor="#98A1AE"
              multiline
              style={styles.input}
              accessibilityLabel="Reply"
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} disabled={!draft.trim()}
              style={({ pressed }) => [styles.send, (!draft.trim() || pressed) && { opacity: 0.5 }]}>
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={suggest} disabled={suggesting} hitSlop={8} style={styles.suggest}>
            <Text style={styles.suggestText}>{suggesting ? 'Drafting a reply…' : 'Suggest a reply'}</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'system') return <Text style={styles.system}>{m.text}</Text>;
  const who = m.role === 'visitor' ? 'Visitor' : m.role === 'ai' ? 'AI assistant' : m.author?.name || 'Team';
  const style = m.role === 'agent' ? styles.agent : m.role === 'ai' ? styles.ai : styles.visitor;
  const textColor = m.role === 'agent' ? colors.accentInk : colors.ink;
  return (
    <View style={[styles.msg, m.role === 'visitor' ? styles.left : styles.right]}>
      <Text style={styles.who}>{who} · {m.pending ? 'Sending…' : clock(m.ts)}</Text>
      <View style={[styles.bubble, style, m.pending && { opacity: 0.6 }]}>
        <FormattedText text={m.text} style={{ color: textColor, fontSize: 16, lineHeight: 22 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  info: { backgroundColor: colors.surface, paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meta: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  link: { fontSize: 13, color: colors.accent },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thread: { padding: space.lg, gap: space.md },
  msg: { maxWidth: '85%', gap: 3 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  who: { fontSize: 12, color: colors.muted, marginHorizontal: 4 },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.lg },
  visitor: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  ai: { backgroundColor: colors.aiBg, borderBottomRightRadius: 4 },
  agent: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  system: { alignSelf: 'center', fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: space.lg },
  typing: { fontSize: 13, color: colors.muted, marginTop: space.sm },
  composer: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingHorizontal: space.md, paddingTop: space.sm, gap: 6 },
  hint: { fontSize: 12.5, color: colors.muted, paddingHorizontal: 4 },
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderWidth: 1, borderColor: '#C8CED7', borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: colors.ink },
  send: { height: 44, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.accentInk, fontWeight: '700', fontSize: 16 },
  suggest: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingVertical: 2 },
  suggestText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  ended: { textAlign: 'center', color: colors.muted, backgroundColor: colors.surface, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
