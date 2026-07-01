#!/bin/bash
# Script de vérification de santé pour FinancePilot
# Usage: ./scripts/health-check.sh

set -e

echo "🏥 Vérification de santé FinancePilot"
echo "======================================"
echo ""

ERRORS=0

# Fonction pour vérifier un service
check_service() {
    local name=$1
    local url=$2
    local expected=$3

    echo -n "🔍 $name... "

    if response=$(curl -s -w "%{http_code}" -o /tmp/health-response.txt "$url" 2>&1); then
        http_code="${response: -3}"
        if [ "$http_code" == "$expected" ]; then
            echo "✅ OK ($http_code)"
            return 0
        else
            echo "❌ ERREUR (HTTP $http_code)"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo "❌ INACCESSIBLE"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Fonction pour vérifier un container Docker
check_docker_container() {
    local name=$1
    echo -n "🐳 Container $name... "

    if docker ps --format '{{.Names}}' | grep -q "^$name$"; then
        status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "no-healthcheck")
        if [ "$status" == "healthy" ] || [ "$status" == "no-healthcheck" ]; then
            echo "✅ Running ($status)"
            return 0
        else
            echo "⚠️  Running but unhealthy ($status)"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo "❌ Not running"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Fonction pour vérifier l'espace disque
check_disk_space() {
    echo -n "💾 Espace disque... "
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

    if [ "$usage" -lt 80 ]; then
        echo "✅ OK (${usage}% utilisé)"
        return 0
    elif [ "$usage" -lt 90 ]; then
        echo "⚠️  Attention (${usage}% utilisé)"
        return 0
    else
        echo "❌ CRITIQUE (${usage}% utilisé)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Fonction pour vérifier la mémoire
check_memory() {
    echo -n "🧠 Mémoire... "
    if command -v free &> /dev/null; then
        usage=$(free | grep Mem | awk '{printf "%.0f", ($3/$2) * 100}')
        if [ "$usage" -lt 80 ]; then
            echo "✅ OK (${usage}% utilisé)"
            return 0
        elif [ "$usage" -lt 90 ]; then
            echo "⚠️  Attention (${usage}% utilisé)"
            return 0
        else
            echo "❌ CRITIQUE (${usage}% utilisé)"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo "⚠️  Impossible de vérifier"
        return 0
    fi
}

echo "📋 Vérification des services HTTP"
echo "----------------------------------"
check_service "Backend API" "http://localhost:5000/health" "200"
check_service "Frontend" "http://localhost:3000" "200"

echo ""
echo "🐳 Vérification des containers Docker"
echo "--------------------------------------"
if command -v docker &> /dev/null; then
    if docker compose ps &> /dev/null 2>&1 || docker-compose ps &> /dev/null 2>&1; then
        check_docker_container "financepilot-backend"
        check_docker_container "financepilot-frontend"
        check_docker_container "financepilot-mongodb"
    else
        echo "⚠️  Docker Compose non utilisé ou services non démarrés"
    fi
else
    echo "⚠️  Docker non installé"
fi

echo ""
echo "💻 Vérification des ressources système"
echo "---------------------------------------"
check_disk_space
check_memory

echo ""
echo "📊 Statistiques"
echo "---------------"

# MongoDB stats (si accessible)
if docker ps | grep -q financepilot-mongodb; then
    echo "🗄️  MongoDB:"
    mongo_stats=$(docker exec financepilot-mongodb mongosh --quiet --eval "
        db.getSiblingDB('financepilot');
        const stats = db.stats(1024*1024);
        print('  - Taille base: ' + stats.dataSize.toFixed(2) + ' MB');
        print('  - Collections: ' + stats.collections);
        const userCount = db.users.countDocuments();
        const txCount = db.transactions.countDocuments();
        print('  - Utilisateurs: ' + userCount);
        print('  - Transactions: ' + txCount);
    " 2>/dev/null || echo "  ⚠️  Impossible de récupérer les stats MongoDB")
fi

# Logs récents (si présents)
if [ -d "backend/logs" ]; then
    echo ""
    echo "📝 Logs récents:"
    latest_log=$(ls -t backend/logs/error-*.log 2>/dev/null | head -1)
    if [ -n "$latest_log" ]; then
        error_count=$(wc -l < "$latest_log")
        echo "  - Erreurs aujourd'hui: $error_count"
        if [ "$error_count" -gt 10 ]; then
            echo "    ⚠️  Nombre élevé d'erreurs détectées"
            ERRORS=$((ERRORS + 1))
        fi
    fi
fi

# Docker stats (si disponible)
if command -v docker &> /dev/null && docker ps | grep -q financepilot; then
    echo ""
    echo "🐳 Utilisation Docker (snapshot):"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep financepilot || true
fi

echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ Tous les contrôles sont passés!"
    echo ""
    echo "🚀 L'application fonctionne correctement"
    exit 0
else
    echo "❌ $ERRORS erreur(s) détectée(s)"
    echo ""
    echo "🔍 Actions recommandées:"
    echo "   - Vérifier les logs: docker compose logs -f"
    echo "   - Vérifier les services: docker compose ps"
    echo "   - Redémarrer si nécessaire: docker compose restart"
    exit 1
fi
