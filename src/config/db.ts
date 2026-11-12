import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../../prisma/contract';
import contractJson from '../../prisma/contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  poolOptions: {
    // Fail fast instead of hanging requests when the database is unreachable
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  },
});
