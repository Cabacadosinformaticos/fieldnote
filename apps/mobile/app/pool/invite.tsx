import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { poolInvitation } from '@/fake/account';
import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const details: { icon: IoniconName; label: string; value: string }[] = [
  {
    icon: 'person-outline',
    label: ta('poolInvite.team'),
    value: poolInvitation.team,
  },
  {
    icon: 'calendar-outline',
    label: ta('poolInvite.duration'),
    value: poolInvitation.period,
  },
  {
    icon: 'notifications-outline',
    label: ta('poolInvite.requests'),
    value: poolInvitation.requests,
  },
  {
    icon: 'camera-outline',
    label: ta('poolInvite.records'),
    value: poolInvitation.records,
  },
  {
    icon: 'location-outline',
    label: ta('poolInvite.location'),
    value: poolInvitation.location,
  },
];

export default function PoolInviteScreen() {
  const [showDecline, setShowDecline] = useState(false);
  const [showLater, setShowLater] = useState(false);

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={styles.title}>{ta('poolInvite.title')}</Text>

      <Note
        body={ta('poolInvite.reason', { concelho: poolInvitation.concelho })}
        icon="information-circle-outline"
        tone="info"
      />

      <View style={styles.card}>
        <View style={styles.studyIntro}>
          <Text style={styles.studyTitle}>{poolInvitation.studyName}</Text>
          <Text style={styles.studyBody}>{poolInvitation.description}</Text>
          <Text style={styles.expiry}>
            {ta('poolInvite.expiry', {
              received: poolInvitation.received,
              expires: poolInvitation.validUntil,
            })}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons
                  name={detail.icon}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue}>{detail.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={ta('poolInvite.accept')}
          onPress={() => router.push(accountHref('/join/consent'))}
        />
        <Button
          label={ta('poolInvite.decline')}
          onPress={() => setShowDecline(true)}
          variant="secondary"
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowLater(true)}
          style={({ pressed }) => [styles.later, pressed && styles.pressed]}
        >
          <Text style={styles.laterLabel}>{ta('poolInvite.later')}</Text>
        </Pressable>
      </View>

      <ConfirmSheet
        body={ta('poolInvite.declineBody')}
        cancelLabel={ta('poolInvite.declineBack')}
        confirmLabel={ta('poolInvite.declineConfirm')}
        onCancel={() => setShowDecline(false)}
        onConfirm={() => router.replace(accountHref('/pool/settings'))}
        title={ta('poolInvite.declineTitle')}
        tone="dark"
        visible={showDecline}
      />

      <ConfirmSheet
        body={ta('poolInvite.laterBody', {
          date: poolInvitation.validUntil,
        })}
        confirmLabel={ta('poolInvite.laterOk')}
        onCancel={() => setShowLater(false)}
        onConfirm={() => setShowLater(false)}
        title={ta('poolInvite.laterTitle')}
        visible={showLater}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },
  studyIntro: {
    gap: 6,
  },
  studyTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    color: colors.text,
  },
  studyBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
  },
  expiry: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  details: {
    gap: 10,
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
    minWidth: 0,
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
  later: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.8,
  },
});
