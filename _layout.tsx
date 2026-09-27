import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { configureForegroundNotifications } from '@/lib/push';
import { colors } from '@/lib/theme';

configureForegroundNotifications();

/** Sends people to sign-in, the required password change, or the inbox. */
function Gate() {
  const { status, session } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (status === 'loading') return;
    const onLogin = first === 'login';
    const onPassword = first === 'password';
    if (status === 'signedOut') {
      if (!onLogin) router.replace('/login');
      return;
    }
    if (session?.agent.must_change_password) {
      if (!onPassword) router.replace({ pathname: '/password', params: { required: '1' } });
      return;
    }
    if (onLogin || !first || first === 'index') router.replace('/inbox');
  }, [status, session?.agent.must_change_password, first, router]);

  return null;
}

/** Tapping a notification opens that conversation, including when it launched the app. */
function NotificationRouter() {
  const { status, session } = useSession();
  const router = useRouter();
  const handled = useRef<string | null>(null);
  const last = Platform.OS === 'web' ? null : Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!last || status !== 'signedIn' || session?.agent.must_change_password) return;
    const id = last.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const conv = last.notification.request.content.data?.conversation_id;
    if (typeof conv === 'string' && conv) router.push({ pathname: '/conversation/[id]', params: { id: conv } });
  }, [last, status, session?.agent.must_change_password, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Gate />
        <NotificationRouter />
        <Stack
          screenOptions={{
            headerTintColor: colors.accent,
            headerTitleStyle: { color: colors.ink, fontWeight: '700' },
            headerStyle: { backgroundColor: colors.surface },
            contentStyle: { backgroundColor: colors.wash },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="password" options={{ title: 'Change password' }} />
          <Stack.Screen name="inbox" options={{ title: 'Chats' }} />
          <Stack.Screen name="conversation/[id]" options={{ title: '' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
