# Security Review — Auditoría de seguridad de Chirola

Alcance: **$ARGUMENTS** (si vacío, revisar los archivos cambiados en el branch actual vs `main`).

Revisión enfocada en el riesgo real de una app fiscal: custodia de claves privadas, aislamiento
entre emisores, integración con ARCA (WSAA/WSFEv1), autenticación y la superficie mobile.

## Paso 1 — Determinar alcance

Si `$ARGUMENTS` está vacío:
```bash
git diff main...HEAD --name-only
```
Si se indica un módulo (ej: `certs`, `arca`, `comprobantes`), buscá sus archivos en
`services/api/src/` y `apps/mobile/src/`. Listá los archivos a revisar antes de continuar.

## Paso 2 — Categorías de revisión

### A. Custodia de certificados y claves privadas (CRÍTICO)

El backend es el vault: las `.key`/`.crt`/`.p12` de los contribuyentes son lo más sensible.

- Claves privadas o certificados guardados en claro (deben estar cifrados en reposo).
- Claves o secretos logueados, incluidos en respuestas de la API, o expuestos al mobile.
- Material fiscal commiteado en git (`.key`, `.crt`, `.p12`, `.env`) — verificar `.gitignore`.
- Clave de cifrado del vault hardcodeada o débil, en vez de venir de env var.
- El `TA` (ticket de acceso WSAA) o el `sign`/`token` expuestos fuera del backend.

**Archivos clave:** `services/api/src/certs/`, `services/api/src/crypto/`,
`services/api/src/arca/wsaa/`, `.gitignore`.

### B. Aislamiento por emisor (CRÍTICO)

- Queries Prisma sin filtro por `emisorId` (`findUnique`/`findFirst`/`update`/`delete` que no
  scopean al emisor autenticado).
- Endpoints que aceptan `emisorId` como input del cliente en vez de tomarlo del JWT/contexto.
- IDOR: un usuario accediendo a comprobantes, clientes o certificados de otro emisor.
- Certificado o CUIT de un emisor usado para emitir en nombre de otro.

**Archivos clave:** todos los `*.service.ts` y `*.controller.ts` que tocan datos de contribuyente.

### C. Autenticación y tokens (JWT)

- Endpoints sin `JwtAuthGuard` que deberían estar protegidos.
- JWT: secreto débil o hardcodeado, sin expiración, sin validación de claims.
- Refresh tokens: ¿se rotan al usar? ¿se invalidan al logout?
- Almacenamiento del token en el mobile: debe usar `expo-secure-store`, no storage en claro.

**Archivos clave:** `services/api/src/auth/`, `apps/mobile/src/lib/auth-context.tsx`,
`apps/mobile/src/lib/api.ts`.

### D. Integración con ARCA (SOAP)

- Parsing de respuestas SOAP sin validar/entidad XML externa habilitada (XXE en el parser XML).
- Errores de WSFEv1/WSAA tragados o expuestos crudos al cliente (filtran detalle interno).
- CAE/observaciones de ARCA no persistidos o no auditados (integridad fiscal).
- Reintentos que podrían duplicar la emisión de un comprobante (idempotencia).
- URLs de homologación vs producción fijadas por config, nunca por input del cliente.

**Archivos clave:** `services/api/src/arca/`, `arca-soap.util.ts`, `wsfe.service.ts`,
`wsaa.service.ts`.

### E. Validación de inputs

- DTOs sin validar contra los schemas Zod de `@chirola/shared`.
- Montos fiscales sin validar (negativos, precisión decimal incorrecta).
- Tipos de comprobante / conceptos / alícuotas aceptados sin whitelistear contra el enum válido.

### F. Inyección y datos

- Prisma raw queries (`$queryRaw`/`$executeRaw`) con interpolación de input del usuario.
- Path traversal al leer/escribir certificados o PDFs por nombre derivado de input.
- Generación de PDF/QR con datos sin sanitizar.

**Archivos clave:** `services/api/src/comprobantes/pdf.util.ts`, `qr-image.util.ts`.

### G. Configuración

- CORS abierto (`*`) en la API.
- Secretos en el repo o en defaults de código en vez de env vars.
- Stacktraces o errores internos devueltos al cliente.
- Endpoint de health exponiendo información sensible.

## Paso 3 — Clasificar por severidad

| Severidad | Criterio |
|-----------|----------|
| **CRÍTICO** | Leak de claves privadas, cruce de datos entre emisores, bypass de auth |
| **ALTO** | IDOR autenticado, exposición del token/TA, emisión duplicable |
| **MEDIO** | Validación faltante en campo fiscal, error handling que filtra detalle |
| **BAJO** | Best practice no cumplida, header faltante, log verboso |

## Paso 4 — Reporte

```markdown
## Security Review — [fecha] — [alcance]

### Resumen
- X hallazgos: N críticos, N altos, N medios, N bajos

### CRÍTICO
- [riesgo] — `archivo:línea`
  **Impacto:** [qué pasa si se explota]
  **Fix:** [instrucción concreta]

### ALTO / MEDIO / BAJO
- ...

### Sin hallazgos ✓
- [categorías que pasaron]
```

## Paso 5 — Remediación

Preguntá qué fixear: **todos los críticos y altos** (recomendado), **por categoría**, o
**uno por uno**. No apliques fixes sin confirmación.

## Reglas

- Priorizá siempre custodia de claves y aislamiento por emisor: son los vectores críticos.
- No reportes false positives: verificá antes de reportar.
- Incluí siempre `archivo:línea` exacto.
