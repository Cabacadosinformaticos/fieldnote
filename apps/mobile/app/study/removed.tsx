import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { networkErrorMessage } from '@/api/errors';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { moreHref } from '@/components/more/navigation';
import { tm } from '@/i18n/tm';
import { getDeviceToken, getParticipation, saveParticipation } from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

export default function StudyRemovedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        if (!active) {
          return;
        }
        if (!data) {
          setError(networkErrorMessage());
          return;
        }

        setTitle(data.study.title);
        await saveParticipation({
          studyId: data.study.id,
          title: data.study.title,
          status: data.status,
          alias: data.alias,
          startsOn: data.study.starts_on,
          endsOn: data.study.ends_on,
          timezone: data.study.timezone,
        }).catch(() => undefined);
      } catch {
        if (active) {
          setError(networkErrorMessage());
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons name="person-remove-outline" size={38} color="#9B1C1C" />
        </View>
        <Text style={styles.title}>{tm('removed.title')}</Text>
        <Text style={styles.body}>
          {tm('removed.body', { study: title ?? '' })}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm('removed.whatTitle')}</Text>
        <InfoRow
          body={tm('removed.noRequestsBody')}
          icon="notifications-off-outline"
          title={tm('removed.noRequests')}
        />
        <InfoRow
          body={tm('removed.eraseBody')}
          icon="trash-outline"
          title={tm('removed.eraseTitle')}
          tone="danger"
        />
        <InfoRow
          body={tm('removed.contactBody')}
          icon="mail-outline"
          title={tm('removed.contact')}
        />
      </View>

      <View style={styles.spacer} />

      <Button
        disabled={!id}
        label={tm('removed.erase')}
        onPress={() => {
          if (id) {
            router.push(moreHref(`/erase/${id}`));
          }
        }}
      />
      <Button
        label={tm('study.back')}
        onPress={() => router.replace('/(tabs)/studies')}
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  intro: {
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#FDECEC',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#9B1C1C',
  },
  card: {
    gap: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
});
