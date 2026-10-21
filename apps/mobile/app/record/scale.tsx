import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { ScaleFace } from '@/components/daily/ScaleFace';
import { dailyActivities, getActivity, type ScaleKind } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function numberPoints(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 7;
  }
  return Math.min(11, Math.max(2, Math.trunc(value)));
}

export default function ScaleRecordScreen() {
  const params = useLocalSearchParams<{
    activityId?: string;
    kind?: string;
    points?: string;
    low?: string;
    high?: string;
    mid?: string;
  }>();

  const activity = getActivity(params.activityId) ?? dailyActivities[0];
  const scale = activity.scale;

  const kindParam = first(params.kind);
  const kind: ScaleKind =
    kindParam === 'faces' || kindParam === 'numbers'
      ? kindParam
      : (scale?.kind ?? 'numbers');

  const requestedPoints = Number(first(params.points) ?? scale?.points ?? (kind === 'faces' ? 5 : 7));
  const count = kind === 'faces' ? (requestedPoints === 3 ? 3 : 5) : numberPoints(requestedPoints);

  const lowLabel =
    first(params.low) ?? (scale ? td(scale.lowKey) : td('scale.low'));
  const highLabel =
    first(params.high) ?? (scale ? td(scale.highKey) : td('scale.high'));
  const midLabel = first(params.mid) ?? (scale?.midKey ? td(scale.midKey) : undefined);

  const [value, setValue] = useState(() => Math.round((count + 1) / 2));

  const question = scale
    ? td(activity.instructionKey)
    : kind === 'faces'
      ? td('activity.moodFaces.instruction')
      : td('activity.mood.instruction');

  const title = scale ? td(activity.titleKey) : td('activity.mood.title');

  const options = Array.from({ length: count }, (_, index) => index + 1);
  const middle = Math.ceil(count / 2);

  const faceLevels = count === 3 ? [0, 2, 4] : [0, 1, 2, 3, 4];
  const faceLabels =
    count === 3
      ? [lowLabel, midLabel ?? td('scale.face.neutral'), highLabel]
      : [
          lowLabel,
          td('scale.face.bad'),
          td('scale.face.neutral'),
          td('scale.face.good'),
          highLabel,
        ];

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <RecordHeader eyebrow={td(activity.contextKey)} title={title} />

      <View style={styles.body}>
        <Text style={styles.question}>{question}</Text>

        <View
          accessibilityLabel={td('scale.group', { count })}
          accessibilityRole="radiogroup"
          style={styles.options}
        >
          {options.map((option, index) => {
            const selected = option === value;

            if (kind === 'faces') {
              const label = faceLabels[index] ?? '';

              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option}
                  onPress={() => setValue(option)}
                  style={({ pressed }) => [
                    styles.faceOption,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <ScaleFace
                    color={selected ? colors.white : colors.text}
                    level={faceLevels[index] ?? 2}
                  />
                  <Text
                    style={[styles.faceText, selected && styles.selectedText]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            }

            const label =
              option === 1
                ? lowLabel
                : option === count
                  ? highLabel
                  : count % 2 === 1 && option === middle && midLabel
                    ? midLabel
                    : '';

            return (
              <Pressable
                accessibilityLabel={
                  label
                    ? td('scale.optionLabel', { value: option, label })
                    : String(option)
                }
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option}
                onPress={() => setValue(option)}
                style={({ pressed }) => [
                  styles.numberOption,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.number, selected && styles.selectedText]}>
                  {option}
                </Text>
                {label ? (
                  <Text
                    style={[styles.optionText, selected && styles.selectedText]}
                  >
                    {label}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
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
    gap: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  question: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.text,
  },
  options: {
    gap: 10,
  },
  numberOption: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  faceOption: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primary,
  },
  number: {
    width: 32,
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
  },
  faceText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  selectedText: {
    color: colors.white,
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
