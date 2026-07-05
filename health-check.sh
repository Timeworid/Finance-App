#!/bin/bash

# Health Check Script - FinancePilot
# Vérifie que tous les services sont opérationnels

echo "🏥 FinancePilot Health Check"
echo "=============================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si le backend tourne
echo -n "Backend (Port 5000): "
if curl -s http://localhost:5000/api/categories > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RUNNING${NC}"
    BACKEND_OK=1
else
    echo -e "${RED}✗ DOWN${NC}"
    BACKEND_OK=0
fi

# Vérifier si le frontend tourne
echo -n "Frontend (Port 3000): "
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RUNNING${NC}"
    FRONTEND_OK=1
else
    echo -e "${RED}✗ DOWN${NC}"
    FRONTEND_OK=0
fi

# Vérifier MongoDB
echo -n "MongoDB: "
if pgrep -x mongod > /dev/null; then
    echo -e "${GREEN}✓ RUNNING${NC}"
    MONGO_OK=1
else
    echo -e "${YELLOW}⚠ NOT DETECTED${NC} (peut être distant)"
    MONGO_OK=1
fi

echo ""
echo "=============================="

# Résumé
if [ $BACKEND_OK -eq 1 ] && [ $FRONTEND_OK -eq 1 ]; then
    echo -e "${GREEN}✓ Tous les services sont opérationnels${NC}"
    exit 0
else
    echo -e "${RED}✗ Certains services sont hors ligne${NC}"
    echo ""
    echo "Pour démarrer les services:"
    echo "  ./start.sh"
    exit 1
fi
