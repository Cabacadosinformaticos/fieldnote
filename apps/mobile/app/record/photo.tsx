import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { CaptureTypeTabs } from '@/components/daily/CaptureTypeTabs';
import { GardenScene } from '@/components/daily/GardenScene';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { dailyActivities, getActivity } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const CAPTURE_TIME = '14:26';

export default function PhotoRecordScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = getActivity(activityId) ?? dailyActivities[0];
  const [captured, setCaptured] = useState(true);
  const [note, setNote] = useState('');

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={td(activity.contextKey)} title={td(activity.titleKey)} />

      <View style={styles.body}>
        <InstructionCard
          instruction={td(activity.instructionKey)}
          warnings={activity.warnings}
        />

        <CaptureTypeTabs
          active="photo"
          activityId={activity.id}
          types={activity.captureTypes}
        />

        {captured ? (
          <View style={styles.preview}>
            <GardenScene height={280} label={td('entry.photoLabel')} />
            <View style={styles.capturedBadge}>
              <Ionicons name="time-outline" size={14} color={colors.white} />
              <Text style={styles.capturedBadgeText}>
                {td('record.photo.capturedAt', { time: CAPTURE_TIME })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCaptured(false)}
              style={({ pressed }) => [styles.retake, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={16} color={colors.text} />
              <Text style={styles.retakeLabel}>{td('record.photo.retake')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.camera}>
            <Ionicons name="camera-outline" size={40} color={colors.scanTextMuted} />
            <Text style={styles.cameraLabel}>{td('record.photo.cameraPlaceholder')}</Text>
            <Pressable
              accessibilityLabel={td('record.photo.shutter')}
              accessibilityRole="button"
              onPress={() => setCaptured(true)}
              style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
            >
              <Ionicons name="camera" size={28} color={colors.text} />
            </Pressable>
          </View>
        )}

        {captured ? (
          <View style={styles.field}>
            <Text style={styles.label}>
              {td('record.photo.noteLabel')}{' '}
              <Text style={styles.optional}>{td('record.photo.noteOptional')}</Text>
            </Text>
            <TextInput
              accessibilityLabel={td('record.photo.noteLabel')}
              multiline
              onChangeText={setNote}
              placeholder={td('record.photo.notePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              textAlignVertical="top"
              value={note}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
          disabled={!captured}
          label={td('record.save')}
          onPress={() => router.replace('/record/saved')}
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
  preview: {
    position: 'relative',
  },
  capturedBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(27, 36, 54, 0.78)',
  },
  capturedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  retake: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  retakeLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  camera: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.scanBackground,
  },
  cameraLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.scanTextMuted,
  },
  shutter: {
    position: 'absolute',
    bottom: spacing.lg,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: colors.surface,
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
  optional: {
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  input: {
    minHeight: 80,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#858EA1',
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
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
