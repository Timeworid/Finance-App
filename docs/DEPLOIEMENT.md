# Déploiement de FinancePilot

## 1. Docker Compose (recommandé) — une seule commande

```bash
./scripts/deploy-production.sh
# ou, avec votre domaine :
FRONTEND_URL=https://finance.exemple.fr ./scripts/deploy-production.sh
```

Le script fait **tout automatiquement**, à l'installation comme à chaque mise à jour :

| Étape | Comportement |
|---|---|
| Configuration | Crée `.env.docker` (permissions 600) avec des secrets aléatoires forts s'il n'existe pas. Il régénère les secrets JWT absents, faibles ou identiques (seul effet : une reconnexion). |
| Clé de chiffrement | Générée **uniquement** pour une installation neuve et **jamais modifiée** ensuite. Si elle est absente ou invalide alors que des données existent, le déploiement s'arrête sans rien changer. |
| Sauvegarde | Si une base existe, elle est sauvegardée dans `./backups` **avant** toute mise à jour. En cas d'échec de la sauvegarde, le déploiement s'arrête. |
| Build et démarrage | Build des images, démarrage, attente des healthchecks. |
| Migrations | Exécutées par le backend au démarrage, **une seule fois** chacune (marqueurs dans la collection `_migrations`) : re-chiffrement des données historiques en clair, suppression de l'ancien index TTL dangereux. |
| Vérification | Frontend et chaîne nginx → API → MongoDB testés. |

`./scripts/deploy-production.sh --prepare-only` prépare et vérifie la configuration sans déployer.

> ⚠️ **Conservez une copie de `.env.docker` hors du serveur.** Il contient `ENCRYPTION_KEY` : sans elle, les données (et leurs sauvegardes) sont illisibles. Si `.env.docker` est absent alors que des données existent, le script refuse de générer de nouveaux secrets et demande de restaurer le fichier d'origine.

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

Relancez simplement `./scripts/deploy-production.sh` : tout est automatique.

- **Sauvegarde** : faite avant la mise à jour.
- **Données historiques en clair** (anciens imports CSV, modifications de charges récurrentes ou de bourse, libellés contenant `:`) : chiffrées par la migration `reencrypt-plaintext-v1` au premier démarrage.
- **Index TTL dangereux** (`refreshTokens.createdAt_1`, qui supprimait des comptes) : supprimé au démarrage.
- **Secrets JWT faibles** : régénérés. `ENCRYPTION_KEY` est conservée.
- **Sessions** : chaque utilisateur se reconnecte une fois, rien à faire.

Pour diagnostiquer manuellement : `docker compose exec backend node scripts/reencrypt-plaintext.js --dry-run`.

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
