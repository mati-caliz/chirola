#!/bin/bash

set -e

echo "🚀 Iniciando Chirola en modo desarrollo..."

free_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "🧹 Liberando puerto ${port} (proceso previo: ${pids})..."
        kill -9 $pids 2>/dev/null || true
    fi
}

echo "🧹 Cerrando ejecuciones previas..."
free_port 3000
free_port 8081

if ! docker ps &> /dev/null; then
    echo "❌ Docker no está corriendo. Por favor inicia Docker primero."
    exit 1
fi

echo "📦 Iniciando PostgreSQL..."
docker compose up -d db

echo "⏳ Esperando a que PostgreSQL esté listo..."
timeout 30 bash -c 'until (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null; do sleep 1; done' || {
    echo "❌ PostgreSQL no respondió a tiempo"
    exit 1
}
echo "✅ PostgreSQL listo"

echo "🔧 Iniciando Backend..."
pnpm api:dev > /tmp/chirola-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

cleanup() {
    echo ""
    echo "🛑 Deteniendo backend..."
    kill "$BACKEND_PID" 2>/dev/null || true
    free_port 3000
    free_port 8081
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
