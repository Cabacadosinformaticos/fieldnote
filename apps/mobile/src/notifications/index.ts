import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { deviceClientForStudy } from '@/api/client';
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

async function registerPushTokens(): Promise<void> {
  const id = projectId();
  if (!id) {
    return;
  }

  const permission = await Notifications.getPermissionsAsync().catch(
    () => null,
  );
  if (!permission?.granted) {
    const requested = await Notifications.requestPermissionsAsync()
      .then((response) => response.granted)
      .catch(() => false);
    if (!requested) {
      return;
    }
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

async function openPrompt(promptId: string): Promise<void> {
  let activity = await cachedActivityForPrompt(promptId).catch(() => null);
  if (!activity) {
    await refreshPromptCache().catch(() => undefined);
    activity = await cachedActivityForPrompt(promptId).catch(() => null);
  }

  if (activity) {
    router.push({
      pathname: '/record/[activityId]',
      params: { activityId: activity.id },
    });
  } else {
    router.replace('/(tabs)');
  }
}

async function handleResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const request = response.notification.request;
  if (handledNotifications.has(request.identifier)) {
    return;
  }
  handledNotifications.add(request.identifier);

  const data = request.content.data;
  const promptId =
    typeof data?.prompt_id === 'string'
      ? data.prompt_id
      : typeof data?.promptId === 'string'
        ? data.promptId
        : null;

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
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleResponse(response);
  });

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => (response ? handleResponse(response) : undefined))
    .catch(() => undefined);
  void registerPushTokens().catch(() => undefined);
}
