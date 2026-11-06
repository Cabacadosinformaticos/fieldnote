import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConsentDeclineDialog } from '@/components/join/ConsentDeclineDialog';
import { ConsentText } from '@/components/join/ConsentText';
import { StepProgress } from '@/components/join/StepProgress';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { useJoinSession } from '@/state/join';
import {
  getParticipation,
  type Participation,
} from '@/state/participations';
import { colors, fonts, radii, spacing, typography } from '@/theme';

type CachedParticipation = {
  studyId: string;
  row: Participation | null;
};

export default function ConsentTextScreen() {
  const [declineVisible, setDeclineVisible] = useState(false);
  const { lookup } = useJoinSession();
  const params = useLocalSearchParams<{ studyId?: string }>();
  const studyId =
    typeof params.studyId === 'string' && params.studyId ? params.studyId : null;
  const [cache, setCache] = useState<CachedParticipation | null>(null);
  const cacheReady = cache !== null && cache.studyId === studyId;
  const cached = cacheReady ? cache.row : null;

  const leaveStudy = () => {
    setDeclineVisible(false);
    router.replace('/');
  };

  useEffect(() => {
    if (studyId) {
      return;
    }

    if (!lookup) {
      router.replace('/join/code');
    }
  }, [lookup, studyId]);

  useEffect(() => {
    if (!studyId) {
      return;
    }

    let active = true;

    getParticipation(studyId)
      .then((row) => {
        if (active) {
          setCache({ studyId, row });
        }
      })
      .catch(() => {
        if (active) {
          setCache({ studyId, row: null });
        }
      });

    return () => {
      active = false;
    };
  }, [studyId]);

  useEffect(() => {
    if (studyId && cacheReady && !cached) {
      router.replace('/');
    }
  }, [cacheReady, cached, studyId]);

  const cachedStudy = cached
    ? {
        title: cached.title,
        description: cached.description,
        consent_text: cached.consentText,
        team: cached.team,
        starts_on: cached.startsOn,
        ends_on: cached.endsOn,
      }
    : null;
  const study = studyId ? cachedStudy : lookup?.study ?? null;

  if (!study) {
    return null;
  }

  const subtitle =
    !studyId && lookup
      ? tj('consent.subtitle', {
          title: lookup.study.title,
          version: lookup.consent_version,
        })
      : tj('consent.subtitleEmpty');

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <StepProgress filled={2} label={tj('consent.step')} />

      <View style={styles.intro}>
        <Text style={typography.title}>{tj('consent.title')}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <Card style={styles.card}>
        <ConsentText study={study} />
      </Card>

      {studyId ? null : (
        <>
          <View style={styles.actions}>
            <Button
              label={tj('consent.accept')}
              onPress={() => router.push('/join/questions')}
            />
            <Button
              label={tj('consent.decline')}
              onPress={() => setDeclineVisible(true)}
              variant="secondary"
            />
          </View>

          <ConsentDeclineDialog
            onClose={() => setDeclineVisible(false)}
            onLeave={leaveStudy}
            visible={declineVisible}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intro: {
    gap: 4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  card: {
    borderRadius: radii.card,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  actions: {
    gap: 10,
  },
});
