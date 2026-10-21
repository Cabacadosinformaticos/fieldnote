import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { colors, fonts, spacing } from '@/theme';

type RecordHeaderProps = {
  eyebrow: string;
  title: string;
};

export function RecordHeader({ eyebrow, title }: RecordHeaderProps) {
  return (
    <View style={styles.header}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.eyebrow}>
          {eyebrow}
        </Text>
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
  },
});
