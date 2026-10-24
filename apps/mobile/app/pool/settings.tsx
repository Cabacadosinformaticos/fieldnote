import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { ConfirmSheet } from '@/components/account/ConfirmSheet';
import { ToggleSwitch } from '@/components/account/ToggleSwitch';
import { accountHref } from '@/components/account/navigation';
import { poolMember } from '@/fake/account';
import { ta, type AccountKey } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

const profileRows: { label: AccountKey; value: string }[] = [
  { label: 'poolSettings.concelho', value: poolMember.concelho },
  { label: 'poolSettings.freguesia', value: poolMember.freguesia },
  { label: 'poolSettings.age', value: poolMember.age },
  { label: 'poolSettings.gender', value: poolMember.gender },
  { label: 'poolSettings.situation', value: poolMember.situation },
  { label: 'poolSettings.transport', value: poolMember.transport },
  {
    label: 'poolSettings.languages',
    value: poolMember.languages.join(', '),
  },
];

export default function PoolSettingsScreen() {
  const [receiving, setReceiving] = useState(true);
  const [showLeave, setShowLeave] = useState(false);

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>{ta('poolSettings.title')}</Text>
        <Text style={styles.memberSince}>
          {ta('poolSettings.memberSince', { date: poolMember.since })}
        </Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Text style={styles.profileTitle}>
            {ta('poolSettings.profileTitle')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(accountHref('/pool/profile'))}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primaryDark} />
            <Text style={styles.editLabel}>{ta('poolSettings.edit')}</Text>
          </Pressable>
        </View>

        <View>
          {profileRows.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.row,
                index < profileRows.length - 1 && styles.rowDivider,
              ]}
            >
              <Text style={styles.rowLabel}>{ta(row.label)}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{ta('poolSettings.receive')}</Text>
          <ToggleSwitch
            label={ta('poolSettings.receive')}
            onChange={setReceiving}
            value={receiving}
          />
        </View>
        <Text style={styles.toggleBody}>
          {ta('poolSettings.receiveBody')}
        </Text>
      </View>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowLeave(true)}
        style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={18} color="#9B1C1C" />
        <Text style={styles.leaveLabel}>{ta('poolSettings.leave')}</Text>
      </Pressable>
      <Text style={styles.leaveNote}>{ta('poolSettings.leaveNote')}</Text>

      <ConfirmSheet
        body={ta('poolSettings.leaveBody')}
        cancelLabel={ta('poolSettings.leaveCancel')}
        confirmLabel={ta('poolSettings.leaveConfirm')}
        onCancel={() => setShowLeave(false)}
        onConfirm={() => router.replace(accountHref('/settings'))}
        title={ta('poolSettings.leaveTitle')}
        tone="danger"
        visible={showLeave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  intro: {
    gap: 6,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  memberSince: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  profileHeader: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  edit: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  editLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.primaryDark,
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLabel: {
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  rowValue: {
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
    color: colors.text,
  },
  toggleCard: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  toggleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleLabel: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  toggleBody: {
    paddingBottom: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  leave: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: '#9B1C1C',
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  leaveLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: '#9B1C1C',
  },
  leaveNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
