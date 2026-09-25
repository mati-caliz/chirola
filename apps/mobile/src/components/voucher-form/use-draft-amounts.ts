import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DraftAmounts, DraftAmountsInput } from "@chirola/shared";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { calculateDraftAmounts } from "@/lib/resources";

const RECALCULATION_DELAY_MS = 400;

export function useDraftAmounts(input: DraftAmountsInput | null): UseQueryResult<NoInfer<DraftAmounts>> {
  const debounced = useDebouncedValue(input, RECALCULATION_DELAY_MS);
  return useQuery({
    queryKey: ["draft-amounts", debounced],
    queryFn: () => {
      if (debounced === null) {
        throw new Error("El borrador todavía no tiene importes válidos.");
      }
      return calculateDraftAmounts(debounced);
    },
    enabled: debounced !== null,
    placeholderData: keepPreviousData,
  });
}
