# 💰 FinancePilot - Application de gestion financière personnelle

**Application web complète et sécurisée pour gérer vos finances, investissements et projections long terme.**

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![MongoDB](https://img.shields.io/badge/mongodb-%3E%3D6.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Architecture technique](#-architecture-technique)
- [Installation](#-installation)
- [Utilisation](#-utilisation)
- [API Documentation](#-api-documentation)
- [Sécurité](#-sécurité)
- [Structure du projet](#-structure-du-projet)
- [Développement](#-développement)

---

## ✨ Fonctionnalités

### 📊 Tableau de bord interactif
- **KPIs en temps réel** : solde, revenus, dépenses, taux d'épargne
- **Patrimoine total** : agrégation compte courant + enveloppes d'investissement
- **Visualisations avancées** :
  - Courbe d'évolution du solde avec filtres temporels (3/6/12/60 mois)
  - Répartition des dépenses par catégorie (donut interactif)
  - Revenus vs dépenses mensuels (graphique en barres)
- **Navigation temporelle** : sélecteur de mois avec comparaison vs période précédente
- **Comparaison mois par mois** : variations des KPIs et principales évolutions

### 💸 Gestion des transactions
- **Saisie rapide** : formulaire optimisé avec auto-catégorisation
- **Import CSV** : parsing intelligent de relevés bancaires
  - Formats multiples : Débit/Crédit séparés ou Montant unique
  - Détection automatique des séparateurs (`;`, `,`, `\t`)
  - Parsing robuste des montants FR (1 234,56) et EN (1,234.56)
  - Parsing dates DD/MM/YYYY, DD-MM-YYYY, ISO, DD/MM/YY
  - Auto-catégorisation par mots-clés
- **Recherche et filtres** : par catégorie, montant, date, texte libre
- **Export CSV** : exportation complète avec encodage UTF-8

### 🏷️ Catégories intelligentes
- **Gestion complète** : création, édition, suppression
- **Budgets mensuels** : suivi avec barres de progression et alertes de dépassement
- **Mots-clés** : auto-catégorisation des imports CSV
- **Types** : revenus ou dépenses avec couleurs personnalisables
- **Statistiques** : dépense moyenne calculée automatiquement

### 📈 Enveloppes d'investissement
**8 enveloppes fiscales pré-configurées** :
- Livret A (plafond 22 950€, 2.4% attendu)
- Livret Jeune (plafond 1 600€, 3.0% attendu)
- Assurance vie (3.5% attendu)
- PER - Plan Épargne Retraite (5.0% attendu)
- PEA - Plan Épargne Actions (7.0% attendu)
- PEA piloté (6.0% attendu)
- Compte-titres ordinaire (7.0% attendu)
- Épargne pilotée (5.0% attendu)

**Fonctionnalités** :
- Édition inline : solde, rendement attendu, versement mensuel
- Alertes sur plafonds réglementaires (Livret A/Jeune)
- Plan d'épargne mensuel avec visualisation de la capacité
- Projection long terme (5/10/15/20/30 ans) avec :
  - Graphique en aires empilées par enveloppe
  - Ligne de référence "total versé sans rendement"
  - Tableau détaillé : versé / valeur projetée / intérêts par enveloppe
- Calcul du rendement moyen pondéré

### 🧮 Simulateurs financiers

#### Simulateur d'épargne
- Capital initial + versements mensuels
- 3 scénarios de rendement (pessimiste/réaliste/optimiste)
- Graphique superposé avec ligne "total versé"
- Calcul des intérêts composés

#### Simulateur d'emprunt
- Calcul de mensualité fixe (amortissement constant)
- Coût total et intérêts totaux
- Graphique d'amortissement (capital restant + intérêts cumulés)
- Tableau détaillé mensuel optionnel
- Gestion du cas taux nul

### 🔒 Authentification et sécurité
- **Inscription/Connexion** sécurisée avec JWT
- **Refresh tokens** (7 jours) avec rotation automatique
- **Chiffrement AES-256-GCM** des données sensibles :
  - Montants des transactions
  - Soldes des enveloppes
  - Versements mensuels
  - Settings utilisateur
- **Rate limiting** anti-bruteforce :
  - Authentification : 5 tentatives / 15 minutes
  - API générale : 100 requêtes / 15 minutes
  - Import CSV : 10 imports / heure
- **Protection OWASP** : injection, XSS, CSRF, headers sécurisés

### 💾 Gestion des données
- **Stockage cloud sécurisé** : MongoDB avec chiffrement
- **Multi-utilisateurs** : isolation complète des données
- **Export/Import JSON** : sauvegarde complète de l'état
- **Synchronisation multi-devices** : jusqu'à 5 appareils simultanés

---

## 🏗️ Architecture technique

### Stack Backend
- **Runtime** : Node.js 18+
- **Framework** : Express 5.x
- **Base de données** : MongoDB 6+ avec Mongoose ODM
- **Authentification** : JWT (jsonwebtoken) + bcrypt
- **Chiffrement** : Crypto natif Node.js (AES-256-GCM)
- **Validation** : Joi + express-validator
- **Sécurité** : Helmet, CORS, express-rate-limit

### Stack Frontend
- **Framework** : React 18+ avec Hooks
- **Build tool** : Vite 5.x
- **Styling** : Tailwind CSS 3.x
- **Charts** : Recharts
- **Icons** : Lucide React
- **HTTP Client** : Axios avec intercepteurs
- **Routing** : React Router DOM

### Sécurité et conformité
- ✅ Passwords hashés avec bcrypt (12 rounds)
- ✅ Données sensibles chiffrées AES-256-GCM en base
- ✅ JWT courte durée (15min) + refresh tokens
- ✅ HTTP-only cookies pour refresh tokens
- ✅ Validation stricte côté serveur (Joi)
- ✅ Protection CSRF (SameSite cookies)
- ✅ Headers sécurisés (Helmet + CSP)
- ✅ Rate limiting sur toutes les routes sensibles
- ✅ Logs sans données sensibles

---

## 🚀 Installation

### Prérequis

```bash
# Versions minimales requises
Node.js >= 18.0.0
npm >= 9.0.0
MongoDB >= 6.0
```

### Étape 1 : Cloner le repository

```bash
git clone https://github.com/votre-username/finance-app.git
cd finance-app
```

### Étape 2 : Installation des dépendances

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Optionnel : installer concurrently pour lancer les deux en parallèle
cd ..
npm install
```

### Étape 3 : Configuration MongoDB

```bash
# Démarrer MongoDB (Linux/Ubuntu)
sudo systemctl start mongod
sudo systemctl enable mongod  # Démarrage automatique au boot

# Vérifier que MongoDB tourne
sudo systemctl status mongod

# Créer la base de données
mongosh
> use financepilot
> exit
```

### Étape 4 : Configuration des variables d'environnement

Le fichier `.env` a déjà été généré avec des secrets cryptographiques sécurisés dans `backend/.env`.

**Vérifiez la configuration** :

```bash
cd backend
cat .env
```

Contenu (les secrets sont déjà générés) :
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/financepilot
JWT_SECRET=<généré automatiquement>
JWT_REFRESH_SECRET=<généré automatiquement>
ENCRYPTION_KEY=<généré automatiquement>
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Pour la production**, modifier :
- `MONGODB_URI` : URL MongoDB Atlas ou serveur dédié
- `FRONTEND_URL` : URL de production
- `NODE_ENV=production`

### Étape 5 : Démarrage

```bash
# Option 1 : Démarrer séparément

# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Option 2 : Démarrer en parallèle (depuis la racine)
npm run dev
```

L'application sera accessible sur :
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:5000/api
- **Health check** : http://localhost:5000/health

---

## 📖 Utilisation

### Premier lancement

1. **Accéder à l'application** : http://localhost:3000
2. **S'inscrire** :
   - Email valide
   - Mot de passe sécurisé (min 8 caractères, majuscule + minuscule + chiffre)
   - Prénom et nom (optionnels)
3. **7 catégories par défaut** sont créées automatiquement :
   - Salaire (revenu)
   - Logement, Courses, Transport, Loisirs, Santé, Épargne (dépenses)
4. **8 enveloppes d'investissement** sont pré-configurées

### Workflow typique

1. **Importer un relevé bancaire CSV** :
   - Aller dans "Transactions" → "Importer CSV"
   - Sélectionner le fichier
   - Mapper les colonnes (Date, Libellé, Montant ou Débit/Crédit)
   - Activer l'auto-catégorisation
   - Valider l'import

2. **Suivre son budget** :
   - Dashboard : voir l'évolution du solde
   - Catégories : comparer dépenses réelles vs budget
   - Enveloppes : suivre le patrimoine total

3. **Planifier son épargne** :
   - Enveloppes → Plan mensuel : répartir la capacité d'épargne
   - Projection long terme : visualiser l'évolution sur 20 ans

4. **Simuler un emprunt** :
   - Simulateurs → Emprunt
   - Saisir montant, taux, durée
   - Analyser mensualité et coût total

---

## 📡 API Documentation

### Authentification

Toutes les routes API (sauf auth) nécessitent un JWT dans le header :
```
Authorization: Bearer <access_token>
```

#### POST `/api/auth/register`
Inscription d'un nouvel utilisateur.

**Body** :
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response** (201) :
```json
{
  "message": "Inscription réussie",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

#### POST `/api/auth/login`
Connexion.

**Body** :
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response** (200) : identique à `/register`

#### POST `/api/auth/refresh`
Rafraîchir l'access token.

**Body** :
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response** (200) :
```json
{
  "accessToken": "eyJhbGc..."
}
```

#### POST `/api/auth/logout`
Déconnexion (invalidation du refresh token).

**Response** (204) : No content

---

### Transactions

#### GET `/api/transactions`
Récupérer les transactions avec filtres.

**Query params** :
- `limit` : nombre max de résultats (défaut: 400)
- `offset` : pagination
- `category` : ID de catégorie ou "none"
- `search` : recherche textuelle sur le libellé
- `startDate` : date ISO minimum
- `endDate` : date ISO maximum

**Response** (200) :
```json
{
  "transactions": [
    {
      "_id": "...",
      "date": "2025-03-15",
      "label": "Carrefour Courses",
      "amount": -67.50,
      "category": {
        "_id": "...",
        "name": "Courses",
        "color": "#fbbf24"
      }
    }
  ],
  "total": 150
}
```

#### POST `/api/transactions`
Créer une transaction.

**Body** :
```json
{
  "date": "2025-03-15",
  "label": "Carrefour Courses",
  "amount": -67.50,
  "category": "category_id_or_null"
}
```

**Response** (201) :
```json
{
  "message": "Transaction créée",
  "transaction": { ... }
}
```

#### POST `/api/transactions/batch`
Import massif de transactions (CSV).

**Body** :
```json
{
  "transactions": [
    { "date": "2025-03-15", "label": "...", "amount": -50, "category": null },
    { ... }
  ]
}
```

**Response** (201) :
```json
{
  "message": "Transactions importées",
  "imported": 42
}
```

#### DELETE `/api/transactions/:id`
Supprimer une transaction.

**Response** (204) : No content

---

### Catégories

#### GET `/api/categories`
Récupérer toutes les catégories.

**Response** (200) :
```json
{
  "categories": [
    {
      "_id": "...",
      "name": "Courses",
      "type": "depense",
      "color": "#fbbf24",
      "budget": 450,
      "keywords": ["carrefour", "leclerc", "courses"]
    }
  ]
}
```

#### POST `/api/categories`
Créer une catégorie.

**Body** :
```json
{
  "name": "Abonnements",
  "type": "depense",
  "color": "#60a5fa",
  "budget": 100,
  "keywords": ["netflix", "spotify", "prime"]
}
```

#### PUT `/api/categories/:id`
Mettre à jour une catégorie.

**Body** : champs partiels à modifier

#### DELETE `/api/categories/:id`
Supprimer une catégorie (orpheline les transactions).

**Response** (204) : No content

---

### Enveloppes

#### GET `/api/envelopes`
Récupérer toutes les enveloppes.

#### POST `/api/envelopes`
Créer une enveloppe.

**Body** :
```json
{
  "name": "Livret A",
  "type": "Sécurisé",
  "balance": 12000,
  "expectedReturn": 2.4,
  "monthly": 100,
  "color": "#2dd4bf"
}
```

#### PUT `/api/envelopes/:id`
Mettre à jour une enveloppe.

#### DELETE `/api/envelopes/:id`
Supprimer une enveloppe.

---

### Settings

#### GET `/api/settings`
Récupérer les settings utilisateur.

**Response** (200) :
```json
{
  "settings": {
    "startBalance": 0,
    "monthlyCapacity": 1000,
    "updatedAt": "2025-03-15T10:30:00Z"
  }
}
```

#### PUT `/api/settings`
Mettre à jour les settings.

**Body** :
```json
{
  "startBalance": 5000,
  "monthlyCapacity": 1200
}
```

---

## 🔒 Sécurité

### Chiffrement des données

Les champs suivants sont chiffrés en base avec **AES-256-GCM** :

**Transactions** :
- `label` : libellé de la transaction
- `amount` : montant

**Envelopes** :
- `balance` : solde actuel
- `monthly` : versement mensuel

**Settings** :
- `startBalance` : solde de départ
- `monthlyCapacity` : capacité d'épargne mensuelle

Format en base : `iv:encrypted:authTag` (hex)

### Authentification

- **Access token** : JWT signé, durée 15 minutes
- **Refresh token** : JWT signé, durée 7 jours
  - Stocké haché en base
  - Envoyé en cookie HTTP-only + response body
  - Maximum 5 tokens actifs par user (FIFO)

### Validation

Tous les inputs sont validés avec **Joi** :

**Password** :
- Min 8 caractères
- Max 100 caractères
- Au moins 1 majuscule, 1 minuscule, 1 chiffre

**Email** : format RFC 5322

**Montants** : -999 999 999 à 999 999 999

**Dates** : ISO 8601

**Couleurs** : format hex `#RRGGBB`

### Rate Limiting

| Route | Limite | Fenêtre |
|-------|--------|---------|
| `/api/auth/login` | 5 req | 15 min |
| `/api/auth/register` | 5 req | 15 min |
| `/api/transactions/batch` | 10 req | 1 heure |
| Autres routes API | 100 req | 15 min |

### En production

**Checklist de sécurité** :
- [ ] Générer de nouveaux secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`)
- [ ] Configurer `NODE_ENV=production`
- [ ] Activer HTTPS (certificat SSL/TLS)
- [ ] Configurer un pare-feu (UFW, iptables)
- [ ] Limiter l'accès MongoDB (bind_ip, authentification)
- [ ] Configurer les backups automatiques MongoDB
- [ ] Activer les logs applicatifs (Winston, PM2)
- [ ] Configurer le monitoring (Prometheus, Grafana)

---

## 📂 Structure du projet

```
Finance-App/
├── backend/                          # Serveur Node.js/Express
│   ├── config/
│   │   ├── db.js                     # Connexion MongoDB
│   │   └── encryption.js             # Config chiffrement
│   ├── models/                       # Schémas Mongoose
│   │   ├── User.js                   # Utilisateur + auth
│   │   ├── Transaction.js            # Transactions (chiffrées)
│   │   ├── Category.js               # Catégories
│   │   ├── Envelope.js               # Enveloppes (chiffrées)
│   │   └── Settings.js               # Settings user (chiffrées)
│   ├── middleware/
│   │   ├── auth.js                   # Vérification JWT
│   │   └── rateLimiter.js            # Rate limiting
│   ├── routes/                       # Routes API
│   │   ├── auth.js                   # Authentification
│   │   ├── transactions.js           # CRUD transactions
│   │   ├── categories.js             # CRUD catégories
│   │   ├── envelopes.js              # CRUD enveloppes
│   │   └── settings.js               # GET/PUT settings
│   ├── utils/
│   │   ├── encryption.js             # Fonctions AES-256-GCM
│   │   └── validators.js             # Schémas Joi
│   ├── server.js                     # Point d'entrée
│   ├── package.json
│   ├── .env                          # Variables (généré)
│   └── .env.example
├── frontend/                         # Application React
│   ├── src/
│   │   ├── components/               # Composants React
│   │   │   ├── Login.jsx             # Formulaire login
│   │   │   └── Register.jsx          # Formulaire inscription
│   │   ├── services/
│   │   │   └── api.js                # Client Axios + intercepteurs
│   │   ├── App.jsx                   # FinancePilot (dashboard)
│   │   ├── main.jsx                  # Point d'entrée + router
│   │   └── index.css                 # Tailwind imports
│   ├── index.html
│   ├── vite.config.js                # Config Vite
│   ├── tailwind.config.js            # Config Tailwind
│   └── package.json
├── FinancePilot.jsx                  # Version originale (référence)
├── README.md                         # Ce fichier
├── GUIDE_FINITION.md                 # Guide de finition
└── package.json                      # Scripts racine (concurrently)
```

---

## 🛠️ Développement

### Scripts disponibles

**Backend** :
```bash
npm run dev      # Nodemon (hot reload)
npm start        # Production
```

**Frontend** :
```bash
npm run dev      # Vite dev server
npm run build    # Build production
npm run preview  # Preview du build
```

**Racine** (nécessite `concurrently`) :
```bash
npm run dev             # Backend + Frontend en parallèle
npm run backend:dev     # Backend seul
npm run frontend:dev    # Frontend seul
```

### Tests manuels

```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","firstName":"Test"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Get categories (avec token)
curl http://localhost:5000/api/categories \
  -H "Authorization: Bearer <access_token>"
```

### Vérifier le chiffrement

```bash
# Se connecter à MongoDB
mongosh

# Sélectionner la base
use financepilot

# Voir une transaction (champs chiffrés)
db.transactions.findOne()

# Le champ 'amount' doit être au format "iv:encrypted:authTag"
# Exemple : "a3f2c1d4e5f6g7h8:9a8b7c6d5e4f3g2h:1a2b3c4d5e6f7g8h"
```

### Debugging

**Backend** :
```bash
# Activer les logs détaillés
DEBUG=* npm run dev

# Logs MongoDB
tail -f /var/log/mongodb/mongod.log
```

**Frontend** :
```bash
# Console navigateur
# Vérifier les requêtes dans l'onglet Network
# Vérifier le localStorage pour les tokens
```

### Base de données

**Backup** :
```bash
# Exporter la base
mongodump --db financepilot --out backup/

# Restaurer
mongorestore --db financepilot backup/financepilot/
```

**Reset complet** :
```bash
mongosh
> use financepilot
> db.dropDatabase()
```

---

## 🐛 Résolution de problèmes

### MongoDB ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u mongod -n 50

# Vérifier le port
sudo netstat -tulpn | grep 27017

# Redémarrer
sudo systemctl restart mongod
```

### Erreur "ECONNREFUSED" sur le frontend

- Vérifier que le backend tourne sur le port 5000
- Vérifier la config CORS dans `backend/server.js`
- Vérifier `FRONTEND_URL` dans `.env`

### Erreur "Token expired"

- Le access token expire après 15 minutes
- Le refresh automatique devrait fonctionner via l'intercepteur Axios
- Sinon, se reconnecter

### Erreur de déchiffrement

- Vérifier que `ENCRYPTION_KEY` n'a pas changé entre 2 démarrages
- Si changé : les données chiffrées avec l'ancienne clé sont perdues
- Backup recommandé avant modification de `ENCRYPTION_KEY`

---

## 📜 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📞 Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter le [GUIDE_FINITION.md](GUIDE_FINITION.md) pour les étapes de finalisation

---

## 🎯 Roadmap

- [ ] Tests unitaires et d'intégration
- [ ] Notifications push pour alertes budget
- [ ] Export PDF des rapports mensuels
- [ ] Graphiques comparatifs année N vs N-1
- [ ] Objectifs d'épargne avec date cible
- [ ] Transactions récurrentes automatiques
- [ ] Support multi-devises
- [ ] API publique avec documentation OpenAPI/Swagger
- [ ] Application mobile (React Native)
- [ ] Synchronisation temps réel (WebSockets)

---

**Développé avec ❤️ pour la gestion financière personnelle sécurisée**
