# 🚀 Mizania Business Suite

Flexible business system for keeping records and tracking sales, customers, stock, purchasing, and finances. Each company name remains its own workspace inside Mizania.

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL 17+ (local installation)
- Redis (optional, for caching)

### Setup

1. **Install Dependencies**
   ```bash
   # Backend
   cd genuine-backend
   pnpm install
   pnpm db:generate

   # Frontend
   cd ../genuine-frontend
   pnpm install
   ```

2. **Database Setup**
   ```bash
   # Start the PostgreSQL Windows service first if it is stopped, then:
   psql -U postgres -h localhost -p 5432

   # At the psql prompt, create a dedicated application account.
   # `\password` prompts for the password without putting it in shell history.
   CREATE ROLE lastmateru WITH LOGIN;
   \password lastmateru
   CREATE DATABASE genuine OWNER lastmateru;
   \c genuine

   # Enable extensions while connected as the PostgreSQL administrator.
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```

   Set `DATABASE_URL` in `genuine-backend/.env` to
   `postgresql://lastmateru:<URL-encoded-password>@localhost:5432/genuine?schema=public`.
   URL-encode reserved characters in the password (for example, `@` becomes `%40`).
   Keep the real connection string only in the ignored `.env` file; do not commit it.

3. **Run Migrations**
   ```bash
   cd genuine-backend
   pnpm db:migrate:deploy
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd genuine-backend
   pnpm start:dev

   # Terminal 2: Frontend
   cd genuine-frontend
   pnpm dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3002

## Project Structure

```
genuine-liquor-store/
├── genuine-backend/     # NestJS backend
├── genuine-frontend/    # Next.js frontend
└── docker-compose.yml  # Docker services (Redis only)
```

## Key Technologies

- **Backend**: NestJS, TypeScript, PostgreSQL, Prisma
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Database**: PostgreSQL 18 (local)
- **Cache**: Redis (optional)
- **Package Manager**: pnpm

## Development Commands

### Backend
```bash
pnpm start:dev        # Start development server
pnpm build            # Build for production
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
pnpm test             # Run tests
pnpm db:migrate:deploy # Apply committed migrations to the database
pnpm db:migrate       # Create/apply dev migrations (requires CREATEDB privilege)
pnpm db:studio        # Open Prisma Studio
```

### Frontend
```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
```

### Database Configuration

The project uses a local PostgreSQL installation. Create a dedicated `lastmateru`
login and `genuine` database using the setup steps above. Keep credentials in
`genuine-backend/.env` and out of source control.

## Color Scheme (Vault-Inspired)

- **Primary Dark**: #1A1A1A (Sidebar)
- **Primary Light**: #FFFFFF (Main Content)
- **Accent Yellow**: #FFD700 (Highlights, CTAs)
- **Success Green**: #22C55E (Positive, Stock)
- **Warning Orange**: #F97316 (Warnings, Low Stock)
- **Error Red**: #EF4444 (Errors, Critical)

## Documentation

- [Phase 0: Business Rules](https://claude.ai/chat/PHASE_0_RULES.md)
- [Phase 1: Project Setup](https://claude.ai/chat/PHASE_1_SETUP.md)
- [Phase 2: Database Schema](https://claude.ai/chat/PHASE_2_SCHEMA.md)

## Status

Phase 1 ✅ — Project Setup Complete

---

## ✅ PHASE 1 COMPLETE CHECKLIST

✅ Backend project initialized with pnpm
✅ Frontend project initialized with pnpm
✅ Folder structure created (organized by modules)
✅ TypeScript configuration optimized
✅ Environment files (.env, .env.production)
✅ Local PostgreSQL configuration (no Docker)
✅ Tailwind CSS configured (Vault-inspired colors)
✅ Prisma ORM configured and migrated
✅ ESLint & Prettier configured
✅ Git initialized with first commit
✅ All development servers tested & running
✅ Documentation created

---

## 🎯 WHAT'S NEXT

**Phase 2 (Next):** Complete database schema with 45+ models

**Phase 3:** NestJS modules, middleware, guards, pipes

**Phase 4:** Authentication (JWT + RBAC)

---

**PHASE 1 COMPLETE! 🚀**
