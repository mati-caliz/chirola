import { View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet, Button, Divider, ListItem, StatusBadge } from "@/components/ds";
import { useActiveIssuer } from "@/lib/active-issuer";
import type { ReactNode } from "react";

export const IssuerPickerSheet = ({
  open,
  onClose,
}: Readonly<{ open: boolean; onClose: () => void }>): ReactNode => {
  const router = useRouter();
  const { issuers, activeIssuerId, selectIssuer } = useActiveIssuer();
  return (
    <BottomSheet open={open} title="Tus emisores" onClose={onClose}>
      {issuers.map((issuer, index) => (
        <View key={issuer.id}>
          {index > 0 ? <Divider /> : null}
          <ListItem
            title={issuer.legalName}
            subtitle={`CUIT ${issuer.cuit}`}
            trailing={
              issuer.id === activeIssuerId ? (
                <StatusBadge status="aprobado" label="Activo" size="sm" />
              ) : undefined
            }
            onPress={() => {
              selectIssuer(issuer.id);
              onClose();
            }}
          />
        </View>
      ))}
      <View style={{ height: 12 }} />
      <Button
        variant="secondary"
        full
        onPress={() => {
          onClose();
          router.push("/(app)/issuers/new");
        }}
      >
        Agregar otro emisor
      </Button>
    </BottomSheet>
  );
};
