import { X } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

export const EmittingScreen = (): ReactNode => {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32 }}>
        <ActivityIndicator size="large" color={theme.colors.actionPrimary} />
        <Text
          style={{
            fontFamily: theme.font.bold,
            fontSize: theme.fontSize.subhead,
            color: theme.colors.textPrimary,
          }}
        >
          Emitiendo contra ARCA…
        </Text>
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
            textAlign: "center",
          }}
        >
          No cierres la app. Esto tarda unos segundos.
        </Text>
      </View>
    </SafeAreaView>
  );
};

interface FailedEmissionScreenProps {
  message: string;
  onRetry: () => void;
  onExit: () => void;
}

export const FailedEmissionScreen = ({ message, onRetry, onExit }: FailedEmissionScreenProps): ReactNode => {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: theme.colors.statusRechazadoBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={44} color={theme.colors.statusRechazadoFg} strokeWidth={2.5} />
          </View>
          <Text
            style={{
              fontFamily: theme.font.extrabold,
              fontSize: theme.fontSize.heading,
              color: theme.colors.textPrimary,
              textAlign: "center",
            }}
          >
            No se pudo emitir
          </Text>
          <Text
            style={{
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.callout,
              color: theme.colors.textSecondary,
              textAlign: "center",
              maxWidth: 280,
            }}
          >
            No se emitió nada ni se usó numeración. Podés corregir y volver a intentar.
          </Text>
        </View>
        <Banner kind="error" title="ARCA rechazó el comprobante" body={message} />
        <Button variant="primary" full onPress={onRetry}>
          Corregir y reintentar
        </Button>
        <Button variant="ghost" full onPress={onExit}>
          Salir
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};
