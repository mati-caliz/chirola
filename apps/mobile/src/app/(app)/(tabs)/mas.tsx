import { useState } from 'react';
import { Building2, FileBadge, LogOut, ShieldCheck, Users } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Card, Divider, ListItem, StatusBadge } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

const SectionLabel = ({ children }: { children: string }) => {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.font.semibold,
        fontSize: theme.fontSize.micro,
        letterSpacing: 0.66,
        textTransform: 'uppercase',
        color: theme.colors.textTertiary,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
};

export default function MasScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { logout } = useAuth();
  const { issuers, activeIssuer, activeIssuerId, selectIssuer } = useActiveIssuer();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.screenPad, gap: 20, paddingBottom: 120 }}>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textPrimary }}>
          Más
        </Text>

        <View>
          <SectionLabel>Emisor</SectionLabel>
          <Card pad={4}>
            <ListItem
              title={activeIssuer ? activeIssuer.legalName : 'Sin emisor'}
              subtitle={activeIssuer ? `CUIT ${activeIssuer.cuit}` : 'Agregá tu primer emisor'}
              leading={<Building2 color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
              trailing={issuers.length > 1 ? <StatusBadge status="pendiente" label="Cambiar" size="sm" /> : undefined}
              onPress={() => (issuers.length > 0 ? setPickerOpen(true) : router.push('/(app)/issuers/new'))}
            />
            {activeIssuer ? (
              <>
                <Divider inset={16} />
                <ListItem
                  title="Certificado ARCA"
                  leading={<ShieldCheck color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/certificate`)}
                />
                <Divider inset={16} />
                <ListItem
                  title="Clientes"
                  leading={<Users color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}/clients`)}
                />
                <Divider inset={16} />
                <ListItem
                  title="Datos del emisor"
                  leading={<FileBadge color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => router.push(`/(app)/issuers/${activeIssuer.id}`)}
                />
              </>
            ) : null}
          </Card>
        </View>

        <View>
          <SectionLabel>Cuenta</SectionLabel>
          <Card pad={4}>
            <ListItem
              title="Cerrar sesión"
              leading={<LogOut color={theme.colors.errFg} size={20} strokeWidth={2} />}
              onPress={logout}
            />
          </Card>
        </View>
      </ScrollView>

      <BottomSheet open={pickerOpen} title="Tus emisores" onClose={() => setPickerOpen(false)}>
        {issuers.map((issuer, index) => (
          <View key={issuer.id}>
            {index > 0 ? <Divider /> : null}
            <ListItem
              title={issuer.legalName}
              subtitle={`CUIT ${issuer.cuit}`}
              trailing={
                issuer.id === activeIssuerId ? <StatusBadge status="aprobado" label="Activo" size="sm" /> : undefined
              }
              onPress={() => {
                selectIssuer(issuer.id);
                setPickerOpen(false);
              }}
            />
          </View>
        ))}
        <View style={{ height: 12 }} />
        <Button
          variant="secondary"
          full
          onPress={() => {
            setPickerOpen(false);
            router.push('/(app)/issuers/new');
          }}
        >
          Agregar otro emisor
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}
