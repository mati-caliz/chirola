import { ScrollView, Text, View } from 'react-native';
import { DocumentType, recipientIvaConditionName, voucherTypeName } from '@chirola/shared';
import { Banner, Button, Card, Chip, Input, Segmented } from '@/components/ds';
import type { Client } from '@/lib/resources';
import { useTheme } from '@/hooks/use-theme';
import { docTypeOptions } from './form-model';

interface RecipientSectionProps {
  clients: Client[] | undefined;
  voucherType: number;
  requiresCuit: boolean;
  docType: number;
  docNumber: string;
  legalName: string;
  ivaConditionId: number | null;
  padronPending: boolean;
  onChooseClient: (client: Client) => void;
  onDocTypeChange: (docType: number) => void;
  onDocNumberChange: (docNumber: string) => void;
  onLegalNameChange: (legalName: string) => void;
  onPadronLookup: () => void;
}

export const RecipientSection = ({
  clients,
  voucherType,
  requiresCuit,
  docType,
  docNumber,
  legalName,
  ivaConditionId,
  padronPending,
  onChooseClient,
  onDocTypeChange,
  onDocNumberChange,
  onLegalNameChange,
  onPadronLookup,
}: RecipientSectionProps) => {
  const theme = useTheme();
  return (
    <Card>
      <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.caption, color: theme.colors.textPrimary, marginBottom: 8 }}>
        Receptor
      </Text>
      {clients && clients.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          {clients.map((client) => (
            <Chip
              key={client.id}
              label={client.legalName ?? client.docNumber}
              selected={docNumber === client.docNumber}
              onPress={() => onChooseClient(client)}
            />
          ))}
        </ScrollView>
      ) : null}
      <Segmented value={docType} options={docTypeOptions} onChange={onDocTypeChange} />
      <View style={{ height: 10 }} />
      <Input label="Número de documento" value={docNumber} onChangeText={onDocNumberChange} keyboardType="number-pad" mono />
      {docType === DocumentType.CUIT ? (
        <Button variant="ghost" full onPress={onPadronLookup} disabled={padronPending}>
          {padronPending ? 'Consultando…' : 'Buscar en padrón ARCA'}
        </Button>
      ) : null}
      <View style={{ height: 10 }} />
      <Input label="Razón social" value={legalName} onChangeText={onLegalNameChange} placeholder="Opcional" />
      {ivaConditionId !== null ? (
        <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, marginTop: 8 }}>
          Condición IVA: {recipientIvaConditionName[ivaConditionId] ?? ivaConditionId}
        </Text>
      ) : null}
      {requiresCuit && docType !== DocumentType.CUIT ? (
        <View style={{ marginTop: 10 }}>
          <Banner kind="warning" title={`${voucherTypeName[voucherType]} necesita CUIT del receptor`} />
        </View>
      ) : null}
    </Card>
  );
};
