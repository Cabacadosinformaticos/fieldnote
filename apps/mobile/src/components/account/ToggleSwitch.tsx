import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type ToggleSwitchProps = {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
};

export function ToggleSwitch({ label, onChange, value }: ToggleSwitchProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.button}
    >
      <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    width: 56,
    height: 32,
    borderRadius: 16,
  },
  trackOn: {
    backgroundColor: colors.primary,
  },
  trackOff: {
    backgroundColor: '#8A93A8',
  },
  knob: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  knobOn: {
    left: 28,
  },
});
