import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { captureTypeIcons, captureTypeLabelKeys } from '@/components/daily/captureType';
import type { CaptureType } from '@/fake/daily';
import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

const recordRoutes: Record<CaptureType, string> = {
  photo: '/record/photo',
  text: '/record/text',
  video: '/record/video',
  audio: '/record/audio',
  scale: '/record/scale',
};

type CaptureTypeTabsProps = {
  active: CaptureType;
  types: CaptureType[];
  activityId: string;
};

export function CaptureTypeTabs({ active, types, activityId }: CaptureTypeTabsProps) {
  if (types.length < 2) {
    return null;
  }

  return (
    <View accessibilityLabel={td('record.chooseType')} style={styles.tabs}>
      {types.map((type) => {
        const selected = type === active;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={type}
            onPress={() => {
              if (!selected) {
                router.replace({
                  pathname: recordRoutes[type],
                  params: { activityId },
                });
              }
            }}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={captureTypeIcons[type]}
              size={18}
              color={selected ? colors.primaryDark : colors.textMuted}
            />
            <Text style={[styles.label, selected && styles.labelActive]}>
              {td(captureTypeLabelKeys[type])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.xl,
    backgroundColor: colors.divider,
  },
  tab: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.75,
  },
});
