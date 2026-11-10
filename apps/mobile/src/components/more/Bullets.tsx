import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

type BulletsProps = {
  items: string[];
  /** 14/19 text with a 4 gap, as the app settings mockup draws it. */
  compact?: boolean;
};

export function Bullets({ items, compact = false }: BulletsProps) {
  return (
    <View style={[styles.list, compact && styles.listCompact]}>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <Text style={[styles.bullet, compact && styles.compactText]}>•</Text>
          <Text style={[styles.text, compact && styles.compactText]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  listCompact: {
    gap: 4,
  },
  compactText: {
    fontSize: 14,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 2,
  },
  bullet: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  text: {
    minWidth: 0,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});
