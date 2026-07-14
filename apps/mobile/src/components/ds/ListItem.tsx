import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const ListItem = ({
  title,
  subtitle,
  leading,
  trailing,
  chevron = false,
  onPress,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}) => {
  const theme = useTheme();
  const content = (pressed: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: pressed ? theme.colors.bgSunken : 'transparent',
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: theme.font.medium, fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 2,
              fontFamily: theme.font.regular,
              fontSize: theme.fontSize.caption,
              color: theme.colors.textSecondary,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} /> : null}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress}>{({ pressed }) => content(pressed)}</Pressable>;
  }
  return content(false);
};
