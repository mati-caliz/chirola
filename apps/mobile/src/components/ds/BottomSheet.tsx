import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Dimensions, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const OPEN_DURATION_MS = 280;
const CLOSE_DURATION_MS = 200;
const MAX_HEIGHT_RATIO = 0.85;
const SHEET_HORIZONTAL_PADDING = 20;

export const BottomSheet = ({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children: ReactNode;
}): ReactNode => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? OPEN_DURATION_MS : CLOSE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  return (
    <Modal visible={open} transparent statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.overlayScrim, opacity: progress }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: SCREEN_HEIGHT * MAX_HEIGHT_RATIO,
          paddingHorizontal: SHEET_HORIZONTAL_PADDING,
          paddingTop: 8,
          paddingBottom: insets.bottom + SHEET_HORIZONTAL_PADDING,
          backgroundColor: theme.colors.surfaceSheet,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          ...theme.shadow.sheet,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT, 0] }) },
          ],
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            alignSelf: "center",
            marginTop: 4,
            marginBottom: 12,
            backgroundColor: theme.colors.borderStrong,
          }}
        />
        {hasText(title) ? (
          <Text
            style={{
              marginBottom: 12,
              fontFamily: theme.font.bold,
              fontSize: theme.fontSize.subhead,
              color: theme.colors.textPrimary,
            }}
          >
            {title}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
};
