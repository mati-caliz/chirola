# Roadmap — Chirola

Lo que falta. El alcance actual está en [`arquitectura.md`](arquitectura.md) y la cobertura del
protocolo en [`arca-ampliacion.md`](arca-ampliacion.md); acá no se repite.

Estado: 🔴 bloqueante · 🟡 alto valor · 🟢 mejora.

El MVP ya emite en producción: hay dos emisores productivos con su certificado validado y el
flujo WSAA → CAE cerrado de punta a punta. Lo que sigue es producto, no puesta en marcha.

## Alto valor

### 🟡 Entregar el comprobante al receptor

El PDF ya se genera en el backend, pero no hay forma de mandárselo al cliente. Falta el envío
por email —`Client.email` ya existe— o compartir por WhatsApp desde la app. Sin esto, emitir no
cierra el ciclo.

### 🟡 Dashboard y Libro IVA Ventas

Total facturado por período, IVA débito fiscal y export del **Libro IVA Ventas** en CSV o PDF
para el contador. La posición de IVA ya se calcula para las tools de respondi; falta la
superficie propia y el export.

### 🟡 Mostrar las observaciones y los rechazos de ARCA

`Voucher` guarda `arcaObservations` y `status`, pero la app no diferencia aprobado de observado
ni de rechazado, no explica el motivo y no ofrece reintentar. Hoy un rechazo queda opaco para
quien factura.

### 🟡 Nota de crédito desde el detalle

El backend ya emite NC/ND con comprobantes asociados. Falta el atajo en la UI: desde el detalle
de una factura, un botón que precargue el asociado.

### 🟡 Numeración visible antes de confirmar

`GET /vouchers/numbering` ya devuelve el próximo número por punto de venta y tipo. Falta que la
pantalla de emisión diga "vas a emitir la Factura B 0001-00000042" **antes** de tocar el botón.

## Mejoras

- 🟢 **Rate limiting en `login` y `refresh`**: hoy no hay ninguno, así que la fuerza bruta no
  tiene costo. Es lo único de seguridad que quedó abierto (la biometría ya está en la app).
- 🟢 **Moneda extranjera en la UI**: el schema tiene `currency` y `exchangeRate`, y el backend
  consulta la cotización a ARCA, pero la app asume pesos.
- 🟢 **Salud de ARCA visible**: `FEDummy` ya está integrado; falta mostrar si auth, appserver y
  base están operativos antes de intentar emitir.
- 🟢 **Push notifications**: avisar CAE emitido y vencimiento de certificado.
- 🟢 **Rotación de `CERT_ENCRYPTION_KEY`**: no hay procedimiento escrito. La base entra al
  backup externo cifrado, claves privadas incluidas.
- 🟢 **Correr la app en un device real** contra el backend, apuntando `EXPO_PUBLIC_API_URL` a la
  LAN. Pasa `tsc`, `eslint` y el bundle de Metro, pero nunca se probó la red de verdad.
