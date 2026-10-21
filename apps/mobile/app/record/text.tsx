import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { CaptureTypeTabs } from '@/components/daily/CaptureTypeTabs';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { dailyActivities, getActivity } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

export default function TextRecordScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const activity = getActivity(activityId) ?? dailyActivities[0];
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

        <CaptureTypeTabs
          active="text"
          activityId={activity.id}
          types={activity.captureTypes}
        />

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
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Button
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
    minHeight: 280,
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
  offline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
