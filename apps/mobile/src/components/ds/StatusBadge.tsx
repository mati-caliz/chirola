import { StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { type StatusKey } from '@/theme/tokens';

const defaultLabels: Record<StatusKey, string> = {
  aprobado: 'Aprobado',
  observado: 'Observado',
  rechazado: 'Rechazado',
  pendiente: 'Pendiente',
};

function statusColors(theme: Theme, status: StatusKey) {
  const { colors } = theme;
  switch (status) {
    case 'aprobado':
      return { bg: colors.statusAprobadoBg, fg: colors.statusAprobadoFg };
    case 'observado':
      return { bg: colors.statusObservadoBg, fg: colors.statusObservadoFg };
    case 'rechazado':
      return { bg: colors.statusRechazadoBg, fg: colors.statusRechazadoFg };
    default:
      return { bg: colors.statusPendienteBg, fg: colors.statusPendienteFg };
  }
}

export const StatusBadge = ({
  status = 'pendiente',
  label,
  size = 'md',
}: {
  status?: StatusKey;
  label?: string;
  size?: 'sm' | 'md';
}) => {
  const theme = useTheme();
  const { bg, fg } = statusColors(theme, status);
  const small = size === 'sm';
  const dot = small ? 5 : 6;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: theme.radius.pill,
          paddingHorizontal: small ? 8 : 12,
          paddingVertical: small ? 2 : 4,
        },
      ]}
    >
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fg }} />
      <Text
        style={{ color: fg, fontFamily: theme.font.semibold, fontSize: small ? theme.fontSize.micro : theme.fontSize.caption }}
      >
        {label ?? defaultLabels[status]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
