import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n/pt';
import { colors, fonts, spacing, typography } from '@/theme';

export default function ScanScreen() {
  return (
    <Screen
      backgroundColor={colors.scanBackgroundDeep}
      contentStyle={styles.content}
      scroll={false}
    >
      <StatusBar style="light" />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.backgroundDeep} />
        <View style={styles.backgroundBand} />
        <View style={styles.backgroundBlobLeft} />
        <View style={styles.backgroundBlobRight} />
        <View style={styles.backgroundPill} />
      </View>

      <View style={styles.header}>
        <BackButton onDark onPress={() => router.back()} />
        <Text style={styles.headerTitle}>{t('scan.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.instruction}>{t('scan.instruction')}</Text>

      <View style={styles.captureArea}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <View style={styles.cameraPlaceholder}>
            <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
            <Text style={styles.cameraLabel}>{t('scan.cameraPlaceholder')}</Text>
          </View>
        </View>

        <Pill
          tone="onDark"
          icon={<ActivityIndicator color={colors.white} size="small" />}
        >
          {t('scan.reading')}
        </Pill>
      </View>

      <View style={styles.spacer} />

      <View style={styles.footer}>
        <Text style={styles.note}>{t('scan.note')}</Text>
        <Button
          label={t('welcome.writeCode')}
          variant="secondary"
          onDark
          icon={<Ionicons name="keypad-outline" size={22} color={colors.white} />}
          onPress={() => router.push('/join/code')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  backgroundDeep: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '39%',
    backgroundColor: colors.scanSurface,
  },
  backgroundBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '39%',
    height: 70,
    backgroundColor: colors.scanHighlight,
  },
  backgroundBlobLeft: {
    position: 'absolute',
    left: 0,
    top: '36%',
    width: 150,
    height: 220,
    borderTopRightRadius: 110,
    borderBottomRightRadius: 110,
    backgroundColor: '#21342A',
  },
  backgroundBlobRight: {
    position: 'absolute',
    right: 0,
    top: '33%',
    width: 150,
    height: 240,
    borderTopLeftRadius: 120,
    borderBottomLeftRadius: 120,
    backgroundColor: '#1C2C23',
  },
  backgroundPill: {
    position: 'absolute',
    left: 150,
    right: 0,
    bottom: '32%',
    height: 50,
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
    backgroundColor: '#2B3D31',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.white,
  },
  headerSpacer: {
    width: 48,
    height: 48,
  },
  instruction: {
    ...typography.bodyLarge,
    fontFamily: fonts.bold,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.white,
    marginTop: spacing.lg,
  },
  captureArea: {
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  frame: {
    width: 272,
    height: 272,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: colors.white,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 20,
  },
  cameraPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  cameraLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
  },
  spacer: {
    flexGrow: 1,
  },
  footer: {
    gap: spacing.md,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.scanTextMuted,
  },
});
