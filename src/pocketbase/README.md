# PocketBase Backend — make-it-done

PocketBase provides the sync backend for make-it-done. It stores checklists in a shared account so they're available across devices.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose

## 1. Start PocketBase

```bash
cd src/pocketbase
docker compose up -d
```

PocketBase is now running at `http://localhost:8090`.

## 2. Create the Admin Account

Open `http://localhost:8090/_/` in your browser.

On first visit you'll be prompted to create an admin email and password. This is separate from the app user — keep these credentials safe.

## 3. Create the `checklists` Collection

In the admin UI: **Collections → New collection**

- **Name:** `checklists`
- **Type:** Base collection

Add the following fields:

| Field name   | Type   | Options                        |
|-------------|--------|--------------------------------|
| `app_id`     | Text   | Required, check "Unique"       |
| `kind`       | Text   | Required                       |
| `title`      | Text   | Required                       |
| `items`      | JSON   | —                              |
| `archived`   | Bool   | Default: false                 |
| `created_at` | Text   | —                              |
| `archived_at`| Text   | —                              |
| `template_id`| Text   | —                              |
| `run_label`  | Text   | —                              |

**Set API rules** (click the lock icon for each rule):

- List, View, Create, Update, Delete: `@request.auth.id != ""`

This restricts all access to authenticated users only.

## 4. Create the App User

In the admin UI: **Users → New record**

- **Email:** `user@make-it-done.app` (or whatever you'll set as `VITE_PB_USER_EMAIL`)
- **Password:** choose a strong password — this is what you'll enter in the app

## 5. Configure the Frontend

```bash
cd src/make-it-done
cp .env.example .env
```

Edit `.env`:

```
VITE_PB_URL=http://localhost:8090
VITE_PB_USER_EMAIL=user@make-it-done.app
```

If PocketBase is on a different host or port, update `VITE_PB_URL` accordingly.

## 6. First Launch

Start the frontend:

```bash
cd src/make-it-done
npm run dev
```

On first load the app shows a password prompt — enter the password you set in step 4. The app will unlock and sync any existing local data to PocketBase.

On subsequent loads the auth token is restored automatically (no password prompt).

## Offline Behaviour

The app works fully without PocketBase. When the backend is unavailable:

- All changes are saved locally as usual
- The sync status indicator in the header turns grey
- The app retries connecting every 1 s, 5 s, 10 s, then every 60 s
- When the backend comes back, offline edits are pushed automatically

## Production Notes

- Use a reverse proxy (nginx, Caddy, Traefik) in front of port 8090 with HTTPS
- Set `VITE_PB_URL` to the public HTTPS URL before building the frontend
- **Never expose the admin UI (`/_/`) publicly** — restrict it by IP or disable it after setup
- The `pb_data/` directory contains all database files — back it up regularly

## Stopping / Restarting

```bash
docker compose stop      # pause
docker compose start     # resume
docker compose down      # stop and remove containers (data preserved in pb_data/)
docker compose down -v   # stop and DELETE all data
```
