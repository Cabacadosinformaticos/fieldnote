import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { CaptureTypeTabs } from '@/components/daily/CaptureTypeTabs';
import { InstructionCard } from '@/components/daily/InstructionCard';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import { saveEntry } from '@/queue/save';
import { colors, fonts, radii, spacing } from '@/theme';

export default function TextRecordScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const { activity, loading } = useCachedActivity(activityId);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!activity.captureTypes.includes('text')) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <RecordHeader eyebrow={activity.studyTitle} title={activity.title} />
        <View style={styles.body}>
          <Text style={styles.message}>{td('record.typeUnavailable')}</Text>
        </View>
      </Screen>
    );
  }

  const save = async () => {
    if (saving || !answer.trim()) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({ activity, type: 'text', body: answer });
      router.replace({ pathname: '/record/saved', params: { id: entryId } });
    } catch {
      setError(td('record.saveError'));
      setSaving(false);
    }
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

        <CaptureTypeTabs
          active="text"
          activityId={activity.id}
          types={activity.captureTypes}
        />

        <View style={styles.field}>
          <Text style={styles.label}>{td('record.text.label')}</Text>
          <TextInput
            accessibilityLabel={td('record.text.label')}
            maxLength={100000}
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          disabled={!answer.trim() || saving}
          label={saving ? td('record.saving') : td('record.save')}
          onPress={() => {
            void save();
          }}
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
  error: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  offline: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
