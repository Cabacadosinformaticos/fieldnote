import { Tabs } from 'expo-router/js-tabs';

import { DailyTabBar } from '@/components/daily/DailyTabBar';
import { td } from '@/i18n/td';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={(props) => <DailyTabBar {...props} />}
      backBehavior="history"
    >
      <Tabs.Screen name="index" options={{ title: td('tabs.today') }} />
      <Tabs.Screen name="entries" options={{ title: td('tabs.entries') }} />
      <Tabs.Screen name="profile" options={{ title: td('tabs.profile') }} />
      <Tabs.Screen name="studies" options={{ title: td('tabs.studies') }} />
      {/* Study details keep the tab bar, with Studies active (DailyTabBar skips this route). */}
      <Tabs.Screen name="study/[id]" options={{ href: null }} />
    </Tabs>
  );
}
