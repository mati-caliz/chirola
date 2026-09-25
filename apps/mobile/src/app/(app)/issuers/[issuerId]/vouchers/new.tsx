import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Loading } from "@/components/ds";
import { VoucherForm } from "@/components/voucher-form/VoucherForm";
import { getCreditNoteDraft } from "@/lib/resources";
import { useTheme } from "@/hooks/use-theme";

export default function NewVoucherScreen() {
  const theme = useTheme();
  const { issuerId, creditNoteFor } = useLocalSearchParams<{
    issuerId: string;
    creditNoteFor?: string;
  }>();
  const draft = useQuery({
    queryKey: ["credit-note-draft", creditNoteFor],
    queryFn: () => getCreditNoteDraft(creditNoteFor ?? ""),
    enabled: Boolean(creditNoteFor),
  });

  if (!creditNoteFor) {
    return <VoucherForm issuerId={issuerId} draft={null} />;
  }
  if (draft.isLoading) {
    return <Loading />;
  }
  if (!draft.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp, padding: 20 }}>
        <Stack.Screen options={{ title: "Nota de crédito" }} />
        <Banner
          kind="error"
          title="No se puede anular este comprobante"
          body={draft.error?.message ?? "No pudimos armar la nota de crédito."}
        />
      </SafeAreaView>
    );
  }
  return <VoucherForm issuerId={issuerId} draft={draft.data} />;
}
