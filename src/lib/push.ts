/** Push notification registration (Expo push service → APNs / FCM). */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export type PushStatus = 'enabled' | 'denied' | 'unsupported' | 'error';

/** Show notifications even while the app is open. */
export function configureForegroundNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getPushToken(): Promise<{ status: PushStatus; token?: string; message?: string }> {
  if (Platform.OS === 'web') return { status: 'unsupported', message: 'Notifications are only available in the phone app.' };
  if (!Device.isDevice) return { status: 'unsupported', message: 'Push notifications need a real phone, not a simulator.' };

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('chats', {
      name: 'Chats',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { status: 'denied', message: 'Notifications are turned off for LiveAssist in your phone settings.' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { status: 'error', message: 'This build has no EAS project ID. Run "eas init" and rebuild.' };

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return { status: 'enabled', token };
  } catch (e) {
    return { status: 'error', message: `Couldn't set up notifications: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function setBadge(count: number) {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}
