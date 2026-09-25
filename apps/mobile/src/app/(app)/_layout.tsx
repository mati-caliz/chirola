import { Stack } from "expo-router";
import { ActiveIssuerProvider } from "@/lib/active-issuer";
import { BiometricGate } from "@/components/BiometricGate";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function AppLayout() {
  usePushNotifications();

  return (
    <BiometricGate>
      <ActiveIssuerProvider>
        <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: "minimal" }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="issuers/[issuerId]/vouchers/new"
            options={{ presentation: "modal", title: "Emitir comprobante" }}
          />
        </Stack>
      </ActiveIssuerProvider>
    </BiometricGate>
  );
}
