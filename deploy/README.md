# Deploying the Shopora API

## 1. Environment
Set these on the server (see `.env.example` for all variables):

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` (also the default when unset) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ chars each, different — `openssl rand -hex 32` |
| `CLIENT_URL` | Storefront origin, e.g. `https://shopora.com` |
| `CORS_ORIGINS` | Optional extra origins, comma separated |
| `TRUST_PROXY` | Number of proxies in front of the app (default `1`) |
| `ESCROW_RELEASE_INTERVAL_MINUTES` | How often matured 7-day escrow is released to seller balances (default `60`, `0` disables) |
| `CLOUDINARY_*` | Image storage credentials |

The server refuses to start in production if a required secret is missing or weak.

## 2. Database schema (once per release that changes `prisma/*.prisma`)
Run from a checkout with dev dependencies installed, pointing at the production database:

```bash
DATABASE_URL=... npm run db:update
```

This installs the `pg_trgm` extension and creates/updates tables and indexes. Use
`npx prisma db update --dry-run` first to review the plan.

### One-time: money columns Float → numeric(12,2)
This release changes every money column to `numeric(12,2)` (commission rates to `numeric(5,2)`).
Postgres converts the existing values in place (`ALTER COLUMN … TYPE numeric(12,2) USING …`), but
Prisma asks for explicit consent for each type change. Take a backup first, then:

```bash
# 1. Review the plan (34 type changes + 15 defaults, no drops)
DATABASE_URL=... npx prisma db update --dry-run
# 2. Apply, consenting to each type change the plan lists
DATABASE_URL=... npx prisma db update --yes $(npx prisma db update --dry-run --format json 2>/dev/null \
  | grep '"kind":"result"' | node -e 'const r=JSON.parse(require("fs").readFileSync(0)).envelope.result;
    console.log(r.dataLoss.map(d=>`--delete ${d.subject.model}.${d.subject.field}`).join(" "))')
```

Values with more than 2 decimals would be rounded; amounts above 9,999,999,999.99 would fail.
Check before migrating if unsure.

## 3. Run
**Docker**
```bash
docker build -t shopora-api .
docker run -d --env-file .env.production -p 5000:5000 --restart unless-stopped shopora-api
```

**Without Docker** (Node 24+, e.g. under PM2 or systemd)
```bash
npm ci --omit=dev
NODE_ENV=production node src/index.ts
```

Health check for load balancers / uptime monitors: `GET /api/health` (200 healthy, 503 when the DB is down).

## Tests
`npm test` (360° workflow audit) and `npm run test:money` (exact money maths, escrow and payout
concurrency) need a seeded local test database. CI runs both against a throwaway Postgres on every push.

## Frontend (Next.js)
- `NEXT_PUBLIC_API_URL` must point at the versioned API, e.g. `https://api.shopora.com/api/v1`
  (the un-versioned `/api/*` routes were removed).
- The storefront's origin must be `CLIENT_URL` (or listed in `CORS_ORIGINS`), otherwise the browser blocks API calls.

## Notes
- Rate limits are kept in memory per process. With more than one instance, move them to a shared store (Redis).
- Put the API behind HTTPS (Nginx, Caddy or the platform's load balancer).
