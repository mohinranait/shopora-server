import { z } from "zod";
import { MAX_MONEY } from "./money.ts";

/**
 * Zod schema for a money amount from a client: at most 2 decimal places and within what a
 * numeric(12,2) column can store. Chain `.positive()` / `.nonnegative()` as needed.
 */
export const zMoney = () =>
  z
    .number()
    .multipleOf(0.01, "Amount can have at most 2 decimal places")
    .max(MAX_MONEY, "Amount is too large");

/** Zod schema for a percentage between 0 and 100 with at most 2 decimals */
export const zPercent = () =>
  z.number().min(0).max(100, "Percentage cannot exceed 100").multipleOf(0.01, "Percentage can have at most 2 decimal places");
