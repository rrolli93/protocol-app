import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ─── Notification copy ────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = {
  DAILY_REMINDER: 'Log your activity or you will fall behind!',
  LEADERBOARD_CHANGE: 'Someone just passed you on the leaderboard',
  CHALLENGE_ENDING: 'Your challenge ends in 24 hours — finish strong!',
  CHALLENGE_WON: 'You won! USDC is being distributed.',
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

// ─── Default handler ──────────────────────────────────────────────────────────

// Set notification handling behaviour while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Permissions ──────────────────────────────────────────────────────────────

/**
 * Requests push notification permissions from the OS.
 * Returns the final permission status.
 */
export async function requestPermissions(): Promise<Notifications.PermissionStatus> {
  const { status: existing } = await Notifications.getPermissionsAsync();

  if (existing === 'granted') return existing;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status;
}

// ─── Push Token Registration ──────────────────────────────────────────────────

/**
 * Gets the Expo push token and saves it to the `push_subscriptions` table.
 * Must be called AFTER requestPermissions() returns 'granted'.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Physical device required for real push tokens
    if (!Constants.isDevice) {
      console.warn('[notifications] Push tokens only work on physical devices.');
      // Still resolve gracefully in simulator
    }

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C63FF',
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[notifications] Permission not granted, skipping token registration.');
      return null;
    }

    // Get the Expo push token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const pushToken = tokenData.data;

    // Persist token to Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase as any).from('push_subscriptions').upsert(
        {
          user_id: user.id,
          push_token: pushToken,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    return pushToken;
  } catch (err) {
    console.error('[notifications] registerForPushNotifications error:', err);
    return null;
  }
}

// ─── Local Notifications ──────────────────────────────────────────────────────

/**
 * Schedules a local notification.
 *
 * @param title    Notification title
 * @param body     Notification body text
 * @param trigger  Expo NotificationTriggerInput — e.g. { seconds: 60 } or a Date
 * @returns        The scheduled notification identifier
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger,
  });
  return id;
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Schedule the daily activity reminder (fires every day at 20:00 local time). */
export async function scheduleDailyReminder(): Promise<string> {
  return scheduleLocalNotification(
    'PROTOCOL',
    NOTIFICATION_TYPES.DAILY_REMINDER,
    {
      hour: 20,
      minute: 0,
      repeats: true,
    } as Notifications.NotificationTriggerInput,
  );
}

/** Cancel all scheduled notifications. */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
