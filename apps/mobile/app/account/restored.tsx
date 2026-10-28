import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Note } from '@/components/account/Note';
import { accountHref } from '@/components/account/navigation';
import { formatDate } from '@/components/join/format';
import { StatusPill } from '@/components/more/StatusPill';
import { ta } from '@/i18n/ta';
import {
  getAccount,
  getAccountToken,
  getPoolCredential,
  getPoolMember,
  type AccountParticipation,
} from '@/state/actions';
import { colors, fonts, radii, spacing } from '@/theme';

type Row = {
  id: string;
  title: string;
  status: string;
  erasing: string | null;
};

function statusLabel(item: AccountParticipation): string {
  switch (item.status) {
    case 'pending_approval':
      return ta('account.pending');
    case 'withdrawn':
      return ta('account.withdrawn');
    case 'removed':
      return ta('account.removed');
    case 'erasure_scheduled':
      return ta('account.erasing');
    case 'declined':
      return ta('account.declined');
    default:
      return item.study.status === 'closed'
        ? ta('account.ended')
        : ta('account.active');
  }
}

function toRow(item: AccountParticipation): Row {
  return {
    id: item.study.id,
    title: item.study.title,
    status: statusLabel(item),
    erasing: item.erasure_due_at ? formatDate(item.erasure_due_at) : null,
  };
}

export default function AccountRestoredScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [poolSince, setPoolSince] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const token = await getAccountToken().catch(() => null);

      if (!token) {
        return;
      }

      const { data } = await getAccount(token);
      if (!data) {
        return;
      }

      setRows(data.participations.map(toRow));

      if (!data.pool_linked) {
        return;
      }

      const credential = await getPoolCredential();
      if (!credential) {
        return;
      }

      const member = await getPoolMember(credential);
      if (member.data) {
        setPoolSince(formatDate(member.data.joined_at));
      }
    };

    void load();
  }, []);

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
        {rows.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <View style={styles.statusLine}>
                  <Text style={styles.status}>{item.status}</Text>
                  {item.erasing ? (
                    <StatusPill
                      label={ta('restored.erasing', { date: item.erasing })}
                      tone="erasing"
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        ))}

        {poolSince ? (
          <View>
            {rows.length > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{ta('pool.title')}</Text>
                <Text style={styles.status}>
                  {ta('restored.pool', { date: poolSince })}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {rows.length === 0 && !poolSince ? (
          <View style={styles.row}>
            <Text style={styles.status}>{ta('account.noStudies')}</Text>
          </View>
        ) : null}
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
