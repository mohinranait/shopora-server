/**
 * Money helpers.
 *
 * Money columns are Postgres numeric(12,2); the ORM reads and writes them as decimal strings
 * ("1250.50"). Do all arithmetic in integer paisa (1 BDT = 100 paisa) so sums never pick up
 * floating-point drift, and convert at the edges:
 *   DB string / client number --toPaisa--> integer paisa --fromPaisa--> DB string
 *   integer paisa --paisaToTaka--> number for API responses / display
 */

import type { Numeric } from "@prisma/orm-postgres/target/codec-types";

export type MoneyInput = string | number | null | undefined;
/** Value of a numeric(12,2) money column */
export type DbMoney = Numeric<12, 2>;
/** Value of a numeric(5,2) percentage column (e.g. commission rate) */
export type DbRate = Numeric<5, 2>;

/** Parse a money value (DB decimal string or number) into integer paisa. Null/empty → 0. */
export const toPaisa = (value: MoneyInput): number => {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`Invalid money value: ${String(value)}`);
  }
  // Work on the decimal text, not the binary float: 1.005 * 100 is 100.4999… in floating point.
  // toPrecision(15) recovers the decimal the caller meant from a JS number.
  const text = typeof value === "number" ? String(Number(value.toPrecision(15))) : value.trim();
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === "" && !match[3])) {
    // Exponent notation and the like: fall back to float maths
    const n = Number(text);
    if (!Number.isFinite(n)) throw new Error(`Invalid money value: ${String(value)}`);
    return Math.sign(n) * Math.round(Math.abs(n) * 100);
  }
  const [, sign, whole, frac = ""] = match;
  let paisa = Number(whole || "0") * 100 + Number(frac.slice(0, 2).padEnd(2, "0"));
  // Round half away from zero on the third decimal
  if (Number(frac[2] ?? "0") >= 5) paisa += 1;
  return sign === "-" && paisa !== 0 ? -paisa : paisa;
};

/** Integer paisa → exact decimal string for a numeric(12,2) column */
export const fromPaisa = (paisa: number): DbMoney => formatHundredths(paisa) as DbMoney;

const formatHundredths = (paisa: number): string => {
  if (!Number.isSafeInteger(paisa)) {
    throw new Error(`Money amount must be a whole number of paisa, got ${paisa}`);
  }
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
};

/** Integer paisa → taka as a number (for responses and display) */
export const paisaToTaka = (paisa: number): number => paisa / 100;

/** Any money value → taka number rounded to 2 decimals */
export const toTaka = (value: MoneyInput): number => paisaToTaka(toPaisa(value));

/** Any money value → DB decimal string */
export const toDb = (value: MoneyInput): DbMoney => fromPaisa(toPaisa(value));

/** Like toDb, but keeps null/undefined as null (optional money columns) */
export const toDbOrNull = (value: MoneyInput): DbMoney | null =>
  value === null || value === undefined || value === "" ? null : toDb(value);

/** Percentage (e.g. 12.5) → DB decimal string for a numeric(5,2) column */
export const toDbRate = (value: MoneyInput): DbRate => formatHundredths(toPaisa(value)) as DbRate;

/** Like toDbRate, but keeps null/undefined as null */
export const toDbRateOrNull = (value: MoneyInput): DbRate | null =>
  value === null || value === undefined || value === "" ? null : toDbRate(value);

/** `rate` percent of an amount in paisa, rounded half away from zero to whole paisa */
export const percentOfPaisa = (paisa: number, rate: MoneyInput): number => {
  const raw = (paisa * toPaisa(rate)) / 10000; // rate in hundredths of a percent
  return Math.sign(raw) * Math.round(Math.abs(raw));
};

/**
 * JSON keys that hold money (or a numeric(…,2) rate). Express's `json replacer` uses this to send
 * them as numbers, keeping the API contract the frontend already relies on.
 */
const MONEY_KEYS = new Set([
  "price",
  "basePrice",
  "comparePrice",
  "costPrice",
  "subtotal",
  "discount",
  "shippingFee",
  "shippingCost",
  "tax",
  "totalAmount",
  "totalPrice",
  "commissionRate",
  "commissionAmount",
  "sellerEarnings",
  "refundAmount",
  "balance",
  "pendingBalance",
  "totalWithdrawn",
  "totalEarnings",
  "totalCommissionPaid",
  "amount",
  "discountValue",
  "minOrderAmount",
  "maxDiscountAmount",
]);

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/;

export const moneyJsonReplacer = (key: string, value: unknown) =>
  typeof value === "string" && MONEY_KEYS.has(key) && DECIMAL_TEXT.test(value) ? Number(value) : value;

/** Largest value a numeric(12,2) column holds */
export const MAX_MONEY = 9_999_999_999.99;
