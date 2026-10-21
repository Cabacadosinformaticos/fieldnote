import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/pt';
import { colors, fonts, radii, spacing, typography } from '@/theme';

const FAKE_STUDY = {
  title: 'Viver o Jardim da Estrela',
  description:
    'Como é que os moradores usam o Jardim da Estrela ao longo do dia, durante duas semanas.',
  team: 'Inês Marques, UNIDCOM/IADE',
  duration: '6 a 19 out. 2026 (14 dias)',
  requests: 'Até 4 pedidos por dia, cerca de 8 min por dia',
  records: 'Fotos, texto, vídeo, áudio e uma escala de 1 a 7',
  location: 'Só em algumas atividades, que o indicam',
} as const;

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export default function InvitationScreen() {
  const details: { icon: IoniconName; label: string; value: string }[] = [
    { icon: 'people-outline', label: t('invitation.teamLabel'), value: FAKE_STUDY.team },
    {
      icon: 'calendar-outline',
      label: t('invitation.durationLabel'),
      value: FAKE_STUDY.duration,
    },
    {
      icon: 'notifications-outline',
      label: t('invitation.requestsLabel'),
      value: FAKE_STUDY.requests,
    },
    {
      icon: 'camera-outline',
      label: t('invitation.recordsLabel'),
      value: FAKE_STUDY.records,
    },
    {
      icon: 'location-outline',
      label: t('invitation.locationLabel'),
      value: FAKE_STUDY.location,
    },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={typography.title}>{t('invitation.title')}</Text>

      <Card style={styles.studyCard}>
        <View style={styles.studyIntro}>
          <Text style={typography.heading}>{FAKE_STUDY.title}</Text>
          <Text style={styles.description}>{FAKE_STUDY.description}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name={detail.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue}>{detail.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={t('invitation.accept')}
          onPress={() => router.push('/join/consent')}
        />
        <Button
          label={t('invitation.decline')}
          variant="secondary"
          onPress={() => undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  studyCard: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  studyIntro: {
    gap: 6,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  details: {
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  detailIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  detailText: {
    flex: 1,
    gap: 1,
  },
  detailLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: 10,
  },
});
