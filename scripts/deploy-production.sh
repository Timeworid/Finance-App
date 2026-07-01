#!/bin/bash
# Script de déploiement production pour FinancePilot
# Usage: ./scripts/deploy-production.sh

set -e

echo "🚀 Déploiement de FinancePilot en production"
echo "=============================================="

# Vérifier que nous sommes à la racine du projet
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Exécutez ce script depuis la racine du projet"
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Erreur: Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Erreur: Docker Compose n'est pas installé"
    exit 1
fi

# Vérifier que le fichier .env.docker existe
if [ ! -f ".env.docker" ]; then
    echo "❌ Erreur: Fichier .env.docker manquant"
    echo "Copiez .env.docker.example et configurez les secrets"
    exit 1
fi

# Vérifier que les secrets sont configurés
if grep -q "YOUR_.*_HERE" .env.docker; then
    echo "⚠️  ATTENTION: Certains secrets ne sont pas configurés dans .env.docker"
    echo "Voulez-vous continuer quand même? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "📋 Étape 1/6: Arrêt des containers existants"
docker-compose down || true

echo ""
echo "🔨 Étape 2/6: Build des images Docker"
docker-compose build --no-cache

echo ""
echo "📦 Étape 3/6: Démarrage des services"
docker-compose --env-file .env.docker up -d

echo ""
echo "⏳ Étape 4/6: Attente du démarrage des services (30s)"
sleep 30

echo ""
echo "🏥 Étape 5/6: Vérification de la santé des services"
docker-compose ps

# Vérifier le backend
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend: OK"
else
    echo "❌ Backend: ERREUR"
    docker-compose logs backend
    exit 1
fi

# Vérifier le frontend
if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: ERREUR"
    docker-compose logs frontend
    exit 1
fi

echo ""
echo "📊 Étape 6/6: Affichage des logs"
echo ""
echo "✅ Déploiement réussi!"
echo ""
echo "🌐 Application disponible sur:"
echo "   - Frontend: http://localhost"
echo "   - Backend API: http://localhost:5000/api"
echo "   - MongoDB: localhost:27017"
echo ""
echo "📝 Commandes utiles:"
echo "   - Voir les logs: docker-compose logs -f"
echo "   - Arrêter: docker-compose down"
echo "   - Redémarrer: docker-compose restart"
echo "   - Status: docker-compose ps"
echo ""
