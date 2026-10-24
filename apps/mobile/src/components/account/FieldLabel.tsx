import { StyleSheet, Text } from 'react-native';

import { ta } from '@/i18n/ta';
import { colors, fonts } from '@/theme';

type FieldLabelProps = {
  label: string;
  optional?: boolean;
  required?: boolean;
};

export function FieldLabel({
  label,
  optional = false,
  required = false,
}: FieldLabelProps) {
  return (
    <Text style={styles.label}>
      {label}
      {required ? (
        <Text style={styles.required}> {ta('common.required')}</Text>
      ) : null}
      {optional ? (
        <Text style={styles.optional}> {ta('common.optional')}</Text>
      ) : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  required: {
    color: '#9B1C1C',
  },
  optional: {
    color: colors.textMuted,
  },
});
