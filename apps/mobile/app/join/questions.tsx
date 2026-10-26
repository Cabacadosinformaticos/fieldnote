import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { components } from '@/api/schema';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceChip } from '@/components/join/ChoiceChip';
import { StepProgress } from '@/components/join/StepProgress';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/pt';
import { tj } from '@/i18n/tj';
import { useJoinSession, type StudyAnswer } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type StudyQuestion = components['schemas']['StudyQuestionOut'];
type QuestionAnswer = string | string[];

function hintFor(question: StudyQuestion): string {
  switch (question.kind) {
    case 'single_choice':
      return tj('questions.hintSingle');
    case 'multiple_choice':
      return tj('questions.hintMultiple');
    case 'yes_no':
      return tj('questions.hintYesNo');
    case 'short_text':
      return tj('questions.hintShort');
  }
}

function isAnswered(value: QuestionAnswer | undefined): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === 'string' && value.trim().length > 0;
}

export default function QuestionsScreen() {
  const { lookup, setAnswers } = useJoinSession();
  const [answers, setLocalAnswers] = useState<Record<string, QuestionAnswer>>({});
  const questions = lookup?.questions ?? [];

  useEffect(() => {
    if (!lookup) {
      router.replace('/join/code');
    }
  }, [lookup]);

  const choose = (questionId: string, value: string) => {
    setLocalAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const toggle = (questionId: string, option: string) => {
    setLocalAnswers((current) => {
      const selected = Array.isArray(current[questionId])
        ? (current[questionId] as string[])
        : [];
      const next = selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option];

      return { ...current, [questionId]: next };
    });
  };

  const write = (questionId: string, value: string) => {
    setLocalAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const answered = questions.filter((question) =>
    isAnswered(answers[question.id]),
  ).length;

  const continueToHours = () => {
    const prepared: StudyAnswer[] = [];

    for (const question of questions) {
      const value = answers[question.id];

      if (Array.isArray(value)) {
        if (value.length > 0) {
          prepared.push({ question_id: question.id, answer: value });
        }
        continue;
      }

      if (typeof value === 'string' && value.trim().length > 0) {
        prepared.push({ question_id: question.id, answer: value.trim() });
      }
    }

    setAnswers(prepared);
    router.push('/join/availability');
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
        <Text style={styles.study}>
          {tj('questions.study', { title: lookup?.study.title ?? '' })}
        </Text>
      </View>

      <Text style={styles.body}>{tj('questions.body')}</Text>

      <Text style={styles.count}>
        {tj('questions.count', { answered, total: questions.length })}
      </Text>

      {questions.map((question) => (
        <Card key={question.id} style={styles.card}>
          <View style={styles.question}>
            <Text style={styles.questionTitle}>{question.text}</Text>
            <Text style={styles.hint}>{hintFor(question)}</Text>
          </View>

          {question.kind === 'yes_no' ? (
            <View style={styles.pairedOptions}>
              {(['yes', 'no'] as const).map((value) => (
                <ChoiceChip
                  key={value}
                  label={tj(value === 'yes' ? 'questions.yes' : 'questions.no')}
                  onPress={() => choose(question.id, value)}
                  selected={answers[question.id] === value}
                  style={styles.pairedChip}
                />
              ))}
            </View>
          ) : null}

          {question.kind === 'single_choice' ? (
            <View style={styles.options}>
              {question.options.map((option) => (
                <ChoiceChip
                  key={option}
                  label={option}
                  onPress={() => choose(question.id, option)}
                  selected={answers[question.id] === option}
                />
              ))}
            </View>
          ) : null}

          {question.kind === 'multiple_choice' ? (
            <View style={styles.options}>
              {question.options.map((option) => {
                const selected = Array.isArray(answers[question.id])
                  ? (answers[question.id] as string[]).includes(option)
                  : false;

                return (
                  <ChoiceChip
                    key={option}
                    label={option}
                    onPress={() => toggle(question.id, option)}
                    role="checkbox"
                    selected={selected}
                  />
                );
              })}
            </View>
          ) : null}

          {question.kind === 'short_text' ? (
            <TextInput
              accessibilityLabel={question.text}
              autoCapitalize="sentences"
              maxLength={300}
              multiline
              onChangeText={(value) => write(question.id, value)}
              placeholder={tj('questions.shortPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.textInput}
              value={typeof answers[question.id] === 'string' ? (answers[question.id] as string) : ''}
            />
          ) : null}
        </Card>
      ))}

      <Text style={styles.note}>{tj('questions.optionalNote')}</Text>

      <View style={styles.spacer} />

      <Button label={t('common.continue')} onPress={continueToHours} />
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
  textInput: {
    minHeight: 96,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
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
