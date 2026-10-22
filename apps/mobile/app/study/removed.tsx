import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/more/InfoRow';
import { moreHref } from '@/components/more/navigation';
import { removedStudy } from '@/fake/more';
import { tm } from '@/i18n/tm';
import { colors, fonts, radii, spacing } from '@/theme';

export default function StudyRemovedScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <StatusBar style="dark" />

      <View style={styles.intro}>
        <View style={styles.icon}>
          <Ionicons name="person-remove-outline" size={38} color="#9B1C1C" />
        </View>
        <Text style={styles.title}>{tm('removed.title')}</Text>
        <Text style={styles.body}>
          {tm('removed.body', { study: removedStudy.name })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm('removed.whatTitle')}</Text>
        <InfoRow
          body={tm('removed.noRequestsBody')}
          icon="notifications-off-outline"
          title={tm('removed.noRequests')}
        />
        <InfoRow
          body={tm('removed.eraseBody')}
          icon="trash-outline"
          title={tm('removed.eraseTitle')}
          tone="danger"
        />
        <InfoRow
          body={tm('removed.contactBody', {
            name: removedStudy.teamName,
            email: removedStudy.teamEmail,
          })}
          icon="mail-outline"
          title={tm('removed.contact')}
        />
      </View>

      <View style={styles.spacer} />

      <Button
        label={tm('removed.erase')}
        onPress={() => router.push(moreHref(`/erase/${removedStudy.id}`))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingTop: 72,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  intro: {
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    backgroundColor: '#FDECEC',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.text,
  },
  card: {
    gap: spacing.lg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  spacer: {
    flexGrow: 1,
  },
});
