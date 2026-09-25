import { BottomSheet, ListItem } from "@/components/ds";
import { ConfirmEmissionSheet } from "@/components/vouchers/ConfirmEmissionSheet";
import { hasText } from "@chirola/shared";
import type { VoucherEmission } from "./use-voucher-emission";
import { padSalesPoint, recipientLabel, type VoucherFormOptions } from "./use-voucher-form-options";
import type { VoucherFormState } from "./use-voucher-form-state";
import type { ReactNode } from "react";

interface VoucherFormSheetsProps {
  form: VoucherFormState;
  options: VoucherFormOptions;
  emission: VoucherEmission;
}

const VoucherTypeSheet = ({ form, options, emission }: VoucherFormSheetsProps): ReactNode => (
  <BottomSheet
    open={emission.sheet === "tipo"}
    title="Tipo de comprobante"
    onClose={() => {
      emission.setSheet(null);
    }}
  >
    {options.voucherTypeOptions.map((type) => (
      <ListItem
        key={type.value}
        title={type.label}
        {...(hasText(type.hint) && { subtitle: type.hint })}
        onPress={() => {
          form.setters.setVoucherType(type.value);
          emission.setSheet(null);
        }}
      />
    ))}
  </BottomSheet>
);

const SalesPointSheet = ({ form, options, emission }: VoucherFormSheetsProps): ReactNode => (
  <BottomSheet
    open={emission.sheet === "pdv"}
    title="Punto de venta"
    onClose={() => {
      emission.setSheet(null);
    }}
  >
    {(options.salesPoints ?? []).map((point) => (
      <ListItem
        key={point.id}
        title={`Punto de venta ${padSalesPoint(point.number)}`}
        {...(hasText(point.description) && { subtitle: point.description })}
        onPress={() => {
          form.setters.setSalesPoint(String(point.number));
          emission.setSheet(null);
        }}
      />
    ))}
  </BottomSheet>
);

const CurrencySheet = ({ options, emission }: Omit<VoucherFormSheetsProps, "form">): ReactNode => (
  <BottomSheet
    open={emission.sheet === "moneda"}
    title="Moneda"
    onClose={() => {
      emission.setSheet(null);
    }}
  >
    {options.currencyOptions.map((option) => (
      <ListItem
        key={option.value}
        title={option.label}
        subtitle={option.value}
        onPress={() => {
          emission.chooseCurrency(option.value);
        }}
      />
    ))}
  </BottomSheet>
);

const ConfirmSheet = ({ form, options, emission }: VoucherFormSheetsProps): ReactNode => {
  const { voucherType, legalName, docType, docNumber, currency } = form.values;
  const selectedType = options.voucherTypeOptions.find((type) => type.value === voucherType);
  return (
    <ConfirmEmissionSheet
      open={emission.sheet === "confirm"}
      typeLabel={selectedType?.label}
      clientLabel={recipientLabel(legalName, docType, docNumber)}
      currency={currency}
      plan={emission.emissionPlan.data}
      planLoading={emission.emissionPlan.isPending}
      planError={emission.emissionPlan.error?.message ?? null}
      onClose={() => {
        emission.setSheet(null);
      }}
      onConfirm={emission.emit}
    />
  );
};

export const VoucherFormSheets = (props: VoucherFormSheetsProps): ReactNode => (
  <>
    <VoucherTypeSheet {...props} />
    <SalesPointSheet {...props} />
    <CurrencySheet options={props.options} emission={props.emission} />
    <ConfirmSheet {...props} />
  </>
);
