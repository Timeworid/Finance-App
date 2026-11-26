#!/usr/bin/env bash
# =============================================================================
# Déploiement automatique de FinancePilot (Docker Compose v2)
#
# Usage : ./scripts/deploy-production.sh                 (depuis la racine du projet)
#         FRONTEND_URL=https://finance.exemple.fr ./scripts/deploy-production.sh
#         ./scripts/deploy-production.sh --prepare-only  (configuration seule, sans déployer)
#
# Étapes, toutes automatiques :
#   1. Configuration : .env.docker généré s'il n'existe pas (secrets aléatoires forts) ;
#      secrets JWT absents ou faibles régénérés ; ENCRYPTION_KEY JAMAIS modifiée.
#   2. Sauvegarde de la base existante avant toute mise à jour.
#   3. Build des images et démarrage (attente des healthchecks).
#   4. Migrations de données : exécutées par le backend au démarrage (une seule fois).
#   5. Vérification de santé de bout en bout.
# =============================================================================

set -euo pipefail

ENV_FILE=".env.docker"
EXAMPLE_FILE=".env.docker.example"
PREPARE_ONLY=false
[ "${1:-}" = "--prepare-only" ] && PREPARE_ONLY=true

info() { echo "ℹ️  $*"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
die()  { echo "❌ $*" >&2; exit 1; }

# Génère N octets aléatoires en hexadécimal (openssl, sinon /dev/urandom)
gen_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

# Lit la valeur d'une variable du fichier d'environnement (sans l'exécuter)
get_var() {
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

# Écrit (ou remplace) une variable dans le fichier d'environnement
set_var() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN { FS = OFS = "=" } $1 == k { print k "=" v; next } { print }' "$ENV_FILE" > "$tmp"
  else
    cat "$ENV_FILE" > "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE" # conserve les permissions (600) du fichier
  rm -f "$tmp"
}

# Secret JWT acceptable : ≥ 32 caractères et pas une valeur d'exemple
is_strong_secret() {
  local v="$1"
  [ "${#v}" -ge 32 ] && ! [[ "$v" =~ (REPLACE|YOUR_|votre_|changeme) ]]
}

# ----------------------------------------------------------------------------
# 0. Pré-requis
# ----------------------------------------------------------------------------
[ -f docker-compose.yml ] || die "Lancez ce script depuis la racine du projet"
command -v docker >/dev/null || die "Docker n'est pas installé"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 requis (commande « docker compose »)"

# Nom du projet Compose → nom du volume de données MongoDB
PROJECT="$(docker compose config --no-interpolate 2>/dev/null | sed -n 's/^name: //p' | head -n1)"
[ -n "$PROJECT" ] || die "Impossible de déterminer le nom du projet Docker Compose"
DATA_VOLUME="${PROJECT}_mongodb_data"
HAS_DATA=false
docker volume inspect "$DATA_VOLUME" >/dev/null 2>&1 && HAS_DATA=true

echo "🚀 Déploiement de FinancePilot (projet « $PROJECT »)"
$HAS_DATA && info "Données existantes détectées (volume $DATA_VOLUME)"

# ----------------------------------------------------------------------------
# 1. Configuration et secrets
# ----------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  # Avec des données existantes, de nouveaux secrets rendraient la base inaccessible
  # (mot de passe MongoDB) et les données illisibles (clé de chiffrement).
  $HAS_DATA && die "$ENV_FILE est absent alors que des données existent.
   Restaurez votre fichier $ENV_FILE d'origine (il contient ENCRYPTION_KEY,
   indispensable pour lire les données). Aucun secret n'a été généré."
  [ -f "$EXAMPLE_FILE" ] || die "$EXAMPLE_FILE introuvable"
  (umask 077 && cp "$EXAMPLE_FILE" "$ENV_FILE")
  ok "$ENV_FILE créé à partir de $EXAMPLE_FILE (permissions 600)"
fi
chmod 600 "$ENV_FILE"

# Clé de chiffrement : générée seulement pour une installation neuve, JAMAIS remplacée
ENCRYPTION_KEY="$(get_var ENCRYPTION_KEY)"
if [ -z "$ENCRYPTION_KEY" ]; then
  $HAS_DATA && die "ENCRYPTION_KEY est vide alors que des données existent : renseignez la clé d'origine dans $ENV_FILE."
  set_var ENCRYPTION_KEY "$(gen_hex 32)"
  ok "ENCRYPTION_KEY générée — sauvegardez $ENV_FILE en lieu sûr (sans cette clé, les données sont perdues)"
elif ! [[ "$ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]]; then
  die "ENCRYPTION_KEY invalide (64 caractères hexadécimaux attendus). Elle n'est jamais modifiée automatiquement : corrigez-la dans $ENV_FILE."
fi

# Mots de passe MongoDB : fixés à la création du volume, donc générés seulement s'il est neuf
for key in MONGO_ROOT_PASSWORD MONGO_APP_PASSWORD; do
  if [ -z "$(get_var "$key")" ]; then
    $HAS_DATA && die "$key est vide alors que la base existe déjà : renseignez la valeur d'origine dans $ENV_FILE."
    set_var "$key" "$(gen_hex 24)"
    ok "$key généré"
  fi
done

# Secrets JWT : régénérés s'ils sont absents, faibles ou identiques (seul effet : reconnexion)
JWT_SECRET="$(get_var JWT_SECRET)"
JWT_REFRESH_SECRET="$(get_var JWT_REFRESH_SECRET)"
if ! is_strong_secret "$JWT_SECRET" || ! is_strong_secret "$JWT_REFRESH_SECRET" || [ "$JWT_SECRET" = "$JWT_REFRESH_SECRET" ]; then
  set_var JWT_SECRET "$(gen_hex 64)"
  set_var JWT_REFRESH_SECRET "$(gen_hex 64)"
  ok "Secrets JWT (re)générés — les utilisateurs devront se reconnecter"
fi

# URL publique : surcharge possible par variable d'environnement au lancement
if [ -n "${FRONTEND_URL:-}" ]; then
  set_var FRONTEND_URL "$FRONTEND_URL"
elif [ -z "$(get_var FRONTEND_URL)" ]; then
  set_var FRONTEND_URL "http://localhost"
fi

COMPOSE=(docker compose --env-file "$ENV_FILE")
"${COMPOSE[@]}" config -q || die "Configuration Docker Compose invalide"
ok "Configuration valide ($ENV_FILE)"

if $PREPARE_ONLY; then
  ok "Préparation terminée (--prepare-only) : aucun déploiement effectué"
  exit 0
fi

# ----------------------------------------------------------------------------
# 2. Sauvegarde avant mise à jour
# ----------------------------------------------------------------------------
if $HAS_DATA; then
  info "Sauvegarde de la base avant mise à jour…"
  # Démarre MongoDB seul s'il est arrêté (la sauvegarde passe par le container)
  "${COMPOSE[@]}" up -d --wait --wait-timeout 120 mongodb >/dev/null
  BACKUP_LOG="$(mktemp)"
  if ! ./scripts/backup-mongodb.sh >"$BACKUP_LOG" 2>&1; then
    cat "$BACKUP_LOG"; rm -f "$BACKUP_LOG"
    die "La sauvegarde a échoué : déploiement interrompu (aucune modification effectuée)"
  fi
  rm -f "$BACKUP_LOG"
  ok "Sauvegarde créée : $(ls -t "${BACKUP_DIR:-./backups}"/financepilot-*.tar.gz | head -n1)"
else
  info "Installation neuve : pas de sauvegarde nécessaire"
fi

# ----------------------------------------------------------------------------
# 3. Build et démarrage
# ----------------------------------------------------------------------------
info "Build des images…"
"${COMPOSE[@]}" build --pull

info "Démarrage des services (attente des healthchecks, migrations automatiques incluses)…"
if ! "${COMPOSE[@]}" up -d --remove-orphans --wait --wait-timeout 300; then
  "${COMPOSE[@]}" logs --tail 50 backend
  die "Les services n'ont pas démarré correctement (logs ci-dessus)"
fi

# ----------------------------------------------------------------------------
# 4. Migrations (exécutées par le backend au démarrage) : compte rendu
# ----------------------------------------------------------------------------
MIGRATIONS_LOG="$("${COMPOSE[@]}" logs backend 2>/dev/null | grep -o 'Migration [^"]*' || true)"
if [ -n "$MIGRATIONS_LOG" ]; then
  echo "$MIGRATIONS_LOG" | sed 's/^/   /'
else
  info "Aucune migration en attente"
fi

# ----------------------------------------------------------------------------
# 5. Vérification de bout en bout
# ----------------------------------------------------------------------------
HTTP_PORT="$(get_var HTTP_PORT)"
BASE_URL="http://localhost:${HTTP_PORT:-80}"
curl -fsS "$BASE_URL/health" >/dev/null || die "Frontend injoignable sur $BASE_URL"
# 401 attendu sans authentification : prouve que nginx → backend → MongoDB répond
code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/me")"
[ "$code" = "401" ] || { "${COMPOSE[@]}" logs --tail 50 backend; die "API : réponse HTTP $code inattendue"; }

echo ""
ok "Déploiement réussi : $BASE_URL"
echo "   Logs        : docker compose logs -f"
echo "   Sauvegarde  : ./scripts/backup-mongodb.sh"
echo "   ⚠️  Conservez une copie de $ENV_FILE hors du serveur (ENCRYPTION_KEY)."
