# push-server

Node.js / Fastify server that sends Web Push notifications for the **get-it-done** app.

## Single-account architecture

The entire system (CouchDB database + push server) is designed for **one account**.

- The CouchDB database `get-it-done` has no per-user document ownership. All authenticated
  users see and modify the same data. There is no mechanism to scope tasks to a specific user.
- The push scheduler (`scheduler.ts`) uses `sendToAll` for snooze alerts and task reminders,
  which broadcasts to every registered subscription. With a single account this is correct
  ("all my devices receive my reminders"); with multiple accounts it would leak task contents
  across users.

### `ALLOWED_USERS` — subscription allowlist

The env var `ALLOWED_USERS` (comma-separated CouchDB usernames, default: `admin`) restricts
which CouchDB users may call `POST /api/push/subscribe`. Any session authenticated as a user
not in this list receives `403 Forbidden`.

This is the enforced guard against the multi-user leak: `sendToAll` is safe only when every
subscription belongs to the same account, and `ALLOWED_USERS` ensures that.

**Examples:**

```
# Default — only the 'admin' account may subscribe (recommended for home-server deployments)
ALLOWED_USERS=admin

# Single named user (non-admin CouchDB account)
ALLOWED_USERS=alice

# Multiple users — only safe if those users deliberately share the same task database
ALLOWED_USERS=alice,bob
```

### Multi-account support

Supporting multiple independent users would require:

1. Per-user CouchDB databases (one `get-it-done-<userId>` DB per account).
2. Per-user scheduler scoping (each scan restricted to the owning user's DB).
3. Replacing `sendToAll` with `sendToUser` in `runSnoozeCheck` and `runTaskReminders`.

This is a full product redesign and is out of scope for the current version.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `COUCH_URL` | `http://localhost:5984` | CouchDB base URL |
| `COUCH_USER` | `admin` | CouchDB admin username |
| `COUCH_PASSWORD` | *(empty — warns on startup)* | CouchDB admin password |
| `VAPID_PUBLIC_KEY` | *(required)* | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | *(required)* | VAPID private key for Web Push |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | VAPID contact URI |
| `ALLOWED_USERS` | `admin` | Comma-separated CouchDB usernames allowed to subscribe |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `PORT` | `3000` | HTTP port to listen on |

## Running

```bash
npm install
npm run build
node dist/index.js
```
