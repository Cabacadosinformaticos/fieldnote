import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { RecordHeader } from '@/components/daily/RecordHeader';
import { ScaleFace } from '@/components/daily/ScaleFace';
import { ScaleSlider } from '@/components/daily/ScaleSlider';
import { td } from '@/i18n/td';
import { useCachedActivity } from '@/queue/hooks';
import {
  faceLabels,
  faceLevel,
  scaleOptions,
  scaleShownFor,
} from '@/queue/scale';
import { saveEntry } from '@/queue/save';
import { colors, fonts, radii, spacing } from '@/theme';

function faceFallbacks(count: number): string[] {
  if (count === 3) {
    return [td('scale.low'), td('scale.face.neutral'), td('scale.high')];
  }
  return [
    td('scale.low'),
    td('scale.face.bad'),
    td('scale.face.neutral'),
    td('scale.face.good'),
    td('scale.high'),
  ];
}

export default function ScaleRecordScreen() {
  const { activityId, promptId } = useLocalSearchParams<{
    activityId: string;
    promptId?: string;
  }>();
  const { activity, loading } = useCachedActivity(activityId, promptId);
  const [selected, setSelected] = useState<number | null>(null);
  const [sliderValue, setSliderValue] = useState(50);
  const [sliderTouched, setSliderTouched] = useState(false);
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

  const scale = activity.scale;
  if (!scale || !activity.captureTypes.includes('scale')) {
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

  const options = scaleOptions(scale);
  const count = options.length;
  const activityFaceLabels = faceLabels(scale);
  const fallbacks = faceFallbacks(count);
  const displayFaceLabels = activityFaceLabels.map(
    (label, index) => label || fallbacks[index] || '',
  );
  const labels = scale.type === 'faces' ? displayFaceLabels : [];
  // The slider thumb starts in the middle, but that is only a position: until the participant
  // moves it the answer is still empty and Save stays disabled.
  const value =
    scale.type === 'slider' ? (sliderTouched ? sliderValue : null) : selected;

  const save = async () => {
    if (saving || value === null) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entryId = await saveEntry({
        activity,
        type: 'scale',
        value,
        scaleShown: scaleShownFor(scale, labels),
      });
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
        <Text style={styles.question}>
          {activity.instructions || td('record.noInstructions')}
        </Text>

        {scale.type === 'slider' ? (
          <ScaleSlider
            endLabel={scale.endLabel}
            onChange={(next) => {
              setSliderValue(next);
              setSliderTouched(true);
            }}
            startLabel={scale.startLabel}
            value={sliderValue}
          />
        ) : (
          <View
            accessibilityLabel={td('scale.group', { count })}
            accessibilityRole="radiogroup"
            style={styles.options}
          >
            {options.map((option, index) => {
              const isSelected = value === option.value;
              const label =
                scale.type === 'faces'
                  ? displayFaceLabels[index] || ''
                  : option.label;

              if (scale.type === 'faces') {
                return (
                  <Pressable
                    accessibilityLabel={
                      label
                        ? td('scale.optionLabel', {
                            value: option.value,
                            label,
                          })
                        : String(option.value)
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={option.value}
                    onPress={() => setSelected(option.value)}
                    style={({ pressed }) => [
                      styles.faceOption,
                      isSelected && styles.optionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ScaleFace
                      color={isSelected ? colors.white : colors.text}
                      level={faceLevel(index, count)}
                    />
                    <Text
                      style={[styles.faceText, isSelected && styles.selectedText]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              }

              return (
                <Pressable
                  accessibilityLabel={
                    label
                      ? td('scale.optionLabel', {
                          value: option.value,
                          label,
                        })
                      : String(option.value)
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  key={option.value}
                  onPress={() => setSelected(option.value)}
                  style={({ pressed }) => [
                    styles.numberOption,
                    isSelected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.number, isSelected && styles.selectedText]}>
                    {option.value}
                  </Text>
                  {label ? (
                    <Text
                      style={[styles.optionText, isSelected && styles.selectedText]}
                    >
                      {label}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          disabled={value === null || saving}
          labelSize={17}
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
    gap: spacing.xxl,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
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
  pressed: {
    opacity: 0.75,
  },
});
