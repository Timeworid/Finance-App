#!/usr/bin/env bash
# Génère des secrets pour le DÉVELOPPEMENT LOCAL (backend/.env).
# Usage : ./scripts/generate-secrets.sh            → affiche les lignes à copier
#         ./scripts/generate-secrets.sh --write    → crée backend/.env s'il n'existe pas
#
# En production (Docker), inutile : ./scripts/deploy-production.sh génère et
# vérifie automatiquement .env.docker. Ce script n'écrase JAMAIS un fichier existant
# (remplacer ENCRYPTION_KEY rendrait les données chiffrées illisibles).

set -euo pipefail

gen_hex() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"; else od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; fi
}

SECRETS="JWT_SECRET=$(gen_hex 64)
JWT_REFRESH_SECRET=$(gen_hex 64)
ENCRYPTION_KEY=$(gen_hex 32)"

if [ "${1:-}" = "--write" ]; then
  TARGET="backend/.env"
  [ -f backend/.env.example ] || { echo "❌ Lancez ce script depuis la racine du projet"; exit 1; }
  if [ -f "$TARGET" ]; then
    echo "❌ $TARGET existe déjà : il n'est jamais écrasé (sa clé ENCRYPTION_KEY protège vos données)."
    exit 1
  fi
  (umask 077 && grep -vE '^(JWT_SECRET|JWT_REFRESH_SECRET|ENCRYPTION_KEY)=' backend/.env.example > "$TARGET")
  printf '%s\n' "$SECRETS" >> "$TARGET"
  echo "✅ $TARGET créé avec des secrets aléatoires (permissions 600)."
else
  echo "# Secrets à placer dans backend/.env (ne jamais les commiter) :"
  echo "$SECRETS"
fi
