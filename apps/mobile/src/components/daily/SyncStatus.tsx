import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTopBanner } from '@/components/TopBanner';
import { td } from '@/i18n/td';
import { useOutboxSummary } from '@/queue/hooks';
import { retryOutbox } from '@/queue/sender';
import { colors, fonts, spacing } from '@/theme';

const waitingColors = {
  background: '#FFF3D6',
  border: '#F5D38A',
  text: '#5C3900',
} as const;

const errorColors = {
  background: '#FDECEC',
  border: '#EDB4B4',
  text: '#9B1C1C',
} as const;

export function SyncStatus() {
  const { show } = useTopBanner();
  const retrying = useRef(false);
  const { waiting, failed } = useOutboxSummary();
  const attention = failed > 0;
  const badge = waiting + failed;

  const icon = attention
    ? 'alert-circle-outline'
    : waiting > 0
      ? 'cloud-offline-outline'
      : 'cloud-done-outline';
  const iconColor = attention
    ? errorColors.text
    : waiting > 0
      ? waitingColors.text
      : colors.successText;
  const iconBackground = attention
    ? errorColors.background
    : waiting > 0
      ? waitingColors.background
      : colors.successBackground;

  const retry = async () => {
    if (retrying.current) {
      return;
    }
    retrying.current = true;
    await retryOutbox().catch(() => undefined);
    retrying.current = false;
  };

  const openStatus = () => {
    const title = attention
      ? td('sync.failedTitle')
      : waiting > 0
        ? td('sync.waitingTitle')
        : td('sync.sentTitle');
    const body = attention
      ? td('sync.failedBody', { failed, waiting })
      : waiting > 0
        ? td('sync.waitingBody', { count: waiting })
        : td('sync.sentBody');
    const note = attention
      ? td('sync.failedNote')
      : waiting > 0
        ? td('sync.waitingNote')
        : undefined;

    show({
      icon,
      iconColor,
      iconBackground,
      title,
      body,
      note,
      noteTone: attention ? 'error' : waiting > 0 ? 'warning' : undefined,
      action:
        waiting > 0
          ? {
              label: td('sync.retry'),
              onPress: () => {
                void retry();
              },
            }
          : undefined,
    });
  };

  return (
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
      onPress={openStatus}
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
    borderColor: errorColors.border,
    backgroundColor: errorColors.background,
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
});
