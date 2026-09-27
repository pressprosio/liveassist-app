import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useSession } from '@/lib/session';
import { colors, space } from '@/lib/theme';

const MIN = 10;

export default function ChangePassword() {
  const { required } = useLocalSearchParams<{ required?: string }>();
  const isRequired = required === '1';
  const { changePassword, signOut } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function submit() {
    setError(null);
    if (!current) return setError('Enter your current password.');
    if (next.length < MIN) return setError(`Choose a new password of at least ${MIN} characters.`);
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError('Choose a password different from your current one.');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      if (isRequired) router.replace('/inbox');
      else setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: isRequired ? 'Choose a password' : 'Change password', headerBackVisible: !isRequired, gestureEnabled: !isRequired }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          {isRequired
            ? 'You signed in with a temporary password. Choose your own to continue.'
            : 'After you change it, your other phones and computers will need to sign in again.'}
        </Text>
        {done ? <Text style={styles.success} accessibilityRole="alert">Password changed. Your other devices have been signed out.</Text> : null}
        <Field label={isRequired ? 'Temporary password' : 'Current password'} value={current} onChangeText={setCurrent}
          secureTextEntry textContentType="password" autoComplete="current-password" returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()} />
        <Field ref={nextRef} label="New password" value={next} onChangeText={setNext}
          secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="next"
          hint={`At least ${MIN} characters.`} onSubmitEditing={() => confirmRef.current?.focus()} />
        <Field ref={confirmRef} label="Confirm new password" value={confirm} onChangeText={setConfirm}
          secureTextEntry textContentType="newPassword" autoComplete="new-password" returnKeyType="done" onSubmitEditing={submit} />
        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        <Button label="Save password" onPress={submit} busy={busy} />
        {isRequired ? <Button label="Sign out" variant="secondary" onPress={() => signOut()} style={{ marginTop: space.md }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { fontSize: 15, color: colors.muted, marginBottom: space.xl, lineHeight: 21 },
  success: { backgroundColor: colors.liveBg, color: colors.live, padding: space.md, borderRadius: 10, marginBottom: space.lg, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: space.md, fontSize: 15 },
});
