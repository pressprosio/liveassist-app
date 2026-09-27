import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, space } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  label, onPress, variant = 'primary', busy, disabled, style, small,
}: {
  label: string; onPress: () => void; variant?: Variant; busy?: boolean; disabled?: boolean; style?: ViewStyle; small?: boolean;
}) {
  const v = variants[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && !off && { opacity: 0.75 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={v.fg} /> : <Text style={[styles.label, small && styles.smallLabel, { color: v.fg }]}>{label}</Text>}
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentInk, border: colors.accent },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
  danger: { bg: colors.surface, fg: colors.danger, border: '#F0C9C5' },
};

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.sm },
  label: { fontSize: 16, fontWeight: '600' },
  smallLabel: { fontSize: 14 },
});
