import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

const BOX_COUNT = 6;

type CodeInputProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function CodeInput({ label, onChange, value }: CodeInputProps) {
  const activeIndex = Math.min(value.length, BOX_COUNT - 1);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.boxRow}>
        {Array.from({ length: BOX_COUNT }, (_, index) => (
          <View
            key={index}
            style={[styles.box, index === activeIndex && styles.boxActive]}
          >
            <Text style={styles.digit}>{value.charAt(index)}</Text>
          </View>
        ))}
        <TextInput
          accessibilityLabel={label}
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={BOX_COUNT}
          onChangeText={(text) =>
            onChange(text.replace(/[^0-9]/g, '').slice(0, BOX_COUNT))
          }
          style={styles.input}
          textContentType="oneTimeCode"
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  boxRow: {
    position: 'relative',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    height: 64,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  boxActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  digit: {
    fontFamily: fonts.mono,
    fontSize: 28,
    lineHeight: 34,
    color: '#131A2A',
  },
  input: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 16,
  },
});
