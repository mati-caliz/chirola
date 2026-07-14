import { useState } from 'react';
import { FileText } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, EmptyState, SearchBar } from '@/components/ds';
import { useActiveIssuer } from '@/lib/active-issuer';
import { useTheme } from '@/hooks/use-theme';

const filters = [
  { id: 'todos', label: 'Todos' },
  { id: 'aprobado', label: 'Aprobados' },
  { id: 'observado', label: 'Observados' },
  { id: 'rechazado', label: 'Rechazados' },
];

export default function ComprobantesScreen() {
  const theme = useTheme();
  const { activeIssuer } = useActiveIssuer();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top']}>
      <View style={{ paddingHorizontal: theme.spacing.screenPad, paddingTop: 8, gap: 12 }}>
        <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.title, color: theme.colors.textPrimary }}>
          Comprobantes
        </Text>
        <SearchBar value={search} onChangeText={setSearch} onClear={() => setSearch('')} placeholder="Buscar por cliente o número" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {filters.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
          ))}
        </ScrollView>
      </View>
      <EmptyState
        icon={(p) => <FileText {...p} strokeWidth={1.75} />}
        title={activeIssuer ? 'Todavía no hay comprobantes' : 'Elegí un emisor'}
        body={
          activeIssuer
            ? 'Cuando emitas una factura, la vas a ver acá con su estado y CAE.'
            : 'Agregá o seleccioná un emisor para ver sus comprobantes.'
        }
      />
    </SafeAreaView>
  );
}
