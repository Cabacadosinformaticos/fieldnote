import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n/pt';
import { colors, fonts, radii } from '@/theme';

export function LanguageToggle() {
  return (
    <View accessibilityLabel={t('welcome.language')} style={styles.container}>
      <Pressable
        accessibilityLabel={t('welcome.portuguese')}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        style={[styles.option, styles.optionActive]}
      >
        <Text style={[styles.label, styles.labelActive]}>PT</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t('welcome.english')}
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  option: {
    height: 48,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: colors.text,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.white,
  },
});
