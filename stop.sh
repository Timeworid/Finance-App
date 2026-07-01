#!/bin/bash

echo "🛑 Arrêt de FinancePilot..."

# Répertoire racine du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Couleurs pour affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fichiers PID
BACKEND_PID_FILE="$PROJECT_DIR/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/.frontend.pid"

# Fonction pour arrêter un processus
stop_process() {
  local pid_file=$1
  local name=$2

  if [ -f "$pid_file" ]; then
    local pid=$(cat "$pid_file")
    if ps -p $pid > /dev/null 2>&1; then
      echo -e "${YELLOW}🔄 Arrêt de $name (PID: $pid)...${NC}"
      kill $pid 2>/dev/null
      sleep 2

      # Vérifier si le processus est toujours actif
      if ps -p $pid > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Forçage de l'arrêt de $name...${NC}"
        kill -9 $pid 2>/dev/null
      fi

      echo -e "${GREEN}✅ $name arrêté${NC}"
    else
      echo -e "${YELLOW}⚠️  $name n'était pas en cours d'exécution${NC}"
    fi
    rm -f "$pid_file"
  else
    echo -e "${YELLOW}⚠️  Pas de fichier PID pour $name${NC}"
  fi
}

# Arrêter le backend
stop_process "$BACKEND_PID_FILE" "Backend"

# Arrêter le frontend
stop_process "$FRONTEND_PID_FILE" "Frontend"

# Nettoyage supplémentaire : tuer tous les processus Node.js liés au projet
echo -e "${YELLOW}🧹 Nettoyage des processus restants...${NC}"
pkill -f "node.*server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "node.*vite" 2>/dev/null

# Libérer les ports
echo -e "${YELLOW}🔓 Libération des ports 3000 et 5000...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5000 | xargs kill -9 2>/dev/null

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ FinancePilot a été arrêté avec succès${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
