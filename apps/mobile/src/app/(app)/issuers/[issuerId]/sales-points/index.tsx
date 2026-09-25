import { useState, type ReactNode } from "react";
import { RefreshCw, Store } from "lucide-react-native";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Divider,
  EmptyState,
  Input,
  ListItem,
  Loading,
  Screen,
} from "@/components/ds";
import { listSalesPoints, syncSalesPoints, updateSalesPoint } from "@/lib/resources";
import type { SalesPoint } from "@chirola/shared";
import { useTheme } from "@/hooks/use-theme";
import { hasText } from "@chirola/shared";

const SALES_POINT_NUMBER_DIGITS = 4;

const padNumber = (value: number): string => String(value).padStart(SALES_POINT_NUMBER_DIGITS, "0");

interface SalesPointsContentProps {
  salesPointsQuery: UseQueryResult<SalesPoint[]>;
  onEdit: (point: SalesPoint) => void;
}

const SalesPointsContent = ({ salesPointsQuery, onEdit }: Readonly<SalesPointsContentProps>): ReactNode => {
  const { data, isLoading, isError, refetch } = salesPointsQuery;
  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Banner
        kind="error"
        title="No pudimos cargar tus puntos de venta"
        action={
          <Button
            variant="secondary"
            onPress={() => {
              void refetch();
            }}
          >
            Reintentar
          </Button>
        }
      />
    );
  }
  if (data && data.length > 0) {
    return (
      <Card pad={4}>
        {data.map((point, index) => (
          <View key={point.id}>
            {index > 0 ? <Divider inset={16} /> : null}
            <ListItem
              title={`Punto de venta ${padNumber(point.number)}`}
              subtitle={point.description ?? "Sin descripción"}
              chevron
              onPress={() => {
                onEdit(point);
              }}
            />
          </View>
        ))}
      </Card>
    );
  }
  return (
    <EmptyState
      icon={(item) => <Store {...item} strokeWidth={1.75} />}
      title="Sincronizá tus puntos de venta"
      body="Los puntos de venta se dan de alta en ARCA. Traelos acá para elegirlos al facturar."
    />
  );
};

interface SalesPointEditorProps {
  editing: SalesPoint | null;
  description: string;
  saving: boolean;
  onChangeDescription: (value: string) => void;
  onClose: () => void;
  onSave: (point: SalesPoint) => void;
}

const SalesPointEditor = ({
  editing,
  description,
  saving,
  onChangeDescription,
  onClose,
  onSave,
}: Readonly<SalesPointEditorProps>): ReactNode => (
  <BottomSheet
    open={editing !== null}
    title={`Punto de venta ${editing ? padNumber(editing.number) : ""}`}
    onClose={onClose}
  >
    <Input
      label="Descripción"
      value={description}
      onChangeText={onChangeDescription}
      placeholder="Ej: Local Córdoba"
      hint="Un nombre para reconocerlo al facturar."
    />
    <View style={{ height: 12 }} />
    <Button
      variant="primary"
      full
      loading={saving}
      onPress={() => {
        if (editing) onSave(editing);
      }}
    >
      Guardar
    </Button>
  </BottomSheet>
);

export default function SalesPointsScreen(): ReactNode {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SalesPoint | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const salesPointsQuery = useQuery({
    queryKey: ["sales-points", issuerId],
    queryFn: () => listSalesPoints(issuerId),
  });
  const hasSalesPoints = salesPointsQuery.data !== undefined && salesPointsQuery.data.length > 0;

  const syncMutation = useMutation({
    mutationFn: () => syncSalesPoints(issuerId),
    onSuccess: (points) => {
      setError(null);
      queryClient.setQueryData(["sales-points", issuerId], points);
    },
    onError: (entry) => {
      setError(entry instanceof Error ? entry.message : "No se pudieron sincronizar los puntos de venta.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: (point: SalesPoint) => updateSalesPoint(issuerId, point.number, description.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales-points", issuerId] });
      setEditing(null);
    },
    onError: (entry) => {
      setError(entry instanceof Error ? entry.message : "No se pudo guardar la descripción.");
    },
  });

  const openEditor = (point: SalesPoint): void => {
    setDescription(point.description ?? "");
    setEditing(point);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Puntos de venta" }} />
      <Screen>
        {hasText(error) ? <Banner kind="error" title="Algo salió mal" body={error} /> : null}

        <SalesPointsContent salesPointsQuery={salesPointsQuery} onEdit={openEditor} />

        <Button
          variant={hasSalesPoints ? "secondary" : "primary"}
          full
          loading={syncMutation.isPending}
          icon={
            <RefreshCw
              size={18}
              color={hasSalesPoints ? theme.colors.actionSecondaryText : theme.colors.actionPrimaryText}
              strokeWidth={2}
            />
          }
          onPress={() => {
            syncMutation.mutate();
          }}
        >
          Sincronizar desde ARCA
        </Button>
      </Screen>

      <SalesPointEditor
        editing={editing}
        description={description}
        saving={saveMutation.isPending}
        onChangeDescription={setDescription}
        onClose={() => {
          setEditing(null);
        }}
        onSave={(point) => {
          saveMutation.mutate(point);
        }}
      />
    </>
  );
}
