import { useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, IconButton, Input, StatusBadge, Stepper } from '@/components/ds';
import { generateCsr, matchCertificate } from '@/lib/resources';
import { useTheme } from '@/hooks/use-theme';

const steps = ['Tu clave', 'Subir a ARCA', 'Certificado', 'Listo'];

const arcaGuide = [
  'Entrá a arca.gob.ar con tu CUIT y Clave Fiscal (nivel 3).',
  'Buscá el servicio «Administración de Certificados Digitales».',
  'Tocá «Agregar alias», pegá el CSR que copiaste y confirmá.',
  'Descargá el archivo .crt que te da ARCA y volvé acá.',
];

export default function CertificateScreen() {
  const theme = useTheme();
  const { issuerId } = useLocalSearchParams<{ issuerId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [csrPem, setCsrPem] = useState<string | null>(null);
  const [certPem, setCertPem] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const csrMutation = useMutation({
    mutationFn: () => generateCsr(issuerId),
    onSuccess: (res) => {
      setError(null);
      setCsrPem(res.csrPem);
      setStep(1);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo generar el pedido.'),
  });

  const certMutation = useMutation({
    mutationFn: () => matchCertificate(issuerId, certPem.trim()),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ['issuers'] });
      setStep(3);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo emparejar el certificado.'),
  });

  const copyCsr = async () => {
    if (!csrPem) return;
    await Clipboard.setStringAsync(csrPem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const advance = () => {
    setError(null);
    if (step === 0) {
      if (csrPem) setStep(1);
      else csrMutation.mutate();
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (certPem.trim().length === 0) {
        setError('Pegá el certificado que descargaste de ARCA.');
        return;
      }
      certMutation.mutate();
      return;
    }
    router.replace(`/(app)/issuers/${issuerId}/vouchers/new`);
  };

  const primaryLabel = ['Empezar', 'Ya lo subí a ARCA', 'Emparejar certificado', 'Ir a facturar'][step];
  const primaryLoading = (step === 0 && csrMutation.isPending) || (step === 2 && certMutation.isPending);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bgApp }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <Stepper steps={steps} current={step} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
        {error ? <Banner kind="error" title="Algo salió mal" body={error} /> : null}

        {step === 0 ? (
          <>
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 12 }}>
              <Hero bg={theme.colors.surfaceBrandSubtle}>
                <ShieldCheck size={48} color={theme.colors.textBrand} strokeWidth={1.5} />
              </Hero>
              <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textPrimary, textAlign: 'center' }}>
                Conectemos tu emisor con ARCA
              </Text>
              <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 300, lineHeight: theme.fontSize.callout * theme.lineHeight.body }}>
                Para facturar a tu nombre, ARCA pide un certificado digital. Se hace una sola vez y tarda unos 5 minutos. Te guiamos en cada paso.
              </Text>
            </View>
            <Card>
              <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.callout, color: theme.colors.textPrimary }}>
                Generamos tu clave privada
              </Text>
              <Text style={{ marginTop: 4, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textSecondary, lineHeight: theme.fontSize.caption * theme.lineHeight.body }}>
                Queda cifrada en el servidor y nunca sale de ahí. Con ella armamos el «pedido de certificado» (CSR) que ARCA necesita.
              </Text>
            </Card>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
              Subí tu pedido al portal de ARCA
            </Text>
            <Card style={{ backgroundColor: theme.colors.bgSunken }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Text
                  numberOfLines={4}
                  style={{ flex: 1, fontFamily: theme.font.monoRegular, fontSize: theme.fontSize.micro, color: theme.colors.textSecondary }}
                >
                  {csrPem}
                </Text>
                <IconButton
                  label={copied ? 'Copiado' : 'Copiar CSR'}
                  variant="tonal"
                  icon={(p) => (copied ? <Check {...p} strokeWidth={2} /> : <Copy {...p} strokeWidth={2} />)}
                  onPress={copyCsr}
                />
              </View>
            </Card>
            <Card>
              <Text style={{ fontFamily: theme.font.semibold, fontSize: theme.fontSize.micro, letterSpacing: 0.66, textTransform: 'uppercase', color: theme.colors.textTertiary, marginBottom: 10 }}>
                Qué hacer en ARCA
              </Text>
              <View style={{ gap: 10 }}>
                {arcaGuide.map((text, index) => (
                  <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.surfaceBrandSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                      <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.micro, color: theme.colors.textBrand }}>{index + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: theme.font.regular, fontSize: theme.fontSize.caption, color: theme.colors.textPrimary, lineHeight: theme.fontSize.caption * theme.lineHeight.body }}>
                      {text}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={{ fontFamily: theme.font.bold, fontSize: theme.fontSize.subhead, color: theme.colors.textPrimary }}>
              Pegá el certificado que te dio ARCA
            </Text>
            <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary }}>
              Abrí el archivo .crt y copiá todo el contenido.
            </Text>
            <Input
              value={certPem}
              onChangeText={setCertPem}
              multiline
              mono
              placeholder={'-----BEGIN CERTIFICATE-----'}
              autoCapitalize="none"
              hint="Lo emparejamos con tu clave privada automáticamente."
              style={{ minHeight: 160 }}
            />
          </>
        ) : null}

        {step === 3 ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
            <Hero bg={theme.colors.statusAprobadoBg}>
              <Check size={44} color={theme.colors.statusAprobadoFg} strokeWidth={2.5} />
            </Hero>
            <Text style={{ fontFamily: theme.font.extrabold, fontSize: theme.fontSize.heading, color: theme.colors.textPrimary, textAlign: 'center' }}>
              ¡Listo, ya podés facturar!
            </Text>
            <Text style={{ fontFamily: theme.font.regular, fontSize: theme.fontSize.callout, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: theme.fontSize.callout * theme.lineHeight.body }}>
              El certificado quedó emparejado y la conexión con ARCA funciona. Te avisamos antes de que venza.
            </Text>
            <StatusBadge status="aprobado" label="Conexión con ARCA OK" />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, borderTopWidth: 1, borderTopColor: theme.colors.borderSubtle, backgroundColor: theme.colors.surfaceCard }}>
        {step > 0 && step < 3 ? (
          <Button variant="ghost" onPress={() => setStep(step - 1)}>
            Atrás
          </Button>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button variant="primary" full loading={primaryLoading} onPress={advance}>
            {primaryLabel}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const Hero = ({ bg, children }: { bg: string; children: React.ReactNode }) => (
  <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
    {children}
  </View>
);
