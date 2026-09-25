import { LOCAL_CURRENCY, hasText } from "@chirola/shared";
import { Input, Select } from "@/components/ds";
import type { VoucherEmission } from "./use-voucher-emission";
import { salesPointLabel, type VoucherFormOptions } from "./use-voucher-form-options";
import type { VoucherFormState } from "./use-voucher-form-state";
import type { ReactNode } from "react";

interface DocumentFieldsProps {
  form: VoucherFormState;
  options: VoucherFormOptions;
  emission: VoucherEmission;
}

const VoucherTypeSelect = ({ form, options, emission }: DocumentFieldsProps): ReactNode => {
  const selectedType = options.voucherTypeOptions.find((type) => type.value === form.values.voucherType);
  const selectedLabel = selectedType?.label;
  const selectedHint = selectedType?.hint;
  return (
    <Select
      label="Tipo de comprobante"
      {...(hasText(selectedLabel) && { value: selectedLabel })}
      {...(hasText(selectedHint) && { hint: selectedHint })}
      onPress={() => {
        emission.setSheet("tipo");
      }}
    />
  );
};

const SalesPointField = ({ form, options, emission }: DocumentFieldsProps): ReactNode => {
  const { salesPoints } = options;
  const { salesPoint } = form.values;
  if (salesPoints !== undefined && salesPoints.length > 0) {
    const label = salesPointLabel(salesPoints.find((point) => String(point.number) === salesPoint));
    return (
      <Select
        label="Punto de venta"
        {...(hasText(label) && { value: label })}
        onPress={() => {
          emission.setSheet("pdv");
        }}
      />
    );
  }
  return (
    <Input
      label="Punto de venta"
      value={salesPoint}
      onChangeText={form.setters.setSalesPoint}
      keyboardType="number-pad"
      mono
      hint="Sincronizá tus puntos de venta desde el emisor para elegirlos de una lista."
    />
  );
};

const CurrencyFields = ({ form, options, emission }: DocumentFieldsProps): ReactNode => {
  const { currency, exchangeRate } = form.values;
  const selectedLabel = options.currencyOptions.find((option) => option.value === currency)?.label;
  const isForeignCurrency = currency !== LOCAL_CURRENCY;
  return (
    <>
      <Select
        label="Moneda"
        {...(hasText(selectedLabel) && { value: selectedLabel })}
        {...(isForeignCurrency && { hint: `Cotización ${exchangeRate}` })}
        onPress={() => {
          emission.setSheet("moneda");
        }}
      />
      {isForeignCurrency ? (
        <Input
          label="Cotización"
          value={exchangeRate}
          onChangeText={form.setters.setExchangeRate}
          keyboardType="decimal-pad"
          mono
          hint={
            emission.exchangeRatePending ? "Consultando a ARCA…" : "ARCA valida contra su propia cotización."
          }
        />
      ) : null}
    </>
  );
};

export const DocumentFields = (props: DocumentFieldsProps): ReactNode => (
  <>
    <VoucherTypeSelect {...props} />
    <SalesPointField {...props} />
    <CurrencyFields {...props} />
  </>
);
