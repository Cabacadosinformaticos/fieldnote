import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/more/BackLink';
import { Bullets } from '@/components/more/Bullets';
import { LanguageToggle } from '@/components/more/LanguageToggle';
import { SettingsRow } from '@/components/more/SettingsRow';
import { moreHref } from '@/components/more/navigation';
import { moreStudies } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export default function SettingsScreen() {
  const [confirmation, setConfirmation] = useState('');
  const ready = confirmation.trim() === 'APAGAR';

  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackLink label={tm('common.back')} onPress={() => router.back()} />
        <Text style={styles.title}>{tm('settings.title')}</Text>
      </View>

      <View style={styles.preferencesCard}>
        <SettingsRow
          divider
          icon="person-outline"
          subtitle={tm('settings.accountBody')}
          title={tm('settings.account')}
        />
        <SettingsRow
          divider
          icon="globe-outline"
          title={tm('settings.language')}
          trailing={<LanguageToggle />}
        />
        <SettingsRow
          divider
          icon="people-outline"
          subtitle={tm('settings.poolBody')}
          title={tm('settings.pool')}
        />
        <SettingsRow
          divider
          icon="notifications-outline"
          onPress={() => router.push(moreHref('/notifications'))}
          subtitle={tm('settings.notificationsBody')}
          title={tm('settings.notifications')}
        />
        <SettingsRow
          icon="shield-outline"
          onPress={() => router.push('/join/consent-text')}
          title={tm('settings.privacy')}
        />
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>
          <Ionicons name="trash-outline" size={20} color="#9B1C1C" />{' '}
          {tm('settings.myData')}
        </Text>
        <Bullets
          items={[
            tm('settings.eraseB1', { count: moreStudies.length }),
            tm('settings.eraseB2'),
            tm('settings.eraseB3'),
            tm('settings.eraseB4'),
          ]}
        />

        <View style={styles.confirmBlock}>
          <Text style={styles.confirmLabel}>{tm('settings.confirmLabel')}</Text>
          <TextInput
            accessibilityLabel={tm('settings.confirmLabel')}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setConfirmation}
            placeholder={tm('settings.confirmPlaceholder')}
            placeholderTextColor={colors.textMuted}
            spellCheck={false}
            style={styles.input}
            value={confirmation}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={() => router.push(moreHref('/erase/scheduled?scope=all'))}
          style={({ pressed }) => [
            styles.eraseButton,
            ready ? styles.eraseButtonOn : styles.eraseButtonOff,
            pressed && ready && styles.pressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={ready ? colors.white : '#9B1C1C'}
          />
          <Text style={[styles.eraseLabel, ready && styles.eraseLabelOn]}>
            {tm('settings.eraseCta')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <Text style={styles.version}>{tm('settings.version')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    gap: 2,
    paddingBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  preferencesCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  dangerCard: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: '#9B1C1C',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  dangerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: '#9B1C1C',
  },
  confirmBlock: {
    gap: 6,
    marginTop: spacing.xs,
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
  version: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});
