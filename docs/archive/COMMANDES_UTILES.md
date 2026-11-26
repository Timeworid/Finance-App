# 🛠️ Commandes utiles - FinancePilot

## 🚀 Démarrage

### Démarrer MongoDB
```bash
sudo systemctl start mongod
sudo systemctl status mongod
sudo systemctl enable mongod  # Auto-start au boot
```

### Démarrer l'application
```bash
# Option 1 : En parallèle (depuis la racine)
npm run dev

# Option 2 : Séparément
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

### Arrêter l'application
```bash
# Ctrl+C dans les terminaux
# Ou
pkill -f "node.*backend"
pkill -f "vite"
```

## 🔍 Tests et vérification

### Tester le backend (curl)
```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "firstName": "Test",
    "lastName": "User"
  }' | jq

# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}' \
  | jq -r '.accessToken')

echo "Token: $TOKEN"

# Get categories (avec token)
curl http://localhost:5000/api/categories \
  -H "Authorization: Bearer $TOKEN" | jq

# Create transaction
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-07-01",
    "label": "Test transaction",
    "amount": -50.99,
    "category": null
  }' | jq

# Get transactions
curl http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" | jq

# Get settings
curl http://localhost:5000/api/settings \
  -H "Authorization: Bearer $TOKEN" | jq

# Update settings
curl -X PUT http://localhost:5000/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startBalance": 1000,
    "monthlyCapacity": 1500
  }' | jq
```

## 🗄️ MongoDB

### Connexion et exploration
```bash
# Connexion
mongosh

# Sélectionner la base
use financepilot

# Lister les collections
show collections

# Compter les documents
db.users.countDocuments()
db.transactions.countDocuments()
db.categories.countDocuments()
db.envelopes.countDocuments()
db.settings.countDocuments()

# Voir un utilisateur
db.users.findOne()

# Voir toutes les catégories
db.categories.find().pretty()

# Voir les transactions (montants chiffrés)
db.transactions.find().pretty()

# Voir les enveloppes
db.envelopes.find().pretty()

# Voir les settings
db.settings.find().pretty()

# Quitter
exit
```

### Backup et restore
```bash
# Backup complet
mongodump --db financepilot --out backup/$(date +%Y%m%d)

# Restore
mongorestore --db financepilot backup/20250701/financepilot/

# Export en JSON (une collection)
mongoexport --db financepilot --collection transactions --out transactions.json

# Import depuis JSON
mongoimport --db financepilot --collection transactions --file transactions.json
```

### Nettoyage
```bash
mongosh

use financepilot

# Supprimer toutes les transactions d'un user
db.transactions.deleteMany({ userId: ObjectId("USER_ID_HERE") })

# Supprimer un utilisateur et toutes ses données
var userId = ObjectId("USER_ID_HERE");
db.transactions.deleteMany({ userId: userId });
db.categories.deleteMany({ userId: userId });
db.envelopes.deleteMany({ userId: userId });
db.settings.deleteMany({ userId: userId });
db.users.deleteOne({ _id: userId });

# Reset complet de la base
db.dropDatabase()

exit
```

## 📦 Gestion des dépendances

### Installer/Réinstaller
```bash
# Tout réinstaller
npm run install:all

# Backend uniquement
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend uniquement
cd frontend
rm -rf node_modules package-lock.json
npm install

# Racine
npm install
```

### Mettre à jour
```bash
# Voir les packages obsolètes
npm outdated

# Mettre à jour (patch versions)
npm update

# Mettre à jour (major versions - attention!)
npm install <package>@latest
```

## 🐛 Debugging

### Logs backend
```bash
# Mode verbose
cd backend
DEBUG=* npm run dev

# Logs MongoDB
tail -f /var/log/mongodb/mongod.log

# Logs système
sudo journalctl -u mongod -f
```

### Logs frontend
```bash
# Console navigateur
# F12 → Console

# Network
# F12 → Network → Filter: Fetch/XHR

# localStorage
# F12 → Application → Local Storage
# Vérifier : accessToken, refreshToken, user
```

### Vérifier les ports
```bash
# Port 5000 (backend)
sudo netstat -tulpn | grep 5000
# ou
lsof -i :5000

# Port 3000 (frontend)
sudo netstat -tulpn | grep 3000
# ou
lsof -i :3000

# Port 27017 (MongoDB)
sudo netstat -tulpn | grep 27017
# ou
lsof -i :27017
```

### Tuer un processus sur un port
```bash
# Trouver le PID
lsof -ti :5000

# Tuer le processus
kill $(lsof -ti :5000)

# Force kill
kill -9 $(lsof -ti :5000)
```

## 🔐 Sécurité

### Générer de nouveaux secrets
```bash
# JWT Secret (64 bytes hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT Refresh Secret (64 bytes hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Vérifier le chiffrement
```bash
mongosh

use financepilot

# Voir une transaction RAW (chiffré)
db.transactions.findOne()

# Le champ 'amount' et 'label' doivent être au format:
# "iv:encrypted:authTag" (hex)
# Exemple: "a3f2c1d4e5f6g7h8:9a8b7c6d5e4f3g2h:1a2b3c4d5e6f7g8h"

# Si ce sont des nombres clairs, le chiffrement ne fonctionne pas !

exit
```

## 🧪 Tests

### Test de charge (avec Apache Bench)
```bash
# Installer ab
sudo apt install apache2-utils

# Test register (10 requêtes, 2 concurrentes)
ab -n 10 -c 2 -p register.json -T application/json \
  http://localhost:5000/api/auth/register

# Fichier register.json:
# {"email":"test@test.com","password":"Test1234"}

# Test health check (100 requêtes, 10 concurrentes)
ab -n 100 -c 10 http://localhost:5000/health
```

### Test des endpoints
```bash
# Script bash pour tester tous les endpoints
#!/bin/bash

echo "🧪 Test des endpoints FinancePilot"

# Health
echo "\n✓ Health check"
curl -s http://localhost:5000/health | jq

# Register
echo "\n✓ Register"
RESP=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"auto@test.com","password":"Test1234"}')
echo $RESP | jq

# Login
echo "\n✓ Login"
TOKEN=$(echo $RESP | jq -r '.accessToken')
echo "Token: ${TOKEN:0:20}..."

# Categories
echo "\n✓ Get categories"
curl -s http://localhost:5000/api/categories \
  -H "Authorization: Bearer $TOKEN" | jq '.categories | length'

# Transactions
echo "\n✓ Create transaction"
curl -s -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-07-01","label":"Test","amount":-50}' \
  | jq '.message'

echo "\n✓ Get transactions"
curl -s http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" | jq '.total'

echo "\n✅ Tests terminés"
```

## 📊 Monitoring

### Voir les ressources utilisées
```bash
# CPU et RAM
top
# Appuyer sur 'P' pour trier par CPU
# Appuyer sur 'M' pour trier par mémoire

# Ou avec htop (plus visuel)
htop

# Ressources MongoDB
ps aux | grep mongod

# Taille de la base
mongosh --eval "db.stats()" financepilot
```

### Logs en temps réel
```bash
# Backend
cd backend
npm run dev | tee backend.log

# Frontend
cd frontend
npm run dev | tee frontend.log

# MongoDB
tail -f /var/log/mongodb/mongod.log
```

## 🎯 Raccourcis utiles

### Alias à ajouter dans ~/.bashrc
```bash
# FinancePilot aliases
alias fp-start='cd ~/Documents/VSCodium/Finance-App && npm run dev'
alias fp-backend='cd ~/Documents/VSCodium/Finance-App/backend && npm run dev'
alias fp-frontend='cd ~/Documents/VSCodium/Finance-App/frontend && npm run dev'
alias fp-mongo='mongosh financepilot'
alias fp-logs='tail -f /var/log/mongodb/mongod.log'
alias fp-backup='mongodump --db financepilot --out ~/backups/financepilot/$(date +%Y%m%d)'
alias fp-test='curl http://localhost:5000/health'

# Recharger le bashrc
source ~/.bashrc
```

### Utilisation
```bash
fp-start      # Démarre tout
fp-backend    # Backend seul
fp-frontend   # Frontend seul
fp-mongo      # Connexion MongoDB
fp-logs       # Logs MongoDB
fp-backup     # Backup MongoDB
fp-test       # Test rapide
```

## 🚀 Production

### Build frontend
```bash
cd frontend
npm run build

# Les fichiers sont dans frontend/dist/
ls -lh dist/
```

### Démarrer en production
```bash
# Backend (avec PM2)
npm install -g pm2
cd backend
NODE_ENV=production pm2 start server.js --name financepilot-api

# Frontend (servir avec Nginx ou serve)
npm install -g serve
cd frontend
serve -s dist -l 3000
```

### Arrêter
```bash
pm2 stop financepilot-api
pm2 delete financepilot-api
```

## 📚 Ressources

- Documentation MongoDB : https://docs.mongodb.com/
- Express docs : https://expressjs.com/
- React docs : https://react.dev/
- Vite docs : https://vitejs.dev/
- Tailwind CSS : https://tailwindcss.com/

---

**💡 Astuce** : Sauvegardez ce fichier dans vos favoris pour un accès rapide aux commandes !
