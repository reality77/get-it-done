# Configuration NGINX — get-it-done

L'objectif est de faire passer **toutes les requêtes par le même domaine** (même schème + hôte + port). Ainsi le navigateur ne déclenche jamais de preflight OPTIONS/CORS : l'app Vue, CouchDB et le push-server ont la même origine.

```
https://mondomaine.com/get-it-done/   → fichiers statiques Vue SPA
https://mondomaine.com/couchdb/       → CouchDB  (proxy → getitdone:5984)
https://mondomaine.com/api/push/      → push-server (proxy → getitdone-push:3000)
```

---

## 1. Variables d'environnement de build (frontend)

Ces variables sont **embarquées dans le bundle JavaScript au moment du build** par Vite.
Elles doivent être fixées **avant** `npm run build`.

Fichier `src/get-it-done/.env.production` (ou export dans CI) :

```ini
VITE_COUCH_URL=https://mondomaine.com/couchdb
VITE_PUSH_SERVER_URL=https://mondomaine.com
VITE_VAPID_PUBLIC_KEY=<clé publique VAPID>
VITE_COUCH_USER=admin
```

> **Attention** : si `VITE_PUSH_SERVER_URL` n'est pas défini, Vite utilise le défaut
> `http://localhost:3000` — le navigateur tente alors de joindre `localhost` sur la
> machine du visiteur, ce qui échoue systématiquement en production.

---

## 2. Variables d'environnement du push-server

Fichier `src/push-server/.env` (ou dans `docker-compose.yml`) :

```ini
VAPID_PUBLIC_KEY=<clé publique>
VAPID_PRIVATE_KEY=<clé privée>
VAPID_SUBJECT=mailto:admin@mondomaine.com
COUCH_URL=http://couchdb:5984
COUCH_USER=admin
COUCH_PASSWORD=<mot de passe>
PORT=3000
# CORS_ORIGINS n'a pas besoin d'être défini en production :
# toutes les requêtes arrivent depuis le même domaine (pas d'en-tête Origin envoyé).
```

---

## 3. Bloc server NGINX complet

> Ce bloc suppose que NGINX tourne **dans un conteneur Docker** connecté au réseau
> `reverse_proxy_network` (il peut donc joindre `getitdone` et `getitdone-push`
> par leur hostname Docker). Adaptez les `proxy_pass` si NGINX est sur l'hôte
> (utilisez `localhost:5984` / `localhost:3000`).

```nginx
# ── Redirection HTTP → HTTPS ──────────────────────────────────────────────────
server {
    listen 80;
    server_name mondomaine.com;
    return 301 https://$host$request_uri;
}

# ── HTTPS ─────────────────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    server_name mondomaine.com;

    ssl_certificate     /etc/letsencrypt/live/mondomaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mondomaine.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # ── Push-server ───────────────────────────────────────────────────────────
    # proxy_pass SANS slash final : NGINX conserve le préfixe /api/push/
    # Le push-server reçoit bien /api/push/subscribe (pas /subscribe).
    location /api/push/ {
        proxy_pass         http://getitdone-push:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # ── CouchDB ───────────────────────────────────────────────────────────────
    # proxy_pass AVEC slash final : NGINX supprime /couchdb du chemin.
    # /couchdb/_session  →  http://getitdone:5984/_session
    # /couchdb/get-it-done/_changes  →  http://getitdone:5984/get-it-done/_changes
    location /couchdb/ {
        proxy_pass         http://getitdone:5984/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Ajoute Secure + SameSite=None sur le cookie AuthSession de CouchDB
        # pour qu'il soit transmis dans tous les contextes HTTPS.
        proxy_cookie_flags ~ secure samesite=none;

        # Nécessaire pour le _changes feed de la réplication PouchDB live
        # (connexion longue, pas de tampon intermédiaire).
        proxy_read_timeout 600s;
        proxy_buffering    off;
    }

    # ── SPA Vue (fichiers statiques) ──────────────────────────────────────────
    # Déployez le contenu de dist/ dans /var/www/get-it-done/
    # (index.html, assets/, sw.js, pwa-*.png…)
    location /get-it-done/ {
        root /var/www;   # NGINX cherche /var/www/get-it-done/<fichier>
        try_files $uri $uri/ /get-it-done/index.html;

        # Cache long pour les assets Vite (noms avec hash content-addressable)
        location ~* \.(js|css|woff2?|png|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Redirige la racine vers l'app
    location = / {
        return 301 /get-it-done/;
    }
}
```

---

## 4. Déploiement des fichiers statiques

```bash
# Dans src/get-it-done/ (après avoir défini les variables .env.production)
npm run build

# Copier le contenu de dist/ sur le serveur
rsync -av dist/ user@mondomaine.com:/var/www/get-it-done/
```

---

## 5. Pourquoi cette config élimine les problèmes CORS

| Requête navigateur | Origine | Destination | Même origine ? |
|---|---|---|---|
| `POST /api/push/subscribe` | `https://mondomaine.com` | `https://mondomaine.com` | ✓ pas d'en-tête `Origin` |
| `POST /couchdb/_session` | `https://mondomaine.com` | `https://mondomaine.com` | ✓ pas d'en-tête `Origin` |
| Réplication PouchDB | `https://mondomaine.com` | `https://mondomaine.com` | ✓ pas d'en-tête `Origin` |

Le navigateur ne déclenche **aucun preflight OPTIONS** pour des requêtes same-origin.
Le bloc `@fastify/cors` du push-server ne voit jamais d'en-tête `Origin` → branche
`!origin → callback(null, true)` → aucune erreur 500 ou 404.

---

## 6. Flux d'authentification (résumé)

```
Navigateur                    NGINX                  CouchDB / push-server
    │                           │                           │
    │ POST /couchdb/_session     │                           │
    │ ─────────────────────────▶│                           │
    │                           │ POST /_session            │
    │                           │ ─────────────────────────▶│
    │◀─────────────────────────│ Set-Cookie: AuthSession    │
    │  Set-Cookie: AuthSession  │ (Secure; SameSite=None)   │
    │                           │                           │
    │ POST /api/push/subscribe  │                           │
    │ Cookie: AuthSession=…     │                           │
    │ ─────────────────────────▶│                           │
    │                           │ POST /api/push/subscribe  │
    │                           │ Cookie: AuthSession=…     │
    │                           │ ─────────────────────────▶│ push-server valide
    │                           │                           │ le cookie via CouchDB
    │◀─────────────────────────│◀─────────────────────────│ 201 Created
```
