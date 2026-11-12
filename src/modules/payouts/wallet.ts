import { db } from "../../config/db.ts";
import { fromPaisa } from "../../utils/money.ts";

/** Changes to a seller wallet, in paisa. Positive adds, negative subtracts; omitted fields stay. */
export interface IWalletDelta {
  balance?: number;
  pendingBalance?: number;
  totalEarnings?: number;
  totalCommissionPaid?: number;
  totalWithdrawn?: number;
}

/**
 * Atomically apply deltas to a wallet and record the ledger entry, inside the caller's transaction.
 *
 * The UPDATE adds to the current column values (`balance = balance + x`), so concurrent writers
 * can never overwrite each other's changes the way read-modify-write updates do. Balances may go
 * negative: a return after the seller already withdrew leaves a debt that later earnings repay.
 *
 * With `requireBalance`, the update only applies when the available balance covers that amount
 * (checked in the same statement); returns false when it does not.
 */
export const adjustWallet = async (
  tx: any,
  walletId: string,
  delta: IWalletDelta,
  ledger: { amount: number; type: string; description: string; subOrderId?: string | null } | null,
  options: { requireBalance?: number } = {}
): Promise<boolean> => {
  const d = (v?: number) => fromPaisa(v ?? 0);
  const required = fromPaisa(options.requireBalance ?? 0);
  const { affectedRows } = await tx.execute(
    db.raw.sql`
      UPDATE "SellerWallet" SET
        "balance" = "balance" + CAST(${d(delta.balance)} AS numeric),
        "pendingBalance" = "pendingBalance" + CAST(${d(delta.pendingBalance)} AS numeric),
        "totalEarnings" = "totalEarnings" + CAST(${d(delta.totalEarnings)} AS numeric),
        "totalCommissionPaid" = "totalCommissionPaid" + CAST(${d(delta.totalCommissionPaid)} AS numeric),
        "totalWithdrawn" = "totalWithdrawn" + CAST(${d(delta.totalWithdrawn)} AS numeric),
        "updatedAt" = now()
      WHERE "id" = ${walletId} AND "balance" >= CAST(${required} AS numeric)`
      .affectedCount()
      .build()
  );
  if (affectedRows === 0) return false;

  if (ledger) {
    await tx.orm.public.WalletTransaction.create({
      walletId,
      subOrderId: ledger.subOrderId ?? null,
      amount: fromPaisa(ledger.amount),
      type: ledger.type,
      description: ledger.description,
    });
  }
  return true;
};

/**
 * Atomically move a sub-order's escrow from one state to another. Returns false when another
 * request already moved it, so callers never credit or release the same money twice.
 */
export const transitionEscrow = async (
  tx: any,
  subOrderId: string,
  from: string[],
  to: string,
  extra: { releasedAt?: boolean; settled?: boolean } = {}
): Promise<boolean> => {
  const settled = extra.settled === undefined ? "keep" : String(extra.settled);
  const { affectedRows } = await tx.execute(
    db.raw.sql`
      UPDATE "SubOrder" SET
        "escrowStatus" = ${to},
        "escrowReleasedAt" = CASE WHEN CAST(${extra.releasedAt ?? false} AS boolean) THEN now() ELSE "escrowReleasedAt" END,
        "isPayoutSettled" = CASE ${settled} WHEN 'true' THEN true WHEN 'false' THEN false ELSE "isPayoutSettled" END,
        "updatedAt" = now()
      WHERE "id" = ${subOrderId} AND "escrowStatus" = ANY(string_to_array(${from.join(",")}, ','))`
      .affectedCount()
      .build()
  );
  return affectedRows > 0;
};
