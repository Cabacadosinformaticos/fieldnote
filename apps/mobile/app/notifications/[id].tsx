import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { tm } from '@/i18n/tm';
import { fonts, radii, spacing } from '@/theme';

export default function LockScreenNotificationScreen() {
  return (
    <Screen
      backgroundColor="#131A2A"
      contentStyle={styles.content}
      scroll={false}
    >
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />

      <Pressable
        accessibilityLabel={tm('notifications.lockLabel')}
        accessibilityRole="button"
        onPress={() => router.replace('/(tabs)')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.metaRow}>
          <View style={styles.appIcon}>
            <Ionicons name="leaf" size={12} color="#FFFFFF" />
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
    paddingTop: 120,
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
  card: {
    gap: spacing.sm,
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
