import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { ConsentDeclineDialog } from '@/components/join/ConsentDeclineDialog';
import { ConsentText } from '@/components/join/ConsentText';
import { StepProgress } from '@/components/join/StepProgress';
import { Screen } from '@/components/Screen';
import { tj } from '@/i18n/tj';
import { useJoinSession } from '@/state/join';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function ConsentScreen() {
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
    <Screen contentStyle={styles.content} scroll={false}>
      <StatusBar style="dark" />

      <View style={styles.main}>
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
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/join/consent-text')}
            style={styles.readFull}
          >
            <Text style={styles.link}>{tj('consent.readFull')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <ScrollView
            accessibilityLabel={tj('consent.scrollLabel')}
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator
          >
            <ConsentText study={lookup?.study} />
          </ScrollView>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>{tj('consent.footerNote')}</Text>
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
    flex: 1,
  },
  main: {
    flex: 1,
    gap: 14,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
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
  readFull: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primaryDark,
    textDecorationLine: 'underline',
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  cardContent: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  footer: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 14,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
  },
  footerNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
