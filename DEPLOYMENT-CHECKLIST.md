# Production deployment checklist

Code is prepared to run locally and in a container-based cloud host. Cloud-specific credentials,
database URL, and final service domains must be supplied in the provider dashboard before the live
deployment checks can turn green.

## Code readiness

- [x] Frontend and backend have separate standard multi-stage Dockerfiles and Docker ignore files.
- [x] Backend binds to the host-provided `PORT` and `0.0.0.0`; local `API_PORT` remains supported.
- [x] Frontend takes `NEXT_PUBLIC_API_URL` at build time and rejects localhost/example URLs for production builds.
- [x] Backend accepts a standard Postgres `DATABASE_URL`, validates production HTTPS origins, and rejects local/example production URLs.
- [x] Backend production install includes Prisma CLI and the image includes committed migrations.
- [x] Deployment guide covers Railway, Render, and any Docker host, including release migration command and secret setup.
- [x] Production seed scripts are explicitly excluded from deployment instructions.
- [x] 390 px mobile dashboard layout review marked green in Phase 25 checklist after user confirmation.
- [x] Backend Prisma Client generation and Nest production compilation passed locally.
- [x] Frontend TypeScript check passed locally.
- [ ] Frontend optimized production build and Docker image build are verified on a host with Docker/build filesystem permissions. Local Next build hit Windows `EPERM` while creating `.next` output, and local Docker Engine is unavailable.

## Live deployment (pending provider and database values)

- [ ] Create/provision a managed PostgreSQL database; record its production URL in the API secret store only.
- [ ] Create the API service from `genuine-backend/`; set production mode, three unique JWT secrets, database URL, frontend CORS origin, and frontend reset-link URL.
- [ ] Run `pnpm db:migrate:deploy` as the platform release/pre-deploy command or from a one-off API container.
- [ ] Confirm API health at `/api/v1/health` and verify it reaches the managed database.
- [ ] Create the web service from `genuine-frontend/`; set build argument `NEXT_PUBLIC_API_URL=https://<api-domain>/api/v1`.
- [ ] Confirm web `/login`, registration/login, an authenticated database read, and CORS from the deployed domain.
- [ ] Add the chosen domains and HTTPS, update origins if needed, and rebuild the web service after any API URL change.
- [ ] Return to the paused Phase 25 UI checklist and continue the remaining access fallback and settings manual checks.
