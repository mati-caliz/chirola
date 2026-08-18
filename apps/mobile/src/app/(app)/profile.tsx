import { LogOut } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { Button, Card, Divider, Screen } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
      <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
        {label}
      </Text>
      <Text style={{ fontFamily: theme.font.medium, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
};

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { issuers } = useActiveIssuer();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <>
      <Stack.Screen options={{ title: 'Perfil' }} />
      <Screen>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.surfaceBrandSubtle, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textBrand }}>
              {initial}
            </Text>
          </View>
          <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
            {user?.email}
          </Text>
        </View>

        <Card>
          <InfoRow label="Emisores" value={String(issuers.length)} />
          <Divider />
          <InfoRow label="Versión" value={version} />
        </Card>

        <Button variant="danger" full icon={<LogOut size={18} color={theme.colors.textInverse} strokeWidth={2} />} onPress={logout}>
          Cerrar sesión
        </Button>
      </Screen>
    </>
  );
}
