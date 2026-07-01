# FinancePilot 🚀

Application de pilotage financier personnel avec backend sécurisé et authentification.

## Architecture

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Vite
- **Authentification**: JWT (access + refresh tokens)
- **Sécurité**: Chiffrement AES-256-GCM pour les données sensibles

## Démarrage rapide

### Prérequis

- Node.js 18+ installé
- MongoDB en cours d'exécution (local ou distant)
- Git

### Configuration

1. Cloner le dépôt et installer les dépendances

2. Configurer les variables d'environnement :

Créer un fichier `.env` dans le dossier `backend/` :

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/financepilot
JWT_SECRET=votre_secret_jwt_super_securise
JWT_REFRESH_SECRET=votre_refresh_secret_super_securise
ENCRYPTION_KEY=votre_cle_chiffrement_32_bytes_hex
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Utilisation

#### Démarrer l'application

```bash
./start.sh
```

Cette commande :
- ✅ Nettoie les processus existants
- ✅ Libère les ports 3000 et 5000
- ✅ Démarre le backend sur http://localhost:5000
- ✅ Démarre le frontend sur http://localhost:3000
- ✅ Crée des fichiers de logs (`backend.log` et `frontend.log`)

#### Arrêter l'application

```bash
./stop.sh
```

Cette commande :
- ✅ Arrête proprement le backend et le frontend
- ✅ Libère tous les ports utilisés
- ✅ Nettoie les fichiers PID

#### Consulter les logs

```bash
# Logs backend
tail -f backend.log

# Logs frontend
tail -f frontend.log
```

## Fonctionnalités

### Gestion financière

- 📊 **Dashboard** : Vue d'ensemble avec KPIs et graphiques
- 💳 **Transactions** : Import CSV, catégorisation automatique
- 🏷️ **Catégories** : Catégories personnalisées avec budgets
- 💰 **Enveloppes** : Comptes d'épargne avec projections
- 🏠 **Biens & Propriétés** : Inventaire de vos biens physiques
- 🔄 **Charges récurrentes** : Suivi des revenus et charges mensuels
- 📈 **Bourse** : Portefeuille d'actions et ETF
- 🧮 **Simulateurs** : Projections d'épargne et emprunts

### Sécurité

- 🔐 Authentification JWT avec refresh tokens
- 🔒 Chiffrement AES-256-GCM des données sensibles
- 🛡️ Protection OWASP (rate limiting, CORS, helmet)
- 🔑 Hash bcrypt des mots de passe (12 rounds)

## Structure du projet

```
Finance-App/
├── backend/              # API Node.js + Express
│   ├── models/          # Modèles Mongoose
│   ├── routes/          # Routes API
│   ├── middleware/      # Middlewares (auth, validation)
│   ├── utils/           # Utilitaires (encryption, validators)
│   └── server.js        # Point d'entrée
├── frontend/            # Application React
│   ├── src/
│   │   ├── components/  # Composants React
│   │   ├── services/    # Services API
│   │   └── App.jsx      # Composant principal
│   └── package.json
├── start.sh            # Script de démarrage
├── stop.sh             # Script d'arrêt
└── README.md
```

## API Endpoints

### Authentification

- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter
- `POST /api/auth/refresh` - Renouveler le token
- `POST /api/auth/logout` - Se déconnecter

### Ressources protégées (JWT requis)

- `GET/POST/PUT/DELETE /api/transactions`
- `GET/POST/PUT/DELETE /api/categories`
- `GET/POST/PUT/DELETE /api/envelopes`
- `GET/POST/PUT/DELETE /api/assets`
- `GET/POST/PUT/DELETE /api/recurring`
- `GET/POST/PUT/DELETE /api/stocks`
- `GET/PUT /api/settings`

## Développement

### Backend

```bash
cd backend
npm install
npm start  # Démarre sur port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev  # Démarre sur port 3000
```

## Troubleshooting

### Les ports sont déjà utilisés

Utilisez `./stop.sh` pour libérer les ports, ou manuellement :

```bash
# Libérer le port 3000
lsof -ti:3000 | xargs kill -9

# Libérer le port 5000
lsof -ti:5000 | xargs kill -9
```

### MongoDB n'est pas connecté

Vérifiez que MongoDB est démarré :

```bash
# Vérifier le statut
sudo systemctl status mongod

# Démarrer MongoDB
sudo systemctl start mongod
```

### Erreur de connexion API

Vérifiez les logs backend :

```bash
tail -f backend.log
```

## Licence

MIT
