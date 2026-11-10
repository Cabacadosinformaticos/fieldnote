import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type LogoMarkProps = {
  /** 1 is the 30 by 34 mark of the welcome screen. */
  scale?: number;
};

export function LogoMark({ scale = 1 }: LogoMarkProps) {
  const s = (value: number) => value * scale;

  return (
    <View
      style={[
        styles.logo,
        { width: s(30), height: s(34), borderRadius: s(5) },
      ]}
    >
      <View style={[styles.spine, { width: s(6) }]} />
      <View
        style={[
          styles.line,
          { left: s(11), top: s(10), width: s(15), height: s(2.5), borderRadius: s(2) },
        ]}
      />
      <View
        style={[
          styles.line,
          { left: s(11), top: s(17), width: s(11), height: s(2.5), borderRadius: s(2) },
        ]}
      />
      <View
        style={[
          styles.pin,
          { right: s(3), bottom: s(3), width: s(11), height: s(11), borderRadius: s(6) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primaryDark,
  },
  line: {
    position: 'absolute',
    backgroundColor: colors.white,
    opacity: 0.85,
  },
  pin: {
    position: 'absolute',
    backgroundColor: colors.accent,
  },
});
