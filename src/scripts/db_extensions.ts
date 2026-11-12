/**
 * Install the Postgres extensions the contract depends on.
 * `prisma db update` does not create extensions, so run this first on every new database:
 *   npm run db:extensions && npx prisma db update
 */
import { db } from "../config/db.ts";

// pg_trgm: backs the gin_trgm_ops indexes used for ILIKE '%term%' product search
await db.runtime().execute(db.raw.sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.affectedCount().build());
console.log("Extensions ready: pg_trgm");
await db.close();
