import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { deviceClient } from '@/api/client';
import { apiErrorMessage, networkErrorMessage } from '@/api/errors';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Bullets } from '@/components/more/Bullets';
import { formatDate } from '@/components/join/format';
import { tm } from '@/i18n/tm';
import { clearStudyQueue, setErasureDue } from '@/state/actions';
import {
  getDeviceToken,
  getParticipation,
  saveParticipation,
} from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

function dueDate(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function dueTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function EraseStudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirmation.trim().toUpperCase() === 'APAGAR';

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        return;
      }

      const cached = await getParticipation(id).catch(() => null);
      if (active && cached) {
        setTitle(cached.title);
      }

      const token = await getDeviceToken(id).catch(() => null);
      if (!token) {
        return;
      }

      try {
        const { data } = await deviceClient(token).GET(
          '/api/v1/participation/me',
        );
        if (active && data) {
          setTitle(data.study.title);
        }
      } catch {
        // The cached title is enough when the phone is offline.
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  const confirm = async () => {
    if (!id || !ready || busy) {
      return;
    }

    const token = await getDeviceToken(id).catch(() => null);
    if (!token) {
      setError(tm('erase.error'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data, error: apiError } = await deviceClient(token).POST(
        '/api/v1/participation/me/erasure',
        { body: { confirmation: 'APAGAR' } },
      );
      if (!data) {
        setError(apiErrorMessage(apiError));
        return;
      }

      await clearStudyQueue(id).catch(() => undefined);
      await saveParticipation({
        studyId: data.study.id,
        title: data.study.title,
        status: data.status,
        alias: data.alias,
        startsOn: data.study.starts_on,
        endsOn: data.study.ends_on,
        timezone: data.study.timezone,
      }).catch(() => undefined);
      await setErasureDue(data.study.id, data.erasure_due_at).catch(
        () => undefined,
      );

      router.replace({
        pathname: '/erase/scheduled',
        params: {
          scope: 'study',
          studyId: data.study.id,
          study: data.study.title,
          due: data.erasure_due_at ?? '',
          requested: data.erasure_requested_at ?? '',
        },
      });
    } catch {
      setError(networkErrorMessage());
    } finally {
      setBusy(false);
    }
  };

  const due = dueDate();

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={tm('common.back')} onPress={() => router.back()} />
        <Text style={styles.title}>{tm('erase.title')}</Text>
        <Text style={styles.study}>
          {tm('erase.study', { study: title ?? '' })}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{tm('erase.nowTitle')}</Text>
          <Bullets
            items={[
              tm('erase.nowB1'),
              tm('erase.nowB2'),
              tm('erase.nowB3'),
              tm('erase.nowB4'),
              tm('erase.nowB5'),
            ]}
          />
        </View>
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            {tm('erase.whenTitleAt', {
              date: formatDate(due.toISOString()),
              time: dueTime(due),
            })}
          </Text>
          <Bullets
            items={[tm('erase.whenB1'), tm('erase.whenB2')]}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />

      <View style={styles.confirmBlock}>
        <Text style={styles.confirmLabel}>{tm('erase.confirmLabel')}</Text>
        <TextInput
          accessibilityLabel={tm('erase.confirmLabel')}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setConfirmation}
          placeholder={tm('erase.confirmPlaceholder')}
          placeholderTextColor={colors.textMuted}
          spellCheck={false}
          style={styles.input}
          value={confirmation}
        />
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready || busy }}
          disabled={!ready || busy}
          onPress={() => {
            void confirm();
          }}
          style={({ pressed }) => [
            styles.eraseButton,
            ready ? styles.eraseButtonOn : styles.eraseButtonOff,
            pressed && ready && !busy && styles.pressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={ready ? colors.white : '#9B1C1C'}
          />
          <Text style={[styles.eraseLabel, ready && styles.eraseLabelOn]}>
            {busy ? tm('erase.busy') : tm('erase.cta')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.cancelLabel}>{tm('erase.cancel')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.24,
    color: colors.text,
  },
  study: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  block: {
    gap: spacing.xs,
  },
  blockTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  confirmBlock: {
    gap: 6,
  },
  confirmLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  input: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#858EA1',
    paddingHorizontal: 14,
    fontFamily: fonts.mono,
    fontSize: 17,
    letterSpacing: 1.36,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  actions: {
    gap: spacing.sm,
  },
  eraseButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.lg,
  },
  eraseButtonOn: {
    backgroundColor: '#9B1C1C',
  },
  eraseButtonOff: {
    backgroundColor: '#FDECEC',
    opacity: 0.6,
  },
  eraseLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: '#9B1C1C',
  },
  eraseLabelOn: {
    color: colors.white,
  },
  cancelButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
