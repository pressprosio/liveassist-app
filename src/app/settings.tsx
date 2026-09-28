import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button } from '@/components/Button';
import { useSession } from '@/lib/session';
import { colors, space } from '@/lib/theme';

export default function Settings() {
  const { session, push, enablePush, testPush, signOut, connection } = useSession();
  const router = useRouter();
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    setTesting(true);
    try {
      const n = await testPush();
      Alert.alert(n ? 'Test sent' : 'No phones registered', n
        ? 'A notification should arrive in a few seconds. Lock your phone to see it on the lock screen.'
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

  const pushText =
    push?.status === 'enabled' ? 'On. You\'ll be notified when a visitor asks for a person, and when visitors reply in chats you\'ve joined.'
      : push?.message || 'Checking…';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Section title="Account">
        <Row label="Name" value={session?.agent.name} />
        <Row label="Email" value={session?.agent.email} />
        <Row label="Hub" value={session?.hubUrl.replace(/^https?:\/\//, '')} />
        <Row label="Connection" value={connection === 'online' ? 'Online' : connection === 'connecting' ? 'Connecting…' : 'Offline'} />
        <Button label="Change password" variant="secondary" onPress={() => router.push('/password')} style={styles.btn} />
      </Section>

      <Section title="Notifications">
        <Text style={styles.body}>{pushText}</Text>
        {push?.status === 'enabled' ? (
          <Button label="Send a test notification" variant="secondary" onPress={sendTest} busy={testing} style={styles.btn} />
        ) : push?.status === 'denied' ? (
          <Button label="Open phone settings" variant="secondary" onPress={() => Linking.openSettings()} style={styles.btn} />
        ) : push?.status === 'error' ? (
          <Button label="Try again" variant="secondary" onPress={() => enablePush()} style={styles.btn} />
        ) : null}
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
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: space.lg, gap: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.lg },
  rowLabel: { fontSize: 15, color: colors.muted },
  rowValue: { fontSize: 15, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  btn: { marginTop: 4 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 13 },
});
