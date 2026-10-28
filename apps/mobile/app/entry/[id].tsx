import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Screen } from '@/components/Screen';
import { EntryStatusPill } from '@/components/daily/EntryStatusPill';
import { captureTypeLabelKeys } from '@/components/daily/captureType';
import { formatFullRecorded, formatReceived } from '@/components/daily/entryFormat';
import { td } from '@/i18n/td';
import { useOutboxEntry } from '@/queue/hooks';
import { scaleMaximum } from '@/queue/scale';
import type { CaptureType, OutboxEntry } from '@/queue/types';
import { colors, fonts, radii, spacing } from '@/theme';

function sentMediaLabel(type: CaptureType): string | null {
  if (type === 'photo') {
    return td('entry.photoSent');
  }
  if (type === 'video') {
    return td('entry.videoSent');
  }
  if (type === 'audio') {
    return td('entry.audioSent');
  }
  return null;
}

function MediaBlock({ entry }: { entry: OutboxEntry }) {
  const local = entry.media[0]?.localPath;
  const sent = entry.state === 'sent';

  if (entry.entryType === 'photo') {
    if (local && !sent) {
      return (
        <Image
          accessibilityLabel={td('entry.photoLabel')}
          contentFit="cover"
          source={{ uri: local }}
          style={styles.photo}
        />
      );
    }
    return (
      <View style={styles.mediaPlaceholder}>
        <Ionicons name="camera-outline" size={36} color={colors.primaryDark} />
        <Text style={styles.mediaPlaceholderText}>
          {sent ? td('entry.photoSent') : td('entry.photoLabel')}
        </Text>
      </View>
    );
  }

  if (entry.entryType === 'video' || entry.entryType === 'audio') {
    const isVideo = entry.entryType === 'video';
    return (
      <View style={styles.mediaPlaceholder}>
        <View style={styles.mediaIcon}>
          <Ionicons
            name={isVideo ? 'videocam-outline' : 'mic-outline'}
            size={26}
            color={colors.primaryDark}
          />
        </View>
        <Text style={styles.mediaPlaceholderText}>
          {sent ? sentMediaLabel(entry.entryType) : td('entry.recording')}
        </Text>
      </View>
    );
  }

  return null;
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entry, loading } = useOutboxEntry(id);

  if (loading) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryDark} />
        </View>
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen contentStyle={styles.content} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.body}>
          <Text style={styles.notFound}>{td('entry.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const recorded = formatFullRecorded(entry.recordedAt);
  const received = entry.serverReceivedAt
    ? formatReceived(entry.serverReceivedAt)
    : td('entry.notReceived');

  const rows: { label: string; value: string }[] = [
    { label: td('entry.activity'), value: entry.activityTitle },
    { label: td('entry.recorded'), value: recorded },
    { label: td('entry.received'), value: received },
  ];

  const scaleMax = scaleMaximum(entry.payload.scaleShown);
  const body = entry.payload.body;
  const isMedia =
    entry.entryType === 'photo' ||
    entry.entryType === 'video' ||
    entry.entryType === 'audio';

  return (
    <Screen contentStyle={styles.content} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.eyebrow}>
            {td('entry.kind', {
              type: td(captureTypeLabelKeys[entry.entryType]),
            })}
          </Text>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {entry.activityTitle}
          </Text>
        </View>
        <EntryStatusPill state={entry.state} />
      </View>

      <View style={styles.body}>
        {isMedia ? <MediaBlock entry={entry} /> : null}

        {entry.entryType === 'scale' ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentLabel}>{td('entry.answer')}</Text>
            <Text style={styles.scaleValue}>
              {td('entry.scaleValue', {
                value: entry.payload.value ?? '',
                max: scaleMax,
              })}
            </Text>
            {entry.payload.scaleShown?.start_label ||
            entry.payload.scaleShown?.end_label ? (
              <Text style={styles.scaleEnds}>
                {[
                  entry.payload.scaleShown.start_label,
                  entry.payload.scaleShown.end_label,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {body ? (
          <View style={styles.contentCard}>
            <Text style={styles.contentLabel}>
              {entry.entryType === 'photo' ? td('entry.phrase') : td('entry.answer')}
            </Text>
            <Text style={styles.contentValue}>{body}</Text>
          </View>
        ) : null}

        {entry.state === 'failed' ? (
          <View style={styles.failureCard}>
            <View style={styles.failureHeader}>
              <Ionicons name="warning-outline" size={20} color="#9B1C1C" />
              <Text style={styles.failureTitle}>{td('entry.failedTitle')}</Text>
            </View>
            <Text style={styles.failureBody}>{td('entry.failedBody')}</Text>
          </View>
        ) : null}

        <View style={styles.metaCard}>
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.metaRow, index > 0 && styles.metaRowDivided]}
            >
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {entry.state === 'queued' || entry.state === 'sending' ? (
          <View style={styles.lockRow}>
            <Ionicons
              name="cloud-upload-outline"
              size={18}
              color={colors.textMuted}
            />
            <Text style={styles.lockText}>{td('entry.retryHint')}</Text>
          </View>
        ) : null}

        {entry.state === 'sent' ? (
          <View style={styles.lockRow}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.textMuted}
            />
            <Text style={styles.lockText}>{td('entry.lock')}</Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  headerTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
  body: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  photo: {
    width: '100%',
    height: 300,
    borderRadius: radii.card,
    backgroundColor: colors.scanBackground,
  },
  mediaPlaceholder: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  mediaIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
  },
  mediaPlaceholderText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    color: colors.textBody,
  },
  contentCard: {
    gap: spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  contentLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  contentValue: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  scaleValue: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.primaryDark,
  },
  scaleEnds: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  failureCard: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: '#EDB4B4',
    backgroundColor: '#FDECEC',
  },
  failureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  failureTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: '#9B1C1C',
  },
  failureBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#7A1A1A',
  },
  metaCard: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  metaRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  metaRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  metaLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  metaValue: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'right',
    color: colors.text,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.xs,
  },
  lockText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
