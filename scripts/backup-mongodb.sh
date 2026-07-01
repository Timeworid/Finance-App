#!/bin/bash
# Script de backup automatique MongoDB pour FinancePilot
# Usage: ./scripts/backup-mongodb.sh
# Cron: 0 2 * * * /path/to/backup-mongodb.sh

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="financepilot"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$DB_NAME-$DATE"

echo "📦 Backup MongoDB - FinancePilot"
echo "================================"

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "🗄️  Base de données: $DB_NAME"
echo "📁 Destination: $BACKUP_PATH"

# Vérifier si MongoDB tourne dans Docker
if docker ps | grep -q financepilot-mongodb; then
    echo "🐳 Backup depuis Docker container"
    docker exec financepilot-mongodb mongodump \
        --db "$DB_NAME" \
        --out "/tmp/backup-$DATE" \
        --gzip

    # Copier le backup depuis le container
    docker cp "financepilot-mongodb:/tmp/backup-$DATE/$DB_NAME" "$BACKUP_PATH"
    docker exec financepilot-mongodb rm -rf "/tmp/backup-$DATE"
else
    echo "💻 Backup depuis installation locale"
    mongodump \
        --db "$DB_NAME" \
        --out "$BACKUP_PATH" \
        --gzip
fi

# Compresser le backup
echo "🗜️  Compression du backup"
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "$(basename $BACKUP_PATH)"
rm -rf "$BACKUP_PATH"

# Calculer la taille
SIZE=$(du -h "$BACKUP_PATH.tar.gz" | cut -f1)
echo "✅ Backup créé: $BACKUP_PATH.tar.gz ($SIZE)"

# Nettoyage des backups de plus de 30 jours
echo "🧹 Nettoyage des anciens backups (>30 jours)"
find "$BACKUP_DIR" -name "$DB_NAME-*.tar.gz" -mtime +30 -delete

# Afficher les backups restants
echo ""
echo "📋 Backups disponibles:"
ls -lh "$BACKUP_DIR"/$DB_NAME-*.tar.gz 2>/dev/null | tail -5 || echo "Aucun backup trouvé"

echo ""
echo "✅ Backup terminé avec succès"
