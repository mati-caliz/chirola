import { Tabs, useRouter } from 'expo-router';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBar, type TabId } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';

const routeToTab: Record<string, TabId> = {
  index: 'inicio',
  comprobantes: 'comprobantes',
  fiscal: 'fiscal',
  mas: 'mas',
};

const tabToRoute: Record<TabId, string> = {
  inicio: 'index',
  comprobantes: 'comprobantes',
  fiscal: 'fiscal',
  mas: 'mas',
};

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { activeIssuer } = useActiveIssuer();
  const activeRoute = state.routes[state.index].name;
  const active = routeToTab[activeRoute] ?? 'inicio';
  return (
    <TabBar
      active={active}
      onSelect={(id) => navigation.navigate(tabToRoute[id])}
      onEmitir={() =>
        router.push(activeIssuer ? `/(app)/issuers/${activeIssuer.id}/vouchers/new` : '/(app)/(tabs)/mas')
      }
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="comprobantes" />
      <Tabs.Screen name="fiscal" />
      <Tabs.Screen name="mas" />
    </Tabs>
  );
}
