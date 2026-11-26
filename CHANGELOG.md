# Changelog

## [2026-11-26] - Déploiement entièrement automatique

### Ajouté
- 🚀 `./scripts/deploy-production.sh` automatise tout :
  - génération de `.env.docker` (secrets forts, permissions 600) ;
  - régénération des secrets JWT faibles ;
  - sauvegarde automatique avant mise à jour ;
  - build, démarrage et vérification de bout en bout.
  L'option `--prepare-only` vérifie la configuration sans déployer.
- 🔁 **Migrations automatiques au démarrage du backend** (`backend/migrations/`) : exécution unique par migration grâce à un marqueur en base, qui sert aussi de verrou entre instances. Le marqueur est retiré en cas d'échec pour retenter au prochain démarrage. Le re-chiffrement des données historiques en clair ne demande plus aucune commande manuelle.

### Sécurité
- 🔒 `ENCRYPTION_KEY` n'est jamais générée ni modifiée quand des données existent : le déploiement s'arrête avec un message explicite.
- 🔒 `generate-secrets.sh` ne peut plus écraser `.env.docker` : l'ancienne option interactive remplaçait la clé de chiffrement et rendait les données illisibles.

## [2026-11-26] - Découpage du frontend et tests

### Modifié
- ♻️ `App.jsx` (2 160 lignes) découpé en modules. La racine passe à environ 180 lignes et le reste est réparti en 5 vues (`views/`), un hook de données (`hooks/useFinanceData`), une logique pure testée (`lib/`) et des composants UI (`components/ui.jsx`).
- ⚡ Les éditions inline des enveloppes, de la capacité d'épargne et du solde mettent l'affichage à jour immédiatement et sont sauvegardées en différé (600 ms). Avant, chaque frappe envoyait une requête et attendait la réponse avant d'afficher.

### Corrigé
- 🐛 **L'import CSV n'enregistrait rien sur le serveur** : les transactions disparaissaient au rechargement. Elles sont désormais envoyées par lots (`/transactions/batch`) puis rechargées.
- 🐛 **Catégories des transactions** : l'API renvoie un objet, le frontend attendait un identifiant. La répartition des dépenses, les budgets consommés et le filtre par catégorie étaient faux.
- 🐛 Si le chargement échouait, des **données d'exemple aléatoires** s'affichaient comme si elles étaient réelles.
- 🐛 « Recharger les données d'exemple », « Tout effacer » et « Restaurer une sauvegarde JSON » ne modifiaient que l'affichage, sans rien enregistrer. Ces actions sont retirées, et le texte « données dans ce navigateur » est corrigé.
- 🐛 Un nom d'enveloppe vidé pendant la saisie provoquait une erreur 400.
- 🔒 Export CSV : les formules Excel en tête de libellé sont neutralisées (injection CSV).

### Sécurité
- 🔒 **Access token en mémoire uniquement** (plus dans `localStorage`, donc inaccessible à un script XSS). Après un rechargement, la session est restaurée via le cookie httpOnly.
- 🔒 **Refresh tokens par familles** : chaque connexion est une session indépendante. Un token ancien réutilisé révoque cette session pendant toute sa durée de vie. Deux onglets qui rafraîchissent en même temps sont tolérés pendant 30 s, au lieu de déconnecter l'utilisateur. La rotation est atomique côté MongoDB, ce qui supprime une course entre requêtes concurrentes.

### Corrigé (backend)
- 🐛 Créer un bien sans prix ni date d'achat renvoyait une erreur 400 (champs vides refusés). La validation des biens passe sur Joi et `express-validator` est retiré.

### Ajouté
- ✅ 47 tests frontend (Vitest + Testing Library) : logique pure, caractérisation de l'application complète, non-régression de chaque bug corrigé, session et gardes de routes. Ils sont exécutés en CI.
- ✅ Backend : 32 tests, dont les refresh concurrents, la réutilisation après la période de grâce et les sessions multi-appareils.

## [2026-11-26] - Correctifs de sécurité, intégrité des données et déploiement

### Sécurité
- 🔒 Les **refresh tokens** ne sont plus renvoyés au JavaScript ni stockés dans `localStorage` : uniquement en cookie httpOnly (`path=/api/auth`). Ils sont hachés (SHA-256) en base, renouvelés à chaque refresh (rotation), et toutes les sessions sont révoquées en cas de réutilisation.
- 🔒 **Assignation de masse** corrigée sur `PUT /api/stocks/:id` et `PUT /api/recurring/:id` : validation Joi en liste blanche, `userId` non modifiable.
- 🔒 Algorithme JWT imposé (HS256), comparaison bcrypt à temps constant (pas d'énumération des emails), en-tête `Bearer` strict.
- 🔒 Les erreurs de validation ne journalisent plus `req.body` (les mots de passe apparaissaient en clair dans les logs).
- 🔒 Validation de la configuration au démarrage : secrets absents ou faibles et clé de chiffrement invalide sont refusés.
- 🔒 Docker : MongoDB et l'API ne sont plus exposés sur l'hôte, le backend utilise un compte Mongo à droits restreints, il n'y a plus de mot de passe par défaut `changeme`, la CSP nginx n'autorise plus `unsafe-eval` et les sourcemaps ne sont plus publiées.
- 🔒 `trust proxy` est configuré : le rate limiting voit l'IP réelle, et non celle de nginx. Les limites d'écriture et d'import s'appliquent par utilisateur.

### Corrigé
- 🐛 **Suppression de comptes utilisateurs** : l'index TTL sur `refreshTokens.createdAt` supprimait l'utilisateur entier 7 jours après sa plus ancienne session. L'index est supprimé automatiquement au démarrage.
- 🐛 **Données stockées en clair** : imports CSV (`insertMany` ne chiffrait pas), modifications des charges récurrentes et des positions boursières, libellés contenant `:`. Le script `npm run migrate:reencrypt` chiffre les données existantes.
- 🐛 `GET /api/settings` renvoyait les valeurs chiffrées : le solde de départ retombait à 0 à chaque rechargement.
- 🐛 `GET /api/transactions/stats` renvoyait toujours 0.
- 🐛 La recherche de transactions ne trouvait rien (libellés chiffrés), et `total` ne comptait que la page courante.
- 🐛 Le frontend ne chargeait que les 400 dernières transactions : le chargement est désormais paginé.
- 🐛 `GET /api/stocks/portfolio/summary` plantait dès qu'une position avait un compte renseigné.
- 🐛 Un identifiant mal formé provoquait une erreur 500 au lieu d'une 400. `limit` est désormais plafonné à 1000.
- 🐛 La déconnexion ne révoquait pas la session côté serveur.
- 🐛 Le build de production échouait (`manualChunks` incompatible avec Vite 8).
- 🐛 Le build Docker échouait (`package-lock.json` ignoré par git alors que `npm ci` l'exige), et le backend créait une boucle de redirection HTTPS derrière nginx.
- 🐛 Les scripts de sauvegarde, restauration et supervision appelaient MongoDB sans authentification.

### Ajouté
- ✅ 27 tests d'intégration (`cd backend && npm test`), ESLint sur le backend et le frontend, CI GitHub Actions.
- ✅ Arrêt propre (SIGTERM/SIGINT) ; `/health` renvoie l'état de MongoDB.
- 📝 README réécrit, `docs/DEPLOIEMENT.md` ; anciens documents déplacés dans `docs/archive/`.

### Supprimé
- `FinancePilot.jsx` (ancienne copie de `App.jsx`), `docker-entrypoint.sh`, le `health-check.sh` en double, les fichiers `.pid` et `.claude/settings.local.json` versionnés.

## [2025-07-01] - Refonte majeure

### Ajouté
- ✨ Nouvel onglet "Biens & Propriétés" pour inventorier vos biens physiques
  - Catégories : Véhicule, Immobilier, Électronique, Mobilier, Bijoux, Collection, Autre
  - Champs : Nom, valeur actuelle, prix d'achat, date d'achat, description
  - Calcul automatique de la valeur totale du patrimoine physique
- 🚀 Scripts de gestion processus (`start.sh` et `stop.sh`)
  - Démarrage/arrêt propre du backend et frontend
  - Gestion automatique des ports et processus
  - Logs centralisés dans `backend.log` et `frontend.log`
- 📝 Documentation complète (README.md)

### Modifié
- 🔧 Correction du bug de double décryptage des montants
  - Suppression des hooks post-find dans tous les modèles
  - Décryptage uniquement via toJSON transform
  - Fix : Les montants s'affichent maintenant correctement après refresh
- 🏗️ Restructuration des imports API dans App.jsx
- 📊 Optimisation du calcul du patrimoine total dans le Dashboard

### Supprimé
- ❌ Onglet "Investissements" (redondant avec Enveloppes)
  - Suppression du modèle InvestmentProduct
  - Suppression des routes /api/investments
  - Suppression du composant InvestmentProducts.jsx
  - Migration conseillée : Utiliser l'onglet "Enveloppes" pour les produits d'épargne

### Sécurité
- 🔒 Correction d'index dupliqué dans le modèle Asset
- 🛡️ Validation renforcée des catégories pour RecurringItem

## [Précédent] - Version initiale

### Fonctionnalités de base
- Authentification JWT
- CRUD Transactions, Catégories, Enveloppes
- Dashboard avec KPIs
- Import CSV
- Chiffrement AES-256-GCM
