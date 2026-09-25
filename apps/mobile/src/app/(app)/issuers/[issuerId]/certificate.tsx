import { type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Button, Stepper } from "@/components/ds";
import { useTheme } from "@/hooks/use-theme";
import { DoneStep, IntroStep, PasteStep } from "@/screens/certificate/CertificateSteps";
import { UploadStep } from "@/screens/certificate/UploadStep";
import { useCertificateWizard, WizardStep } from "@/screens/certificate/use-certificate-wizard";
import { hasText } from "@chirola/shared";

const steps = ["Tu clave", "Subir a ARCA", "Certificado", "Listo"];
const primaryLabels = ["Empezar", "Ya lo subí a ARCA", "Emparejar certificado", "Ir a facturar"];

export default function CertificateScreen(): ReactNode {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const wizard = useCertificateWizard(issuerId);
  const { step } = wizard;
  const canGoBack = step > WizardStep.intro && step < WizardStep.done;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Stepper steps={steps} current={step} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        {hasText(wizard.error) ? <Banner kind="error" title="Algo salió mal" body={wizard.error} /> : null}
        {step === WizardStep.intro ? <IntroStep /> : null}
        {step === WizardStep.upload ? (
          <UploadStep
            csrPem={wizard.csrPem}
            copied={wizard.copied}
            onCopy={() => {
              void wizard.copyCsr();
            }}
          />
        ) : null}
        {step === WizardStep.paste ? (
          <PasteStep certPem={wizard.certPem} onChangeCertPem={wizard.setCertPem} />
        ) : null}
        {step === WizardStep.done ? <DoneStep /> : null}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 6,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderSubtle,
          backgroundColor: theme.colors.surfaceCard,
        }}
      >
        {canGoBack ? (
          <Button variant="ghost" onPress={wizard.goBack}>
            Atrás
          </Button>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button variant="primary" full loading={wizard.primaryLoading} onPress={wizard.advance}>
            {primaryLabels[step]}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
