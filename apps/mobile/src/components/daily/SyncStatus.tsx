import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { td } from '@/i18n/td';
import { useOutboxSummary } from '@/queue/hooks';
import { retryOutbox } from '@/queue/sender';
import { colors, fonts, radii, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

export function SyncStatus() {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { waiting, failed } = useOutboxSummary();
  const attention = failed > 0;
  const badge = waiting + failed;

  const icon = attention
    ? 'alert-circle-outline'
    : waiting > 0
      ? 'cloud-offline-outline'
      : 'cloud-done-outline';
  const iconColor = attention
    ? '#9B1C1C'
    : waiting > 0
      ? waitingColors.text
      : colors.successText;

  const retry = async () => {
    setRetrying(true);
    await retryOutbox().catch(() => undefined);
    setRetrying(false);
  };

  return (
    <>
      <Pressable
        accessibilityHint={td('today.syncOpenHint')}
        accessibilityLabel={
          attention
            ? td('today.syncFailed', { count: failed })
            : waiting > 0
              ? td('today.syncWaiting', { count: waiting })
              : td('today.syncSent')
        }
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          attention
            ? styles.buttonFailed
            : waiting > 0
              ? styles.buttonWaiting
              : styles.buttonSent,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
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
                  attention
                    ? styles.sheetIconFailed
                    : waiting > 0
                      ? styles.sheetIconWaiting
                      : styles.sheetIconSent,
                ]}
              >
                <Ionicons name={icon} size={24} color={iconColor} />
              </View>
              <Text style={styles.sheetTitle}>
                {attention
                  ? td('sync.failedTitle')
                  : waiting > 0
                    ? td('sync.waitingTitle')
                    : td('sync.sentTitle')}
              </Text>
            </View>

            <Text style={styles.sheetBody}>
              {attention
                ? td('sync.failedBody', { failed, waiting })
                : waiting > 0
                  ? td('sync.waitingBody', { count: waiting })
                  : td('sync.sentBody')}
            </Text>

            {attention ? (
              <Text style={styles.failureNote}>{td('sync.failedNote')}</Text>
            ) : waiting > 0 ? (
              <Text style={styles.sheetWarning}>{td('sync.waitingNote')}</Text>
            ) : null}

            {waiting > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={retrying}
                onPress={() => {
                  void retry();
                }}
                style={({ pressed }) => [
                  styles.retry,
                  pressed && styles.pressed,
                  retrying && styles.retryDisabled,
                ]}
              >
                <Text style={styles.retryLabel}>
                  {retrying ? td('sync.retrying') : td('sync.retry')}
                </Text>
              </Pressable>
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
  buttonFailed: {
    borderWidth: 1,
    borderColor: '#EDB4B4',
    backgroundColor: '#FDECEC',
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
  sheetIconFailed: {
    borderWidth: 1,
    borderColor: '#EDB4B4',
    backgroundColor: '#FDECEC',
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
  failureNote: {
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#EDB4B4',
    backgroundColor: '#FDECEC',
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: '#9B1C1C',
  },
  retry: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    backgroundColor: colors.primary,
  },
  retryDisabled: {
    opacity: 0.6,
  },
  retryLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
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
