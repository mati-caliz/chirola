import { View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

export const Divider = ({ inset = 0 }: { inset?: number }): ReactNode => {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        marginLeft: inset,
        backgroundColor: theme.colors.borderSubtle,
      }}
    />
  );
};
