import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ProfileScreen() {
  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />
      <Text style={styles.title}>{td('profile.title')}</Text>

      <Card style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="person-circle-outline" size={32} color={colors.primaryDark} />
        </View>
        <Text style={styles.body}>{td('profile.body')}</Text>
        <View style={styles.pill}>
          <Pill tone="primary">{td('common.comingSoon')}</Pill>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.28,
    color: colors.text,
  },
  card: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xxl,
    backgroundColor: colors.primarySoft,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textBody,
  },
  pill: {
    alignSelf: 'center',
  },
});
