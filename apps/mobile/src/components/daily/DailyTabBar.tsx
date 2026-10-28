import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const tabPresentation: Record<
  string,
  { label: string; icon: IoniconName; activeIcon: IoniconName }
> = {
  index: { label: td('tabs.today'), icon: 'sunny-outline', activeIcon: 'sunny' },
  entries: { label: td('tabs.entries'), icon: 'list-outline', activeIcon: 'list' },
  studies: { label: td('tabs.studies'), icon: 'layers-outline', activeIcon: 'layers' },
  profile: {
    label: td('tabs.profile'),
    icon: 'time-outline',
    activeIcon: 'time',
  },
};

export function DailyTabBar({ state, insets, navigateToTab }: BottomTabBarProps) {
  return (
    <View
      accessibilityLabel={td('tabs.main')}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xxl) }]}
    >
      {state.routes.map((route, index) => {
        const presentation = tabPresentation[route.name];
        if (!presentation) {
          return null;
        }

        const focused = state.index === index;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={presentation.label}
            accessibilityState={{ selected: focused }}
            key={route.key}
            onPress={() => navigateToTab(route.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={[styles.iconPill, focused && styles.iconPillActive]}>
              <Ionicons
                name={focused ? presentation.activeIcon : presentation.icon}
                size={22}
                color={focused ? colors.primaryDark : colors.textMuted}
              />
            </View>
            <Text style={[styles.label, focused ? styles.labelActive : styles.labelIdle]}>
              {presentation.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  item: {
    flex: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  iconPill: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
  iconPillActive: {
    backgroundColor: colors.primarySoft,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    lineHeight: 16,
    color: '#131A2A',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  labelActive: {
    fontFamily: fonts.extrabold,
    color: colors.primaryDark,
  },
  labelIdle: {
    fontFamily: fonts.semibold,
    color: colors.textMuted,
  },
});
