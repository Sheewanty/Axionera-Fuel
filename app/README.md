# FuelStation OS

Fuel station management platform for GOIL Ghana Ltd.  
Built with Next.js 16, Auth.js v5, Prisma 6, PostgreSQL, and TypeScript.

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally (or Docker)
- A `.env.local` file — **Next.js does NOT load `.env.example` automatically**

### 1. Install dependencies

```bash
cd app
npm install
```

### 2. Create `.env.local`

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/fuelstation_dev
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000
NODE_ENV=development

# Optional — only needed in staging/production for Redis rate limiting.
# In development the rate limiter falls back to in-memory (no Redis needed).
# UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your_token
```

> **`.env.local` is gitignored and never committed.**  
> `.env.local.example` is the committed template. Next.js only auto-loads `.env.local`,
> `.env.development`, `.env.production` — never `.env.example`.

### 3. Start PostgreSQL

If using Docker:

```bash
docker run --name fuelstation-pg \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=fuelstation_dev \
  -p 5432:5432 \
  -d postgres:15
```

Or start your local PostgreSQL service.

### 4. Run migrations

```bash
npx prisma migrate dev
```

### 5. Seed demo data

```bash
npx prisma db seed
```

This creates:
- Tenant: **GOIL Ghana Ltd**
- Stations: Accra Main, Kumasi North, Takoradi South
- Demo users (passwords printed to terminal on first seed run)

> **Guard:** The seed script refuses to run when `NODE_ENV=production`.

### 6. Start the dev server

```bash
npm run dev
```

App available at [http://localhost:3000](http://localhost:3000).  
Unauthenticated routes redirect to `/login`.

### 7. Sign in

Use the demo credentials printed by the seed script.  
The login page expects **email + password** — tenant is derived from the user's
membership after authentication, not entered on the login form.

---

## Common Issues

### Login shows raw JSON / 500 error

**Cause:** Prisma cannot reach PostgreSQL (`localhost:5432`).  
**Fix:**
1. Ensure PostgreSQL is running
2. Verify `DATABASE_URL` in `.env.local` is correct
3. Run migrations: `npx prisma migrate dev`
4. Restart the dev server

### `npm run build` fails with Prisma DLL rename lock (Windows)

**Cause:** The Next.js dev server holds the Prisma native engine open on Windows,
preventing `prisma generate` from replacing it.  
**Fix:** Stop the dev server first, then run `npm run build`.

### `npx prisma validate` fails with `DATABASE_URL not found`

**Cause:** `prisma validate` reads env vars but `.env.local` may not be loaded outside
the Next.js runtime.  
**Fix:** Ensure `DATABASE_URL` is set in your shell, or prefix: `dotenv -e .env.local -- npx prisma validate`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Production build (stop dev server first on Windows) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Vitest unit tests |

---

## Architecture Notes

- **Auth:** Auth.js v5 with Credentials provider. JWT maxAge = 30 min.
- **Proxy:** `src/proxy.ts` — Next.js 16 edge route guard (renamed from `middleware.ts`).
- **Session:** Short JWT + live DB re-check on every write via `requireWriteAccess()`.
- **Mutations:** All domain writes go through `withMutation()` / `withApproval()` in
  `src/lib/mutation.ts`: session → access check → `prisma.$transaction(domain write + audit log)`.
- **Tenant isolation:** Every Prisma query in the service layer includes `tenantId` in
  its `where` clause. No raw Prisma calls from pages or Server Actions.
- **Rate limiting:** Login limited to 5 attempts / 15-min window. Dev: in-memory.
  Prod: Upstash Redis (fail-closed if not configured).

---

## Security Notes

- **No tenant selector on the login page** — tenants are derived from user membership
  after authentication. Public tenant selectors enable tenant enumeration.
- **Station switching** is available post-login in the app header for OWNER/ADMIN
  users with multi-station access (M4 roadmap).
- `explicit_grant` access level is currently nav-visibility-only; server-side
  enforcement requires a `PermissionGrant` table (M4 backlog).
