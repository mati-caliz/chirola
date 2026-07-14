import { Stack } from 'expo-router';
import { ActiveIssuerProvider } from '@/lib/active-issuer';

export default function AppLayout() {
  return (
    <ActiveIssuerProvider>
      <Stack screenOptions={{ headerShown: true, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="issuers/[issuerId]/vouchers/new"
          options={{ presentation: 'modal', title: 'Emitir comprobante' }}
        />
      </Stack>
    </ActiveIssuerProvider>
  );
}
