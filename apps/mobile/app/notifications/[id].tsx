import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/LogoMark';
import { Screen } from '@/components/Screen';
import { tm } from '@/i18n/tm';
import { fonts, radii, spacing } from '@/theme';

export default function LockScreenNotificationScreen() {
  return (
    <Screen
      backgroundColor="#131A2A"
      contentStyle={styles.content}
      edges={['top']}
      scroll={false}
    >
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />

      <View pointerEvents="none" style={styles.bottomBand} />

      <Pressable
        accessibilityLabel={tm('notifications.lockLabel')}
        accessibilityRole="button"
        onPress={() => router.replace('/(tabs)')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.metaRow}>
          <View style={styles.appIcon}>
            <LogoMark scale={11 / 30} />
          </View>
          <Text style={styles.meta}>{tm('notifications.sampleBrand')}</Text>
          <Text style={styles.meta}>·</Text>
          <Text style={styles.meta}>{tm('notifications.lockTime')}</Text>
        </View>
        <Text style={styles.body}>{tm('notifications.sampleBody')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 88,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#131A2A',
  },
  glowOne: {
    position: 'absolute',
    left: -60,
    bottom: 140,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#1B2436',
  },
  glowTwo: {
    position: 'absolute',
    left: 120,
    bottom: 40,
    width: 292,
    height: 292,
    borderRadius: 146,
    backgroundColor: '#1A3330',
  },
  bottomBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 170,
    backgroundColor: '#14241F',
  },
  card: {
    gap: 10,
    minHeight: 88,
    borderRadius: radii.hero,
    paddingVertical: spacing.lg,
    paddingHorizontal: 18,
    backgroundColor: '#F1F4FA',
  },
  pressed: {
    opacity: 0.85,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#2F5BEA',
  },
  meta: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: '#3A4357',
  },
  body: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#1B2436',
  },
});
