import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { captureTypeIcons, captureTypeLabelKeys } from '@/components/daily/captureType';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import type { CaptureType } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

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

export default function ActivityScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const { activity, loading } = useCachedActivity(activityId);

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

  if (activity.captureTypes.length === 0) {
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

  const openType = (type: CaptureType) => {
    router.push({
      pathname: recordRoutes[type],
      params: { activityId: activity.id },
    });
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />

      <View style={styles.body}>
        <InstructionCard
          instruction={activity.instructions || td('record.noInstructions')}
          warnings={activity.warnings}
        />

        <Text style={styles.choose}>{td('record.chooseType')}</Text>

        <View style={styles.options}>
          {activity.captureTypes.map((type) => (
            <Pressable
              accessibilityRole="button"
              key={type}
              onPress={() => openType(type)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name={captureTypeIcons[type]}
                  size={20}
                  color={colors.primaryDark}
                />
              </View>
              <Text style={styles.optionLabel}>{td(captureTypeLabelKeys[type])}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
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
  choose: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  optionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  pressed: {
    opacity: 0.75,
  },
});
