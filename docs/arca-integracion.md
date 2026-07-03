# Integración con ARCA (ex AFIP) — self-host

Este documento describe cómo el backend se autentica y factura contra ARCA sin depender de
servicios de terceros. Todo se prueba primero en **homologación**.

## Endpoints

| Servicio | Homologación | Producción |
|----------|--------------|------------|
| WSAA `loginCms` | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| WSFEv1 | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |

## 1. WSAA — obtener el Ticket de Acceso (TA)

El TA autoriza el uso de un web service concreto (para facturar: `wsfe`). Dura ~12 h.

Flujo:

1. **Login Ticket Request (LTR)** — XML con `uniqueId`, `generationTime`, `expirationTime`
   y `<service>wsfe</service>`.
2. **Firmar como CMS/PKCS#7** el LTR con el certificado + clave privada del contribuyente
   (`node-forge`, formato SMIME/CMS en base64).
3. **`loginCms(cms)`** contra el endpoint WSAA → devuelve `<token>` y `<sign>`.
4. **Cachear el TA** por `(cuit, service)` hasta `expirationTime`. **Regla de oro:** no pedir
   un TA nuevo si el actual sigue vigente — ARCA bloquea temporalmente si abusás.

> El TA es por **CUIT del contribuyente**, no por usuario de la app. El vault mapea
> `usuario → emisor(CUIT) → cert/key` y el TA se cachea a nivel emisor.

## 2. WSFEv1 — emitir comprobante y obtener CAE

Operaciones principales:

- `FECompUltimoAutorizado(pv, tipoCbte)` → último número autorizado ⇒ el próximo = +1.
- `FECAESolicitar(FeCAEReq)` → envía el comprobante y devuelve el **CAE** + vencimiento, o
  **observaciones/errores**.
- `FEParamGet*` → tablas de referencia (tipos de comprobante, doc, IVA, monedas, puntos de venta).

Puntos finos a respetar:
- Numeración **correlativa por punto de venta y tipo de comprobante** (sin huecos).
- Importes: `ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpOpEx`. Cuadrar centavos.
- Factura **C** (Monotributo): sin discriminar IVA (`Id=0`, alícuota "No gravado"/exento según caso).
- Factura **A/B** (Resp. Inscripto): IVA discriminado por alícuota (21%, 10.5%, etc.).
- Notas de crédito/débito: tipos de comprobante propios (203/208/213 A/B/C…) y referencia al
  comprobante asociado (`CbtesAsoc`).

## 3. QR obligatorio (RG 5152 / RG 4892)

Cada comprobante impreso/PDF debe incluir un **QR** que codifica en base64 un JSON con:
`ver`, `fecha`, `cuit`, `ptoVta`, `tipoCmp`, `nroCmp`, `importe`, `moneda`, `ctz`,
`tipoDocRec`, `nroDocRec`, `tipoCodAut` (`E` para CAE), `codAut` (el CAE).
Se antepone `https://www.afip.gob.ar/fe/qr/?p=<base64(json)>`.

## 4. Onboarding del certificado (fricción a resolver en la app)

Para self-host, cada contribuyente debe, con su clave fiscal en ARCA:

1. Generar un par de claves y un **CSR**. Lo generamos nosotros en el backend
   (`openssl`/`node-forge`) para que el usuario solo suba el CSR.
2. En **"Administración de Certificados Digitales"** de ARCA, subir el CSR → descargar el `.crt`.
3. En **"Administrador de Relaciones"** (clave fiscal), asociar el alias del certificado al
   servicio **`wsfe`** (delegación).
4. En la app: subir el `.crt`. El backend lo empareja con la clave privada guardada y ya puede
   emitir a nombre de ese CUIT.

La UX debe guiar paso a paso (probablemente con capturas), porque es el punto de mayor abandono.

## 5. Seguridad

- Claves privadas **cifradas at-rest** (master key vía KMS o libsodium; nunca en texto plano).
- Nunca se envían claves ni certificados a la app.
- Auditoría de cada emisión (quién, cuándo, qué CUIT, resultado ARCA).

## Librerías candidatas (Node)

- `node-forge` — generación de claves, CSR y firma CMS/PKCS#7.
- `soap` o `strong-soap` — cliente SOAP para WSAA/WSFEv1 (o XML armado a mano + `undici`).
- `fast-xml-parser` — parseo de respuestas.
- Alternativa acelerada manteniendo self-host: evaluar `facturajs` (open source) antes de
  escribir el cliente desde cero.
