import { useState } from "react";
import { FileSpreadsheet } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useQuery } from "@tanstack/react-query";
import { Amount, Banner, Button, Card, Divider } from "@/components/ds";
import { downloadSalesBookCsv, getSalesBook } from "@/lib/resources";
import { formatCurrency } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";

const CSV_MIME_TYPE = "text/csv";
const CSV_UTI = "public.comma-separated-values-text";

interface SalesBookCardProps {
  issuerId: string;
  year: number;
  month: number;
  monthLabel: string;
}

export const SalesBookCard = ({ issuerId, year, month, monthLabel }: SalesBookCardProps) => {
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const book = useQuery({
    queryKey: ["sales-book", issuerId, year, month],
    queryFn: () => getSalesBook(issuerId, year, month),
  });

  const exportCsv = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const base64 = await downloadSalesBookCsv(issuerId, year, month);
      const file = new File(Paths.cache, `libro-iva-ventas-${year}-${String(month).padStart(2, "0")}.csv`);
      if (file.exists) {
        file.delete();
      }
      file.write(base64, { encoding: "base64" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: CSV_MIME_TYPE,
          UTI: CSV_UTI,
          dialogTitle: `Libro IVA Ventas · ${monthLabel}`,
        });
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "No se pudo exportar el libro.");
    } finally {
      setExporting(false);
    }
  };

  const totals = book.data?.totals;

  return (
    <Card>
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.66,
          textTransform: "uppercase",
          color: theme.colors.textTertiary,
        }}
      >
        Ventas · {monthLabel}
      </Text>
      {book.isLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={theme.colors.actionPrimary} />
      ) : totals ? (
        <>
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <Amount value={formatCurrency(totals.totalAmount)} size="xl" />
            <Text
              style={{
                marginTop: 4,
                fontFamily: theme.font.regular,
                fontSize: theme.fontSize.caption,
                color: theme.colors.textSecondary,
              }}
            >
              {totals.voucherCount === 1 ? "1 comprobante" : `${totals.voucherCount} comprobantes`}
            </Text>
          </View>
          <Divider />
          <View style={{ height: 8 }} />
          <SalesRow label="Neto gravado" value={formatCurrency(totals.netAmount)} />
          <SalesRow
            label="Exento y no gravado"
            value={formatCurrency(totals.exemptAmount + totals.untaxedAmount)}
          />
          <SalesRow label="IVA débito" value={formatCurrency(totals.ivaAmount)} />
        </>
      ) : (
        <Text
          style={{
            marginVertical: 12,
            fontFamily: theme.font.regular,
            fontSize: theme.fontSize.callout,
            color: theme.colors.textSecondary,
          }}
        >
          No pudimos traer las ventas del mes.
        </Text>
      )}
      {exportError ? (
        <View style={{ marginTop: 8 }}>
          <Banner kind="error" title="No se pudo exportar" body={exportError} />
        </View>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Button
          variant="secondary"
          full
          loading={exporting}
          disabled={!totals || totals.voucherCount === 0}
          icon={<FileSpreadsheet size={18} color={theme.colors.actionSecondaryText} strokeWidth={2} />}
          onPress={exportCsv}
        >
          Exportar Libro IVA Ventas
        </Button>
      </View>
    </Card>
  );
};

const SalesRow = ({ label, value }: { label: string; value: string }) => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Text
        style={{
          fontFamily: theme.font.regular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: theme.font.monoRegular,
          fontSize: theme.fontSize.callout,
          color: theme.colors.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
};
