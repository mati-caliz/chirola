import { StyleSheet, Text, View } from "react-native";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { type StatusKey } from "@/theme/tokens";
import type { ReactNode } from "react";

const badgeMetrics = {
  sm: { dot: 5, paddingHorizontal: 8, paddingVertical: 2 },
  md: { dot: 6, paddingHorizontal: 12, paddingVertical: 4 },
} as const;

const defaultLabels: Record<StatusKey, string> = {
  aprobado: "Aprobado",
  observado: "Observado",
  rechazado: "Rechazado",
  pendiente: "Pendiente",
};

function statusColors(theme: Theme, status: StatusKey): { bg: string; fg: string } {
  const { colors } = theme;
  switch (status) {
    case "aprobado":
      return { bg: colors.statusAprobadoBg, fg: colors.statusAprobadoFg };
    case "observado":
      return { bg: colors.statusObservadoBg, fg: colors.statusObservadoFg };
    case "rechazado":
      return { bg: colors.statusRechazadoBg, fg: colors.statusRechazadoFg };
    case "pendiente":
      return { bg: colors.statusPendienteBg, fg: colors.statusPendienteFg };
  }
}

export const StatusBadge = ({
  status = "pendiente",
  label,
  size = "md",
}: {
  status?: StatusKey;
  label?: string;
  size?: "sm" | "md";
}): ReactNode => {
  const theme = useTheme();
  const { bg, fg } = statusColors(theme, status);
  const small = size === "sm";
  const metrics = badgeMetrics[size];
  const dot = metrics.dot;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.pill,
          paddingHorizontal: metrics.paddingHorizontal,
          paddingVertical: metrics.paddingVertical,
        },
      ]}
    >
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fg }} />
      <Text
        style={{
          color: fg,
          fontFamily: theme.font.semibold,
          fontSize: small ? theme.fontSize.micro : theme.fontSize.caption,
        }}
      >
        {label ?? defaultLabels[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
});
