import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

type SelectSheetProps = {
  hint?: string;
  onClose: () => void;
  onSelect: (option: string) => void;
  options: readonly string[];
  searchable?: boolean;
  selected?: string;
  title: string;
  visible: boolean;
};

function searchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 ]/g, '');
}

export function SelectSheet({
  hint,
  onClose,
  onSelect,
  options,
  searchable = false,
  selected,
  title,
  visible,
}: SelectSheetProps) {
  const [query, setQuery] = useState('');

  const close = () => {
    setQuery('');
    onClose();
  };

  const select = (option: string) => {
    setQuery('');
    onSelect(option);
  };

  const needle = searchKey(query.trim());
  const shownOptions = needle
    ? options.filter((option) => searchKey(option).includes(needle))
    : options;

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={ta('common.cancel')}
          accessibilityRole="button"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {searchable ? (
            <View style={styles.searchRow}>
              <TextInput
                accessibilityLabel={ta('common.search')}
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={ta('common.search')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                value={query}
              />
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.options}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {shownOptions.map((option) => {
              const active = option === selected;

              return (
                <Pressable
                  key={option}
                  accessibilityLabel={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => select(option)}
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
              onPress={close}
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
  searchRow: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xs,
  },
  searchInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
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
