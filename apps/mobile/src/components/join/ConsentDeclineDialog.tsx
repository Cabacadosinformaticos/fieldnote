import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { tj } from '@/i18n/tj';
import { colors, fonts, radii, spacing } from '@/theme';

type ConsentDeclineDialogProps = {
  visible: boolean;
  onClose: () => void;
  onLeave: () => void;
};

export function ConsentDeclineDialog({
  visible,
  onClose,
  onLeave,
}: ConsentDeclineDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel={tj('consent.declineBack')}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityLabel={tj('consent.declineTitle')} accessibilityViewIsModal style={styles.card}>
          <Text style={styles.title}>{tj('consent.declineTitle')}</Text>
          <Text style={styles.body}>{tj('consent.declineBody')}</Text>
          <View style={styles.actions}>
            <Button label={tj('consent.declineBack')} onPress={onClose} />
            <Button
              label={tj('consent.declineLeave')}
              onPress={onLeave}
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.overlay,
  },
  card: {
    gap: spacing.md,
    borderRadius: radii.card,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 8,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textBody,
  },
  actions: {
    gap: 10,
    marginTop: spacing.sm,
  },
});
