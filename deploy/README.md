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
| `CLOUDINARY_*` | Image storage credentials |

The server refuses to start in production if a required secret is missing or weak.

## 2. Database schema (once per release that changes `prisma/*.prisma`)
Run from a checkout with dev dependencies installed, pointing at the production database:

```bash
DATABASE_URL=... npm run db:update
```

This installs the `pg_trgm` extension and creates/updates tables and indexes. Use
`npx prisma db update --dry-run` first to review the plan.

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

## Notes
- Rate limits are kept in memory per process. With more than one instance, move them to a shared store (Redis).
- Put the API behind HTTPS (Nginx, Caddy or the platform's load balancer).
