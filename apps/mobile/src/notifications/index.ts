import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { deviceClientForStudy } from '@/api/client';
import { showTopBanner } from '@/components/TopBanner';
import { td } from '@/i18n/td';
import { recordPromptShown } from '@/queue/promptEvents';
import {
  cachedActivityForPrompt,
  refreshPromptCache,
} from '@/queue/prompts';
import { listParticipations } from '@/state/participations';

type EasExtra = {
  eas?: {
    projectId?: unknown;
  };
};

let started = false;
// Opening a prompt from a notification before the first screen has settled lets the redirect
// from the root route replace the record screen with Today. The navigation waits for the Today
// screen to mount, which only happens after that redirect.
let navigationReady = false;
let pendingPromptId: string | null = null;
const handledNotifications = new Set<string>();

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as EasExtra | undefined;
  const value = extra?.eas?.projectId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function registerForParticipation(
  studyId: string,
  pushToken: string,
): Promise<void> {
  const client = await deviceClientForStudy(studyId).catch(() => null);
  if (!client) {
    return;
  }
  await client
    .PUT('/api/v1/participation/me/push-token', {
      body: { push_token: pushToken },
    })
    .catch(() => undefined);
}

/**
 * Registers the phone silently. The OS dialog is only shown from the explicit "Permitir avisos"
 * action, so a participant who has not granted permission is never asked at launch.
 */
async function registerPushTokens(): Promise<void> {
  const id = projectId();
  if (!id) {
    return;
  }

  const permission = await Notifications.getPermissionsAsync().catch(
    () => null,
  );
  if (!permission?.granted) {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId: id })
    .then((result) => result.data)
    .catch(() => null);
  if (!token) {
    return;
  }

  const participations = await listParticipations().catch(() => []);
  for (const participation of participations) {
    await registerForParticipation(participation.studyId, token);
  }
}

/**
 * Asks for the OS permission from the "Permitir avisos" button. When Android no longer lets the
 * app ask, the only way to turn notifications on is the system settings, so it opens them and
 * returns true so the screen stays there for the participant to try again on the way back.
 */
export async function enableNotifications(): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync().catch(
    () => null,
  );

  if (!permission?.granted) {
    if (permission?.canAskAgain === false) {
      await Linking.openSettings().catch(() => undefined);
      return true;
    }

    const granted = await Notifications.requestPermissionsAsync()
      .then((response) => response.granted)
      .catch(() => false);
    if (!granted) {
      return false;
    }
  }

  await registerPushTokens().catch(() => undefined);
  return false;
}

/**
 * Called when the first screen with the tabs has mounted. Only then can a prompt pushed by a
 * notification keep the record screen on top instead of being replaced by the Today redirect.
 */
export function notificationNavigationReady(): void {
  navigationReady = true;
  const promptId = pendingPromptId;
  pendingPromptId = null;
  if (promptId) {
    void openPrompt(promptId);
  }
  // A response that launched the app is not readable this early at the root layout; it only
  // becomes available once the first screen is mounted. Ask again here, where it is.
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => (response ? handleResponse(response) : undefined))
    .catch(() => undefined);
}

async function openPrompt(promptId: string): Promise<void> {
  if (!navigationReady) {
    pendingPromptId = promptId;
    return;
  }

  let activity = await cachedActivityForPrompt(promptId).catch(() => null);

  if (!activity) {
    const refreshed = await refreshPromptCache().catch(() => null);
    activity =
      refreshed?.prompts.find((item) => item.promptId === promptId) ??
      (await cachedActivityForPrompt(promptId).catch(() => null));

    if (!activity) {
      // Today is the right place only when the API answered and the prompt is gone: closed,
      // answered or belonging to a participation that is no longer active.
      if (refreshed?.online) {
        showTopBanner({
          icon: 'time-outline',
          title: td('notification.closedTitle'),
          body: td('notification.closedBody'),
        });
      } else {
        showTopBanner({
          icon: 'cloud-offline-outline',
          title: td('notification.unavailableTitle'),
          body: td('notification.unavailableBody'),
        });
      }
      router.replace('/(tabs)');
      return;
    }
  }

  router.push({
    pathname: '/record/[activityId]',
    params: activity.promptId
      ? { activityId: activity.id, promptId: activity.promptId }
      : { activityId: activity.id },
  });
}

/**
 * A notification shown in the foreground makes the prompt visible, so its first appearance is
 * reported even if Today has not refreshed yet. A missing prompt or study only skips the report.
 */
async function reportForegroundShown(promptId: string): Promise<void> {
  try {
    let activity = await cachedActivityForPrompt(promptId);
    if (!activity) {
      const refreshed = await refreshPromptCache();
      activity =
        refreshed.prompts.find((item) => item.promptId === promptId) ?? null;
    }
    if (activity) {
      await recordPromptShown(activity.studyId, promptId);
    }
  } catch {
    // Reporting is best effort and must never disturb the banner.
  }
}

function promptIdFrom(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.prompt_id === 'string') {
    return record.prompt_id;
  }
  if (typeof record.promptId === 'string') {
    return record.promptId;
  }
  return null;
}

async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const request = response.notification.request;
  if (handledNotifications.has(request.identifier)) {
    return;
  }
  handledNotifications.add(request.identifier);

  const promptId = promptIdFrom(request.content.data);
  if (promptId) {
    await openPrompt(promptId);
  }
  await Notifications.clearLastNotificationResponseAsync().catch(
    () => undefined,
  );
}

export function startNotifications(): void {
  if (started) {
    return;
  }
  started = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  Notifications.addNotificationReceivedListener((notification) => {
    // Only the prompt id is trusted; the banner text is always generic.
    const promptId = promptIdFrom(notification.request.content.data);
    if (promptId) {
      void reportForegroundShown(promptId);
    }
    showTopBanner({
      icon: 'notifications-outline',
      title: td('notification.foregroundTitle'),
      body: td('notification.foregroundBody'),
      action: promptId
        ? {
            label: td('notification.open'),
            onPress: () => {
              void openPrompt(promptId);
            },
          }
        : undefined,
    });
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  void registerPushTokens().catch(() => undefined);
}
