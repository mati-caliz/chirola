import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB_SIZE = 26;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - 6;

export const Switch = ({
  checked = false,
  onChange,
  disabled = false,
  label,
}: {
  checked?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => {
  const theme = useTheme();
  const position = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: checked ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [checked, position]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange?.(!checked)}
      style={{
        width: TRACK_WIDTH,
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        padding: 3,
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
        backgroundColor: checked ? theme.colors.actionPrimary : theme.colors.borderStrong,
      }}
    >
      <Animated.View
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: '#ffffff',
          transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }],
          ...theme.shadow.card,
        }}
      />
    </Pressable>
  );
};
