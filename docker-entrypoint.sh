#!/bin/sh
set -e

# Script d'entrypoint pour le container frontend
# Permet d'injecter des variables d'environnement au runtime

# Remplacer les variables d'environnement dans les fichiers JS
if [ -n "$VITE_API_URL" ]; then
    echo "Configuring API URL: $VITE_API_URL"
    find /usr/share/nginx/html -type f -name '*.js' -exec sed -i "s|http://localhost:5000/api|$VITE_API_URL|g" {} \;
fi

# Remplacer les variables dans la config Nginx
if [ -n "$BACKEND_URL" ]; then
    sed -i "s|\${BACKEND_URL}|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
else
    sed -i "s|\${BACKEND_URL}|http://backend:5000|g" /etc/nginx/conf.d/default.conf
fi

# Créer le fichier health pour le healthcheck
echo "OK" > /usr/share/nginx/html/health

echo "Starting Nginx..."
exec "$@"
