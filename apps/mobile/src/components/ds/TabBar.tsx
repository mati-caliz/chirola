import { BarChart3, FileText, Home, MoreHorizontal, Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { type IconRender } from "@/components/ds/IconButton";
import type { ReactNode } from "react";

export type TabId = "inicio" | "comprobantes" | "fiscal" | "mas";

interface TabDefinition {
  id: TabId;
  label: string;
  icon: IconRender;
}

const homeTab: TabDefinition = {
  id: "inicio",
  label: "Inicio",
  icon: ({ color, size }) => <Home color={color} size={size} strokeWidth={2} />,
};

const vouchersTab: TabDefinition = {
  id: "comprobantes",
  label: "Comprobantes",
  icon: ({ color, size }) => <FileText color={color} size={size} strokeWidth={2} />,
};

const fiscalTab: TabDefinition = {
  id: "fiscal",
  label: "Fiscal",
  icon: ({ color, size }) => <BarChart3 color={color} size={size} strokeWidth={2} />,
};

const moreTab: TabDefinition = {
  id: "mas",
  label: "Más",
  icon: ({ color, size }) => <MoreHorizontal color={color} size={size} strokeWidth={2} />,
};

export const TabBar = ({
  active = "inicio",
  onSelect,
  onEmitir,
}: {
  active?: TabId;
  onSelect?: (id: TabId) => void;
  onEmitir?: () => void;
}): ReactNode => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const Tab = ({ id, label, icon }: Readonly<TabDefinition>): ReactNode => {
    const selected = active === id;
    const color = selected ? theme.colors.textBrand : theme.colors.textTertiary;
    return (
      <Pressable
        onPress={() => onSelect?.(id)}
        style={{ flex: 1, alignItems: "center", gap: 3, paddingTop: 8, paddingBottom: 6 }}
      >
        {icon({ color, size: 24 })}
        <Text
          numberOfLines={1}
          style={{
            fontFamily: selected ? theme.font.bold : theme.font.medium,
            fontSize: theme.fontSize.micro,
            color,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        height: theme.spacing.tabBarHeight + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.surfaceCard,
        borderTopWidth: 1,
        borderTopColor: theme.colors.borderSubtle,
      }}
    >
      <Tab {...homeTab} />
      <Tab {...vouchersTab} />
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emitir comprobante"
          onPress={onEmitir}
          style={{
            position: "absolute",
            top: -22,
            alignSelf: "center",
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.actionPrimary,
            ...theme.shadow.fab,
          }}
        >
          <Plus color={theme.colors.actionPrimaryText} size={26} strokeWidth={2.5} />
        </Pressable>
        <Text
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 6,
            textAlign: "center",
            fontFamily: theme.font.bold,
            fontSize: theme.fontSize.micro,
            color: theme.colors.textBrand,
          }}
        >
          Emitir
        </Text>
      </View>
      <Tab {...fiscalTab} />
      <Tab {...moreTab} />
    </View>
  );
};
