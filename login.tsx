import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useSession } from '@/lib/session';
import { colors, space, type } from '@/lib/theme';

const DEFAULT_HUB = 'https://chat.presspros.io';

export default function Login() {
  const { signIn, notice, lastHub } = useSession();
  const [hub, setHub] = useState(DEFAULT_HUB);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    lastHub().then((h) => h && setHub(h));
  }, [lastHub]);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      await signIn(hub, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.mark}><Text style={styles.markText}>L</Text></View>
          <Text style={styles.title}>LiveAssist</Text>
          <Text style={styles.lead}>Sign in to answer chats from your website.</Text>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Field
            label="Hub address"
            value={hub}
            onChangeText={setHub}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            hint="Where your chat hub runs. You'll rarely need to change this."
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label="Sign in" onPress={submit} busy={busy} />
          <Text style={styles.foot}>Forgot your password? Ask your hub admin to reset it.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: space.xl, paddingTop: 56, maxWidth: 480, width: '100%', alignSelf: 'center' },
  mark: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  markText: { color: colors.accentInk, fontSize: 28, fontWeight: '800' },
  title: { fontSize: type.big, fontWeight: '800', color: colors.ink },
  lead: { fontSize: type.body, color: colors.muted, marginTop: 4, marginBottom: space.xl },
  notice: { backgroundColor: colors.waitBg, color: colors.wait, padding: space.md, borderRadius: 10, marginBottom: space.lg, fontWeight: '600' },
  error: { color: colors.danger, marginBottom: space.md, fontSize: 15 },
  foot: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: space.lg },
});
