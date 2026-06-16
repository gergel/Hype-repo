# HYPE Production — Client Video Portal

A premium, dark-themed client portal for delivering video projects. Clients view a
cinematic portal at `/p/{project-slug}`, stream films over HLS (no Google Drive
dependency), and download MP4s. Admins manage projects, upload videos (auto thumbnail +
HLS generation via FFmpeg), reorder, replace, set per-project passwords, and generate
share links. Projects can sync automatically from Notion.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Shadcn-style UI, Framer Motion, hls.js
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Celery + Redis (async transcoding)
- **Transcoding:** FFmpeg (thumbnail + VOD HLS)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Deploy:** Docker, Railway

## Architecture

```
            ┌─────────────┐        ┌──────────────┐
  Client ──▶│  Next.js     │  /api ▶│   FastAPI    │
            │  (frontend)  │        │   (api)      │
            └─────────────┘        └──────┬───────┘
                                          │ enqueue
                              ┌───────────▼──────────┐
                              │  Celery worker        │
                              │  (FFmpeg transcode)   │
                              └───────────┬──────────┘
                                          │ upload
   Postgres ◀── api/worker          Cloudflare R2 ◀── HLS + MP4 + thumbs
   Redis    ◀── broker
```

Video pipeline on upload:
1. API stores the original MP4 to R2 and creates a `processing` video row.
2. Celery worker downloads it, runs `ffprobe` for metadata.
3. Generates a JPEG thumbnail and VOD HLS (`master.m3u8` + `.ts` segments) with FFmpeg.
4. Uploads thumbnail, HLS, and the source MP4 to R2.
5. Marks the video `ready`. The portal streams HLS and offers the MP4 for download.

## Local development

```bash
cp backend/.env.example backend/.env      # fill in R2 + Notion + admin creds
docker compose up --build
```

- Portal: http://localhost:3000
- Admin: http://localhost:3000/admin (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- API docs: http://localhost:8000/docs

Migrations run automatically on API start (`alembic upgrade head`).

## Cloudflare R2 setup

1. Create an R2 bucket (e.g. `hype-portal`).
2. Create an R2 API token (Access Key ID + Secret).
3. Attach a public custom domain to the bucket (e.g. `media.hype.studio`) so HLS
   playlists and segments are publicly fetchable, and set `R2_PUBLIC_URL` to it.
4. Add a CORS policy on the bucket allowing `GET` from your frontend origin.

## Notion setup

1. Create an internal integration, copy the secret into `NOTION_API_KEY`.
2. Share the projects database with the integration; copy its id into `NOTION_DATABASE_ID`.
3. Database properties expected: **Project Name** (title), **Client Name** (text),
   **Portal Slug** (text), **Portal Cover Image** (files or url), **Portal Status**
   (select), **Portal URL** (url).
4. In the admin dashboard, click **Sync Notion** to upsert projects.

## Railway deployment

Create four services in one Railway project:

| Service   | Source        | Notes |
|-----------|---------------|-------|
| Postgres  | Railway plugin | Provides `DATABASE_URL` |
| Redis     | Railway plugin | Provides `REDIS_URL` |
| api       | `/backend`    | Uses `backend/railway.json` |
| worker    | `/backend`    | Set config path to `railway.worker.json` |
| web       | `/frontend`   | Uses `frontend/railway.json` |

Steps:
1. Add the Postgres and Redis plugins. Reference their variables in api + worker.
2. Deploy `api` and `worker` from the `backend` directory. Set all env vars from
   `backend/.env.example`. For the worker, point its config file to `railway.worker.json`.
3. Deploy `web` from `frontend`. Set `NEXT_PUBLIC_API_URL` to the public api URL.
4. Set the api's `FRONTEND_URL` to the web service's public URL (for CORS + share links).
5. The api start command runs migrations automatically.

## Environment variables

See `backend/.env.example` and `frontend/.env.example`. Key ones:

- `SECRET_KEY` — JWT signing secret (use a long random string).
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — seeded admin account on first boot.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- `NOTION_API_KEY`, `NOTION_DATABASE_ID`.
- `FRONTEND_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend).

## Admin features

- Create / edit projects (title, client, description, cover, slug, status).
- Upload videos (multiple at once) — thumbnail + HLS generated automatically.
- Drag to reorder; replace a video in place; delete.
- Set, change, or clear a per-project password.
- Generate / regenerate a share link (`/p/{slug}?share={token}`) that bypasses the password.
- Sync projects from Notion.

## Notes

- HLS is single-rendition VOD by default. For adaptive bitrate, extend `make_hls` in
  `backend/app/services/transcode.py` with multiple `-map`/`-var_stream_map` renditions.
- Password unlock returns a project-scoped JWT stored in `sessionStorage`; the portal
  sends it back to fetch the unlocked payload.
