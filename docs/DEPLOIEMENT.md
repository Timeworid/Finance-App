# Déploiement de FinancePilot

## 1. Docker Compose (recommandé)

```bash
cp .env.docker.example .env.docker
./scripts/generate-secrets.sh          # copier les valeurs dans .env.docker
./scripts/deploy-production.sh
```

Architecture :

```
navigateur ──HTTP_PORT──▶ nginx (frontend) ──/api──▶ backend:5000 ──▶ mongodb:27017
                          seul service exposé        réseau Docker interne uniquement
```

- Le backend se connecte avec le compte `financepilot_user` (droits `readWrite` sur la base `financepilot`), pas avec le compte root.
- Le compte applicatif est créé par `mongo-init.js` **au premier démarrage uniquement**, quand le volume est vide. Si vous changez `MONGO_APP_PASSWORD` ensuite, mettez à jour l'utilisateur à la main dans Mongo.

### Variables (`.env.docker`)

| Variable | Rôle |
|---|---|
| `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD` | Mots de passe MongoDB (obligatoires) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Secrets JWT, ≥ 32 caractères, différents (obligatoires) |
| `ENCRYPTION_KEY` | Clé AES-256 de 64 caractères hexadécimaux (obligatoire, **ne jamais la changer**) |
| `FRONTEND_URL` | Origine publique exacte (ex. `https://finance.mondomaine.fr`), utilisée par le contrôle CORS |
| `HTTP_PORT` | Port publié par nginx (80 par défaut) |
| `FORCE_HTTPS` | `true` si un proxy TLS en amont transmet `X-Forwarded-Proto: https` |
| `COOKIE_SECURE` | `true` par défaut ; `false` seulement pour un accès HTTP sans TLS via une IP ou un domaine |

## 2. HTTPS

Placez un reverse proxy TLS devant nginx (Caddy, Traefik, Cloudflare Tunnel…) ou ajoutez un bloc `listen 443 ssl` dans `nginx.conf`. Ensuite :

- mettez `FORCE_HTTPS=true` ;
- mettez `FRONTEND_URL=https://…` ;
- ajoutez l'en-tête HSTS (exemple commenté en bas de `nginx.conf`) ;
- si un proxy supplémentaire se trouve devant nginx, augmentez `TRUST_PROXY` dans `docker-compose.yml` (nombre de proxys de confiance).

## 3. Mise à jour depuis une version antérieure (avant novembre 2026)

Les anciennes versions avaient trois défauts qui laissent des traces en base :

1. **Données en clair** : les imports CSV, les modifications de charges récurrentes ou de positions boursières, et les libellés contenant `:` étaient enregistrés sans chiffrement. Pour les chiffrer, faites d'abord une sauvegarde, puis lancez :
   ```bash
   ./scripts/backup-mongodb.sh
   docker compose exec backend node scripts/reencrypt-plaintext.js --dry-run   # aperçu
   docker compose exec backend node scripts/reencrypt-plaintext.js
   ```
   Hors Docker : `cd backend && npm run migrate:reencrypt`.
2. **Index TTL dangereux** : l'index `refreshTokens.createdAt_1` supprimait les comptes utilisateurs 7 jours après leur plus ancienne session. Il est **supprimé automatiquement** au démarrage du backend.
3. **Sessions** : les refresh tokens sont désormais hachés en base. Tous les utilisateurs devront se reconnecter une fois.

Le backend refuse aussi de démarrer avec des secrets faibles. Si c'est votre cas, générez-en de nouveaux. **Ne touchez pas à `ENCRYPTION_KEY`** : la remplacer rendrait les données existantes illisibles.

## 4. Sauvegardes

```bash
./scripts/backup-mongodb.sh                      # archive dans ./backups
./scripts/restore-mongodb.sh backups/<fichier>   # restauration (écrase la base)
```

Planifiez la sauvegarde (cron) et stockez les archives **hors du serveur**, avec `ENCRYPTION_KEY` conservée séparément. Une sauvegarde sans la clé est inutilisable.

## 5. Supervision

- `GET /health` sur le backend renvoie 503 si MongoDB est déconnecté (utilisé par le healthcheck Docker).
- Les logs backend sont en JSON, avec rotation quotidienne dans le volume `backend_logs`. Ils ne contiennent ni corps de requête, ni montant, ni mot de passe.
- `./scripts/health-check.sh` vérifie les services, les containers, le disque et les statistiques Mongo.
