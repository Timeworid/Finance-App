# FinancePilot

Application de pilotage financier personnel : transactions, budgets, enveloppes d'épargne, biens, charges récurrentes et portefeuille boursier. Les données sensibles sont chiffrées en base.

| Couche | Technologies |
|---|---|
| Backend | Node.js 22, Express 5, MongoDB (Mongoose 9) |
| Frontend | React 19, Vite 8, Tailwind CSS 3, Recharts |
| Sécurité | JWT (access 15 min + refresh 7 j en cookie httpOnly avec rotation), AES-256-GCM, bcrypt, helmet, rate limiting |
| Qualité | Tests backend (`node:test` + supertest + MongoDB en mémoire), tests frontend (Vitest + Testing Library), ESLint, CI GitHub Actions |

## Démarrage rapide (développement)

Prérequis : Node.js ≥ 20 et MongoDB en local.

```bash
npm run install:all                    # dépendances racine, backend et frontend
./scripts/generate-secrets.sh          # génère JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
cp backend/.env.example backend/.env   # puis y coller les secrets générés
./start.sh                             # backend :5000, frontend :3000 (logs : backend.log, frontend.log)
./stop.sh                              # arrêt
```

Le frontend appelle l'API en relatif (`/api`) : le proxy Vite la relaie au backend en dev et nginx le fait en production. Il n'y a donc pas de CORS à configurer.

> Le backend **refuse de démarrer** si un secret est absent ou faible : `ENCRYPTION_KEY` doit faire 64 caractères hexadécimaux, les secrets JWT au moins 32 caractères et être différents l'un de l'autre.

## Déploiement Docker

```bash
cp .env.docker.example .env.docker     # renseigner les secrets (obligatoires)
./scripts/deploy-production.sh         # build, démarrage, vérification
```

Seul nginx est exposé (port `HTTP_PORT`, 80 par défaut). MongoDB et l'API restent sur le réseau Docker interne. Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) pour HTTPS, les sauvegardes et la mise à jour depuis une ancienne version.

## Commandes

| Commande | Effet |
|---|---|
| `npm test` (racine) | Tests backend + frontend |
| `cd backend && npm test` | Tests d'intégration API (télécharge MongoDB au premier lancement) |
| `cd frontend && npm test` | Tests frontend (Vitest) ; `npm run test:watch` en continu |
| `cd backend && npm run lint` / `cd frontend && npm run lint` | ESLint |
| `cd frontend && npm run build` | Build de production dans `frontend/dist` |
| `cd backend && npm run migrate:reencrypt -- --dry-run` | Liste les données historiques restées en clair (sans `--dry-run` : les chiffre) |
| `./scripts/backup-mongodb.sh` / `./scripts/restore-mongodb.sh` | Sauvegarde / restauration |
| `./scripts/health-check.sh` | État des services |

## Structure

```
backend/
  app.js            Application Express (testable, sans écoute de port)
  server.js         Démarrage : validation de la config, connexion Mongo, arrêt propre
  config/           Logger winston, connexion MongoDB, validation des variables d'env
  middleware/       Authentification JWT, rate limiting, validation des ObjectId
  models/           Modèles Mongoose (chiffrement dans les hooks pre('save'))
  routes/           Routes REST (validation Joi en liste blanche)
  utils/            Chiffrement AES-256-GCM, schémas Joi
  scripts/          Migration de re-chiffrement
  tests/            Tests d'intégration
frontend/src/
  App.jsx           Racine : mise en page, navigation, modale d'export
  hooks/            useFinanceData : chargement API, état, persistance (debounce des éditions inline)
  views/            Vues : tableau de bord, transactions (+ import CSV, édition), catégories, enveloppes, simulateurs
  lib/              Logique pure testée : formats, parsing, calculs financiers, reducer, export CSV
  components/       Composants UI génériques (ui.jsx) et écrans bourse, biens, récurrents, connexion
  services/api.js   Client axios (refresh automatique single-flight)
  __tests__/        Tests Vitest (unitaires, caractérisation de l'app, non-régression)
docs/               Déploiement ; archive/ = anciens documents de travail
```

## API

Toutes les routes sauf `/api/auth/*` exigent `Authorization: Bearer <accessToken>`.

| Route | Méthodes |
|---|---|
| `/api/auth/register`, `/login`, `/refresh`, `/logout` | POST |
| `/api/auth/me` | GET |
| `/api/transactions` | GET (`limit` ≤ 1000, `offset`, `search`, `category`, `startDate`, `endDate`), POST |
| `/api/transactions/batch` | POST (import CSV, 1000 lignes max) |
| `/api/transactions/stats` | GET |
| `/api/transactions/:id` | PUT, DELETE |
| `/api/categories`, `/api/envelopes`, `/api/assets`, `/api/recurring`, `/api/stocks` | GET, POST ; `/:id` PUT, DELETE |
| `/api/recurring/summary/all`, `/api/stocks/portfolio/summary` | GET |
| `/api/stocks/prices/update` | POST `{ updates: { SYMBOLE: prix } }` |
| `/api/settings` | GET, PUT |
| `/health` | GET (inclut l'état de MongoDB, 503 si déconnecté) |

## Sécurité : points clés

- Les montants, libellés et valeurs sont chiffrés en AES-256-GCM. **Conservez `ENCRYPTION_KEY`** : sans elle, les données sont perdues.
- Le refresh token n'est jamais accessible au JavaScript. Il est stocké haché (SHA-256) en base et change à chaque renouvellement. S'il est réutilisé (signe de vol), toutes les sessions de l'utilisateur sont révoquées.
- Les entrées sont validées par Joi en liste blanche : `userId` et les champs inconnus sont ignorés.

## Licence

MIT
