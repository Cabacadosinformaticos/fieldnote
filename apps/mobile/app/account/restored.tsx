import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { StatusPill } from '@/components/more/StatusPill';
import { restoredStudies, type RestoredStudy } from '@/fake/account';
import { ta } from '@/i18n/ta';
import { colors, fonts, radii, spacing } from '@/theme';

function statusLabel(item: RestoredStudy): string {
  if (item.status === 'active') {
    return ta('restored.active');
  }

  if (item.status === 'pool') {
    return ta('restored.pool', { date: item.memberSince ?? '' });
  }

  return ta('restored.ended');
}

export default function AccountRestoredScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.header} />

      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons
            name="checkmark-circle"
            size={30}
            color={colors.successText}
          />
        </View>
        <Text style={styles.title}>{ta('restored.title')}</Text>
        <Text style={styles.body}>{ta('restored.body')}</Text>
      </View>

      <View
        accessibilityLabel={ta('restored.listLabel')}
        style={styles.card}
      >
        {restoredStudies.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <View style={styles.statusLine}>
                  <Text style={styles.status}>{statusLabel(item)}</Text>
                  {item.erasingDate ? (
                    <StatusPill
                      label={ta('restored.erasing', { date: item.erasingDate })}
                      tone="erasing"
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Note
        body={ta('restored.notifications')}
        icon="notifications-outline"
        tone="warning"
      />

      <View style={styles.spacer} />

      <Button
        label={ta('restored.continue')}
        onPress={() => router.replace(accountHref('/(tabs)'))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: {
    height: 48,
  },
  intro: {
    gap: spacing.md,
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: colors.successBackground,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  rowText: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  status: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  spacer: {
    flexGrow: 1,
  },
});
