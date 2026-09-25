import { useState, type ReactNode } from "react";
import { FileText, Plus } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Amount,
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  Input,
  ListItem,
  NavBar,
  SearchBar,
  Select,
  StatusBadge,
  Stepper,
  Switch,
  TabBar,
  type TabId,
} from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";

const ignoreInteraction = (): void => undefined;

const Section = ({ title, children }: Readonly<{ title: string; children: ReactNode }>): ReactNode => {
  const theme = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.66,
          textTransform: "uppercase",
          color: theme.colors.textTertiary,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

const ButtonsSection = (): ReactNode => (
  <Section title="Buttons">
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Button variant="primary" onPress={ignoreInteraction}>
        Emitir
      </Button>
      <Button variant="secondary" onPress={ignoreInteraction}>
        Guardar
      </Button>
      <Button variant="ghost" onPress={ignoreInteraction}>
        Cancelar
      </Button>
      <Button variant="danger" onPress={ignoreInteraction}>
        Anular
      </Button>
    </View>
    <Button variant="primary" full loading onPress={ignoreInteraction}>
      Cargando
    </Button>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <IconButton label="Agregar" variant="tonal" icon={(item) => <Plus {...item} strokeWidth={2} />} />
      <IconButton
        label="Comprobante"
        variant="filled"
        icon={(item) => <FileText {...item} strokeWidth={2} />}
      />
      <IconButton label="Más" icon={(item) => <Plus {...item} strokeWidth={2} />} />
    </View>
  </Section>
);

const FormsSection = (): ReactNode => {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(true);
  return (
    <Section title="Forms">
      <Input
        label="Razón social"
        value=""
        onChangeText={ignoreInteraction}
        placeholder="Nombre del cliente"
      />
      <Input
        label="Importe"
        mono
        keyboardType="numeric"
        prefix="$"
        value="48.400,00"
        onChangeText={ignoreInteraction}
      />
      <Input label="Con error" value="12" onChangeText={ignoreInteraction} error="Revisá el CUIT ingresado" />
      <Select label="Tipo de comprobante" value="Factura B" onPress={ignoreInteraction} />
      <SearchBar
        value={search}
        onChangeText={setSearch}
        onClear={() => {
          setSearch("");
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch checked={checked} onChange={setChecked} label="Face ID" />
        <Text style={{ color: theme.colors.textSecondary, fontFamily: theme.font.regular }}>
          Ingreso con Face ID
        </Text>
      </View>
    </Section>
  );
};

const DisplaySection = (): ReactNode => {
  const theme = useTheme();
  const [chip, setChip] = useState("todos");
  return (
    <Section title="Display">
      <Card>
        <Text
          style={{
            fontFamily: theme.font.semibold,
            color: theme.colors.textPrimary,
            fontSize: theme.fontSize.body,
          }}
        >
          Facturado este mes
        </Text>
        <Amount value="$ 1.284.500,00" size="xl" />
      </Card>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <StatusBadge status="aprobado" />
        <StatusBadge status="observado" />
        <StatusBadge status="rechazado" />
        <StatusBadge status="pendiente" />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {["todos", "aprobados", "observados"].map((id) => (
          <Chip
            key={id}
            label={id}
            selected={chip === id}
            onPress={() => {
              setChip(id);
            }}
          />
        ))}
      </View>
      <Card pad={4}>
        <ListItem
          title="Ferretería La Esquina"
          subtitle="Factura B 0001-00000042"
          trailing={<Amount value="$ 48.400,00" size="sm" />}
          chevron
          onPress={ignoreInteraction}
        />
        <Divider inset={16} />
        <ListItem
          title="Kiosco Don Pedro"
          subtitle="Factura C 0001-00000041"
          chevron
          onPress={ignoreInteraction}
        />
      </Card>
    </Section>
  );
};

const FeedbackSection = ({ onOpenSheet }: Readonly<{ onOpenSheet: () => void }>): ReactNode => (
  <Section title="Feedback">
    <Banner
      kind="error"
      title="No pudimos emitir la factura"
      body="ARCA rechazó el comprobante. Revisá los datos y reintentá."
      detail="10016: El campo CbteFch es obligatorio."
    />
    <Banner kind="success" title="¡Listo! Emitimos tu Factura B" body="El CAE ya quedó guardado." />
    <Button variant="secondary" onPress={onOpenSheet}>
      Abrir bottom sheet
    </Button>
    <Card>
      <EmptyState
        icon={(item) => <FileText {...item} strokeWidth={1.75} />}
        title="Todavía no emitiste comprobantes"
        body="Cuando emitas tu primera factura, la vas a ver acá."
        action={
          <Button variant="primary" onPress={ignoreInteraction}>
            Emitir la primera
          </Button>
        }
      />
    </Card>
  </Section>
);

export default function GalleryScreen(): ReactNode {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("inicio");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top"]}>
      <NavBar title="Design System" subtitle={`Tema ${theme.scheme}`} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 120 }}>
        <ButtonsSection />

        <FormsSection />

        <DisplaySection />

        <FeedbackSection
          onOpenSheet={() => {
            setSheetOpen(true);
          }}
        />

        <Section title="Navigation">
          <Stepper steps={["Clave", "CSR", "Certificado", "Listo"]} current={1} />
        </Section>
      </ScrollView>

      <TabBar
        active={tab}
        onSelect={setTab}
        onEmitir={() => {
          setSheetOpen(true);
        }}
      />

      <BottomSheet
        open={sheetOpen}
        title="Tus emisores"
        onClose={() => {
          setSheetOpen(false);
        }}
      >
        <ListItem
          title="Comercial del Sur SA"
          subtitle="20-33222111-9"
          trailing={<StatusBadge status="aprobado" label="Activo" size="sm" />}
        />
        <Divider />
        <ListItem title="Estudio Contable MB" subtitle="27-40111222-3" chevron onPress={ignoreInteraction} />
        <View style={{ height: 12 }} />
        <Button
          variant="secondary"
          full
          onPress={() => {
            setSheetOpen(false);
          }}
        >
          Agregar otro emisor
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}
