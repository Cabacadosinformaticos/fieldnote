import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { dailyWaitingCount } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

export function SyncStatus() {
  const [open, setOpen] = useState(false);
  const waiting = dailyWaitingCount > 0;

  return (
    <>
      <Pressable
        accessibilityHint={td('today.syncOpenHint')}
        accessibilityLabel={
          waiting
            ? td('today.syncWaiting', { count: dailyWaitingCount })
            : td('today.syncSent')
        }
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          waiting ? styles.buttonWaiting : styles.buttonSent,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={waiting ? 'cloud-offline-outline' : 'cloud-done-outline'}
          size={24}
          color={waiting ? waitingColors.text : colors.successText}
        />
        {waiting ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{dailyWaitingCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={td('sync.close')}
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetIcon,
                  waiting ? styles.sheetIconWaiting : styles.sheetIconSent,
                ]}
              >
                <Ionicons
                  name={waiting ? 'cloud-offline-outline' : 'cloud-done-outline'}
                  size={24}
                  color={waiting ? waitingColors.text : colors.successText}
                />
              </View>
              <Text style={styles.sheetTitle}>
                {waiting ? td('sync.waitingTitle') : td('sync.sentTitle')}
              </Text>
            </View>

            <Text style={styles.sheetBody}>
              {waiting
                ? td('sync.waitingBody', { count: dailyWaitingCount })
                : td('sync.sentBody')}
            </Text>

            {waiting ? (
              <Text style={styles.sheetWarning}>{td('sync.waitingNote')}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Text style={styles.closeLabel}>{td('sync.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  buttonSent: {
    backgroundColor: colors.successBackground,
  },
  buttonWaiting: {
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
  },
  pressed: {
    opacity: 0.75,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
    color: '#131A2A',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.overlay,
  },
  sheet: {
    gap: 14,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sheetIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  sheetIconSent: {
    backgroundColor: colors.successBackground,
  },
  sheetIconWaiting: {
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
  },
  sheetTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  sheetBody: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  sheetWarning: {
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: waitingColors.border,
    backgroundColor: waitingColors.background,
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: waitingColors.text,
  },
  close: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
});
