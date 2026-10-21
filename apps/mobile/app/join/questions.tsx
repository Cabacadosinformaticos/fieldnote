import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChip } from '@/components/join/ChoiceChip';
import { StepProgress } from '@/components/join/StepProgress';
import { Screen } from '@/components/Screen';
import type { JoinKey } from '@/i18n/join';
import { t } from '@/i18n/pt';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type QuestionOption = {
  id: string;
  label: JoinKey;
};

const FREQUENCY_OPTIONS: QuestionOption[] = [
  { id: 'daily', label: 'questions.q1.daily' },
  { id: 'weekly', label: 'questions.q1.weekly' },
  { id: 'monthly', label: 'questions.q1.monthly' },
  { id: 'rarely', label: 'questions.q1.rarely' },
];

const TRANSPORT_OPTIONS: QuestionOption[] = [
  { id: 'walk', label: 'questions.q2.walk' },
  { id: 'transit', label: 'questions.q2.transit' },
  { id: 'bike', label: 'questions.q2.bike' },
  { id: 'car', label: 'questions.q2.car' },
];

const NEARBY_OPTIONS: QuestionOption[] = [
  { id: 'yes', label: 'questions.q3.yes' },
  { id: 'no', label: 'questions.q3.no' },
];

export default function QuestionsScreen() {
  const [frequency, setFrequency] = useState<string | null>('weekly');
  const [transport, setTransport] = useState<string[]>(['walk', 'transit']);
  const [nearby, setNearby] = useState<string | null>(null);

  const answered =
    (frequency ? 1 : 0) + (transport.length > 0 ? 1 : 0) + (nearby ? 1 : 0);

  const toggleTransport = (id: string) => {
    setTransport((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <StepProgress filled={2} label={tj('questions.step')} />

      <View style={styles.intro}>
        <Text style={typography.title}>{tj('questions.title')}</Text>
        <Text style={styles.study}>{tj('questions.study')}</Text>
      </View>

      <Text style={styles.body}>{tj('questions.body')}</Text>

      <Text style={styles.count}>
        {tj('questions.count', { answered, total: 3 })}
      </Text>

      <Card style={styles.card}>
        <View style={styles.question}>
          <Text style={styles.questionTitle}>{tj('questions.q1.title')}</Text>
          <Text style={styles.hint}>{tj('questions.q1.hint')}</Text>
        </View>
        <View style={styles.options}>
          {FREQUENCY_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              label={tj(option.label)}
              onPress={() => setFrequency(option.id)}
              selected={frequency === option.id}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.question}>
          <Text style={styles.questionTitle}>{tj('questions.q2.title')}</Text>
          <Text style={styles.hint}>{tj('questions.q2.hint')}</Text>
        </View>
        <View style={styles.options}>
          {TRANSPORT_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              label={tj(option.label)}
              onPress={() => toggleTransport(option.id)}
              role="checkbox"
              selected={transport.includes(option.id)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.question}>
          <Text style={styles.questionTitle}>{tj('questions.q3.title')}</Text>
          <Text style={styles.hint}>{tj('questions.q3.hint')}</Text>
        </View>
        <View style={styles.pairedOptions}>
          {NEARBY_OPTIONS.map((option) => (
            <ChoiceChip
              key={option.id}
              label={tj(option.label)}
              onPress={() => setNearby(option.id)}
              selected={nearby === option.id}
              style={styles.pairedChip}
            />
          ))}
        </View>
      </Card>

      <Text style={styles.note}>{tj('questions.optionalNote')}</Text>

      <View style={styles.spacer} />

      <Button
        label={t('common.continue')}
        onPress={() => router.push('/join/availability')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  intro: {
    gap: 4,
  },
  study: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  count: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
  },
  card: {
    gap: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  question: {
    gap: 2,
  },
  questionTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pairedOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pairedChip: {
    flex: 1,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
});
