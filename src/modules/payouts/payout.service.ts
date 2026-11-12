import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { PAYOUT_STATUS, TRANSACTION_TYPE } from "../../constants/index.ts";
import { toPaisa, paisaToTaka, fromPaisa } from "../../utils/money.ts";
import { firstRowIn } from "../../utils/rawQuery.ts";
import { adjustWallet } from "./wallet.ts";

/**
 * Get Seller Wallet & Transactions
 */
export const getSellerWallet = async (userId: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();
  if (!wallet) {
    throw new AppError("Seller wallet not found", 404);
  }

  const transactions = await db.orm.public.WalletTransaction
    .where({ walletId: wallet.id })
    .orderBy((t) => t.createdAt.desc())
    .all();

  const payoutRequests = await db.orm.public.PayoutRequest
    .where({ sellerId: seller.id })
    .orderBy((p) => p.createdAt.desc())
    .all();

  return {
    wallet,
    transactions,
    payoutRequests,
  };
};

const MIN_WITHDRAWAL_PAISA = 500_00;
/** Requests that still claim part of the seller's balance */
const OPEN_PAYOUT_STATUSES: string[] = [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED];

/**
 * Seller: Submit Payout Request
 */
export const requestPayout = async (
  userId: string,
  payload: {
    amount: number;
    paymentMethod: string;
    accountDetails: any;
  }
) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  const amount = toPaisa(payload.amount);
  if (amount < MIN_WITHDRAWAL_PAISA) {
    throw new AppError(`Minimum withdrawal amount is ${paisaToTaka(MIN_WITHDRAWAL_PAISA)} BDT`, 400);
  }

  return await db.transaction(async (tx) => {
    // Lock the wallet row so two simultaneous requests can't both pass the balance check
    const wallet = await firstRowIn<{ id: string; balance: string }>(
      tx,
      db.raw.sql`SELECT "id", "balance"::text AS "balance" FROM "SellerWallet" WHERE "sellerId" = ${seller.id} FOR UPDATE`
        .returnsRow({ id: "pg/text@1", balance: "pg/text@1" })
        .build()
    );
    if (!wallet) {
      throw new AppError("Wallet not found", 404);
    }

    // Money already promised to earlier, unpaid requests is not available again
    const open = await tx.orm.public.PayoutRequest.where({ sellerId: seller.id })
      .where((p) => p.status.in(OPEN_PAYOUT_STATUSES))
      .select("amount")
      .all();
    const reserved = open.reduce((sum, p) => sum + toPaisa(p.amount), 0);
    const available = toPaisa(wallet.balance) - reserved;

    if (amount > available) {
      throw new AppError(
        `Insufficient wallet balance. You requested ${paisaToTaka(amount)} BDT, but your available balance is ${paisaToTaka(Math.max(0, available))} BDT` +
          (reserved > 0 ? ` (${paisaToTaka(reserved)} BDT is already in pending payout requests).` : "."),
        400
      );
    }

    return await tx.orm.public.PayoutRequest.create({
      sellerId: seller.id,
      amount: fromPaisa(amount),
      paymentMethod: payload.paymentMethod,
      accountDetails: payload.accountDetails,
      status: PAYOUT_STATUS.PENDING,
    });
  });
};

/**
 * Admin: Get all payout requests with optional status filter
 */
export const adminGetAllPayouts = async (status?: string) => {
  let query = db.orm.public.PayoutRequest;
  if (status) {
    query = query.where({ status });
  }

  const payouts = await query.orderBy((p) => p.createdAt.desc()).all();

  // One query for all sellers instead of one per payout
  const sellerIds = [...new Set(payouts.map((p) => p.sellerId))];
  const sellers = sellerIds.length
    ? await db.orm.public.SellerProfile.where((sp) => sp.id.in(sellerIds))
        .select("id", "storeName", "storeSlug", "phone")
        .all()
    : [];
  const sellerMap = new Map(sellers.map((sp) => [sp.id, sp]));

  return payouts.map((payout) => ({ ...payout, seller: sellerMap.get(payout.sellerId) ?? null }));
};

/** Allowed payout status changes; PAID and REJECTED are final */
const PAYOUT_TRANSITIONS: Record<string, string[]> = {
  [PAYOUT_STATUS.PENDING]: [PAYOUT_STATUS.APPROVED, PAYOUT_STATUS.PAID, PAYOUT_STATUS.REJECTED],
  [PAYOUT_STATUS.APPROVED]: [PAYOUT_STATUS.PAID, PAYOUT_STATUS.REJECTED],
};

/**
 * Admin: Process Payout Request (Approve / Mark PAID / Reject)
 */
export const adminProcessPayout = async (
  payoutId: string,
  payload: {
    status: string;
    transactionReference?: string;
    rejectionReason?: string;
  }
) => {
  const payout = await db.orm.public.PayoutRequest.where({ id: payoutId }).first();
  if (!payout) {
    throw new AppError("Payout request not found", 404);
  }

  if (payout.status === PAYOUT_STATUS.PAID) {
    throw new AppError("This payout has already been paid and settled", 400);
  }
  const allowedFrom = Object.keys(PAYOUT_TRANSITIONS).filter((from) => PAYOUT_TRANSITIONS[from].includes(payload.status));
  if (!allowedFrom.includes(payout.status)) {
    throw new AppError(`A ${payout.status.toLowerCase()} payout cannot be marked ${payload.status.toLowerCase()}`, 400);
  }

  const seller = await db.orm.public.SellerProfile.where({ id: payout.sellerId }).first();
  const wallet = await db.orm.public.SellerWallet.where({ sellerId: payout.sellerId }).select("id").first();

  if (!wallet) {
    throw new AppError("Seller wallet not found", 404);
  }

  const amount = toPaisa(payout.amount);

  return await db.transaction(async (tx) => {
    // Claim the status change atomically: if another admin processed it first, stop here
    const { affectedRows } = await tx.execute(
      db.raw.sql`UPDATE "PayoutRequest" SET "status" = ${payload.status}, "updatedAt" = now()
                 WHERE "id" = ${payoutId} AND "status" = ANY(string_to_array(${allowedFrom.join(",")}, ','))`
        .affectedCount()
        .build()
    );
    if (affectedRows === 0) {
      throw new AppError("This payout was already processed by someone else. Refresh and try again.", 409);
    }

    // If status is PAID, deduct the amount from seller balance (only if the balance still covers it)
    if (payload.status === PAYOUT_STATUS.PAID) {
      const paid = await adjustWallet(
        tx,
        wallet.id,
        { balance: -amount, totalWithdrawn: amount },
        {
          amount: -amount,
          type: TRANSACTION_TYPE.PAYOUT_WITHDRAWAL,
          description: `Payout withdrawal via ${payout.paymentMethod}. Ref: ${payload.transactionReference || "Direct Transfer"}`,
        },
        { requireBalance: amount }
      );
      if (!paid) {
        throw new AppError(
          `Cannot process payment: seller balance is lower than payout amount (${paisaToTaka(amount)} BDT)`,
          400
        );
      }
    }

    const updated = await tx.orm.public.PayoutRequest.where({ id: payoutId }).update({
      transactionReference: payload.transactionReference ?? null,
      rejectionReason: payload.status === PAYOUT_STATUS.REJECTED ? payload.rejectionReason ?? "Rejected by admin" : null,
      processedAt: new Date().toISOString(),
    });

    // Notify seller
    if (seller) {
      await tx.orm.public.Notification.create({
        userId: seller.userId,
        title: `Payout Request ${payload.status}`,
        message:
          payload.status === PAYOUT_STATUS.PAID
            ? `Your payout of ${paisaToTaka(amount)} BDT has been successfully transferred! Ref: ${payload.transactionReference || "Paid"}`
            : `Your payout request of ${paisaToTaka(amount)} BDT was ${payload.status.toLowerCase()}. ${payload.rejectionReason || ""}`,
        type: "PAYOUT",
        link: "/seller/wallet",
      });
    }

    return updated;
  });
};

export const PayoutService = {
  getSellerWallet,
  requestPayout,
  adminGetAllPayouts,
  adminProcessPayout,
};
