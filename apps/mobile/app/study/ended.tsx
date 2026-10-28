import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deviceClient } from '@/api/client';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { formatDate } from '@/components/join/format';
import { tm } from '@/i18n/tm';
import { getDeviceToken, getParticipation, saveParticipation } from '@/state/participations';
import { colors, fonts, radii, spacing } from '@/theme';

export default function StudyEndedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [endedOn, setEndedOn] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        return;
      }

      const cached = await getParticipation(id).catch(() => null);
      if (active && cached) {
        setTitle(cached.title);
        setEndedOn(cached.endsOn);
      }

      const token = await getDeviceToken(id).catch(() => null);
      if (!token) {
        return;
      }

      try {
        const { data } = await deviceClient(token).GET(
          '/api/v1/participation/me',
        );
        if (!active || !data) {
          return;
        }

        setTitle(data.study.title);
        setEndedOn(data.study.ends_on);
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
        // The cached card is enough when the phone is offline.
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
          <Ionicons name="happy-outline" size={38} color={colors.primaryDark} />
        </View>
        <Text style={styles.title}>{tm('ended.title')}</Text>
        <Text style={styles.body}>
          {tm('ended.body', {
            study: title,
            date: formatDate(endedOn),
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm('ended.whatTitle')}</Text>
        <InfoRow
          body={tm('ended.noRequestsBody')}
          icon="notifications-off-outline"
          title={tm('ended.noRequests')}
        />
        <InfoRow
          body={tm('ended.waitingBody')}
          icon="cloud-upload-outline"
          title={tm('ended.waiting')}
        />
      </View>

      <View style={styles.spacer} />

      <Button
        label={tm('ended.entries')}
        onPress={() => router.replace('/(tabs)/entries')}
      />
      {id ? (
        <Button
          label={tm('studies.details')}
          onPress={() => router.replace({ pathname: '/study/[id]', params: { id } })}
          variant="secondary"
        />
      ) : null}
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
    backgroundColor: colors.primarySoft,
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
