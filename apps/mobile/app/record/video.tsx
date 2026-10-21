import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { dailyActivities, getActivity } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

export default function VideoRecordScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = getActivity(activityId) ?? dailyActivities[0];

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={td(activity.contextKey)} title={td(activity.titleKey)} />

      <View style={styles.body}>
        <InstructionCard
          instruction={td(activity.instructionKey)}
          warnings={activity.warnings}
        />

        <View
          accessibilityLabel={td('record.video.preview')}
          accessibilityRole="image"
          style={styles.preview}
        >
          <View style={styles.ground} />
          <View style={[styles.tree, styles.treeLeft]} />
          <View style={[styles.tree, styles.treeRight]} />
          <View style={styles.bench} />

          <View style={styles.recordingChip}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>{td('record.video.recording')}</Text>
          </View>
          <View style={styles.timerChip}>
            <Text style={styles.timer}>{td('record.video.timer')}</Text>
          </View>
        </View>

        <View style={styles.progressGroup}>
          <View
            accessibilityLabel={td('record.video.limit')}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 120, now: 48 }}
            style={styles.progressTrack}
          >
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.limit}>{td('record.video.limit')}</Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          icon={<Ionicons name="square" size={16} color={colors.white} />}
          label={td('record.video.stopSave')}
          onPress={() => router.replace('/record/saved')}
          style={styles.stopButton}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.discard, pressed && styles.pressed]}
        >
          <Text style={styles.discardLabel}>{td('record.video.discard')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  preview: {
    position: 'relative',
    height: 380,
    overflow: 'hidden',
    borderRadius: radii.card,
    backgroundColor: colors.text,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    backgroundColor: '#25402F',
  },
  tree: {
    position: 'absolute',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#1F3A2B',
  },
  treeLeft: {
    left: 30,
    bottom: 80,
    width: 120,
  },
  treeRight: {
    left: 214,
    bottom: 90,
    width: 150,
    backgroundColor: '#1A3325',
  },
  bench: {
    position: 'absolute',
    left: 140,
    bottom: 30,
    width: 96,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5F5036',
  },
  recordingChip: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5A4F',
  },
  recordingLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  timerChip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  progressGroup: {
    gap: 6,
  },
  progressTrack: {
    height: spacing.sm,
    overflow: 'hidden',
    borderRadius: spacing.xs,
    backgroundColor: colors.divider,
  },
  progressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: '#9B1C1C',
  },
  limit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  stopButton: {
    backgroundColor: '#9B1C1C',
  },
  discard: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
});
