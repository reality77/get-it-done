# Note about nginx config

In the `location` part, add this 
```
location /api/push/ {
    # Keep proxy_pass without trailing slash to preserve /api/push/ prefix.
    # If you use a trailing slash here, NGINX rewrites /api/push/subscribe to /subscribe.
    proxy_pass http://getitdone-push:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /couchdb/ {
    proxy_pass http://getitdone:5984/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cookie_flags ~ secure samesite=none;
}

location / {
    try_files $uri $uri/ /index.html;
}

```