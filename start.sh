#!/bin/bash

echo "🚀 Démarrage de FinancePilot..."

# Répertoire racine du projet
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Couleurs pour affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fichiers PID pour tracking des processus
BACKEND_PID_FILE="$PROJECT_DIR/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/.frontend.pid"

# Fonction pour nettoyer les processus existants
cleanup_processes() {
  echo -e "${YELLOW}🧹 Nettoyage des processus existants...${NC}"

  # Tuer les processus Node.js backend et frontend s'ils existent
  pkill -f "node.*server.js" 2>/dev/null
  pkill -f "vite" 2>/dev/null
  pkill -f "node.*vite" 2>/dev/null

  # Supprimer les fichiers PID
  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

  # Attendre que les ports se libèrent
  sleep 2
}

# Fonction pour vérifier si un port est utilisé
check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0 # Port utilisé
  else
    return 1 # Port libre
  fi
}

# Fonction pour libérer un port
free_port() {
  local port=$1
  echo -e "${YELLOW}⚠️  Port $port occupé, libération...${NC}"
  lsof -ti:$port | xargs kill -9 2>/dev/null
  sleep 1
}

# Nettoyer d'abord
cleanup_processes

# Vérifier et libérer les ports si nécessaire
if check_port 5000; then
  free_port 5000
fi

if check_port 3000; then
  free_port 3000
fi

# Démarrer le backend
echo -e "${BLUE}🔧 Démarrage du backend...${NC}"
cd "$PROJECT_DIR/backend"

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installation des dépendances backend...${NC}"
  npm install
fi

# Démarrer le backend en arrière-plan
npm start > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE"

echo -e "${GREEN}✅ Backend démarré (PID: $BACKEND_PID)${NC}"

# Attendre que le backend soit prêt
echo -e "${YELLOW}⏳ Attente du démarrage du backend...${NC}"
sleep 5

# Vérifier si le backend est bien démarré
if ! ps -p $BACKEND_PID > /dev/null; then
  echo -e "\033[0;31m❌ Erreur: Le backend n'a pas démarré correctement${NC}"
  echo -e "\033[0;31m   Consultez backend.log pour plus de détails${NC}"
  exit 1
fi

# Démarrer le frontend
echo -e "${BLUE}🎨 Démarrage du frontend...${NC}"
cd "$PROJECT_DIR/frontend"

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installation des dépendances frontend...${NC}"
  npm install
fi

# Démarrer le frontend en arrière-plan
PORT=3000 npm run dev > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$FRONTEND_PID_FILE"

echo -e "${GREEN}✅ Frontend démarré (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ FinancePilot est maintenant en cours d'exécution${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔗 Backend:  ${NC}http://localhost:5000"
echo -e "${BLUE}🌐 Frontend: ${NC}http://localhost:3000"
echo ""
echo -e "${YELLOW}📋 Pour arrêter l'application, exécutez: ./stop.sh${NC}"
echo -e "${YELLOW}📋 Pour voir les logs:${NC}"
echo -e "   Backend:  tail -f backend.log"
echo -e "   Frontend: tail -f frontend.log"
echo ""
