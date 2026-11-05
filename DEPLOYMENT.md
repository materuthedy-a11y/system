# Deployment guide (Railway Railpack or another Node build host)

**Current state:** platform buildpacks and production environment checks are configured without Dockerfiles.
No cloud deployment has been created yet because this workspace does not have a production database
URL, cloud account configuration, or deployed service domains. Track the remaining live steps in
[`DEPLOYMENT-CHECKLIST.md`](DEPLOYMENT-CHECKLIST.md).

Mizania supports local development and production from the same code. Local runs can keep
`http://localhost` values in ignored `.env` files. Production builds require a real HTTPS API
URL, and the backend requires a real PostgreSQL connection URL; the app does not silently fall
back to local services in production.

## Railway services (Railpack; no Dockerfile)

Deploy two services from this repository and set the matching root directory for each service:

| Service | Root directory | Build command | Start command | Health check |
| --- | --- | --- | --- | --- |
| API | `/genuine-backend` | `pnpm build` | `pnpm start:prod` | `/api/v1/health` |
| Web | `/genuine-frontend` | `pnpm build` | `pnpm start -- --hostname 0.0.0.0` | `/login` |

Clear any old Dockerfile override such as `RAILWAY_DOCKERFILE_PATH` from the service. Set the API
root directory to `/genuine-backend` and web root directory to `/genuine-frontend`; leaving either
root blank points Railpack at the repository root instead of that service's lockfile.

Railway Railpack detects Node and pnpm from each service directory, reads the committed lockfile
and `pnpm-workspace.yaml`, installs dependencies, and runs the configured build/start commands.
Both projects require Node 22.13 or newer for pinned pnpm 11. Set `NEXT_PUBLIC_API_URL` as a
frontend service variable before building because Next.js embeds it into the browser bundle.
Railway variables are available during the build.

## Required API environment

Set these in the API service's secret/environment settings. Do not commit production values.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL URL for Neon, Render, or another PostgreSQL provider |
| `JWT_SECRET` | Unique random secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | A different unique random secret, at least 32 characters |
| `JWT_RESET_SECRET` | Another unique random secret, at least 32 characters |
| `CORS_ORIGIN` | Frontend HTTPS origin(s), comma separated if using more than one |
| `FRONTEND_URL` | Primary frontend HTTPS origin, used for password reset links |

The host-provided `PORT` is used automatically; `API_PORT=3002` remains the local fallback.
Optional settings such as `SESSION_IDLE_TIMEOUT`, `SESSION_ABSOLUTE_TIMEOUT`,
`JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`, `ALLOW_NEGATIVE_STOCK`,
`DEFAULT_COSTING_METHOD`, and `LOG_LEVEL` have validated defaults. If notification provider
credentials are configured, also set `NOTIFICATION_CONFIG_ENCRYPTION_KEY` to a persistent random
value of at least 32 characters. Keep that key stable so saved notification credentials remain
decryptable after redeploys.

Generate separate secrets locally with Node (run once per JWT variable; do not share or commit
the output):

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Required web environment

Set `NEXT_PUBLIC_API_URL` to the API's HTTPS URL plus `/api/v1`, for example:

```text
https://your-api-host.example/api/v1
```

Set it as a frontend service variable before the build. It is intentionally public and must not
contain secrets. The web server binds to `0.0.0.0` and honors the hosting platform's `PORT`.

## Database and migrations

Use a managed PostgreSQL database and supply its URL as `DATABASE_URL`. Neon works with the
standard PostgreSQL URL; use its direct connection URL for this long-running NestJS service and
for migrations. If choosing a pooled Neon URL later, keep a separate direct URL for migration
commands. Render Postgres works too: use its internal URL only when the API is also on Render in
the same region; otherwise use its external URL and SSL option. Keep credentials URL-encoded if
they contain reserved characters.

Set the API service's pre-deploy command to apply committed migrations before the release:

```sh
pnpm db:migrate:deploy
```

The API dependencies include Prisma CLI and the repository includes the migration files. Use
`prisma migrate deploy` only; do not run
`prisma migrate dev`, `prisma db push`, or the development seed scripts against production.
The development seed truncates data and is not a production initialization step. Create the first
production business through the app's registration flow or a reviewed, non-destructive provisioning
procedure.

## First deployment sequence

1. Create the managed PostgreSQL database and set its URL in the API service.
2. Set the three independent JWT secrets, `NODE_ENV`, and temporary frontend URLs in the API service.
3. Build/deploy the API, applying migrations through the release/pre-deploy command.
4. Copy the API HTTPS origin into `CORS_ORIGIN`; set `FRONTEND_URL` to the frontend HTTPS origin.
5. Set the web service variable `NEXT_PUBLIC_API_URL` to `https://<api-host>/api/v1`, then build/deploy web.
6. Open `/api/v1/health`, `/login`, and complete a real registration/login and database-backed read.
7. Add custom domains in the host and update `CORS_ORIGIN`, `FRONTEND_URL`, and rebuild web if the
   final API origin changed.

Do not point a deployment at the development database unless that is intentional. Local `.env`
files are ignored by Git; use the hosting provider's secret manager for production credentials.
