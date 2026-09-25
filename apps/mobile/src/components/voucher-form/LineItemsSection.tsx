import { discriminatesIva } from "@chirola/shared";
import { Button } from "@/components/ds";
import { newItem, newTribute } from "./form-model";
import { ItemCard } from "./ItemCard";
import { TributeCard } from "./TributeCard";
import type { VoucherFormState } from "./use-voucher-form-state";
import type { ReactNode } from "react";

const replaceAt = <T,>(list: T[], index: number, patch: Partial<T>): T[] =>
  list.map((entry, position) => (position === index ? { ...entry, ...patch } : entry));

const removeAt = <T,>(list: T[], index: number): T[] => list.filter((_, position) => position !== index);

export const LineItemsSection = ({ form }: Readonly<{ form: VoucherFormState }>): ReactNode => {
  const { items, tributes, voucherType } = form.values;
  const { setItems, setTributes } = form.setters;
  return (
    <>
      {items.map((item, index) => (
        <ItemCard
          key={index}
          item={item}
          position={index + 1}
          discriminatesIva={discriminatesIva(voucherType)}
          canRemove={items.length > 1}
          onChange={(patch) => {
            setItems((prev) => replaceAt(prev, index, patch));
          }}
          onRemove={() => {
            setItems((prev) => removeAt(prev, index));
          }}
        />
      ))}
      <Button
        variant="ghost"
        full
        onPress={() => {
          setItems((prev) => [...prev, newItem()]);
        }}
      >
        + Agregar otro ítem
      </Button>

      {tributes.map((tribute, index) => (
        <TributeCard
          key={`tribute-${index}`}
          tribute={tribute}
          onChange={(patch) => {
            setTributes((prev) => replaceAt(prev, index, patch));
          }}
          onRemove={() => {
            setTributes((prev) => removeAt(prev, index));
          }}
        />
      ))}
      <Button
        variant="ghost"
        full
        onPress={() => {
          setTributes((prev) => [...prev, newTribute()]);
        }}
      >
        + Agregar percepción o tributo
      </Button>
    </>
  );
};
