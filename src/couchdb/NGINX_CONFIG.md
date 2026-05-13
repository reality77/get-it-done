# Configuration NGINX — get-it-done

## Architecture de déploiement

```
Navigateur (GitHub Pages)          Serveur backend
────────────────────────           ────────────────────────────────────────
https://reality77.github.io   ←→  NGINX (SSL)
  /get-it-done/                      ├─ /couchdb/  → CouchDB :5984
                                     └─ /api/push/ → push-server :3000
```

Le frontend est servi par GitHub Pages. **Toutes les requêtes vers le backend
sont cross-origin** : CORS est obligatoire à trois niveaux.

---

## Niveau 1 — CouchDB : `local.ini`

Copier `local.ini.example` → `local.ini` et vérifier :

```ini
[httpd]
enable_cors = true

[cors]
origins = https://reality77.github.io,http://localhost:5173
credentials = true
methods = GET, PUT, POST, HEAD, DELETE, OPTIONS
headers = accept, authorization, content-type, origin, referer
```

Points critiques :
- `origins` : liste exacte sans slash final ni espace autour des virgules.
- `credentials = true` : requis car PouchDB utilise `credentials: 'include'`.
- `OPTIONS` dans `methods` : requis pour le preflight navigateur.

---

## Niveau 2 — Push-server : variable d'environnement

Dans `docker-compose.yml` (ou `.env`) :

```ini
CORS_ORIGINS=https://reality77.github.io
```

Le push-server autorise uniquement cette origine. Les requêtes depuis
`localhost:5173` (dev) doivent être ajoutées séparément si nécessaire :

```ini
CORS_ORIGINS=https://reality77.github.io,http://localhost:5173
```

---

## Niveau 3 — NGINX : proxy avec cookie cross-site

```nginx
# ── HTTP → HTTPS ──────────────────────────────────────────────────────────────
server {
    listen 80;
    server_name monbackend.com;
    return 301 https://$host$request_uri;
}

# ── HTTPS ─────────────────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name monbackend.com;

    ssl_certificate     /etc/letsencrypt/live/monbackend.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monbackend.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # ── Push-server ───────────────────────────────────────────────────────────
    # SANS slash final sur proxy_pass : conserve le préfixe /api/push/
    # Le push-server reçoit /api/push/subscribe (pas /subscribe).
    location /api/push/ {
        proxy_pass         http://getitdone-push:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # ── CouchDB ───────────────────────────────────────────────────────────────
    # AVEC slash final sur proxy_pass : NGINX retire /couchdb du chemin.
    # /couchdb/_session       →  http://getitdone:5984/_session
    # /couchdb/get-it-done    →  http://getitdone:5984/get-it-done
    location /couchdb/ {
        proxy_pass         http://getitdone:5984/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Ajoute Secure + SameSite=None sur AuthSession.
        # Obligatoire pour que le navigateur envoie le cookie dans les
        # requêtes cross-site (GitHub Pages → backend).
        proxy_cookie_flags ~ secure samesite=none;

        # Long-polling pour le _changes feed (réplication PouchDB live)
        proxy_read_timeout 600s;
        proxy_buffering    off;
    }
}
```

> **Note :** ce serveur ne sert pas de fichiers statiques — GitHub Pages s'en charge.

---

## Variables de build frontend

Ces variables sont **embarquées dans le bundle au moment du build** par Vite.
Créer `src/get-it-done/.env.production` avant `npm run build` :

```ini
VITE_COUCH_URL=https://monbackend.com/couchdb
VITE_PUSH_SERVER_URL=https://monbackend.com
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID>
VITE_COUCH_USER=admin
```

---

## Flux CORS complet (preflight + requête)

```
GitHub Pages                    NGINX / backend
────────────────────────────    ────────────────────────────────────────
OPTIONS /api/push/subscribe
  Origin: https://reality77.github.io
  Access-Control-Request-Method: POST   ──────────────────────────────▶
                                         push-server (@fastify/cors)
                                         vérifie CORS_ORIGINS ✓
                                         ◀──────────────────────────────
                                         204 No Content
                                         Access-Control-Allow-Origin: https://reality77.github.io
                                         Access-Control-Allow-Credentials: true

POST /api/push/subscribe
  Cookie: AuthSession=…
  Origin: https://reality77.github.io   ──────────────────────────────▶
                                         requireAuth → valide cookie
                                         ◀──────────────────────────────
                                         201 Created
```

---

## Checklist de déploiement

- [ ] `local.ini` créé depuis `local.ini.example` avec l'origine GitHub Pages
- [ ] CouchDB redémarré après modification de `local.ini`
- [ ] `CORS_ORIGINS=https://reality77.github.io` dans l'environnement du push-server
- [ ] Build frontend avec `.env.production` (vérifier `VITE_PUSH_SERVER_URL`)
- [ ] Cookie `AuthSession` : vérifier `SameSite=None; Secure` dans les DevTools
