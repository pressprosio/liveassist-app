import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/** Shown only when the live connection is down, so the team knows new chats may be delayed. */
export function ConnectionBanner() {
  const { connection } = useSession();
  if (connection === 'online') return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>{connection === 'connecting' ? 'Connecting to the hub…' : 'Offline. Reconnecting…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.waitBg, paddingVertical: 6, paddingHorizontal: 16 },
  text: { color: colors.wait, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
