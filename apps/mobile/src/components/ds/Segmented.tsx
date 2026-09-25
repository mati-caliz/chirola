import { Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";
import { Chip } from "@/components/ds/Chip";
import type { ReactNode } from "react";

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: Readonly<{
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label?: string;
}>): ReactNode {
  const theme = useTheme();
  return (
    <View>
      {hasText(label) ? (
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textPrimary,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={option.value === value}
            onPress={() => {
              onChange(option.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}
