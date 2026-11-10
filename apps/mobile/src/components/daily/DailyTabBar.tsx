import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tm } from '@/i18n/tm';
import { td } from '@/i18n/td';
import { loadTodayPrompts } from '@/queue/prompts';
import { useStudyFocus } from '@/state/studyFocus';
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

type DailyTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  insets: { bottom: number };
  navigateToTab: (key: string) => void;
};

export function DailyTabBar({ state, insets, navigateToTab }: DailyTabBarProps) {
  const { focusedStudyId } = useStudyFocus();
  const [otherPrompts, setOtherPrompts] = useState(0);

  useEffect(() => {
    let active = true;

    void loadTodayPrompts()
      .then((result) => {
        if (!active) {
          return;
        }

        const primaryStudyId =
          result.participations.find(
            (participation) => participation.studyId === focusedStudyId,
          )?.studyId ??
          result.participations.find(
            (participation) => participation.status === 'active',
          )?.studyId ??
          result.participations[0]?.studyId;

        setOtherPrompts(
          result.activities.filter(
            (activity) => activity.studyId !== primaryStudyId,
          ).length,
        );
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [focusedStudyId, state.index]);

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
        const showBadge = route.name === 'studies' && otherPrompts > 0;
        const label = showBadge
          ? `${presentation.label}, ${
              otherPrompts === 1
                ? tm('studies.otherOpenRequestOne')
                : tm('studies.otherOpenRequests', { count: otherPrompts })
            }`
          : presentation.label;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
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
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{otherPrompts}</Text>
                </View>
              ) : null}
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

const studyDetailsRoutes = [
  { key: 'index', name: 'index' },
  { key: 'entries', name: 'entries' },
  { key: 'profile', name: 'profile' },
  { key: 'studies', name: 'studies' },
];

const studyDetailsHrefs = {
  index: '/(tabs)',
  entries: '/(tabs)/entries',
  profile: '/(tabs)/profile',
  studies: '/(tabs)/studies',
} as const;

// Study details open above the tabs, and the mockup keeps the bar there with Studies active.
export function StudyDetailsTabBar() {
  const insets = useSafeAreaInsets();

  return (
    <DailyTabBar
      insets={insets}
      navigateToTab={(key) =>
        router.dismissTo(studyDetailsHrefs[key as keyof typeof studyDetailsHrefs])
      }
      state={{ index: 3, routes: studyDetailsRoutes }}
    />
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
    // Opaque, the colour of the bar: Android drops the rounding when a transparent view gets a colour.
    backgroundColor: colors.surface,
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
