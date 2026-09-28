import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '@/components/Button';
import { useSession } from '@/lib/session';
import { colors, space } from '@/lib/theme';
import type { NotifyPrefs } from '@/lib/types';

const DEFAULT_NOTIFY: NotifyPrefs = { handoffs: true, new_chats: true, messages: 'mine' };
const MESSAGE_OPTIONS: { key: NotifyPrefs['messages']; label: string }[] = [
  { key: 'mine', label: "Chats I've joined" },
  { key: 'all', label: 'All chats' },
  { key: 'none', label: 'Off' },
];

export default function Settings() {
  const { session, push, enablePush, testPush, signOut, connection, updateNotifications } = useSession();
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [enabling, setEnabling] = useState(false);

  async function turnOn() {
    setEnabling(true);
    try {
      await enablePush();
    } finally {
      setEnabling(false);
    }
  }
  const prefs: NotifyPrefs = { ...DEFAULT_NOTIFY, ...(session?.agent.notify || {}) };

  async function save(next: NotifyPrefs) {
    try {
      await updateNotifications(next);
    } catch (e) {
      Alert.alert('Not saved', e instanceof Error ? e.message : String(e));
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const n = await testPush();
      Alert.alert(n ? 'Test sent' : 'No phones registered', n
        ? 'Lock your phone now. The notification should arrive with a sound within a few seconds.'
        : 'Turn on notifications first.');
    } catch (e) {
      Alert.alert('Test failed', e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out?', "You won't get chat notifications on this phone until you sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const pushOn = push?.status === 'enabled';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Section title="Alert me with a sound when">
        <Toggle label="A visitor asks for a person" value={prefs.handoffs} onChange={(v) => save({ ...prefs, handoffs: v })} />
        <Toggle label="A new chat starts" value={prefs.new_chats} onChange={(v) => save({ ...prefs, new_chats: v })} />
        <View style={{ gap: space.sm }}>
          <Text style={styles.label}>A visitor sends a message in</Text>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {MESSAGE_OPTIONS.map((o) => {
              const on = prefs.messages === o.key;
              return (
                <Pressable key={o.key} accessibilityRole="radio" accessibilityState={{ selected: on }}
                  onPress={() => save({ ...prefs, messages: o.key })} style={[styles.segBtn, on && styles.segOn]}>
                  <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={styles.note}>
          These apply to this phone and to the web console. When the app is open you'll hear an alert; when it's closed or your phone is locked, you'll get a notification.
        </Text>
      </Section>

      <Section title="Notifications on this phone">
        <Text style={styles.body} selectable>
          {pushOn ? 'On. This phone is registered for notifications.' : push?.message || 'Not set up yet on this phone.'}
        </Text>
        {pushOn ? (
          <Button label="Send a test notification" variant="secondary" onPress={sendTest} busy={testing} />
        ) : push?.status === 'denied' ? (
          <>
            <Button label="Open phone settings" variant="secondary" onPress={() => Linking.openSettings()} />
            <Button label="I've allowed them, try again" variant="secondary" onPress={turnOn} busy={enabling} />
          </>
        ) : push?.status === 'unsupported' ? null : (
          <Button label="Turn on notifications" onPress={turnOn} busy={enabling} />
        )}
        {Platform.OS === 'android' && pushOn ? (
          <Text style={styles.note}>No sound? In phone settings → Apps → LiveAssist → Notifications, make sure "Chats" is allowed to make sound.</Text>
        ) : null}
      </Section>

      <Section title="Account">
        <Row label="Name" value={session?.agent.name} />
        <Row label="Email" value={session?.agent.email} />
        <Row label="Hub" value={session?.hubUrl.replace(/^https?:\/\//, '')} />
        <Row label="Connection" value={connection === 'online' ? 'Online' : connection === 'connecting' ? 'Connecting…' : 'Offline'} />
        <Button label="Change password" variant="secondary" onPress={() => router.push('/password')} />
      </Section>

      <Button label="Sign out" variant="danger" onPress={Platform.OS === 'web' ? () => signOut() : confirmSignOut} />
      <Text style={styles.version}>LiveAssist {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: '#C8CED7' }} thumbColor="#fff"
        accessibilityLabel={label} />
    </View>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1} selectable>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, gap: space.xl, maxWidth: 560, width: '100%', alignSelf: 'center' },
  section: { gap: space.sm },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.muted, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: space.lg, gap: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  label: { fontSize: 16, color: colors.ink, flexShrink: 1 },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 10, overflow: 'hidden' },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: colors.surface },
  segOn: { backgroundColor: colors.accent },
  segText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  segTextOn: { color: colors.accentInk },
  note: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  rowLabel: { fontSize: 15, color: colors.muted },
  rowValue: { fontSize: 15, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 13 },
});
