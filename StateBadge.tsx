import { StyleSheet, Text } from 'react-native';
import { stateStyle, type ConvState } from '@/lib/theme';

export function StateBadge({ state, suffix }: { state: ConvState; suffix?: string }) {
  const s = stateStyle[state];
  return (
    <Text style={[styles.badge, { color: s.fg, backgroundColor: s.bg }]} numberOfLines={1}>
      {s.label}{suffix ? ` · ${suffix}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
});
