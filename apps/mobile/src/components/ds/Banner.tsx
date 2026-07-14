import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme, type Theme } from '@/hooks/use-theme';

export type BannerKind = 'error' | 'warning' | 'success' | 'info';

function kindColors(theme: Theme, kind: BannerKind) {
  const { colors } = theme;
  switch (kind) {
    case 'warning':
      return { bg: colors.statusObservadoBg, fg: colors.statusObservadoFg };
    case 'success':
      return { bg: colors.statusAprobadoBg, fg: colors.statusAprobadoFg };
    case 'info':
      return { bg: colors.surfaceBrandSubtle, fg: colors.textBrand };
    default:
      return { bg: colors.statusRechazadoBg, fg: colors.statusRechazadoFg };
  }
}

export const Banner = ({
  kind = 'error',
  title,
  body,
  detail,
  action,
}: {
  kind?: BannerKind;
  title: string;
  body?: string;
  detail?: string;
  action?: ReactNode;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const { bg, fg } = kindColors(theme, kind);
  return (
    <View style={{ backgroundColor: bg, borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 14 }}>
      <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.callout, color: fg }}>{title}</Text>
      {body ? (
        <Text
          style={{
            marginTop: 4,
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.caption,
            color: fg,
            lineHeight: theme.fontSize.caption * theme.lineHeight.snug,
          }}
        >
          {body}
        </Text>
      ) : null}
      {detail ? (
        <Pressable onPress={() => setOpen((prev) => !prev)}>
          <Text
            style={{
              marginTop: 8,
              fontFamily: theme.font.semibold,
              fontSize: theme.fontSize.caption,
              color: fg,
              textDecorationLine: 'underline',
            }}
          >
            {open ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
          </Text>
        </Pressable>
      ) : null}
      {detail && open ? (
        <Text style={{ marginTop: 6, fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.micro, color: fg }}>
          {detail}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
};
