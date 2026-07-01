#!/bin/bash
# Script de restauration MongoDB pour FinancePilot
# Usage: ./scripts/restore-mongodb.sh <backup-file.tar.gz>

set -e

DB_NAME="financepilot"

if [ $# -eq 0 ]; then
    echo "❌ Erreur: Fichier de backup requis"
    echo "Usage: $0 <backup-file.tar.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lh backups/$DB_NAME-*.tar.gz 2>/dev/null || echo "Aucun backup trouvé"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Erreur: Fichier $BACKUP_FILE introuvable"
    exit 1
fi

echo "⚠️  ATTENTION: Cette opération va ÉCRASER la base de données actuelle!"
echo "Base de données: $DB_NAME"
echo "Backup: $BACKUP_FILE"
echo ""
echo "Voulez-vous continuer? (yes/NO)"
read -r response

if [[ ! "$response" == "yes" ]]; then
    echo "❌ Restauration annulée"
    exit 0
fi

# Créer un backup de sécurité avant restauration
echo "📦 Création d'un backup de sécurité..."
./scripts/backup-mongodb.sh

# Extraire le backup
TEMP_DIR=$(mktemp -d)
echo "📂 Extraction du backup dans $TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Vérifier si MongoDB tourne dans Docker
if docker ps | grep -q financepilot-mongodb; then
    echo "🐳 Restauration depuis Docker container"

    # Copier le backup dans le container
    docker cp "$TEMP_DIR/$(basename $BACKUP_FILE .tar.gz)" financepilot-mongodb:/tmp/restore

    # Restaurer
    docker exec financepilot-mongodb mongorestore \
        --db "$DB_NAME" \
        --drop \
        --gzip \
        /tmp/restore

    # Nettoyer
    docker exec financepilot-mongodb rm -rf /tmp/restore
else
    echo "💻 Restauration depuis installation locale"
    mongorestore \
        --db "$DB_NAME" \
        --drop \
        --gzip \
        "$TEMP_DIR/$(basename $BACKUP_FILE .tar.gz)"
fi

# Nettoyer
rm -rf "$TEMP_DIR"

echo "✅ Restauration terminée avec succès"
echo ""
echo "🔍 Vérification:"
if docker ps | grep -q financepilot-mongodb; then
    docker exec financepilot-mongodb mongosh --eval "db.getSiblingDB('$DB_NAME').stats()" --quiet
else
    mongosh "$DB_NAME" --eval "db.stats()" --quiet
fi
