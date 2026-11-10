import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type InfoRowProps = {
  icon: IoniconName;
  title?: string;
  body: string;
  tone?: 'default' | 'danger';
  /** A bare 20 dp icon instead of the tile, as the pending erasure mockup draws it. */
  plain?: boolean;
};

export function InfoRow({
  icon,
  title,
  body,
  tone = 'default',
  plain = false,
}: InfoRowProps) {
  const danger = tone === 'danger';

  return (
    <View style={[styles.row, plain && styles.rowPlain]}>
      {plain ? (
        <Ionicons name={icon} size={20} color={colors.textMuted} />
      ) : (
        <View style={[styles.tile, danger && styles.tileDanger]}>
          <Ionicons
            name={icon}
            size={18}
            color={danger ? '#9B1C1C' : colors.primaryDark}
          />
        </View>
      )}
      <View style={styles.text}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={[styles.body, !title && styles.bodyStandalone]}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowPlain: {
    gap: 12,
  },
  tile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  tileDanger: {
    backgroundColor: '#FDECEC',
  },
  text: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textMuted,
  },
  bodyStandalone: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});
