import { useState } from 'react';
import { FileText, Plus } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from '@/components/ds';
import { useTheme } from '@/hooks/use-theme';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const theme = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontFamily: theme.font.semibold,
          fontSize: theme.fontSize.micro,
          letterSpacing: 0.66,
          textTransform: 'uppercase',
          color: theme.colors.textTertiary,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

export default function GalleryScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(true);
  const [chip, setChip] = useState('todos');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('inicio');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <NavBar title="Design System" subtitle={`Tema ${theme.scheme}`} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 28, paddingBottom: 120 }}>
        <Section title="Buttons">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="primary" onPress={() => {}}>
              Emitir
            </Button>
            <Button variant="secondary" onPress={() => {}}>
              Guardar
            </Button>
            <Button variant="ghost" onPress={() => {}}>
              Cancelar
            </Button>
            <Button variant="danger" onPress={() => {}}>
              Anular
            </Button>
          </View>
          <Button variant="primary" full loading onPress={() => {}}>
            Cargando
          </Button>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton label="Agregar" variant="tonal" icon={(p) => <Plus {...p} strokeWidth={2} />} />
            <IconButton label="Comprobante" variant="filled" icon={(p) => <FileText {...p} strokeWidth={2} />} />
            <IconButton label="Más" icon={(p) => <Plus {...p} strokeWidth={2} />} />
          </View>
        </Section>

        <Section title="Forms">
          <Input label="Razón social" value="" onChangeText={() => {}} placeholder="Nombre del cliente" />
          <Input label="Importe" mono keyboardType="numeric" prefix="$" value="48.400,00" onChangeText={() => {}} />
          <Input label="Con error" value="12" onChangeText={() => {}} error="Revisá el CUIT ingresado" />
          <Select label="Tipo de comprobante" value="Factura B" onPress={() => {}} />
          <SearchBar value={search} onChangeText={setSearch} onClear={() => setSearch('')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Switch checked={checked} onChange={setChecked} label="Face ID" />
            <Text style={{ color: theme.colors.textSecondary, fontFamily: theme.font.regular }}>Ingreso con Face ID</Text>
          </View>
        </Section>

        <Section title="Display">
          <Card>
            <Text style={{ fontFamily: theme.font.semibold, color: theme.colors.textPrimary, fontSize: theme.fontSize.body }}>
              Facturado este mes
            </Text>
            <Amount value="$ 1.284.500,00" size="xl" />
          </Card>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status="aprobado" />
            <StatusBadge status="observado" />
            <StatusBadge status="rechazado" />
            <StatusBadge status="pendiente" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['todos', 'aprobados', 'observados'].map((id) => (
              <Chip key={id} label={id} selected={chip === id} onPress={() => setChip(id)} />
            ))}
          </View>
          <Card pad={4}>
            <ListItem
              title="Ferretería La Esquina"
              subtitle="Factura B 0001-00000042"
              trailing={<Amount value="$ 48.400,00" size="sm" />}
              chevron
              onPress={() => {}}
            />
            <Divider inset={16} />
            <ListItem title="Kiosco Don Pedro" subtitle="Factura C 0001-00000041" chevron onPress={() => {}} />
          </Card>
        </Section>

        <Section title="Feedback">
          <Banner
            kind="error"
            title="No pudimos emitir la factura"
            body="ARCA rechazó el comprobante. Revisá los datos y reintentá."
            detail="10016: El campo CbteFch es obligatorio."
          />
          <Banner kind="success" title="¡Listo! Emitimos tu Factura B" body="El CAE ya quedó guardado." />
          <Button variant="secondary" onPress={() => setSheetOpen(true)}>
            Abrir bottom sheet
          </Button>
          <Card>
            <EmptyState
              icon={(p) => <FileText {...p} strokeWidth={1.75} />}
              title="Todavía no emitiste comprobantes"
              body="Cuando emitas tu primera factura, la vas a ver acá."
              action={
                <Button variant="primary" onPress={() => {}}>
                  Emitir la primera
                </Button>
              }
            />
          </Card>
        </Section>

        <Section title="Navigation">
          <Stepper steps={['Clave', 'CSR', 'Certificado', 'Listo']} current={1} />
        </Section>
      </ScrollView>

      <TabBar active={tab} onSelect={setTab} onEmitir={() => setSheetOpen(true)} />

      <BottomSheet open={sheetOpen} title="Tus emisores" onClose={() => setSheetOpen(false)}>
        <ListItem title="Comercial del Sur SA" subtitle="20-33222111-9" trailing={<StatusBadge status="aprobado" label="Activo" size="sm" />} />
        <Divider />
        <ListItem title="Estudio Contable MB" subtitle="27-40111222-3" chevron onPress={() => {}} />
        <View style={{ height: 12 }} />
        <Button variant="secondary" full onPress={() => setSheetOpen(false)}>
          Agregar otro emisor
        </Button>
      </BottomSheet>
    </SafeAreaView>
  );
}
