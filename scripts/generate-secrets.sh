#!/bin/bash
# Script de génération des secrets cryptographiques pour FinancePilot
# Usage: ./scripts/generate-secrets.sh

set -e

echo "🔐 Génération des secrets cryptographiques pour FinancePilot"
echo "=============================================================="
echo ""

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Erreur: Node.js n'est pas installé"
    echo "Installez Node.js depuis https://nodejs.org"
    exit 1
fi

echo "Génération de secrets sécurisés..."
echo ""

# Générer JWT_SECRET (64 bytes)
echo "📝 JWT_SECRET (64 bytes):"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
echo "$JWT_SECRET"
echo ""

# Générer JWT_REFRESH_SECRET (64 bytes)
echo "📝 JWT_REFRESH_SECRET (64 bytes):"
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
echo "$JWT_REFRESH_SECRET"
echo ""

# Générer ENCRYPTION_KEY (32 bytes)
echo "📝 ENCRYPTION_KEY (32 bytes):"
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo "$ENCRYPTION_KEY"
echo ""

# Générer mot de passe MongoDB sécurisé
echo "📝 MONGO_ROOT_PASSWORD (32 caractères alphanumériques):"
MONGO_ROOT_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64').replace(/[+/=]/g, ''))")
echo "$MONGO_ROOT_PASSWORD"
echo ""

echo "📝 MONGO_APP_PASSWORD (32 caractères alphanumériques):"
MONGO_APP_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64').replace(/[+/=]/g, ''))")
echo "$MONGO_APP_PASSWORD"
echo ""

echo "=============================================================="
echo "✅ Secrets générés avec succès!"
echo ""
echo "⚠️  IMPORTANT: Sauvegardez ces valeurs de manière sécurisée!"
echo "   - Ne les commitez JAMAIS dans Git"
echo "   - Utilisez un gestionnaire de secrets en production"
echo "   - Changez-les régulièrement"
echo ""
echo "📋 Instructions:"
echo "   1. Copiez les valeurs ci-dessus"
echo "   2. Éditez votre fichier .env.docker ou backend/.env"
echo "   3. Remplacez les valeurs 'YOUR_*_HERE' par les valeurs générées"
echo ""

# Option: Créer automatiquement le fichier .env.docker
echo "Voulez-vous créer automatiquement le fichier .env.docker? (y/N)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    if [ -f ".env.docker" ]; then
        echo "⚠️  Le fichier .env.docker existe déjà!"
        echo "Voulez-vous le remplacer? Cela écrasera l'ancien fichier! (yes/NO)"
        read -r confirm
        if [[ ! "$confirm" == "yes" ]]; then
            echo "❌ Opération annulée"
            exit 0
        fi
    fi

    # Créer le fichier .env.docker avec les secrets générés
    cat > .env.docker << EOF
# Variables d'environnement pour Docker Compose
# Généré automatiquement le $(date)

# MongoDB
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
MONGO_APP_PASSWORD=$MONGO_APP_PASSWORD

# JWT Secrets
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# Encryption Key
ENCRYPTION_KEY=$ENCRYPTION_KEY

# URLs (MODIFIER AVEC VOTRE DOMAINE EN PRODUCTION!)
FRONTEND_URL=http://localhost:3000
VITE_API_URL=http://localhost:5000/api
BACKEND_URL=http://backend:5000

# Configuration
LOG_LEVEL=info
NODE_ENV=production
EOF

    echo ""
    echo "✅ Fichier .env.docker créé avec succès!"
    echo "📝 Vous pouvez maintenant modifier les URLs dans .env.docker si nécessaire"
    echo ""
    echo "⚠️  N'oubliez pas de modifier FRONTEND_URL et VITE_API_URL pour la production!"
else
    echo ""
    echo "📋 Copiez manuellement les secrets dans votre fichier .env.docker"
fi

echo ""
echo "🚀 Pour déployer maintenant:"
echo "   ./scripts/deploy-production.sh"
