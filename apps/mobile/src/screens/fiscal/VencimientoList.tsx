import { CalendarClock } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card, Divider, StatusBadge } from "@/components/ds";
import type { Vencimiento, VencimientoStatusType } from "@chirola/shared";
import { formatDate } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import type { ReactNode } from "react";

const vencimientoStatus: Record<VencimientoStatusType, { key: StatusKey; label: string }> = {
  OVERDUE: { key: "rechazado", label: "Vencido" },
  DUE_SOON: { key: "observado", label: "Pronto" },
  UPCOMING: { key: "pendiente", label: "Próximo" },
};

const VencimientoRow = ({ item, index }: Readonly<{ item: Vencimiento; index: number }>): ReactNode => {
  const theme = useTheme();
  const badge = vencimientoStatus[item.status];
  return (
    <View>
      {index > 0 ? <Divider inset={16} /> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <CalendarClock size={20} color={theme.colors.textSecondary} strokeWidth={2} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: theme.font.medium,
              fontSize: theme.fontSize.callout,
              color: theme.colors.textPrimary,
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textSecondary,
            }}
          >
            Vence {formatDate(item.dueDate)}
          </Text>
        </View>
        <StatusBadge status={badge.key} label={badge.label} size="sm" />
      </View>
    </View>
  );
};

export const VencimientoList = ({ vencimientos }: Readonly<{ vencimientos: Vencimiento[] }>): ReactNode => (
  <Card pad={4}>
    {vencimientos.map((item, index) => (
      <VencimientoRow key={`${item.type}-${item.dueDate}`} item={item} index={index} />
    ))}
  </Card>
);
