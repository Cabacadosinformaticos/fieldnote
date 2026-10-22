import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tm } from '@/i18n/tm';
import { colors, fonts, radii } from '@/theme';

export function LanguageToggle() {
  return (
    <View accessibilityLabel={tm('settings.language')} style={styles.container}>
      <Pressable
        accessibilityLabel={tm('language.portuguese')}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        style={[styles.option, styles.optionActive]}
      >
        <Text style={[styles.label, styles.labelActive]}>PT</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={tm('language.english')}
        accessibilityRole="button"
        accessibilityState={{ selected: false, disabled: true }}
        disabled
        style={styles.option}
      >
        <Text style={styles.label}>EN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: radii.lg,
    padding: 4,
    backgroundColor: colors.divider,
  },
  option: {
    width: 64,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primaryDark,
  },
});
