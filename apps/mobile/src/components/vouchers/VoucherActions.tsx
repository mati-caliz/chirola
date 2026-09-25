import { FileMinus, Mail, Share2 } from "lucide-react-native";
import { View } from "react-native";
import * as MailComposer from "expo-mail-composer";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import { creditNoteTypeFor, voucherTypeName, hasText } from "@chirola/shared";
import { Banner, Button } from "@/components/ds";
import { useVoucherPdf } from "@/hooks/use-voucher-pdf";
import { useTheme } from "@/hooks/use-theme";
import { formatVoucherNumber } from "@/lib/format";
import type { VoucherDetail } from "@chirola/shared";
import type { ReactNode } from "react";

const PDF_MIME_TYPE = "application/pdf";
const PDF_UTI = "com.adobe.pdf";

export const VoucherActions = ({ voucher }: Readonly<{ voucher: VoucherDetail }>): ReactNode => {
  const theme = useTheme();
  const router = useRouter();
  const pdf = useVoucherPdf(voucher.id);
  const recipientEmail = voucher.client?.email ?? null;
  const label = `${voucherTypeName[voucher.voucherType] ?? "Comprobante"} ${formatVoucherNumber(voucher.salesPoint.number, voucher.number)}`;
  const canCreditNote = creditNoteTypeFor(voucher.voucherType) !== null;

  const share = (): Promise<void> =>
    pdf.withPdf(async (uri) => {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: PDF_MIME_TYPE, UTI: PDF_UTI, dialogTitle: label });
      }
    });

  const email = (): Promise<void> =>
    pdf.withPdf(async (uri) => {
      if (!(await MailComposer.isAvailableAsync())) {
        throw new Error("No hay una app de correo configurada en el teléfono. Usá Compartir.");
      }
      await MailComposer.composeAsync({
        recipients: hasText(recipientEmail) ? [recipientEmail] : [],
        subject: `${label} de ${voucher.issuer.legalName}`,
        body: `Te enviamos adjunto el comprobante ${label}.`,
        attachments: [uri],
      });
    });

  const creditNote = (): void => {
    router.push({
      pathname: "/(app)/issuers/[issuerId]/vouchers/new",
      params: { issuerId: voucher.issuerId, creditNoteFor: voucher.id },
    });
  };

  return (
    <View style={{ gap: 10 }}>
      {hasText(pdf.error) ? (
        <Banner kind="error" title="No se pudo enviar el comprobante" body={pdf.error} />
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            full
            loading={pdf.loading}
            icon={<Mail size={18} color={theme.colors.actionPrimaryText} strokeWidth={2} />}
            onPress={() => {
              void email();
            }}
          >
            {hasText(recipientEmail) ? "Enviar por mail" : "Mail"}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            full
            loading={pdf.loading}
            icon={<Share2 size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />}
            onPress={() => {
              void share();
            }}
          >
            Compartir
          </Button>
        </View>
      </View>
      {canCreditNote ? (
        <Button
          variant="ghost"
          full
          icon={<FileMinus size={18} color={theme.colors.textSecondary} strokeWidth={2} />}
          onPress={creditNote}
        >
          Anular con nota de crédito
        </Button>
      ) : null}
    </View>
  );
};
