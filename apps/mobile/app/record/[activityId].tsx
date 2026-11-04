import { Redirect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import { recordPromptOpened } from '@/queue/promptEvents';
import type { CaptureType } from '@/queue/types';
import { colors, fonts, spacing } from '@/theme';

const recordRoutes: Record<
  CaptureType,
  '/record/photo' | '/record/text' | '/record/video' | '/record/audio' | '/record/scale'
> = {
  photo: '/record/photo',
  text: '/record/text',
  video: '/record/video',
  audio: '/record/audio',
  scale: '/record/scale',
};

// No screen of its own: an activity opens directly on its first capture type, with the instruction
// and warnings on top and tabs for the other types.
export default function ActivityScreen() {
  const { activityId, promptId } = useLocalSearchParams<{
    activityId: string;
    promptId?: string;
  }>();
  const { activity, loading } = useCachedActivity(activityId, promptId);

  // Opening the record screen of a prompt is its first open, wherever it was opened from.
  useEffect(() => {
    if (activity?.promptId) {
      void recordPromptOpened(activity.studyId, activity.promptId).catch(
        () => undefined,
      );
    }
  }, [activity?.promptId, activity?.studyId]);

  if (loading) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={td('tabs.today')} title={td('record.loading')} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      </Screen>
    );
  }

  if (!activity) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={td('tabs.today')} title={td('record.notFound')} />
        <View style={styles.body}>
          <Text style={styles.message}>{td('record.notFoundBody')}</Text>
        </View>
      </Screen>
    );
  }

  const firstType = activity.captureTypes[0];
  if (!firstType) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader
          eyebrow={activity.studyTitle}
          title={td('record.unsupportedTitle')}
        />
        <View style={styles.body}>
          <Text style={styles.message}>{td('record.unsupportedBody')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Redirect
      href={{
        pathname: recordRoutes[firstType],
        params: activity.promptId
          ? { activityId: activity.id, promptId: activity.promptId }
          : { activityId: activity.id },
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
});
