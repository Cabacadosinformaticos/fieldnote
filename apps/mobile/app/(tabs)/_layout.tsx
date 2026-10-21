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
    >
      <Tabs.Screen name="index" options={{ title: td('tabs.today') }} />
      <Tabs.Screen name="entries" options={{ title: td('tabs.entries') }} />
      <Tabs.Screen name="studies" options={{ title: td('tabs.studies') }} />
      <Tabs.Screen name="profile" options={{ title: td('tabs.profile') }} />
    </Tabs>
  );
}
