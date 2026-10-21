import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Sparkle = {
  top: number;
  left: number;
  size: number;
  color: string;
  round: boolean;
  rotation: number;
};

const SPARKLES: Sparkle[] = [
  { top: 34, left: 36, size: 10, color: colors.primary, round: false, rotation: 24 },
  { top: 10, left: 78, size: 10, color: colors.accent, round: true, rotation: 0 },
  { top: 6, left: 112, size: 10, color: colors.successText, round: false, rotation: -18 },
  { top: 10, left: 168, size: 10, color: colors.accent, round: false, rotation: 32 },
  { top: 26, left: 212, size: 10, color: colors.primary, round: true, rotation: 0 },
  { top: 51, left: 240, size: 10, color: '#F5D38A', round: false, rotation: -26 },
  { top: 92, left: 14, size: 10, color: '#F5D38A', round: true, rotation: 0 },
  { top: 118, left: 32, size: 9, color: colors.accent, round: false, rotation: 40 },
  { top: 168, left: 58, size: 10, color: colors.successText, round: true, rotation: 0 },
  { top: 184, left: 90, size: 9, color: colors.primary, round: false, rotation: -34 },
  { top: 192, left: 150, size: 10, color: colors.primaryDark, round: true, rotation: 0 },
  { top: 174, left: 192, size: 9, color: colors.successText, round: false, rotation: 16 },
  { top: 152, left: 230, size: 9, color: colors.primary, round: false, rotation: -28 },
  { top: 112, left: 262, size: 10, color: colors.accent, round: true, rotation: 0 },
  { top: 68, left: 20, size: 8, color: colors.primaryDark, round: false, rotation: 22 },
  { top: 78, left: 250, size: 8, color: colors.successText, round: false, rotation: -12 },
  { top: 64, left: 198, size: 8, color: colors.primaryDark, round: true, rotation: 0 },
  { top: 60, left: 84, size: 8, color: colors.successText, round: true, rotation: 0 },
  { top: 100, left: 56, size: 7, color: colors.primaryDark, round: false, rotation: 30 },
  { top: 152, left: 218, size: 7, color: colors.accent, round: false, rotation: -20 },
];

export function Sparkles() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {SPARKLES.map((sparkle, index) => (
        <View
          key={`${sparkle.top}-${sparkle.left}-${index}`}
          style={{
            position: 'absolute',
            top: sparkle.top,
            left: sparkle.left,
            width: sparkle.size,
            height: sparkle.size,
            borderRadius: sparkle.round ? sparkle.size / 2 : 2,
            backgroundColor: sparkle.color,
            transform: [{ rotate: `${sparkle.rotation}deg` }],
          }}
        />
      ))}
    </View>
  );
}
