import { Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  BodyText,
  brandColor,
  Button,
  Card,
  Centered,
  Loading,
  Screen,
  Subtitle,
  Title,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { listIssuers } from "@/lib/resources";
import type { Issuer } from "@chirola/shared";
import { formatDate } from "@/lib/format";
import { hasText } from "@chirola/shared";
import type { ReactNode } from "react";

const IssuersContent = ({
  onOpenIssuer,
}: Readonly<{ onOpenIssuer: (issuerId: string) => void }>): ReactNode => {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["issuers"],
    queryFn: listIssuers,
  });

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <Centered>
        <BodyText>{error instanceof Error ? error.message : "Error al cargar."}</BodyText>
        <Button
          title="Reintentar"
          variant="secondary"
          onPress={() => {
            void refetch();
          }}
        />
      </Centered>
    );
  }
  if (data && data.length > 0) {
    return (
      <>
        {data.map((issuer) => (
          <IssuerCard
            key={issuer.id}
            issuer={issuer}
            onPress={() => {
              onOpenIssuer(issuer.id);
            }}
          />
        ))}
      </>
    );
  }
  return (
    <Centered>
      <Subtitle>Todavía no cargaste ningún emisor.</Subtitle>
    </Centered>
  );
};

export default function IssuersScreen(): ReactNode {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Emisores",
          headerRight: () => (
            <Pressable
              onPress={() => {
                void logout();
              }}
              hitSlop={8}
            >
              <Text style={{ color: brandColor, fontWeight: "600" }}>Salir</Text>
            </Pressable>
          ),
        }}
      />
      <Screen>
        <View style={{ gap: 4 }}>
          <Title>Tus emisores</Title>
          <Subtitle>Los CUIT en cuyo nombre facturás.</Subtitle>
        </View>

        <IssuersContent
          onOpenIssuer={(issuerId) => {
            router.push(`/(app)/issuers/${issuerId}`);
          }}
        />

        <Button
          title="+ Nuevo emisor"
          onPress={() => {
            router.push("/(app)/issuers/new");
          }}
        />
      </Screen>
    </>
  );
}

function IssuerCard({ issuer, onPress }: Readonly<{ issuer: Issuer; onPress: () => void }>): ReactNode {
  const certificate = issuer.certificate;
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <BodyText>{issuer.legalName}</BodyText>
        <Badge text={issuer.environment} tone="neutral" />
      </View>
      <Subtitle>CUIT {issuer.cuit}</Subtitle>
      {certificate ? (
        <Badge
          text={
            hasText(certificate.validUntil)
              ? `Cert. vence ${formatDate(certificate.validUntil)}`
              : "Certificado cargado"
          }
          tone="ok"
        />
      ) : (
        <Badge text="Sin certificado" tone="warn" />
      )}
    </Card>
  );
}
