#!/usr/bin/env bash
# Déploiement production de FinancePilot avec Docker Compose (v2)
# Usage : ./scripts/deploy-production.sh   (depuis la racine du projet)

set -euo pipefail

ENV_FILE=".env.docker"
COMPOSE=(docker compose --env-file "$ENV_FILE")

echo "🚀 Déploiement de FinancePilot"

# Pré-requis
[ -f docker-compose.yml ] || { echo "❌ Lancez ce script depuis la racine du projet"; exit 1; }
command -v docker >/dev/null || { echo "❌ Docker n'est pas installé"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ Docker Compose v2 requis (docker compose)"; exit 1; }
[ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE manquant : cp .env.docker.example $ENV_FILE puis renseignez les secrets"; exit 1; }

# Vérifie que les secrets obligatoires sont renseignés (le compose refuse sinon)
"${COMPOSE[@]}" config -q

echo "🔨 Build des images"
"${COMPOSE[@]}" build --pull

echo "📦 Démarrage (les containers existants sont recréés si nécessaire)"
"${COMPOSE[@]}" up -d --wait --wait-timeout 180

# shellcheck disable=SC1090
HTTP_PORT="$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2)"
BASE_URL="http://localhost:${HTTP_PORT:-80}"

echo "🏥 Vérification"
curl -fsS "$BASE_URL/health" >/dev/null && echo "✅ Frontend : OK"
# 401 attendu sans authentification : prouve que nginx → backend → MongoDB répond
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me")
if [ "$code" = "401" ]; then echo "✅ API : OK"; else echo "❌ API : HTTP $code"; "${COMPOSE[@]}" logs --tail 50 backend; exit 1; fi

echo ""
echo "✅ Déploiement réussi : $BASE_URL"
echo "   Logs     : docker compose logs -f"
echo "   Arrêt    : docker compose down"
echo "   Sauvegarde : ./scripts/backup-mongodb.sh"
echo ""
echo "ℹ️  Après une mise à jour depuis une ancienne version, chiffrez les données restées en clair :"
echo "   docker compose exec backend node scripts/reencrypt-plaintext.js --dry-run"
