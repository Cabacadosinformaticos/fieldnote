import { useCallback, useMemo, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

type ScaleSliderProps = {
  value: number;
  startLabel: string | null;
  endLabel: string | null;
  onChange: (value: number) => void;
};

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function ScaleSlider({
  value,
  startLabel,
  endLabel,
  onChange,
}: ScaleSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);

  const update = useCallback(
    (position: number) => {
      if (trackWidth <= 0) {
        return;
      }
      onChange(clamp(Math.round((position / trackWidth) * 100)));
    },
    [onChange, trackWidth],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => update(event.nativeEvent.locationX),
        onPanResponderMove: (event) => update(event.nativeEvent.locationX),
        onPanResponderTerminationRequest: () => false,
      }),
    [update],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') {
      onChange(clamp(value + 5));
    } else if (event.nativeEvent.actionName === 'decrement') {
      onChange(clamp(value - 5));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.value}>{td('scale.sliderLabel', { value })}</Text>
      <View style={styles.paddedTrack}>
        <View
          accessibilityActions={[
            { name: 'increment', label: td('scale.high') },
            { name: 'decrement', label: td('scale.low') },
          ]}
          accessibilityLabel={td('scale.sliderGroup')}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: 100, now: value }}
          onAccessibilityAction={handleAccessibilityAction}
          onLayout={handleLayout}
          style={styles.touch}
          {...panResponder.panHandlers}
        >
          <View pointerEvents="none" style={styles.track}>
            <View style={[styles.fill, { width: `${value}%` }]} />
          </View>
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: `${value}%` }]}
          />
        </View>
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{startLabel ?? ''}</Text>
        <Text style={[styles.label, styles.labelEnd]}>{endLabel ?? ''}</Text>
      </View>
      <Text style={styles.hint}>{td('scale.sliderHint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  value: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    color: colors.primaryDark,
  },
  paddedTrack: {
    paddingHorizontal: 12,
  },
  touch: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    overflow: 'hidden',
    borderRadius: radii.pill,
    backgroundColor: colors.border,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.primaryDark,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  labelEnd: {
    textAlign: 'right',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
