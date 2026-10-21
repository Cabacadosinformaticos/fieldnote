import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { captureTypeIcons, captureTypeLabelKeys } from '@/components/daily/captureType';
import { getActivity, type CaptureType } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const recordRoutes: Record<Exclude<CaptureType, 'scale'>, string> = {
  photo: '/record/photo',
  text: '/record/text',
  video: '/record/video',
  audio: '/record/audio',
};

export default function ActivityScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = getActivity(activityId);

  if (!activity) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={td('tabs.today')} title={td('record.notFound')} />
      </Screen>
    );
  }

  const openType = (type: CaptureType) => {
    if (type === 'scale') {
      const scale = activity.scale;
      router.push({
        pathname: '/record/scale',
        params: {
          activityId: activity.id,
          kind: scale?.kind ?? 'numbers',
          points: String(scale?.points ?? 7),
          low: scale ? td(scale.lowKey) : td('scale.low'),
          high: scale ? td(scale.highKey) : td('scale.high'),
          ...(scale?.midKey ? { mid: td(scale.midKey) } : {}),
        },
      });
      return;
    }

    router.push({
      pathname: recordRoutes[type],
      params: { activityId: activity.id },
    });
  };

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader
        eyebrow={td(activity.contextKey)}
        title={td(activity.titleKey)}
      />

      <View style={styles.body}>
        <InstructionCard
          instruction={td(activity.instructionKey)}
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
