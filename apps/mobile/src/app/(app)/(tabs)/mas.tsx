import { useState, type ReactNode } from "react";
import {
  Building2,
  FileBadge,
  LogOut,
  Settings,
  ShieldCheck,
  Store,
  UserCircle,
  Users,
} from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Divider, ListItem, StatusBadge } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { IssuerPickerSheet } from "@/screens/shared/IssuerPickerSheet";

const SectionLabel = ({ children }: Readonly<{ children: string }>): ReactNode => {
  const theme = useTheme();
  return (
    <Text
      style={{
        fontFamily: theme.font.semibold,
        fontSize: theme.fontSize.micro,
        letterSpacing: 0.66,
        textTransform: "uppercase",
        color: theme.colors.textTertiary,
        marginBottom: 4,
      }}
    >
      {children}
    </Text>
  );
};

export default function MasScreen(): ReactNode {
  const theme = useTheme();
  const router = useRouter();
  const { logout } = useAuth();
  const { issuers, activeIssuer } = useActiveIssuer();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.screenPad, gap: 20, paddingBottom: 120 }}>
        <Text
          style={{
            fontFamily: theme.font.extrabold,
            fontSize: theme.fontSize.title,
            color: theme.colors.textPrimary,
          }}
        >
          Más
        </Text>

        <View>
          <SectionLabel>Emisor</SectionLabel>
          <Card pad={4}>
            <ListItem
              title={activeIssuer ? activeIssuer.legalName : "Sin emisor"}
              subtitle={activeIssuer ? `CUIT ${activeIssuer.cuit}` : "Agregá tu primer emisor"}
              leading={<Building2 color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
              trailing={
                issuers.length > 1 ? <StatusBadge status="pendiente" label="Cambiar" size="sm" /> : undefined
              }
              onPress={() => {
                if (issuers.length > 0) {
                  setPickerOpen(true);
                } else {
                  router.push("/(app)/issuers/new");
                }
              }}
            />
            {activeIssuer ? (
              <>
                <Divider inset={16} />
                <ListItem
                  title="Certificado ARCA"
                  leading={<ShieldCheck color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => {
                    router.push(`/(app)/issuers/${activeIssuer.id}/certificate`);
                  }}
                />
                <Divider inset={16} />
                <ListItem
                  title="Clientes"
                  leading={<Users color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => {
                    router.push(`/(app)/issuers/${activeIssuer.id}/clients`);
                  }}
                />
                <Divider inset={16} />
                <ListItem
                  title="Puntos de venta"
                  leading={<Store color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => {
                    router.push(`/(app)/issuers/${activeIssuer.id}/sales-points`);
                  }}
                />
                <Divider inset={16} />
                <ListItem
                  title="Datos del emisor"
                  leading={<FileBadge color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
                  chevron
                  onPress={() => {
                    router.push(`/(app)/issuers/${activeIssuer.id}`);
                  }}
                />
              </>
            ) : null}
          </Card>
        </View>

        <View>
          <SectionLabel>Cuenta</SectionLabel>
          <Card pad={4}>
            <ListItem
              title="Perfil"
              leading={<UserCircle color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
              chevron
              onPress={() => {
                router.push("/(app)/profile");
              }}
            />
            <Divider inset={16} />
            <ListItem
              title="Configuración"
              leading={<Settings color={theme.colors.textSecondary} size={20} strokeWidth={2} />}
              chevron
              onPress={() => {
                router.push("/(app)/config");
              }}
            />
            <Divider inset={16} />
            <ListItem
              title="Cerrar sesión"
              leading={<LogOut color={theme.colors.errFg} size={20} strokeWidth={2} />}
              onPress={() => {
                void logout();
              }}
            />
          </Card>
        </View>
      </ScrollView>

      <IssuerPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
