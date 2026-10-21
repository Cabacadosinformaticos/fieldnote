import { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { colors, fonts, radii } from '@/theme';

export const TIME_SLOTS = 48;

const ROW_HEIGHT = 48;
const WHEEL_HEIGHT = ROW_HEIGHT * 5;
const PADDING = ROW_HEIGHT * 2;

const TIMES = Array.from({ length: TIME_SLOTS }, (_, index) =>
  formatTime(index),
);

export function formatTime(index: number): string {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
}

function clampIndex(value: number): number {
  return Math.max(0, Math.min(TIME_SLOTS - 1, Math.round(value / ROW_HEIGHT)));
}

type TimeWheelProps = {
  value: number;
  onChange: (index: number) => void;
  accessibilityLabel: string;
};

export function TimeWheel({ value, onChange, accessibilityLabel }: TimeWheelProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [current, setCurrent] = useState(value);

  const handleLayout = () => {
    scrollRef.current?.scrollTo({ y: value * ROW_HEIGHT, animated: false });
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = clampIndex(event.nativeEvent.contentOffset.y);
    if (next !== current) {
      setCurrent(next);
    }
  };

  const handleSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = clampIndex(event.nativeEvent.contentOffset.y);
    setCurrent(next);
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.highlight} />
      <ScrollView
        ref={scrollRef}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: TIMES[current] }}
        contentContainerStyle={styles.content}
        contentOffset={{ x: 0, y: value * ROW_HEIGHT }}
        decelerationRate="fast"
        onLayout={handleLayout}
        onMomentumScrollEnd={handleSettle}
        onScroll={handleScroll}
        onScrollEndDrag={handleSettle}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={ROW_HEIGHT}
        style={styles.scroll}
      >
        {TIMES.map((time, index) => {
          const distance = Math.abs(index - current);
          return (
            <View key={time} style={styles.row}>
              <Text
                style={[
                  styles.time,
                  distance === 0 && styles.timeSelected,
                  distance === 1 && styles.timeNear,
                  distance >= 2 && styles.timeFar,
                ]}
              >
                {time}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: WHEEL_HEIGHT,
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: PADDING,
    height: ROW_HEIGHT,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: PADDING,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
    opacity: 0.35,
    fontVariant: ['tabular-nums'],
  },
  timeSelected: {
    fontFamily: fonts.extrabold,
    fontSize: 32,
    lineHeight: 38,
    color: colors.text,
    opacity: 1,
  },
  timeNear: {
    fontSize: 22,
    lineHeight: 28,
    opacity: 0.65,
  },
  timeFar: {
    opacity: 0.35,
  },
});
