import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { accountHref } from '@/components/account/navigation';
import { t } from '@/i18n/pt';
import { colors, fonts, radii, spacing, typography } from '@/theme';

export default function WelcomeScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.brand}>
          <LogoMark />
          <Text style={styles.brandName}>{t('welcome.brand')}</Text>
        </View>
        <LanguageToggle />
      </View>

      <View style={styles.intro}>
        <Text style={typography.title}>{t('welcome.title')}</Text>
        <Text style={[typography.body, styles.bodyText]}>{t('welcome.body')}</Text>
      </View>

      <View
        accessibilityLabel={t('welcome.previewLabel')}
        accessibilityRole="image"
        style={styles.previewPanel}
      >
        <View style={styles.previewCard}>
          <View style={styles.previewTeamRow}>
            <View style={styles.previewAvatar}>
              <Ionicons name="person-outline" size={16} color={colors.textMuted} />
            </View>
            <Text style={styles.previewTeam}>{t('welcome.previewTeam')}</Text>
          </View>
          <View style={[styles.skeleton, styles.skeletonFull]} />
          <View style={[styles.skeleton, styles.skeletonShort]} />
          <View style={styles.previewCodeRow}>
            <QrMini />
            <Text style={styles.previewCode}>{t('welcome.previewCode')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <Button
          label={t('welcome.scanQr')}
          icon={<Ionicons name="qr-code-outline" size={22} color={colors.white} />}
          onPress={() => router.push('/join/scan')}
        />
        <Button
          label={t('welcome.writeCode')}
          variant="secondary"
          icon={<Ionicons name="keypad-outline" size={22} color={colors.text} />}
          onPress={() => router.push('/join/code')}
        />

        <Pressable
          accessibilityLabel={t('welcome.poolTitle')}
          accessibilityRole="button"
          onPress={() => router.push(accountHref('/pool'))}
          style={({ pressed }) => [
            styles.poolCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.poolIcon}>
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.poolText}>
            <Text style={styles.poolTitle}>{t('welcome.poolTitle')}</Text>
            <Text style={styles.poolBody}>{t('welcome.poolBody')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Pressable
          accessibilityRole="link"
          onPress={() => router.push(accountHref('/account/restore'))}
          style={styles.accountLink}
        >
          <Text style={styles.accountLinkText}>{t('welcome.alreadyHaveAccount')}</Text>
        </Pressable>

        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)')}
            style={styles.devLink}
          >
            <Text style={styles.devLinkText}>Ver o dia (demo)</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function LogoMark() {
  return (
    <View style={styles.logo}>
      <View style={styles.logoSpine} />
      <View style={[styles.logoLine, styles.logoLineTop]} />
      <View style={[styles.logoLine, styles.logoLineBottom]} />
      <View style={styles.logoPin} />
    </View>
  );
}

function LanguageToggle() {
  return (
    <View accessibilityLabel={t('welcome.language')} style={styles.languageToggle}>
      <Pressable
        accessibilityLabel={t('welcome.portuguese')}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        style={[styles.languageOption, styles.languageOptionActive]}
      >
        <Text style={[styles.languageText, styles.languageTextActive]}>PT</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={t('welcome.english')}
        accessibilityRole="button"
        accessibilityState={{ selected: false, disabled: true }}
        disabled
        style={styles.languageOption}
      >
        <Text style={styles.languageText}>EN</Text>
      </Pressable>
    </View>
  );
}

function QrMini() {
  return (
    <View style={styles.qrMini}>
      <View style={[styles.qrCorner, styles.qrTopLeft]} />
      <View style={[styles.qrCorner, styles.qrTopRight]} />
      <View style={[styles.qrCorner, styles.qrBottomLeft]} />
      <View style={[styles.qrCorner, styles.qrBottomRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xxl,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandName: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: colors.text,
  },
  logo: {
    width: 30,
    height: 34,
    borderRadius: 5,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  logoSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: colors.primaryDark,
  },
  logoLine: {
    position: 'absolute',
    left: 11,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: colors.white,
    opacity: 0.85,
  },
  logoLineTop: {
    top: 10,
    width: 15,
  },
  logoLineBottom: {
    top: 17,
    width: 11,
  },
  logoPin: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  languageToggle: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  languageOption: {
    height: 48,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageOptionActive: {
    backgroundColor: colors.text,
  },
  languageText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
  languageTextActive: {
    color: colors.white,
  },
  intro: {
    gap: 10,
  },
  bodyText: {
    color: colors.textBody,
  },
  previewPanel: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  previewCard: {
    width: 220,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  previewTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.disabledBackground,
  },
  previewTeam: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textBody,
  },
  skeleton: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider,
  },
  skeletonFull: {
    width: '100%',
  },
  skeletonShort: {
    width: '70%',
  },
  previewCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: spacing.xs,
  },
  previewCode: {
    fontFamily: fonts.mono,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.84,
    color: colors.textMuted,
  },
  qrMini: {
    width: 48,
    height: 48,
  },
  qrCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 3,
    borderColor: '#C4CBDB',
  },
  qrTopLeft: {
    top: 0,
    left: 0,
  },
  qrTopRight: {
    top: 0,
    right: 0,
  },
  qrBottomLeft: {
    bottom: 0,
    left: 0,
  },
  qrBottomRight: {
    bottom: 0,
    right: 0,
    borderStyle: 'dashed',
  },
  spacer: {
    flexGrow: 1,
  },
  actions: {
    gap: spacing.md,
  },
  poolCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.xxl,
  },
  poolIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  poolText: {
    flex: 1,
    gap: 2,
  },
  poolTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  poolBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  accountLink: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLinkText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
    color: colors.primaryDark,
  },
  devLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
});
