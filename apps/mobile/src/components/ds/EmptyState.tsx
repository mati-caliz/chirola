import { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { type IconRender } from '@/components/ds/IconButton';

export const EmptyState = ({
  icon,
  title,
  body,
  action,
}: {
  icon: IconRender;
  title: string;
  body?: string;
  action?: ReactNode;
}) => {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 40 }}>
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          backgroundColor: theme.colors.surfaceBrandSubtle,
        }}
      >
        {icon({ color: theme.colors.textBrand, size: 44 })}
      </View>
      <Text
        style={{
          fontFamily: theme.font.bold,
          fontSize: theme.fontSize.subhead,
          color: theme.colors.textPrimary,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: theme.fontSize.callout * theme.lineHeight.body,
            maxWidth: 280,
            marginBottom: action ? 20 : 0,
          }}
        >
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
};
