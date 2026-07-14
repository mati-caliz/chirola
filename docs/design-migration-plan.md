# Plan de migración — Chirola Design System → app RN/Expo

> **Estado:** Fases 1–5 completas y verificadas (tsc + lint + tests 87/87 + bundle Metro). Todas
> las pantallas núcleo están rediseñadas con el DS: Certificado (wizard Stepper), Emitir (modal +
> confirmación + fases progreso/error), Detalle, Comprobantes (lista real, endpoint nuevo
> `GET /issuers/:id/vouchers`), Fiscal (IVA + vencimientos), Login/Registro (wordmark), alta de
> emisor y de cliente, lista de clientes, detalle de emisor. La navegación es un tab bar de 5
> destinos con emisor activo global (AsyncStorage). Decisiones §7: Emitir = modal; AsyncStorage;
> backend en paralelo. **Pendiente (features nuevas de roadmap, no rediseño):** ABM de puntos de
> venta (1.2), centro de notificaciones, configuración (biometría, toggle de dark mode), perfil,
> recuperar contraseña, autocompletado por padrón.

Objetivo: que **toda la app mobile se vea y se comporte como el "Chirola Design System"** que se
diseñó en Claude Design, sin quedarnos en el look improvisado de hoy.

El design system (DS) es **web** (React DOM + CSS con variables `oklch` + fuentes por CDN +
íconos Lucide inline). La app es **React Native / Expo**. "Importar" acá es **traducir** el
sistema a RN, no copiar archivos. Este doc lista todo lo que hay que hacer, en orden.

> Fuente del DS: proyecto Claude Design "Chirola Design System"
> (`52d28cc0-e85f-4c63-b046-6872b5dd6c49`, dueño "Los 3 Devs"). Se accede vía la MCP de
> claude_design (read-only) para reconsultar componentes durante la implementación.

---

## 0. Estado actual vs destino

**Hoy:** `src/constants/theme.ts` (paleta azul `#208AEF`, neutros fríos, fuentes de sistema) +
`src/components/ui.tsx` (Screen, Title, Card, TextField, Button, Badge, OptionGroup…) sobre un
Stack de expo-router sin tab bar. Funcional pero sin identidad.

**Destino (DS):** verde profundo fiscal + neutros cálidos, Onest + Spline Sans Mono, sombras
suaves, tab bar de 5 destinos, bottom sheets, stepper, estados de comprobante tipados, voseo y
jerga ARCA traducida en criollo. Light y dark completos.

**Decisiones ya tomadas con el usuario:** (1) sumar dependencias para fidelidad total (fuentes +
Lucide), (2) reestructurar navegación a tab bar completo, (3) arrancar por fundaciones + librería
de componentes antes de las pantallas.

---

## 1. Diferencias web→RN a resolver (lo que no se puede copiar tal cual)

| DS (web) | RN | Acción |
|---|---|---|
| Colores `oklch(...)` | RN no parsea `oklch` | Convertir a hex/rgba (hecho, ver §2.1) |
| CSS custom properties + `[data-theme="dark"]` | No hay CSS runtime | Objeto de tokens TS + `useTheme()` por scheme |
| `box-shadow` (3 niveles + fab) | `shadow*`/`elevation` | Mapear cada sombra a props RN (iOS) + `elevation` (Android) |
| Fuentes por `@import` Google Fonts | `expo-font` | Cargar Onest + Spline Sans Mono con `@expo-google-fonts/*` |
| Íconos Lucide como SVG inline | No hay SVG DOM | `lucide-react-native` (+ `react-native-svg`) |
| `<div>/<span>/<button>` + flexbox CSS | `View/Text/Pressable` | Reescribir cada componente; flex ya es casi 1:1 |
| `onClick`, `onChange(value)` | `onPress`, `onChangeText` | Normalizar la API de props a convención RN |
| `overflowY:auto`, scroll libre | `ScrollView`/`FlatList` | Listas largas (comprobantes) con `FlatList` |
| `position:fixed` footer (barra total) | layout flex | Footer sticky con `View` fuera del `ScrollView` |
| `animation` CSS (spin, pop, pulse) | `reanimated` | Spinner de emisión, "pop" de éxito, skeleton pulse |
| `:focus`/`:hover` | press states | Solo press (`pressed`) + `scale(.97)`; sin hover |

---

## 2. Fundaciones

### 2.1 Tokens de color — HECHO (adelanto)
`src/theme/tokens.ts` ya creado: paleta `oklch` convertida a hex con un script propio
(OKLCH→OKLab→sRGB, sin dependencias), más los mapas semánticos `lightColors`/`darkColors`,
`spacing`, `radius`, `fontSize`, `lineHeight`, `fontFamily`. Es el único cambio de código hecho;
el resto del plan está pendiente.

### 2.2 Fuentes
- Agregar deps: `@expo-google-fonts/onest`, `@expo-google-fonts/spline-sans-mono`, `expo-font`
  (ya está).
- Cargar los pesos usados: Onest 400/500/600/700/800, Spline Sans Mono 400/500/600.
- `useFonts(...)` en `src/app/_layout.tsx`; mantener el splash hasta que carguen
  (`expo-splash-screen`, ya está).
- Helpers de tipografía en el theme: `type-amount`/`type-fiscal`/`type-overline` del DS pasan a
  estilos RN reutilizables (mono + `tabular-nums` vía `fontVariant: ['tabular-nums']`).

### 2.3 Íconos
- Agregar `lucide-react-native` + `react-native-svg`.
- Los SVG inline de los mockups (file, swap, bell, chevron, check, x, share, qr, shield, copy,
  mail, whatsapp…) mapean 1:1 a íconos Lucide por nombre. Tamaños del DS: 20 inline / 24 nav /
  44–48 hero / 72 QR. Color vía `color={colors.textX}`.

### 2.4 Provider de theme + sombras
- `src/theme/ThemeProvider.tsx` + `useTheme()` que devuelve `{ scheme, colors, spacing, radius,
  fontSize, font, shadow }` según `useColorScheme()`.
- `shadow`: mapear `--shadow-card/-raised/-sheet/-fab` a objetos RN (`shadowColor`, `shadowOffset`,
  `shadowOpacity`, `shadowRadius`, `elevation`). El `--shadow-fab` va verde para el FAB Emitir.
- Reescribir `src/hooks/use-theme.ts` para exponer el theme nuevo (hoy devuelve la paleta vieja).

**Entregable de esta fase:** theme importable y fuentes/íconos cargando, sin romper pantallas
actuales (se apoyan en `ui.tsx`, que se reemplaza en §3 manteniendo nombres públicos).

---

## 3. Librería de componentes (RN)

Recrear cada componente del DS en `src/components/ui/` (un archivo por componente, `PascalCase`,
funciones flecha, tipado estricto, sin comentarios — reglas del repo). API en convención RN
(`onPress`, `onChangeText`). Props inferidas de los mockups:

**core/**
- `Button` — `variant: primary|secondary|ghost|danger`, `size: sm|md`, `full`, `icon`, `loading`,
  `disabled`, `onPress`. Press: oscurece un paso + `scale(.97)`.
- `IconButton` — `label` (a11y), `icon`, `onPress`. Circular, hit target ≥48.
- `Switch` — `checked`, `onChange`, `label`. (Puede envolver el `Switch` nativo tintado con brand.)

**forms/**
- `Input` — `label`, `value`, `onChangeText`, `hint`, `error`, `placeholder`, `mono`,
  `keyboardType`, `prefix` (ej. `$`), `multiline`. Borde 1.5px → `borderFocus` al enfocar.
- `Select` — `label`, `value`, `hint`, `onPress` (abre un BottomSheet; no es picker nativo).
- `SearchBar` — `value`, `onChangeText`, `placeholder`, `onClear`.

**display/**
- `Card` — `onPress?`, `pad` (default 16; `pad={4}` para listas), `style`. Blanca, radio 16,
  `shadow-card`, sin borde en light / borde sutil en dark.
- `ListItem` — `title`, `subtitle`, `leading`, `trailing`, `chevron`, `onPress`. Divisor
  reutilizable (`Divider`, línea `borderSubtle` con margen lateral).
- `StatusBadge` — `status: aprobado|observado|rechazado|pendiente`, `label?` (default = nombre del
  estado), `size: sm|md`. Usa los tokens `status*Bg/Fg`.
- `Chip` — `label`, `selected`, `onPress`. Pill; fila scrollable horizontal para filtros.
- `Amount` — `value` (string ya formateado `$ 1.234,56`), `currency?`, `size: sm|md|xl`. Mono,
  tabular, peso semibold; `xl` = 40px protagonista.

**feedback/**
- `EmptyState` — `icon`, `title`, `body`, `action`. Ícono 48 en círculo 96 `brand100`.
- `Banner` — `kind: error|warning` (default error), `title`, `body`, `detail` (técnico, plegable).
  Es el patrón "error en criollo + detalle ARCA plegado".
- `BottomSheet` — `open`, `title`, `onClose`, `children`. Scrim `overlayScrim`, hoja radio 22
  arriba, `shadow-sheet`, slide-up con reanimated. (Base: `@gorhom/bottom-sheet` **o** Modal +
  reanimated propio — ver §7 decisión.)

**navigation/**
- `TabBar` — 5 destinos (Inicio, Comprobantes, **Emitir** central destacado, Fiscal, Más). Altura
  64 + safe area. El central es un FAB verde con `shadow-fab`. (Se integra como `tabBar` custom de
  expo-router Tabs.)
- `NavBar` — header con back "minimal", título sentence-case. (Se aplica vía `screenOptions` de
  expo-router con header propio.)
- `Stepper` — `steps: string[]`, `current`. Para el wizard de certificado (4 pasos).

**Reemplazo de `ui.tsx`:** el `src/components/ui.tsx` actual se deja como *barrel* que re-exporta
la librería nueva y mantiene los nombres que hoy usan las pantallas (`Screen`, `Title`, `Subtitle`,
`Label`, `BodyText`, `TextField`→`Input`, `Button`, `ErrorText`, `Loading`, `Centered`, `Badge`→
`StatusBadge`, `OptionGroup`→chips/segmented). Así nada se rompe mientras se migran las pantallas.

**Verificación de la librería:** una pantalla-galería interna (dev-only) que renderice cada
componente en light y dark para comparar contra las `*.card.html` del DS.

---

## 4. Navegación (reestructura a tab bar)

Hoy: `(auth)` + `(app)` como Stack plano de pantallas de emisores/clientes/vouchers.

Destino:
```
src/app/
  (auth)/            login, register, [forgot-password]        ← stack sin tabs
  (app)/
    _layout.tsx      ← selecciona emisor activo; si no hay cert → wizard
    (tabs)/
      _layout.tsx    ← Tabs con TabBar custom (5 destinos)
      index          Inicio (dashboard del emisor activo)
      vouchers/      Comprobantes (lista + filtros) → [id] detalle
      new-voucher    Emitir (o abrir como modal full-screen)
      fiscal         Posición IVA + vencimientos + export
      more           Más (emisor, cuenta, cert, PdV, clientes, logout)
    issuers/         alta/edición + selector (BottomSheet "Tus emisores")
    certificate/     wizard Stepper (fuera de tabs, full-screen)
```
- **Emisor activo** pasa a ser contexto global (hoy va por ruta `issuers/[issuerId]/...`). Nuevo
  `ActiveIssuerProvider` (persistido en `expo-secure-store`/`AsyncStorage`), con el selector en el
  header del dashboard y en "Más". Esto reordena varias rutas anidadas actuales.
- "Emitir" central: modal full-screen (mejor UX de foco) en vez de tab con estado.
- Guard: en `(app)/_layout` ya hay guard de sesión; sumar guard de "emisor sin certificado" →
  redirige al wizard.

---

## 5. Migración pantalla por pantalla

Leyenda: **[HOY]** existe y se rediseña · **[NUEVA]** no existe · mapeo al mockup del DS.

### Núcleo (mockups ya diseñados en el DS)
| Pantalla | Estado | Mockup DS | Notas de migración |
|---|---|---|---|
| Inicio / Dashboard | [NUEVA] | `ScreenDashboard` | Selector de emisor (pill), card "facturado en el mes" + IVA débito, alerta de cert por vencer, últimos 3 comprobantes. |
| Comprobantes (lista) | [NUEVA] backend + UI | `ScreenComprobantes` | SearchBar + chips de filtro + `FlatList`. Estados loading (skeleton)/vacío/error. **Requiere** endpoint `GET /issuers/:id/vouchers` (roadmap 1.3). |
| Detalle comprobante | [HOY] `vouchers/[id]` | `ScreenDetalle` | Card centrada con StatusBadge, Amount xl, QR, CAE+vto en mono, banner si observado/rechazado, acciones Enviar/PDF/Nota de crédito. |
| Nueva factura | [HOY] `vouchers/new` | `ScreenNuevaFactura` | Select tipo (sheet), Select PdV, Input cliente, cards de ítems con IVA, footer sticky total, sheet de confirmación "Vas a emitir…", fases progreso/ok/error. |
| Certificado | [HOY] `certificate` | `ScreenCertificado` | Wizard `Stepper` 4 pasos: clave/CSR → guía ARCA + copiar CSR → pegar/adjuntar .crt → éxito. |
| Fiscal | [NUEVA] | `ScreenFiscal` | Posición IVA (débito/crédito/saldo), próximos vencimientos, export Libro IVA Ventas. |
| Más | [NUEVA] | `ScreenMas` | Secciones Emisor (cert, PdV, clientes, cambiar emisor) y Cuenta (perfil, Face ID, notificaciones), logout. |
| Selector de emisor | [HOY] `issuers/index` | `SheetEmisores` | Pasa a BottomSheet con StatusBadge "Activo" + "Agregar otro emisor". |
| Enviar comprobante | [NUEVA] | `SheetCompartir` | BottomSheet WhatsApp / Email (roadmap 2.2). |

### Auth y cuenta
| Pantalla | Estado | Notas |
|---|---|---|
| Login | [HOY] | Rediseño con Input/Button del DS, wordmark "Chirola" (Onest 800). |
| Registro | [HOY] | Íd. |
| Recuperar contraseña | [NUEVA] | Nueva; requiere endpoint (no existe aún). |
| Perfil / cuenta | [NUEVA] | Datos del usuario, seguridad, logout. Entra desde "Más". |
| Onboarding de bienvenida | [NUEVA] | 2–3 slides (qué es + primeros pasos). Opcional, baja prioridad. |

### Emisores / clientes / puntos de venta
| Pantalla | Estado | Notas |
|---|---|---|
| Alta / edición de emisor | [HOY] `issuers/new` | Rediseño; condición frente al IVA con hint en criollo. |
| Lista/alta de clientes | [HOY] `clients/*` | Rediseño con ListItem/EmptyState; sumar autocompletado por CUIT (padrón, roadmap 2.1). |
| Detalle de cliente | [NUEVA] | Con historial de comprobantes del cliente. |
| ABM puntos de venta | [NUEVA] | **Bloqueante** (roadmap 1.2): endpoint + pantalla + selector. Sync desde ARCA (`FEParamGetPtosVenta`). |

### Sistema (roadmap, sin mockup — diseñar con la librería del DS)
- Centro de notificaciones / alertas (CAE, cert por vencer, vencimientos).
- Configuración (moneda default, notificaciones, biometría Face/Touch ID).
- Salud / diagnóstico de ARCA (`FEDummy`).
- Estados de error de red globales / reintento (patrón `Banner`).

---

## 6. Contenido y copy (parte del DS, no cosmético)

El DS define reglas de contenido que hay que aplicar al migrar, no solo estilos:
- **Voseo siempre** ("Elegí", "Pegá", "Vas a emitir"); nunca tú/usted.
- **Jerga ARCA traducida** en hints ("CAE — el número que prueba que ARCA aprobó tu factura").
- **Confirmaciones explícitas** antes de emitir ("Vas a emitir **Factura B 0001-00000042 por
  $ 48.400,00**").
- **Errores en criollo** + detalle técnico ARCA plegado + acción de salida.
- **Formato es-AR**: `$ 1.234,56`, `13/07/2026`, CUIT `20-33222111-9`, comprobante `0001-00000042`.
  Centralizar en `src/lib/format.ts` (ya existe; extender).
- Sin emoji en UI; sentence case en títulos y botones.

---

## 7. Decisiones abiertas (definir antes de implementar cada parte)

1. **BottomSheet:** `@gorhom/bottom-sheet` (robusto, gestos, snap points; +deps) vs. Modal +
   reanimated propio (menos deps, más laburo). Recomendación: `@gorhom/bottom-sheet`.
2. **Emitir:** ¿tab con estado propio o modal full-screen? Recomendación: modal.
3. **Listas:** `FlatList` para comprobantes/clientes (paginado del backend).
4. **Persistencia de emisor activo:** SecureStore vs AsyncStorage (sumar dep). 
5. **Dark mode:** ¿seguir `useColorScheme` del sistema o toggle manual en Config? DS soporta ambos.
6. **Backend primero:** varias pantallas nuevas necesitan endpoints que no existen (lista de
   comprobantes 1.3, PdV 1.2, padrón 2.1, recuperar contraseña, notificaciones). Definir si se
   mockea en el front o se implementa el backend en paralelo.

---

## 8. Orden de trabajo sugerido

1. **Fundaciones** (§2): tokens (hecho), fuentes, íconos, ThemeProvider + sombras. *No hay UI
   visible todavía.*
2. **Librería de componentes** (§3) + galería de verificación en light/dark.
3. **Barrel de compat en `ui.tsx`** para que las pantallas actuales adopten el look sin reescribir.
4. **Navegación** (§4): tab bar + emisor activo global + guard de certificado.
5. **Pantallas núcleo con mockup** (§5, primer bloque), en este orden por dependencia:
   Certificado → Dashboard → Nueva factura → Detalle → Comprobantes (necesita endpoint) →
   Fiscal → Más.
6. **Auth/emisores/clientes** rediseñados.
7. **Pantallas nuevas de roadmap** (PdV, notificaciones, config, salud ARCA, perfil).
8. **Copy pass** (§6) y **QA** en device real light/dark (roadmap 1.4).

Cada bloque cierra con `pnpm -r lint` + `tsc` + bundle Metro en verde (skill `/check`), y los
componentes se contrastan visualmente contra las `*.card.html`/`ui_kits/` del DS.

---

## 9. Dependencias nuevas (resumen)

- `@expo-google-fonts/onest`, `@expo-google-fonts/spline-sans-mono`
- `lucide-react-native`, `react-native-svg`
- (probable) `@gorhom/bottom-sheet`
- (posible) `@react-native-async-storage/async-storage` para emisor activo

Todas compatibles con Expo SDK 54 / RN 0.81. `react-native-reanimated`, `gesture-handler`,
`safe-area-context` ya están instaladas.
