# Roadmap — Chirola

Lo que falta. El alcance actual está en [`arquitectura.md`](arquitectura.md) y la cobertura del
protocolo en [`arca-ampliacion.md`](arca-ampliacion.md); acá no se repite.

El producto está completo del lado del código. Lo que queda depende de cuentas externas o de
probar en un teléfono, más una deuda de la pantalla de emisión.

## Del dueño

- **Push de punta a punta.** El backend manda por el servicio de Expo y la app registra el token,
  pero `getExpoPushTokenAsync` necesita el `projectId` de EAS (`eas init` lo escribe en
  `app.json`), y Android además necesita las credenciales de FCM de un proyecto de Firebase.
  Mientras falte el `projectId`, la app no pide permiso y no registra nada.
- **Correr la app en un teléfono** contra el backend, apuntando `EXPO_PUBLIC_API_URL` a la LAN.
  Pasa `tsc`, `eslint` y el bundle de Metro, pero la red, el compositor de mail y las hojas de
  compartir nunca se probaron de verdad.

## Deuda

- 🟢 **La pantalla de emisión calcula los totales en el cliente** y pasa las 800 líneas. La
  confirmación ya usa el `dry-run` del backend, pero el total en vivo mientras se cargan ítems se
  calcula en la app. Falta mostrarlo con `POST /vouchers/preview`, con debounce, y partir la
  pantalla en secciones (receptor, ítems, tributos, período).
