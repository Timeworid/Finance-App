# 🚀 Guide de Déploiement Production - FinancePilot

Ce guide décrit comment déployer FinancePilot en production de manière sécurisée et robuste.

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Configuration initiale](#configuration-initiale)
3. [Déploiement avec Docker](#déploiement-avec-docker)
4. [Configuration HTTPS/SSL](#configuration-httpsssl)
5. [Variables d'environnement](#variables-denvironnement)
6. [Backup et restauration](#backup-et-restauration)
7. [Monitoring et logs](#monitoring-et-logs)
8. [Maintenance](#maintenance)
9. [Sécurité](#sécurité)
10. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Serveur recommandé
- **OS**: Ubuntu 22.04 LTS ou supérieur
- **RAM**: Minimum 2GB (4GB recommandé)
- **CPU**: 2 cores minimum
- **Stockage**: 20GB minimum (SSD recommandé)
- **Accès**: root ou sudo

### Logiciels requis
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo apt install docker-compose-plugin

# Vérifier les installations
docker --version
docker compose version
```

---

## Configuration initiale

### 1. Cloner le projet

```bash
# SSH (recommandé)
git clone git@github.com:votre-username/financepilot.git

# ou HTTPS
git clone https://github.com/votre-username/financepilot.git

cd financepilot
```

### 2. Générer les secrets de production

**⚠️ CRITIQUE**: Ne JAMAIS utiliser les secrets par défaut en production!

```bash
# Générer JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Générer JWT_REFRESH_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Générer ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Configurer les variables d'environnement

```bash
# Copier le template
cp .env.docker.example .env.docker

# Éditer avec vos valeurs
nano .env.docker
```

**Exemple de configuration production**:
```env
# MongoDB
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=VotreMotDePasseTresSecurise123!

# JWT Secrets (REMPLACER PAR VOS VALEURS GÉNÉRÉES!)
JWT_SECRET=a1b2c3d4e5f6...
JWT_REFRESH_SECRET=9z8y7x6w5v4u...

# Encryption Key (REMPLACER!)
ENCRYPTION_KEY=1a2b3c4d5e6f...

# URLs
FRONTEND_URL=https://votre-domaine.com
VITE_API_URL=https://votre-domaine.com/api
BACKEND_URL=http://backend:5000
```

---

## Déploiement avec Docker

### Déploiement rapide

```bash
# Rendre les scripts exécutables
chmod +x scripts/*.sh

# Déployer en production
./scripts/deploy-production.sh
```

### Déploiement manuel

```bash
# Build des images
docker compose build --no-cache

# Démarrer les services
docker compose --env-file .env.docker up -d

# Vérifier le statut
docker compose ps

# Voir les logs
docker compose logs -f
```

### Vérification du déploiement

```bash
# Tester le backend
curl http://localhost:5000/health

# Tester le frontend
curl http://localhost/health

# Vérifier MongoDB
docker exec financepilot-mongodb mongosh --eval "db.adminCommand('ping')"
```

---

## Configuration HTTPS/SSL

### Option 1: Let's Encrypt (Gratuit, recommandé)

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir un certificat
sudo certbot certonly --standalone -d votre-domaine.com

# Certificats générés dans:
# /etc/letsencrypt/live/votre-domaine.com/fullchain.pem
# /etc/letsencrypt/live/votre-domaine.com/privkey.pem
```

### Option 2: Certificat auto-signé (Développement uniquement)

```bash
# Générer un certificat auto-signé
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/CN=votre-domaine.com"
```

### Configuration Nginx pour HTTPS

Décommenter la section HTTPS dans `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ... reste de la configuration
}

# Redirection HTTP → HTTPS
server {
    listen 80;
    server_name votre-domaine.com;
    return 301 https://$server_name$request_uri;
}
```

Monter les certificats dans `docker-compose.yml`:

```yaml
frontend:
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

### Renouvellement automatique Let's Encrypt

```bash
# Ajouter une tâche cron
sudo crontab -e

# Ajouter cette ligne (renouvellement quotidien à 2h du matin)
0 2 * * * certbot renew --quiet && docker compose restart frontend
```

---

## Variables d'environnement

### Backend (.env)

```env
# Serveur
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://votre-domaine.com

# MongoDB (Atlas recommandé pour production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/financepilot

# JWT (15min access, 7j refresh)
JWT_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>

# Encryption AES-256
ENCRYPTION_KEY=<32-byte-hex>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Security
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=strict
```

### Frontend

Les variables frontend sont injectées au build:

```env
VITE_API_URL=https://votre-domaine.com/api
```

---

## Backup et restauration

### Backup automatique MongoDB

```bash
# Backup manuel
./scripts/backup-mongodb.sh

# Planifier des backups quotidiens (2h du matin)
crontab -e
# Ajouter:
0 2 * * * /path/to/financepilot/scripts/backup-mongodb.sh
```

Les backups sont stockés dans `./backups/` et conservés 30 jours.

### Restauration

```bash
# Lister les backups disponibles
ls -lh backups/

# Restaurer un backup
./scripts/restore-mongodb.sh backups/financepilot-20260701_020000.tar.gz
```

### Backup complet du serveur

```bash
# Sauvegarder tout (code + données + config)
tar -czf financepilot-full-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='dist' \
  .
```

---

## Monitoring et logs

### Logs Docker

```bash
# Tous les services
docker compose logs -f

# Un service spécifique
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb

# Dernières 100 lignes
docker compose logs --tail=100 backend
```

### Logs Winston (Backend)

Logs stockés dans `backend/logs/`:
- `combined-YYYY-MM-DD.log`: Tous les logs
- `error-YYYY-MM-DD.log`: Erreurs uniquement

```bash
# Voir les logs en temps réel
tail -f backend/logs/combined-$(date +%Y-%m-%d).log

# Voir les erreurs
tail -f backend/logs/error-$(date +%Y-%m-%d).log

# Chercher dans les logs
grep "ERROR" backend/logs/combined-*.log
```

### Monitoring ressources

```bash
# Stats Docker
docker stats

# Espace disque
df -h

# Mémoire
free -h

# Processus
top
# ou
htop
```

### Health checks

```bash
# Backend
curl https://votre-domaine.com/api/health

# Frontend
curl https://votre-domaine.com/health

# MongoDB
docker exec financepilot-mongodb mongosh --eval "db.serverStatus()"
```

---

## Maintenance

### Mise à jour de l'application

```bash
# 1. Sauvegarder
./scripts/backup-mongodb.sh

# 2. Pull les dernières modifications
git pull origin main

# 3. Rebuild et redéployer
docker compose build --no-cache
docker compose up -d

# 4. Vérifier
docker compose ps
curl https://votre-domaine.com/health
```

### Mise à jour des dépendances

```bash
# Backend
cd backend
npm update
npm audit fix

# Frontend
cd frontend
npm update
npm audit fix

# Rebuild après mise à jour
docker compose build --no-cache
```

### Nettoyer Docker

```bash
# Supprimer les images inutilisées
docker image prune -a

# Supprimer les volumes orphelins
docker volume prune

# Nettoyer complètement (ATTENTION: supprime tout)
docker system prune -a --volumes
```

### Rotation des logs

Configurer logrotate pour les logs Winston:

```bash
# Créer le fichier de config
sudo nano /etc/logrotate.d/financepilot
```

```
/path/to/financepilot/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nodejs nodejs
}
```

---

## Sécurité

### Checklist de sécurité

- [ ] Secrets uniques générés (JWT, ENCRYPTION_KEY)
- [ ] HTTPS activé avec certificat valide
- [ ] Firewall configuré (UFW)
- [ ] SSH avec clés uniquement (pas de password)
- [ ] MongoDB avec authentification forte
- [ ] Backups automatiques actifs
- [ ] Rate limiting activé
- [ ] Headers de sécurité configurés
- [ ] Logs sans données sensibles
- [ ] Variables d'environnement non commitées

### Configuration Firewall

```bash
# Installer UFW
sudo apt install ufw

# Règles de base
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH (IMPORTANT!)
sudo ufw allow ssh

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable

# Vérifier
sudo ufw status
```

### Sécurisation SSH

```bash
# Désactiver l'authentification par mot de passe
sudo nano /etc/ssh/sshd_config

# Modifier:
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes

# Redémarrer SSH
sudo systemctl restart ssh
```

### MongoDB sécurisé

En production, utiliser MongoDB Atlas ou configurer:

```yaml
# docker-compose.yml
mongodb:
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: <mot-de-passe-fort>
  # Ne PAS exposer le port 27017 publiquement
  # ports:
  #   - "27017:27017"  # RETIRER EN PRODUCTION
```

---

## Troubleshooting

### Le backend ne démarre pas

```bash
# Vérifier les logs
docker compose logs backend

# Problèmes courants:
# 1. MongoDB inaccessible
docker compose ps mongodb

# 2. Variables d'environnement manquantes
docker compose exec backend env | grep JWT_SECRET

# 3. Port déjà utilisé
sudo lsof -i :5000
```

### Le frontend affiche une erreur

```bash
# Vérifier les logs
docker compose logs frontend

# Vérifier la connexion au backend
docker compose exec frontend wget -O- http://backend:5000/health

# Rebuild du frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

### MongoDB plante ou se remplit

```bash
# Vérifier l'espace disque
df -h

# Taille de la DB
docker exec financepilot-mongodb mongosh --eval "db.stats(1024*1024)"

# Nettoyer les vieux refresh tokens
docker exec financepilot-mongodb mongosh financepilot --eval "
  db.users.updateMany(
    {},
    { \$pull: { refreshTokens: { createdAt: { \$lt: new Date(Date.now() - 30*24*60*60*1000) } } } }
  )
"
```

### Performance dégradée

```bash
# Vérifier les ressources
docker stats

# Analyser les logs lents
grep "duration" backend/logs/combined-*.log | sort -k6 -n | tail -20

# Vérifier les indexes MongoDB
docker exec financepilot-mongodb mongosh financepilot --eval "
  db.transactions.getIndexes()
"
```

### Certificat SSL expiré

```bash
# Vérifier l'expiration
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew --force-renewal

# Redémarrer Nginx
docker compose restart frontend
```

---

## Commandes utiles

```bash
# Voir tous les containers
docker compose ps -a

# Redémarrer un service
docker compose restart backend

# Voir les ressources utilisées
docker stats

# Shell dans un container
docker compose exec backend sh
docker compose exec mongodb mongosh

# Copier des fichiers depuis un container
docker cp financepilot-backend:/app/logs/error.log ./

# Voir les variables d'environnement d'un container
docker compose exec backend env
```

---

## Support et aide

- **Documentation complète**: [README.md](README.md)
- **Commandes utiles**: [COMMANDES_UTILES.md](COMMANDES_UTILES.md)
- **Guide de finition**: [GUIDE_FINITION.md](GUIDE_FINITION.md)
- **Issues GitHub**: https://github.com/votre-username/financepilot/issues

---

**🎉 Félicitations! Votre application FinancePilot est maintenant en production de manière sécurisée!**

Pour toute question ou problème, consultez d'abord cette documentation et les logs.
