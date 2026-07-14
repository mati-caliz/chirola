import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export const Divider = ({ inset = 0 }: { inset?: number }) => {
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
