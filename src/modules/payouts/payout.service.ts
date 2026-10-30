import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { PAYOUT_STATUS, TRANSACTION_TYPE } from "../../constants/index.ts";

/**
 * Get Seller Wallet & Transactions
 */
export const getSellerWallet = async (userId: number) => {
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

/**
 * Seller: Submit Payout Request
 */
export const requestPayout = async (
  userId: number,
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

  const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  if (payload.amount > wallet.balance) {
    throw new AppError(
      `Insufficient wallet balance. You requested ${payload.amount} BDT, but your available balance is ${wallet.balance} BDT.`,
      400
    );
  }

  const minWithdrawal = 500;
  if (payload.amount < minWithdrawal) {
    throw new AppError(`Minimum withdrawal amount is ${minWithdrawal} BDT`, 400);
  }

  // Create Payout Request
  return await db.orm.public.PayoutRequest.create({
    sellerId: seller.id,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    accountDetails: payload.accountDetails,
    status: PAYOUT_STATUS.PENDING,
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

  const populated = await Promise.all(
    payouts.map(async (payout) => {
      const seller = await db.orm.public.SellerProfile.where({ id: payout.sellerId }).first();
      return {
        ...payout,
        seller: seller
          ? {
              id: seller.id,
              storeName: seller.storeName,
              storeSlug: seller.storeSlug,
              phone: seller.phone,
            }
          : null,
      };
    })
  );

  return populated;
};

/**
 * Admin: Process Payout Request (Approve / Mark PAID / Reject)
 */
export const adminProcessPayout = async (
  payoutId: number,
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

  const seller = await db.orm.public.SellerProfile.where({ id: payout.sellerId }).first();
  const wallet = await db.orm.public.SellerWallet.where({ sellerId: payout.sellerId }).first();

  if (!wallet) {
    throw new AppError("Seller wallet not found", 404);
  }

  return await db.transaction(async (tx) => {
    // If status is PAID, deduct the amount from seller balance
    if (payload.status === PAYOUT_STATUS.PAID) {
      if (wallet.balance < payout.amount) {
        throw new AppError(
          `Cannot process payment: seller balance (${wallet.balance} BDT) is lower than payout amount (${payout.amount} BDT)`,
          400
        );
      }

      await tx.orm.public.SellerWallet.where({ id: wallet.id }).update({
        balance: wallet.balance - payout.amount,
        totalWithdrawn: wallet.totalWithdrawn + payout.amount,
      });

      // Add wallet transaction record
      await tx.orm.public.WalletTransaction.create({
        walletId: wallet.id,
        amount: -payout.amount,
        type: TRANSACTION_TYPE.PAYOUT_WITHDRAWAL,
        description: `Payout withdrawal via ${payout.paymentMethod}. Ref: ${payload.transactionReference || "Direct Transfer"}`,
      });
    }

    const updated = await tx.orm.public.PayoutRequest.where({ id: payoutId }).update({
      status: payload.status,
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
            ? `Your payout of ${payout.amount} BDT has been successfully transferred! Ref: ${payload.transactionReference || "Paid"}`
            : `Your payout request of ${payout.amount} BDT was ${payload.status.toLowerCase()}. ${payload.rejectionReason || ""}`,
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
