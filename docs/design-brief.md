# Brief de diseño UX/UI — Chirola (app de facturación electrónica ARCA)

Necesito que diseñes el sistema de UI completo de una app mobile. Hoy la app funciona pero
la UX/UI es improvisada (no fue pensada): quiero un rediseño integral, coherente y cuidado.

## Qué es la app

Chirola es una app mobile (iOS + Android, hecha en React Native / Expo) para que
monotributistas, autónomos y PyMEs argentinas **facturen electrónicamente contra ARCA (ex AFIP)
de forma simple**: emiten comprobantes (Factura A/B/C, Notas de Crédito/Débito) y obtienen el
CAE, sin pelearse con el portal de ARCA. Es "la forma humana de facturar".

Es **multi-emisor**: un usuario puede administrar varios contribuyentes (razones sociales /
CUITs) desde la misma cuenta.

## Público y tono

- Usuarios NO técnicos y NO contadores: comerciantes, profesionales independientes, dueños de
  PyME. El lenguaje fiscal (CAE, punto de venta, condición frente al IVA) les intimida.
- Tono: claro, tranquilizador, "te lo resolvemos". Traducir la jerga de ARCA a algo entendible,
  con ayuda contextual. Prioridad absoluta a la tarea "emitir una factura en <30 segundos".
- Estética: moderna, limpia, confiable (manejan plata e impuestos), cálida sin ser infantil.
  Pensá un sistema de diseño consistente: paleta, tipografía, spacing, componentes, estados,
  íconos. Soporte para light y dark mode. Accesible (contraste, tamaños táctiles).

## Reglas de plataforma

- Patrones nativos mobile (no web): navegación por tabs + stacks, bottom sheets, pull-to-refresh,
  gestos, teclado numérico donde corresponda, safe areas.
- Todos los textos de usuario en **español (Argentina)**. Formato de moneda ARS, fechas es-AR.
- Contemplá siempre los tres estados de cada pantalla: **cargando, vacío (empty state) y error**
  (sobre todo errores de red y de ARCA, que son frecuentes).

## Navegación general (propuesta, mejorala si ves algo mejor)

Tras elegir/crear un emisor, la app entra a un **tab bar** con: Inicio (dashboard) · Comprobantes
· Emitir (acción central destacada) · Fiscal · Más. El cambio de emisor debe estar siempre a mano.

## Pantallas a diseñar

Marco con [HOY] las que ya existen y quiero rediseñadas, y con [NUEVA] las que faltan.

### 1. Onboarding y cuenta
- [HOY] Splash / carga inicial (con estado de sesión).
- [HOY] Login.
- [HOY] Registro.
- [NUEVA] Recuperar contraseña.
- [NUEVA] Onboarding de bienvenida (2-3 slides: qué hace la app y los primeros pasos:
  crear emisor → subir certificado → emitir).
- [NUEVA] Perfil / cuenta del usuario (datos, cerrar sesión, seguridad).

### 2. Emisores (multi-contribuyente)
- [HOY] Lista de emisores (selector + alta).
- [HOY] Alta / edición de emisor (razón social, CUIT, condición frente al IVA).
- [HOY] Detalle / home del emisor.

### 3. Certificado ARCA (el paso más difícil para el usuario — cuidalo mucho)
- [HOY] Onboarding del certificado. Rediseñar como **wizard por pasos** claro:
  1) generamos tu clave y CSR, 2) copiar el CSR y subirlo al portal de ARCA (con guía visual
  paso a paso de qué hacer en ARCA), 3) pegar/adjuntar el `.crt` que te da ARCA y emparejarlo,
  4) confirmación de éxito. Necesita mucho hand-holding: es donde la gente se traba.
- [NUEVA] Estado del certificado: vigencia, fecha de vencimiento, aviso de "por vencer",
  y salud de la conexión con ARCA.

### 4. Puntos de venta (falta y bloquea la emisión prolija)
- [NUEVA] ABM de puntos de venta del emisor, idealmente con opción de **sincronizar los
  habilitados desde ARCA** (no cargar a mano). Selector de punto de venta reutilizable.

### 5. Emisión de comprobantes (núcleo del producto)
- [HOY] Nueva factura. Rediseño clave: elegir tipo de comprobante, punto de venta, receptor
  (buscar cliente o cargar rápido), ítems con cálculo de IVA, moneda (ARS por default; soporte
  a USD con cotización). Antes de confirmar, mostrar en claro **"vas a emitir Factura B
  0001-00000042 por $X"**.
- [NUEVA] Preview del comprobante calculado (totales, IVA) antes de emitir, sin emitir todavía.
- [NUEVA] Pantalla de emisión en progreso + resultado: diferenciar visualmente
  **aprobado / observado / rechazado por ARCA**, explicar el motivo en criollo y ofrecer
  reintento cuando falla.
- [HOY] Detalle del comprobante: CAE y su vencimiento, QR, botón de PDF, estado, observaciones
  de ARCA. Acciones: compartir/enviar, y **generar Nota de Crédito** que precargue el asociado.
- [NUEVA] Historial / listado de comprobantes emitidos, con filtros (rango de fechas, tipo,
  estado, cliente, punto de venta) y acceso al detalle / PDF.
- [NUEVA] Compartir / enviar comprobante al receptor por **email o WhatsApp** (adjuntando el PDF).

### 6. Clientes / receptores
- [HOY] Lista de clientes del emisor.
- [HOY] Alta / edición de cliente. Sumar **autocompletado por CUIT** consultando el padrón de
  ARCA (razón social, condición frente al IVA, domicilio) para no cargar a mano.
- [NUEVA] Detalle de cliente con su historial de comprobantes.

### 7. Módulo fiscal / contable
- [NUEVA] Facturas de compra: listado + resumen, y alta de factura de compra (impactan el IVA).
- [NUEVA] Posición mensual de IVA: débito (ventas) vs crédito (compras), saldo del período.
- [NUEVA] Calendario de vencimientos AFIP/ARCA + alertas fiscales.
- [NUEVA] Dashboard / reportes del emisor: total facturado por período, IVA débito fiscal,
  resumen por punto de venta y por tipo de comprobante. (Este dashboard es el "Inicio".)
- [NUEVA] Export del **Libro IVA Ventas** (para el contador).

### 8. Sistema
- [NUEVA] Centro de notificaciones / alertas (CAE emitido, certificado por vencer, vencimiento
  impositivo cercano).
- [NUEVA] Configuración: moneda por default, notificaciones push, biometría (Face/Touch ID)
  para desbloquear la app.
- [NUEVA] Salud / diagnóstico de ARCA (estado de los servicios antes de intentar emitir).

## Qué espero como entrega

1. Un **sistema de diseño** base: paleta (light/dark), tipografía, escala de spacing, componentes
   reutilizables (botones, inputs, cards, list items, chips de estado, bottom sheets, empty/error
   states, badges de estado de comprobante: aprobado/observado/rechazado/pendiente).
2. El **diseño de cada pantalla** de la lista, con sus estados (carga/vacío/error donde aplique).
3. Los **flujos completos** más importantes end-to-end: (a) onboarding + certificado ARCA,
   (b) emitir una factura de cero, (c) generar una nota de crédito desde una factura.
4. Foco especial en reducir la fricción de: subir el certificado, elegir tipo de comprobante y
   condición fiscal, y entender un rechazo de ARCA.

Priorizá coherencia visual y claridad por sobre "efectos". El objetivo: que emitir una factura
legal se sienta simple y seguro.
