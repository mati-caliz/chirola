import { Check, Copy } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card, IconButton } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import type { ReactNode } from "react";

const arcaGuide = [
  "Entrá a arca.gob.ar con tu CUIT y Clave Fiscal (nivel 3).",
  "Buscá el servicio «Administración de Certificados Digitales».",
  "Tocá «Agregar alias», pegá el CSR que copiaste y confirmá.",
  "Descargá el archivo .crt que te da ARCA y volvé acá.",
];

const ArcaGuideStep = ({ text, index }: Readonly<{ text: string; index: number }>): ReactNode => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: theme.colors.surfaceBrandSubtle,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.bold,
            fontSize: theme.fontSize.micro,
            color: theme.colors.textBrand,
          }}
        >
          {index + 1}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.caption,
          color: theme.colors.textPrimary,
          lineHeight: theme.fontSize.caption * theme.lineHeight.body,
        }}
      >
        {text}
      </Text>
    </View>
  );
};

interface UploadStepProps {
  csrPem: string | null;
  copied: boolean;
  onCopy: () => void;
}

export const UploadStep = ({ csrPem, copied, onCopy }: Readonly<UploadStepProps>): ReactNode => {
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
        Subí tu pedido al portal de ARCA
      </Text>
      <Card style={{ backgroundColor: theme.colors.bgSunken }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <Text
            numberOfLines={4}
            style={{
              flex: 1,
              fontFamily: theme.font.monoRegular,
              fontSize: theme.fontSize.micro,
              color: theme.colors.textSecondary,
            }}
          >
            {csrPem}
          </Text>
          <IconButton
            label={copied ? "Copiado" : "Copiar CSR"}
            variant="tonal"
            icon={(item) =>
              copied ? <Check {...item} strokeWidth={2} /> : <Copy {...item} strokeWidth={2} />
            }
            onPress={onCopy}
          />
        </View>
      </Card>
      <Card>
        <Text
          style={{
            fontFamily: theme.font.semibold,
            fontSize: theme.fontSize.micro,
            letterSpacing: 0.66,
            textTransform: "uppercase",
            color: theme.colors.textTertiary,
            marginBottom: 10,
          }}
        >
          Qué hacer en ARCA
        </Text>
        <View style={{ gap: 10 }}>
          {arcaGuide.map((text, index) => (
            <ArcaGuideStep key={text} text={text} index={index} />
          ))}
        </View>
      </Card>
    </>
  );
};
