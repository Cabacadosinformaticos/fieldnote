import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { t } from '@/i18n/pt';
import { colors } from '@/theme';

type BackButtonProps = {
  onPress: () => void;
  onDark?: boolean;
};

export function BackButton({ onPress, onDark = false }: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={t('common.back')}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        onDark ? styles.onDark : styles.onLight,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="chevron-back"
        size={22}
        color={onDark ? colors.white : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
  },
  onLight: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  onDark: {
    backgroundColor: 'transparent',
    borderColor: colors.scanOutline,
  },
  pressed: {
    opacity: 0.7,
  },
});
