#!/bin/sh
set -e

echo "🔄 Sincronizando schema com o banco de dados..."
npx prisma db push --accept-data-loss

echo "✅ Migrations concluídas. Iniciando servidor..."
exec node dist/server.js
