import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { WarningId } from '@/fake/daily';
import { td, type DailyTranslationKey } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type WarningContent = {
  icon: IoniconName;
  titleKey: DailyTranslationKey;
  bodyKey?: DailyTranslationKey;
};

const warningContent: Record<WarningId, WarningContent> = {
  privacy: {
    icon: 'shield-checkmark-outline',
    titleKey: 'warning.privacy',
  },
  locationOn: {
    icon: 'location-outline',
    titleKey: 'warning.locationOnTitle',
    bodyKey: 'warning.locationOnBody',
  },
  locationOff: {
    icon: 'location-outline',
    titleKey: 'warning.locationOffTitle',
    bodyKey: 'warning.locationOffBody',
  },
};

type WarningSheetProps = {
  visible: boolean;
  warnings: WarningId[];
  onClose: () => void;
};

export function WarningSheet({ visible, warnings, onClose }: WarningSheetProps) {
  const title =
    warnings.length === 1
      ? td('warning.countOne')
      : td('warning.count', { count: warnings.length });

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={td('warning.dismiss')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.items}>
            {warnings.map((warning) => {
              const content = warningContent[warning];

              return (
                <View key={warning} style={styles.item}>
                  <View style={styles.itemIcon}>
                    <Ionicons name={content.icon} size={20} color={colors.primaryDark} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle}>{td(content.titleKey)}</Text>
                    {content.bodyKey ? (
                      <Text style={styles.itemBody}>{td(content.bodyKey)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
          >
            <Text style={styles.dismissLabel}>{td('warning.dismiss')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.overlay,
  },
  sheet: {
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  items: {
    gap: spacing.lg,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  itemIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  itemText: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: 1,
  },
  itemTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  itemBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  dismiss: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  dismissLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
  },
  pressed: {
    opacity: 0.82,
  },
});
