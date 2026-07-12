#!/bin/bash

set -e

echo "🚀 Iniciando Chirola en modo desarrollo..."

if ! docker ps &> /dev/null; then
    echo "❌ Docker no está corriendo. Por favor inicia Docker primero."
    exit 1
fi

echo "📦 Iniciando PostgreSQL..."
docker compose up -d db

echo "⏳ Esperando a que PostgreSQL esté listo..."
timeout 30 bash -c 'until docker compose exec db pg_isready -U chirola > /dev/null 2>&1; do sleep 1; done'
echo "✅ PostgreSQL listo"

echo "🔧 Iniciando Backend..."
pnpm api:dev > /tmp/chirola-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

cleanup() {
    echo ""
    echo "🛑 Deteniendo backend..."
    kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "⏳ Esperando a que el backend esté listo..."
timeout 60 bash -c 'until curl -s -o /dev/null http://localhost:3000/api; do sleep 1; done' || {
    echo "❌ El backend no respondió a tiempo. Ver logs: tail -f /tmp/chirola-backend.log"
    exit 1
}
echo "✅ Backend listo en http://localhost:3000"

LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
MOBILE_ENV="apps/mobile/.env"
if [ -n "$LAN_IP" ] && [ ! -f "$MOBILE_ENV" ]; then
    echo "EXPO_PUBLIC_API_URL=http://${LAN_IP}:3000/api" > "$MOBILE_ENV"
    echo "📱 Generado $MOBILE_ENV apuntando a http://${LAN_IP}:3000/api (para Expo Go en dispositivo físico)"
fi

echo ""
echo "📝 Logs del backend: tail -f /tmp/chirola-backend.log"
echo ""
echo "💻 Iniciando Expo..."
echo ""

pnpm mobile:dev
