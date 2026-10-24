import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

type SelectSheetProps = {
  hint?: string;
  onClose: () => void;
  onSelect: (option: string) => void;
  options: readonly string[];
  selected?: string;
  title: string;
  visible: boolean;
};

export function SelectSheet({
  hint,
  onClose,
  onSelect,
  options,
  selected,
  title,
  visible,
}: SelectSheetProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={ta('common.cancel')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <ScrollView
            contentContainerStyle={styles.options}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => {
              const active = option === selected;

              return (
                <Pressable
                  key={option}
                  accessibilityLabel={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => onSelect(option)}
                  style={({ pressed }) => [
                    styles.option,
                    active && styles.optionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.ring, active && styles.ringActive]}>
                    <View style={[styles.dot, active && styles.dotActive]} />
                  </View>
                  <Text
                    style={[styles.optionLabel, active && styles.optionLabelActive]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelLabel}>{ta('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(19, 26, 42, 0.55)',
  },
  card: {
    maxHeight: '76%',
    overflow: 'hidden',
    borderRadius: radii.card,
    paddingTop: 22,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  title: {
    paddingHorizontal: spacing.xxl,
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  hint: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  options: {
    paddingTop: spacing.sm,
  },
  option: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  optionActive: {
    backgroundColor: '#F4F7FF',
  },
  pressed: {
    opacity: 0.75,
  },
  ring: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#8A93A8',
  },
  ringActive: {
    borderColor: colors.primary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  optionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  optionLabelActive: {
    fontFamily: fonts.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  cancel: {
    minWidth: 88,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
});
