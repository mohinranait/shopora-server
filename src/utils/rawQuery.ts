import { db } from "../config/db.ts";

/** Run a raw single-row query (e.g. an aggregate) and return its row */
export const firstRow = async <T>(plan: any): Promise<T | undefined> => {
  for await (const row of db.runtime().query(plan)) return row as T;
  return undefined;
};
