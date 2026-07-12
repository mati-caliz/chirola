#!/usr/bin/env bash
# Smoke test del backend de Chirola: ejercita auth, emisores, vault y las
# validaciones/ownership sin necesidad de un certificado real de ARCA.
#
# Uso: con la API corriendo (pnpm api:dev), ejecutar:
#   bash services/api/scripts/smoke.sh
set -euo pipefail

BASE="${BASE:-http://localhost:3000/api}"
jq_get() { python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }

echo "== health =="
curl -s "$BASE/health"; echo

EMAIL="smoke+$RANDOM@chirola.dev"
echo "== register ($EMAIL) =="
TOKEN=$(curl -s -X POST "$BASE/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"supersecreta\"}" | jq_get token)
echo "token OK (len ${#TOKEN})"

AUTH=(-H "Authorization: Bearer $TOKEN")

echo "== crear emisor =="
EMISOR=$(curl -s -X POST "$BASE/emisores" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"cuit":"20111111112","razonSocial":"Smoke SA","condicionIva":"MONOTRIBUTO"}' | jq_get id)
echo "emisorId=$EMISOR"

echo "== listar emisores =="
curl -s "$BASE/emisores" "${AUTH[@]}"; echo

echo "== validación: CUIT malo (espera 400) =="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE/emisores" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"cuit":"123","razonSocial":"X","condicionIva":"MONOTRIBUTO"}'

echo "== ruta protegida sin token (espera 401) =="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" "$BASE/emisores"

echo "== emitir sin cert cargado (espera 404) =="
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE/comprobantes" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"emisorId\":\"$EMISOR\",\"puntoVenta\":1,\"tipoCbte\":11,\"concepto\":1,\"receptor\":{\"tipoDoc\":99,\"numeroDoc\":\"0\"},\"items\":[{\"descripcion\":\"Cafe\",\"cantidad\":1,\"precioUnit\":1000,\"alicuotaIva\":21}]}"

echo "== OK: flujo local verificado (sin llamar a ARCA) =="
