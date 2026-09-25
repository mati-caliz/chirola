import { Text, View } from "react-native";
import type { ServicePeriod, TransmissionTypeName } from "@chirola/shared";
import { Card, Input, Segmented } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import { transmissionOptions } from "./form-model";
import type { ReactNode } from "react";

interface BillingDatesSectionProps {
  needsServicePeriod: boolean;
  needsPaymentDueDate: boolean;
  isFce: boolean;
  servicePeriod: ServicePeriod;
  paymentDueDate: string;
  transmissionType: TransmissionTypeName;
  onServicePeriodChange: (period: ServicePeriod) => void;
  onPaymentDueDateChange: (date: string) => void;
  onTransmissionTypeChange: (type: TransmissionTypeName) => void;
}

export const BillingDatesSection = ({
  needsServicePeriod,
  needsPaymentDueDate,
  isFce,
  servicePeriod,
  paymentDueDate,
  transmissionType,
  onServicePeriodChange,
  onPaymentDueDateChange,
  onTransmissionTypeChange,
}: BillingDatesSectionProps): ReactNode => {
  const theme = useTheme();
  return (
    <>
      {needsServicePeriod ? (
        <Card>
          <Text
            style={{
              fontFamily: theme.font.semibold,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textPrimary,
              marginBottom: 8,
            }}
          >
            Período facturado
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Desde"
                value={servicePeriod.from}
                onChangeText={(from) => {
                  onServicePeriodChange({ ...servicePeriod, from });
                }}
                placeholder="AAAA-MM-DD"
                mono
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Hasta"
                value={servicePeriod.to}
                onChangeText={(to) => {
                  onServicePeriodChange({ ...servicePeriod, to });
                }}
                placeholder="AAAA-MM-DD"
                mono
              />
            </View>
          </View>
        </Card>
      ) : null}

      {needsPaymentDueDate ? (
        <Input
          label="Vencimiento de pago"
          value={paymentDueDate}
          onChangeText={onPaymentDueDateChange}
          placeholder="AAAA-MM-DD"
          mono
        />
      ) : null}

      {isFce ? (
        <Segmented
          value={transmissionType}
          options={transmissionOptions}
          onChange={onTransmissionTypeChange}
          label="Tipo de transmisión"
        />
      ) : null}
    </>
  );
};
