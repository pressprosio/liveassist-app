import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, space } from '@/lib/theme';

export const Field = forwardRef<TextInput, TextInputProps & { label: string; hint?: string }>(function Field(
  { label, hint, style, ...props },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor="#98A1AE"
        style={[styles.input, style]}
        accessibilityLabel={label}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: space.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    minHeight: 48, borderWidth: 1, borderColor: '#C8CED7', borderRadius: radius.md,
    paddingHorizontal: space.md, fontSize: 16, color: colors.ink, backgroundColor: colors.surface,
  },
  hint: { fontSize: 13, color: colors.muted },
});
