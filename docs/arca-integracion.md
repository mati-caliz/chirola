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
4. **Cachear el TA** por `(titular del certificado, entorno, service)` hasta `expirationTime`.
   **Regla de oro:** no pedir un TA nuevo si el actual sigue vigente — ARCA bloquea
   temporalmente si abusás.

> El TA lo emite ARCA **para el certificado**, no para el emisor. Por eso la caché se
> indexa por el CUIT del titular del certificado y no por `issuerId`: si un representante
> factura por varios contribuyentes, pedir un TA por emisor hace que ARCA rechace el
> segundo login con "el CEE ya posee un TA válido".

### Lo que el TA no trae

El Ticket de Acceso contiene únicamente `source`, `destination`, `uniqueId` y la vigencia.
**No trae la lista de contribuyentes que delegaron el servicio.** No hay forma de descubrir
las delegaciones en masa ni de resolverlas dentro de un request: la única manera de saber si
alguien delegó es intentar una llamada por cada CUIT. Por eso en chirola la relación es
explícita y se declara al dar de alta el emisor, no se deduce del TA.

### El CUIT del bloque Auth

En el bloque `<Auth>` de WSFEv1 van el `Token` y el `Sign` del TA, pero el campo `Cuit` es el
**del contribuyente a nombre de quien se emite**, que puede no ser el titular del certificado.
El error es silencioso: con un solo emisor los dos CUIT coinciden y nunca se nota; con dos,
las facturas de un contribuyente salen a nombre de otro, con CAE y todo.

chirola lo cubre en tres capas:

- `Issuer.representativeCuit` declara explícitamente cuándo el certificado es de un
  representante. Si es `null`, el certificado tiene que ser del propio emisor.
- Al cargar el `.crt` se lee el `serialNumber` del subject (`CUIT xxxxxxxxxxx`) y se compara
  contra el titular esperado; si no coincide, se rechaza la carga.
- Antes de cada llamada a ARCA se vuelve a verificar el invariante contra el certificado
  guardado (`assertCertificateBelongsToIssuer`). Si no coincide, se corta la operación en vez
  de emitir a nombre de otro.

El script `scripts/audit-certificate-holders.ts` audita todos los emisores de una base y
devuelve exit code 1 si alguno tiene cargado el certificado de otro CUIT.

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

### El error 600 significa dos cosas distintas

`ValidacionDeToken: No aparecio CUIT en lista de relaciones` (código 600) aparece tanto cuando
la delegación no existe como cuando el contribuyente está **inhabilitado para facturar**
(monotributo dado de baja, deuda, inscripción vencida). La respuesta de ARCA no permite
distinguirlos.

Por eso `Issuer.onboardingStatus` recuerda hasta dónde llegó cada emisor:

| Estado | Significado |
| --- | --- |
| `PENDING_CERTIFICATE` | Todavía no cargó el `.crt`. |
| `PENDING_DELEGATION` | Certificado cargado; ARCA nunca aceptó una llamada suya. |
| `DELEGATION_CONFIRMED` | Una consulta de sólo lectura funcionó. |
| `ISSUING_CONFIRMED` | Obtuvo al menos un CAE. |
| `BLOCKED_BY_ARCA` | Dio 600 después de haber funcionado. |

Con eso, un 600 en un emisor que nunca llegó a ARCA pide hacer el trámite de delegación, y un
600 en uno que ya había funcionado apunta a la situación fiscal del contribuyente. Sin este
estado se le termina diciendo "autorizanos en ARCA" a alguien que ya lo hizo.

### El dry-run no garantiza que se pueda emitir

`POST /v1/vouchers/dry-run` usa `FECompUltimoAutorizado` como sonda de sólo lectura: confirma
que el certificado y la delegación funcionan sin gastar un comprobante. **No confirma que el
contribuyente esté habilitado para facturar**: ARCA valida más cosas al autorizar un
comprobante que al consultar el último número, así que un monotributo dado de baja pasa la
sonda y falla al emitir. La respuesta del dry-run lo dice en `verification`, donde
`confirmsIssuing` sólo es `true` cuando el emisor ya obtuvo un CAE.

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
