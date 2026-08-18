import { useState } from 'react';
import { RefreshCw, Store } from 'lucide-react-native';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banner, BottomSheet, Button, Card, Divider, EmptyState, Input, ListItem, Loading, Screen } from '@/components/ds';
import { listSalesPoints, syncSalesPoints, updateSalesPoint, type SalesPoint } from '@/lib/resources';
import { useTheme } from '@/hooks/use-theme';

const padNumber = (value: number) => String(value).padStart(4, '0');

export default function SalesPointsScreen() {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SalesPoint | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales-points', issuerId],
    queryFn: () => listSalesPoints(issuerId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncSalesPoints(issuerId),
    onSuccess: (points) => {
      setError(null);
      qc.setQueryData(['sales-points', issuerId], points);
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : 'No se pudieron sincronizar los puntos de venta.'),
  });

  const saveMutation = useMutation({
    mutationFn: (point: SalesPoint) => updateSalesPoint(issuerId, point.number, description.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-points', issuerId] });
      setEditing(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar la descripción.'),
  });

  const openEditor = (point: SalesPoint) => {
    setDescription(point.description ?? '');
    setEditing(point);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Puntos de venta' }} />
      <Screen>
        {error ? <Banner kind="error" title="Algo salió mal" body={error} /> : null}

        {isLoading ? (
          <Loading />
        ) : isError ? (
          <Banner
            kind="error"
            title="No pudimos cargar tus puntos de venta"
            action={
              <Button variant="secondary" onPress={() => refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : data && data.length > 0 ? (
          <Card pad={4}>
            {data.map((point, index) => (
              <View key={point.id}>
                {index > 0 ? <Divider inset={16} /> : null}
                <ListItem
                  title={`Punto de venta ${padNumber(point.number)}`}
                  subtitle={point.description ?? 'Sin descripción'}
                  chevron
                  onPress={() => openEditor(point)}
                />
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={(p) => <Store {...p} strokeWidth={1.75} />}
            title="Sincronizá tus puntos de venta"
            body="Los puntos de venta se dan de alta en ARCA. Traelos acá para elegirlos al facturar."
          />
        )}

        <Button
          variant={data && data.length > 0 ? 'secondary' : 'primary'}
          full
          loading={syncMutation.isPending}
          icon={
            <RefreshCw
              size={18}
              color={data && data.length > 0 ? theme.colors.actionSecondaryText : theme.colors.actionPrimaryText}
              strokeWidth={2}
            />
          }
          onPress={() => syncMutation.mutate()}
        >
          Sincronizar desde ARCA
        </Button>
      </Screen>

      <BottomSheet open={editing !== null} title={`Punto de venta ${editing ? padNumber(editing.number) : ''}`} onClose={() => setEditing(null)}>
        <Input
          label="Descripción"
          value={description}
          onChangeText={setDescription}
          placeholder="Ej: Local Córdoba"
          hint="Un nombre para reconocerlo al facturar."
        />
        <View style={{ height: 12 }} />
        <Button variant="primary" full loading={saveMutation.isPending} onPress={() => editing && saveMutation.mutate(editing)}>
          Guardar
        </Button>
      </BottomSheet>
    </>
  );
}
