import { db } from "../config/db.ts";

/** Run a raw single-row query (e.g. an aggregate) and return its row */
export const firstRow = async <T>(plan: any): Promise<T | undefined> => {
  for await (const row of db.runtime().query(plan)) return row as T;
  return undefined;
};

/** Same as firstRow, but runs on a transaction (e.g. for SELECT … FOR UPDATE) */
export const firstRowIn = async <T>(tx: any, plan: any): Promise<T | undefined> => {
  for await (const row of tx.query(plan)) return row as T;
  return undefined;
};
