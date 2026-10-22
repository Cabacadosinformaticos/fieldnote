import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/more/SettingsRow';
import { StudyCard } from '@/components/more/StudyCard';
import { moreHref } from '@/components/more/navigation';
import { moreStudies, type Study } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

function openStudy(study: Study) {
  if (study.status === 'erasing') {
    router.push(moreHref('/erase/scheduled'));
    return;
  }
  if (study.status === 'ended') {
    router.push(moreHref('/study/ended'));
    return;
  }
  router.push('/(tabs)');
}

function openDetails(study: Study) {
  if (study.status === 'erasing') {
    router.push(moreHref('/erase/scheduled'));
    return;
  }
  if (study.status === 'ended') {
    router.push(moreHref('/study/ended'));
    return;
  }
  router.push(moreHref(`/study/${study.id}`));
}

export default function StudiesScreen() {
  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Text style={styles.title}>{tm('studies.title')}</Text>
        <Text style={styles.subtitle}>
          {tm('studies.count', { count: moreStudies.length })}
        </Text>
      </View>

      {moreStudies.map((study) => (
        <StudyCard
          key={study.id}
          onDetails={() => openDetails(study)}
          onOpen={() => openStudy(study)}
          study={study}
        />
      ))}

      <View style={styles.moreCard}>
        <SettingsRow
          divider
          icon="add"
          onPress={() => router.push('/join/code')}
          title={tm('studies.enterAnother')}
        />
        <SettingsRow
          icon="settings-outline"
          onPress={() => router.push(moreHref('/settings'))}
          title={tm('studies.settings')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: 1,
    paddingVertical: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  moreCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
});
