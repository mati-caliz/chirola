import { Check, ShieldCheck } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card, Input, StatusBadge } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

export const Hero = ({ bg, children }: Readonly<{ bg: string; children: ReactNode }>): ReactNode => (
  <View
    style={{
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: bg,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {children}
  </View>
);

export const IntroStep = (): ReactNode => {
  const theme = useTheme();
  return (
    <>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
        <Hero bg={theme.colors.surfaceBrandSubtle}>
          <ShieldCheck size={48} color={theme.colors.textBrand} strokeWidth={1.5} />
        </Hero>
        <Text
          style={{
            fontFamily: theme.font.extrabold,
            fontSize: theme.fontSize.heading,
            color: theme.colors.textPrimary,
            textAlign: "center",
          }}
        >
          Conectemos tu emisor con ARCA
        </Text>
        <Text
          style={{
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
            textAlign: "center",
            maxWidth: 300,
            lineHeight: theme.fontSize.callout * theme.lineHeight.body,
          }}
        >
          Para facturar a tu nombre, ARCA pide un certificado digital. Se hace una sola vez y tarda unos 5
          minutos. Te guiamos en cada paso.
        </Text>
      </View>
      <Card>
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textPrimary,
          }}
        >
          Generamos tu clave privada
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.caption,
            color: theme.colors.textSecondary,
            lineHeight: theme.fontSize.caption * theme.lineHeight.body,
          }}
        >
          Queda cifrada en el servidor y nunca sale de ahí. Con ella armamos el «pedido de certificado» (CSR)
          que ARCA necesita.
        </Text>
      </Card>
    </>
  );
};

export const PasteStep = ({
  certPem,
  onChangeCertPem,
}: Readonly<{ certPem: string; onChangeCertPem: (value: string) => void }>): ReactNode => {
  const theme = useTheme();
  return (
    <>
      <Text
        style={{
          fontFamily: theme.font.bold,
          fontSize: theme.fontSize.subhead,
          color: theme.colors.textPrimary,
        }}
      >
        Pegá el certificado que te dio ARCA
      </Text>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        Abrí el archivo .crt y copiá todo el contenido.
      </Text>
      <Input
        value={certPem}
        onChangeText={onChangeCertPem}
        multiline
        mono
        placeholder={"-----BEGIN CERTIFICATE-----"}
        autoCapitalize="none"
        hint="Lo emparejamos con tu clave privada automáticamente."
        style={{ minHeight: 160 }}
      />
    </>
  );
};

export const DoneStep = (): ReactNode => {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
      <Hero bg={theme.colors.statusAprobadoBg}>
        <Check size={44} color={theme.colors.statusAprobadoFg} strokeWidth={2.5} />
      </Hero>
      <Text
        style={{
          fontFamily: theme.font.extrabold,
          fontSize: theme.fontSize.heading,
          color: theme.colors.textPrimary,
          textAlign: "center",
        }}
      >
        ¡Listo, ya podés facturar!
      </Text>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textSecondary,
          textAlign: "center",
          maxWidth: 280,
          lineHeight: theme.fontSize.callout * theme.lineHeight.body,
        }}
      >
        El certificado quedó emparejado y la conexión con ARCA funciona. Te avisamos antes de que venza.
      </Text>
      <StatusBadge status="aprobado" label="Conexión con ARCA OK" />
    </View>
  );
};
