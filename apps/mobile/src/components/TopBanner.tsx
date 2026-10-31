import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { td } from '@/i18n/td';
import { colors, fonts, radii, spacing } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type TopBannerAction = {
  label: string;
  onPress: () => void;
};

export type TopBannerOptions = {
  icon: IoniconName;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  body?: string;
  note?: string;
  noteTone?: 'warning' | 'error';
  action?: TopBannerAction;
  accessibilityLabel?: string;
};

type TopBannerContextValue = {
  show: (options: TopBannerOptions) => void;
  hide: () => void;
};

const TopBannerContext = createContext<TopBannerContextValue | null>(null);

// Lets non-React code (the notification listeners) raise a banner too.
let externalShow: ((options: TopBannerOptions) => void) | null = null;

export function showTopBanner(options: TopBannerOptions): void {
  externalShow?.(options);
}

export function useTopBanner(): TopBannerContextValue {
  const value = useContext(TopBannerContext);
  if (!value) {
    throw new Error('useTopBanner must be used inside a TopBannerProvider');
  }
  return value;
}

const EXIT_OFFSET = 320;

export function TopBannerProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [banner, setBanner] = useState<TopBannerOptions | null>(null);

  // State keeps the values stable without handing refs to PanResponder.create.
  const [translateX] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-EXIT_OFFSET));
  const [opacity] = useState(() => new Animated.Value(0));

  const bannerRef = useRef<TopBannerOptions | null>(null);
  const visibleRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const sequenceRef = useRef(0);

  const swipeThreshold = Math.min(140, width * 0.3);
  const verticalThreshold = 72;

  const finishExit = useCallback(() => {
    visibleRef.current = false;
    bannerRef.current = null;
    setBanner(null);
    translateX.setValue(0);
    translateY.setValue(-EXIT_OFFSET);
    opacity.setValue(0);
  }, [opacity, translateX, translateY]);

  const exit = useCallback(
    (direction: 'left' | 'right' | 'up') => {
      if (!visibleRef.current) {
        return;
      }
      visibleRef.current = false;
      const sequence = sequenceRef.current;
      const duration = reduceMotionRef.current ? 0 : 200;

      const animations =
        direction === 'up'
          ? [
              Animated.timing(translateY, {
                toValue: -EXIT_OFFSET,
                duration,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration,
                useNativeDriver: true,
              }),
            ]
          : [
              Animated.timing(translateX, {
                toValue: (direction === 'right' ? 1 : -1) * (width + 120),
                duration,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration,
                useNativeDriver: true,
              }),
            ];

      Animated.parallel(animations).start(({ finished }) => {
        if (finished && sequence === sequenceRef.current) {
          finishExit();
        }
      });
    },
    [finishExit, opacity, translateX, translateY, width],
  );

  const hide = useCallback(() => exit('up'), [exit]);

  const show = useCallback(
    (options: TopBannerOptions) => {
      sequenceRef.current += 1;
      bannerRef.current = options;
      if (!visibleRef.current) {
        translateX.setValue(0);
        translateY.setValue(-EXIT_OFFSET);
        opacity.setValue(0);
      }
      setBanner(options);
    },
    [opacity, translateX, translateY],
  );

  useEffect(() => {
    externalShow = show;
    return () => {
      if (externalShow === show) {
        externalShow = null;
      }
    };
  }, [show]);

  useEffect(() => {
    if (!banner || visibleRef.current) {
      return;
    }
    visibleRef.current = true;
    const sequence = sequenceRef.current;
    let cancelled = false;

    const animateIn = (reduceMotion: boolean) => {
      if (cancelled || sequence !== sequenceRef.current) {
        return;
      }
      reduceMotionRef.current = reduceMotion;
      const duration = reduceMotion ? 0 : 240;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    };

    AccessibilityInfo.isReduceMotionEnabled()
      .then(animateIn)
      .catch(() => animateIn(false));

    return () => {
      cancelled = true;
    };
  }, [banner, opacity, translateY]);

  const springBack = useCallback(() => {
    if (reduceMotionRef.current) {
      translateX.setValue(0);
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, translateY]);

  const handlePress = useCallback(() => {
    const current = bannerRef.current;
    if (!current) {
      return;
    }
    current.action?.onPress();
    exit('up');
  }, [exit]);

  /* eslint-disable react-hooks/refs -- PanResponder stores these callbacks and
     invokes them from native gestures, never during render. */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || gesture.dy < -6,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || gesture.dy < -6,
        onPanResponderGrant: () => {
          translateX.stopAnimation();
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(gesture.dx);
          if (gesture.dy < 0) {
            translateY.setValue(Math.min(0, gesture.dy));
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) > swipeThreshold) {
            exit(gesture.dx > 0 ? 'right' : 'left');
          } else if (gesture.dy < -verticalThreshold) {
            exit('up');
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: () => springBack(),
        onPanResponderTerminationRequest: () => false,
      }),
    [exit, springBack, swipeThreshold, translateX, translateY],
  );
  /* eslint-enable react-hooks/refs */

  const value = useMemo(() => ({ show, hide }), [hide, show]);

  const label = banner
    ? (banner.accessibilityLabel ??
      [banner.title, banner.body, banner.note].filter(Boolean).join('. '))
    : undefined;

  return (
    <TopBannerContext.Provider value={value}>
      {children}
      {banner ? (
        <View
          pointerEvents="box-none"
          style={[styles.host, { paddingTop: insets.top + spacing.sm }]}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.card,
              { opacity, transform: [{ translateX }, { translateY }] },
            ]}
            {...panResponder.panHandlers}
          >
            <Pressable
              accessibilityActions={[{ name: 'dismiss', label: td('banner.close') }]}
              accessibilityLabel={label}
              accessibilityRole="button"
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'dismiss') {
                  hide();
                }
              }}
              onPress={handlePress}
              style={({ pressed }) => [styles.pressArea, pressed && styles.pressed]}
            >
              <View style={styles.header}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: banner.iconBackground ?? colors.primarySoft },
                  ]}
                >
                  <Ionicons
                    color={banner.iconColor ?? colors.primary}
                    name={banner.icon}
                    size={22}
                  />
                </View>
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={styles.title}>
                    {banner.title}
                  </Text>
                  {banner.body ? (
                    <Text numberOfLines={3} style={styles.body}>
                      {banner.body}
                    </Text>
                  ) : null}
                </View>
              </View>

              {banner.note ? (
                <Text
                  style={[
                    styles.note,
                    banner.noteTone === 'error' ? styles.noteError : styles.noteWarning,
                  ]}
                >
                  {banner.note}
                </Text>
              ) : null}
            </Pressable>

            {banner.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={handlePress}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Text style={styles.actionLabel}>{banner.action.label}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </TopBannerContext.Provider>
  );
}

const noteColors = {
  warning: {
    background: '#FFF3D6',
    border: '#F5D38A',
    text: '#5C3900',
  },
  error: {
    background: '#FDECEC',
    border: '#EDB4B4',
    text: '#9B1C1C',
  },
} as const;

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1000,
    paddingHorizontal: spacing.md,
  },
  card: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
    paddingLeft: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    elevation: 10,
    shadowColor: '#131A2A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  pressArea: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  note: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  noteWarning: {
    borderColor: noteColors.warning.border,
    backgroundColor: noteColors.warning.background,
    color: noteColors.warning.text,
  },
  noteError: {
    borderColor: noteColors.error.border,
    backgroundColor: noteColors.error.background,
    color: noteColors.error.text,
  },
  action: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  actionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  pressed: {
    opacity: 0.8,
  },
});
