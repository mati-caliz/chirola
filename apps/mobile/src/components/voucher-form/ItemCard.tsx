import { Text, View } from 'react-native';
import { ivaRates, TaxTreatment, type TaxTreatmentType } from '@chirola/shared';
import { Button, Card, Input, Segmented } from '@/components/ds';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_IVA_RATE, NO_IVA_RATE, taxTreatmentOptions, type ItemForm } from './form-model';

interface ItemCardProps {
  item: ItemForm;
  position: number;
  discriminatesIva: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<ItemForm>) => void;
  onRemove: () => void;
}

const ivaRateOptions = ivaRates.map((rate) => ({ value: rate, label: `${rate}%` }));

export const ItemCard = ({ item, position, discriminatesIva, canRemove, onChange, onRemove }: ItemCardProps) => {
  const theme = useTheme();
  const taxed = discriminatesIva && item.taxTreatment === TaxTreatment.TAXED;
  const chooseTaxTreatment = (taxTreatment: TaxTreatmentType) =>
    onChange({
      taxTreatment,
      ivaRate: taxTreatment === TaxTreatment.TAXED ? DEFAULT_IVA_RATE : NO_IVA_RATE,
    });

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary }}>
          Ítem {position}
        </Text>
        {canRemove ? (
          <Button variant="ghost" size="sm" onPress={onRemove}>
            Quitar
          </Button>
        ) : null}
      </View>
      <Input label="Descripción" value={item.description} onChangeText={(description) => onChange({ description })} />
      <View style={{ height: 10 }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 96 }}>
          <Input label="Cantidad" value={item.quantity} onChangeText={(quantity) => onChange({ quantity })} keyboardType="decimal-pad" mono />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Precio unitario" value={item.unitPrice} onChangeText={(unitPrice) => onChange({ unitPrice })} keyboardType="decimal-pad" mono prefix="$" />
        </View>
      </View>
      {discriminatesIva ? (
        <>
          <View style={{ height: 10 }} />
          <Segmented value={item.taxTreatment} options={taxTreatmentOptions} onChange={chooseTaxTreatment} label="Tratamiento" />
        </>
      ) : null}
      {taxed ? (
        <>
          <View style={{ height: 10 }} />
          <Segmented value={item.ivaRate} options={ivaRateOptions} onChange={(ivaRate) => onChange({ ivaRate })} label="IVA" />
          <Text style={{ marginTop: 10, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary }}>
            El precio incluye IVA {item.ivaRate}%.
          </Text>
        </>
      ) : null}
    </Card>
  );
};
