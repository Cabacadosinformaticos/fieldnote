import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { accountHref } from '@/components/account/navigation';
import { poolNotification } from '@/fake/account';
import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

export default function PoolNotificationScreen() {
  return (
    <Screen
      backgroundColor="#131A2A"
      contentStyle={styles.content}
      scroll={false}
    >
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />
      <View pointerEvents="none" style={styles.bottomBand} />

      <Text style={styles.date}>{ta('poolNotification.date')}</Text>

      <Pressable
        accessibilityLabel={ta('poolNotification.label')}
        accessibilityRole="button"
        onPress={() => router.push(accountHref('/pool/invite'))}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.metaRow}>
          <View style={styles.appIcon}>
            <Ionicons name="leaf" size={11} color={colors.white} />
          </View>
          <Text style={styles.meta}>{ta('poolNotification.brand')}</Text>
          <Text style={styles.meta}>·</Text>
          <Text style={styles.meta}>{poolNotification.time}</Text>
        </View>
        <Text style={styles.body}>{ta('poolNotification.body')}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: 40,
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
  date: {
    marginTop: 24,
    marginBottom: 56,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: '#E3E7F0',
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
    backgroundColor: colors.primary,
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
