import { type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import type { ThemeColors } from "@/theme/tokens";

function chipBackground(colors: ThemeColors, selected: boolean, pressed: boolean): string {
  if (selected) return colors.actionSecondary;
  return pressed ? colors.bgSunken : colors.surfaceCard;
}

export const Chip = ({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
}): ReactNode => {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: theme.radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.actionPrimary : colors.borderDefault,
        backgroundColor: chipBackground(colors, selected, pressed),
        transform: pressed ? [{ scale: 0.97 }] : [{ scale: 1 }],
      })}
    >
      {icon}
      <Text
        style={{
          color: selected ? colors.actionSecondaryText : colors.textSecondary,
          fontFamily: selected ? theme.font.semibold : theme.font.medium,
          fontSize: theme.fontSize.callout,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
