import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";

const TITLE_PADDING_WITHOUT_BACK = 12;

export const NavBar = ({
  title,
  subtitle,
  onBack,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}): ReactNode => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: theme.spacing.navBarHeight,
        paddingHorizontal: 8,
        backgroundColor: theme.colors.bgApp,
      }}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={onBack}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ChevronLeft size={24} color={theme.colors.textPrimary} strokeWidth={2} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, paddingLeft: onBack ? 0 : TITLE_PADDING_WITHOUT_BACK }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: theme.font.bold,
            fontSize: theme.fontSize.subhead,
            color: theme.colors.textPrimary,
          }}
        >
          {title}
        </Text>
        {hasText(subtitle) ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.micro,
              color: theme.colors.textSecondary,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
};
