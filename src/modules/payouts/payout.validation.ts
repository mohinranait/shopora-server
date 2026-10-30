import { z } from "zod";
import { PAYOUT_STATUS } from "../../constants/index.ts";

export const requestPayoutSchema = z.object({
  body: z.object({
    amount: z.number().positive("Withdrawal amount must be greater than 0"),
    paymentMethod: z.enum(["BANK", "BKASH", "NAGAD"]),
    accountDetails: z.record(z.string(), z.any()), // e.g. { bankName, accountNumber, accountHolderName, branchName } or { mobileNumber }
  }),
});

export const processPayoutSchema = z.object({
  body: z.object({
    status: z.enum([PAYOUT_STATUS.APPROVED, PAYOUT_STATUS.PAID, PAYOUT_STATUS.REJECTED]),
    transactionReference: z.string().optional(),
    rejectionReason: z.string().optional(),
  }),
});
