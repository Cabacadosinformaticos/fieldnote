import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { dailyActivities, getActivity } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const WAVE_HEIGHTS = [
  14, 22, 30, 18, 40, 52, 36, 26, 44, 60, 48, 34, 20, 38, 56, 64, 46, 30, 22, 42, 54, 38,
  24, 16, 20, 14, 18, 12, 16, 10, 14, 10, 12, 8, 12, 8, 10, 8, 10, 8,
];

const RECORDED_BARS = 15;

type Mode = 'audio' | 'text';

export default function AudioRecordScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = getActivity(activityId) ?? dailyActivities[0];
  const [mode, setMode] = useState<Mode>('audio');
  const [answer, setAnswer] = useState('');

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={td(activity.contextKey)} title={td(activity.titleKey)} />

      <View style={styles.body}>
        <InstructionCard
          instruction={td(activity.instructionKey)}
          warnings={activity.warnings}
        />

        {mode === 'audio' ? (
          <>
            <View style={styles.recorder}>
              <View style={styles.recordingRow}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingLabel}>{td('record.audio.recording')}</Text>
              </View>

              <View style={styles.timerRow}>
                <Text style={styles.timer}>{td('record.audio.elapsed')}</Text>
                <Text style={styles.timerTotal}>{td('record.audio.total')}</Text>
              </View>

              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.wave}
              >
                {WAVE_HEIGHTS.map((height, index) => (
                  <View
                    key={`${height}-${index}`}
                    style={[
                      styles.bar,
                      { height },
                      index < RECORDED_BARS ? styles.barRecorded : styles.barIdle,
                    ]}
                  />
                ))}
              </View>

              <Text style={styles.limit}>{td('record.audio.limit')}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('text')}
              style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
            >
              <Ionicons name="text-outline" size={18} color={colors.text} />
              <Text style={styles.switchLabel}>{td('record.audio.toText')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>{td('record.text.label')}</Text>
              <TextInput
                accessibilityLabel={td('record.text.label')}
                multiline
                onChangeText={setAnswer}
                placeholder={td('record.text.placeholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                textAlignVertical="top"
                value={answer}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setMode('audio')}
              style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}
            >
              <Ionicons name="mic-outline" size={18} color={colors.text} />
              <Text style={styles.switchLabel}>{td('record.audio.toAudio')}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          icon={
            mode === 'audio' ? (
              <Ionicons name="square" size={16} color={colors.white} />
            ) : undefined
          }
          label={mode === 'audio' ? td('record.audio.stopSave') : td('record.save')}
          onPress={() => router.replace('/record/saved')}
          style={mode === 'audio' ? styles.stopButton : undefined}
        />
        <Text style={styles.offline}>{td('record.offlineNote')}</Text>
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
  recorder: {
    alignItems: 'center',
    gap: spacing.xxl,
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D92D20',
  },
  recordingLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: '#9B1C1C',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  timer: {
    fontFamily: fonts.mono,
    fontSize: 44,
    lineHeight: 48,
    color: colors.text,
  },
  timerTotal: {
    fontFamily: fonts.mono,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
  wave: {
    width: '100%',
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },
  bar: {
    flex: 1,
    minWidth: 0,
    borderRadius: 3,
  },
  barRecorded: {
    backgroundColor: colors.primary,
  },
  barIdle: {
    backgroundColor: colors.divider,
  },
  limit: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
  },
  switchButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  switchLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    minHeight: 330,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#858EA1',
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  stopButton: {
    backgroundColor: '#9B1C1C',
  },
  offline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.75,
  },
});
