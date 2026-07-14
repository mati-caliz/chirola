import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

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
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 280 : 200,
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
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: SCREEN_HEIGHT * 0.85,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 20,
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
            alignSelf: 'center',
            marginTop: 4,
            marginBottom: 12,
            backgroundColor: theme.colors.borderStrong,
          }}
        />
        {title ? (
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
