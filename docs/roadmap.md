# Roadmap — Chirola

Estado y trabajo pendiente de la app de facturación electrónica ARCA. Este doc lista **lo que
falta** y **las mejoras propuestas**, priorizado. El estado de lo ya implementado vive en
`docs/arquitectura.md`; acá no se repite.

Convención de estado: 🔴 bloqueante · 🟡 alto valor · 🟢 mejora / nice-to-have.

---

## 1. Bloqueantes (sin esto no hay producto usable)

### 1.1 🔴 Validar el flujo real contra ARCA (homologación)

Todo el camino WSAA → CAE está cableado y testeado con mocks, pero **nunca se disparó contra
ARCA con un certificado de homologación real**. Es el próximo paso obligado y depende de un
trámite **externo** del usuario que Claude no puede hacer:

1. Generar el CSR desde la app (`POST /issuers/:id/csr`, ya implementado).
2. Subir el CSR a ARCA y descargar el `.crt` de homologación.
3. Emparejar el `.crt` en la app (`PUT /issuers/:id/certificate`, ya implementado).
4. Asociar el servicio `wsfe` al certificado en ARCA y **registrar un punto de venta**.
5. Recién ahí correr una emisión real y verificar CAE + QR contra el validador de ARCA.

Hasta cerrar esto, todo lo demás es sobre una base sin confirmar. Ver
`[[gastronova-arca-referencia]]` como implementación fiscal ya probada de la cual contrastar.

### 1.2 🔴 ABM de puntos de venta (`SalesPoint`)

El modelo `SalesPoint` existe en Prisma y `Voucher.salesPointId` es **obligatorio**, pero no
hay controller ni pantalla para administrarlos. Hoy no se puede elegir/crear un punto de venta
desde la app → no se puede emitir de forma limpia. Falta:

- Endpoint `GET/POST /issuers/:issuerId/sales-points` (+ scope por `issuerId` y ownership).
- Idealmente, sincronizar los puntos de venta habilitados desde ARCA
  (`FEParamGetPtosVenta` de WSFEv1) en vez de cargarlos a mano.
- Selector de punto de venta en la pantalla de nueva factura.

### 1.3 🔴 Listado de comprobantes emitidos

El `VouchersController` solo expone `POST`, `GET /:id`, `/:id/pdf` y `/:id/qr.png`. **No hay
`GET /vouchers`**: se emite una factura y no existe forma de ver el historial. Falta:

- Endpoint `GET /issuers/:issuerId/vouchers` con paginado y filtros (rango de fechas, tipo,
  estado, cliente, punto de venta).
- Pantalla de historial en mobile con acceso al detalle / PDF de cada comprobante.

### 1.4 🔴 Correr la app en device real contra el backend

La app pasa `tsc`/`eslint`/bundle de Metro pero **nunca se corrió en emulador/device** apuntando
al backend (setear `EXPO_PUBLIC_API_URL` a la IP de la LAN). Falta la primera prueba end-to-end
real de UI + red + rotación de refresh token.

---

## 2. Alto valor de negocio

### 2.1 🟡 Consulta de padrón ARCA por CUIT

Autocompletar razón social, condición frente al IVA y domicilio del receptor consultando el
padrón de ARCA (servicio `ws_sr_constancia_inscripcion` / padrón A13) a partir del CUIT. Evita
la carga manual del cliente y reduce errores de datos. Gran ganancia de UX por poco esfuerzo.

### 2.2 🟡 Envío del comprobante al cliente

El PDF ya se genera en el backend. Falta poder mandarlo al receptor por **email** (ya existe
`Client.email`) o compartir por WhatsApp desde la app. Cierra el ciclo de "emitir y entregar".

### 2.3 🟡 Numeración y último autorizado visibles

Exponer al usuario el próximo número por punto de venta y tipo (backend ya usa
`FECompUltimoAutorizado` internamente). Que la pantalla de nueva factura muestre "vas a emitir
la Factura B 0001-00000042" antes de confirmar.

### 2.4 🟡 Nota de crédito / anulación rápida desde el detalle

El backend ya soporta NC/ND con comprobantes asociados. Falta el atajo en UI: desde el detalle
de una factura, botón "generar nota de crédito" que precargue el comprobante asociado.

### 2.5 🟡 Dashboard y reportes

- Total facturado por período, IVA débito fiscal.
- Export **Libro IVA Ventas** (CSV/PDF) para el contador.
- Resumen por punto de venta / tipo de comprobante.

### 2.6 🟡 Manejo visible de observaciones y rechazos de ARCA

El modelo `Voucher` ya guarda `arcaObservations` y `status`, pero falta mostrarlas de forma
clara: diferenciar aprobado / observado / rechazado, explicar el motivo al usuario y permitir
reintento. Hoy un rechazo de ARCA queda opaco.

---

## 3. Robustez y calidad de producto

### 3.1 🟢 Estados de `Voucher` como enum tipado

`status` es un string libre con valor en español (`"PENDIENTE"`). Migrar a un enum compartido
en `@chirola/shared` (`PENDING` / `APPROVED` / `OBSERVED` / `REJECTED`) y alinear con la regla
de naming en inglés del proyecto.

### 3.2 🟢 Cola de emisión / reintentos ante fallo de red o de ARCA

Emitir es una operación crítica que hoy es un `POST` sincrónico. Sumar reintento idempotente y,
a futuro, una cola para no perder emisiones cuando ARCA está caído o intermitente.

### 3.3 🟢 Endurecer la autenticación

- Rate limiting / throttling en `login` y `refresh` (hoy sin límite → fuerza bruta).
- Biometría (Face/Touch ID) para desbloquear la app y proteger la sesión local.

### 3.4 🟢 Soporte de moneda extranjera en la UI

El schema ya tiene `currency` y `exchangeRate`, pero la app asume pesos. Exponer selección de
moneda y cotización para comprobantes en dólares.

### 3.5 🟢 Salud de ARCA y diagnóstico

Endpoint/pantalla que use `FEDummy` para mostrar si los servicios de ARCA (auth/appserver/db)
están operativos antes de intentar emitir.

### 3.6 🟢 Observabilidad y auditoría

Logging estructurado de las llamadas SOAP a ARCA (request/response guardados para soporte) y una
bitácora de acciones sensibles (alta de cert, emisión, anulación).

---

## 4. Infraestructura y operación

- 🟢 **CI**: pipeline que corra `pnpm -r lint` + `pnpm -r test` en cada push a `main`.
- 🟢 **Migraciones y deploy**: estrategia de deploy del backend + Postgres gestionado, y build
  de la app (EAS Build) para distribución interna / stores.
- 🟢 **Backups y rotación de claves**: plan de backup de la DB (incluye claves privadas cifradas)
  y rotación de `CERT_ENCRYPTION_KEY`.
- 🟢 **Push notifications**: avisar CAE emitido, vencimiento de certificado, etc.

---

## Orden sugerido de ataque

1. **1.1** cerrar ARCA homologación de verdad — desbloquea todo.
2. **1.2** ABM de puntos de venta — sin esto no se puede emitir prolijo.
3. **1.3** listado de comprobantes — autocontenido, no depende de ARCA.
4. **1.4** correr en device real.
5. **2.1** consulta de padrón — mejor relación valor/esfuerzo.
6. Resto de la sección 2, luego 3 y 4 según prioridad de negocio.
