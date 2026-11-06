import { router } from 'expo-router';
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
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function ConsentTextScreen() {
  const [declineVisible, setDeclineVisible] = useState(false);
  const { lookup } = useJoinSession();

  const leaveStudy = () => {
    setDeclineVisible(false);
    router.replace('/');
  };

  useEffect(() => {
    if (!lookup) {
      router.replace('/join/code');
    }
  }, [lookup]);

  if (!lookup) {
    return null;
  }

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <StepProgress filled={2} label={tj('consent.step')} />

      <View style={styles.intro}>
        <Text style={typography.title}>{tj('consent.title')}</Text>
        <Text style={styles.subtitle}>
          {lookup
            ? tj('consent.subtitle', {
                title: lookup.study.title,
                version: lookup.consent_version,
              })
            : tj('consent.subtitleEmpty')}
        </Text>
      </View>

      <Card style={styles.card}>
        <ConsentText study={lookup?.study} />
      </Card>

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
