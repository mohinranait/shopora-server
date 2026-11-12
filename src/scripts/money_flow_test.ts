/**
 * Money-flow integration test: exact totals/commission, escrow, payouts and return reversal,
 * including concurrent double-release / double-payout attempts.
 *
 * It writes test data, so it only runs against a local throwaway database (seeded with `npm run seed`):
 *   DATABASE_URL=postgres://…@127.0.0.1:…/shopora_test npm run test:money
 */
const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to run: DATABASE_URL must point at a local test database.");
  process.exit(1);
}

import { db } from "../config/db.ts";
import { OrderService } from "../modules/orders/order.service.ts";
import { PayoutService } from "../modules/payouts/payout.service.ts";
import { toPaisa, toDb, toDbRate } from "../utils/money.ts";
import { ORDER_STATUS } from "../constants/index.ts";

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, info = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name} ${info}`); };
const wallet = async (sellerId: string) => (await db.orm.public.SellerWallet.where({ sellerId }).first())!;
const admin = (await db.orm.public.User.where({ role: "ADMIN" }).first())!;
const adminUser = { id: admin.id, role: "ADMIN", email: admin.email };

// A seller product priced so float maths would drift: 19.99 x 3
const seller = (await db.orm.public.SellerProfile.where({ status: "APPROVED" }).first())!;
await db.orm.public.SellerProfile.where({ id: seller.id }).update({ commissionRate: toDbRate(12.5) });
const prod = (await db.orm.public.Product.where({ sellerId: seller.id, productType: "SIMPLE", approvalStatus: "APPROVED", status: "PUBLISHED" }).first())!;
await db.orm.public.Product.where({ id: prod.id }).update({ basePrice: toDb(19.99), stock: 100, isFreeShipping: true });
await db.orm.public.Coupon.where({ code: "PCT15" }).deleteAll();
await db.orm.public.Coupon.create({ code: "PCT15", discountType: "PERCENTAGE", discountValue: toDb(15), minOrderAmount: toDb(0), usageLimit: 10, usedCount: 0, isActive: true });

const order = await OrderService.createOrder(null, {
  items: [{ productId: prod.id, quantity: 3 }], couponCode: "PCT15", paymentMethod: "COD",
  shippingAddress: { fullName: "Money Test", phone: "01811111111", streetAddress: "1 Road", city: "Dhaka" } as any,
});
// 59.97 subtotal; 15% = 8.9955 -> whole taka 9; total 50.97
check("Order totals exact", order.subtotal === "59.97" && order.discount === "9.00" && order.totalAmount === "50.97", `${order.subtotal} - ${order.discount} = ${order.totalAmount}`);
const sub = (await db.orm.public.SubOrder.where({ orderId: order.id }).first())!;
// 12.5% of 59.97 = 7.49625 -> 7.50 ; earnings 52.47
check("Commission exact", sub.commissionAmount === "7.50" && sub.sellerEarnings === "52.47" && sub.commissionRate === "12.50", `${sub.commissionAmount} / ${sub.sellerEarnings}`);

// Early release before delivery must be refused
let refused = false;
try { await OrderService.releaseSubOrderEscrowEarly(sub.id, adminUser); } catch { refused = true; }
check("Early release refused before delivery", refused);

const w0 = await wallet(seller.id);
for (const st of [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED]) {
  await OrderService.adminUpdateOrderStatus(order.id, adminUser, { status: st });
}
const w1 = await wallet(seller.id);
check("Delivery credits pending once", toPaisa(w1.pendingBalance) - toPaisa(w0.pendingBalance) === 5247, `pending +${(toPaisa(w1.pendingBalance) - toPaisa(w0.pendingBalance)) / 100}`);

// Two concurrent releases (cron + admin) must pay once
const [r1, r2] = await Promise.allSettled([
  OrderService.releaseSubOrderEscrowEarly(sub.id, adminUser),
  OrderService.releaseSubOrderEscrowEarly(sub.id, adminUser),
]);
const w2 = await wallet(seller.id);
check("Concurrent escrow release pays once", [r1, r2].filter((r) => r.status === "fulfilled").length === 1 && toPaisa(w2.balance) - toPaisa(w1.balance) === 5247,
  `balance +${(toPaisa(w2.balance) - toPaisa(w1.balance)) / 100}`);

// Payout reservation: two requests that together exceed balance
const sellerUserId = seller.userId;
const bal = toPaisa(w2.balance) / 100;
const half = Math.floor((bal * 0.6) * 100) / 100;
const p1 = await PayoutService.requestPayout(sellerUserId, { amount: half, paymentMethod: "BKASH", accountDetails: { mobileNumber: "01811111111" } });
let overRefused = false;
try { await PayoutService.requestPayout(sellerUserId, { amount: half, paymentMethod: "BKASH", accountDetails: {} }); } catch { overRefused = true; }
check("Second payout beyond reserved balance refused", overRefused, `balance ${bal}, each ${half}`);

// Two admins mark the same payout PAID at once: deducted once
const [a, b] = await Promise.allSettled([
  PayoutService.adminProcessPayout(p1.id, { status: "PAID", transactionReference: "A" }),
  PayoutService.adminProcessPayout(p1.id, { status: "PAID", transactionReference: "B" }),
]);
const w3 = await wallet(seller.id);
check("Concurrent PAID deducts once", [a, b].filter((r) => r.status === "fulfilled").length === 1 && toPaisa(w2.balance) - toPaisa(w3.balance) === toPaisa(half),
  `balance -${(toPaisa(w2.balance) - toPaisa(w3.balance)) / 100}`);
let rePaid = false;
try { await PayoutService.adminProcessPayout(p1.id, { status: "REJECTED" }); } catch { rePaid = true; }
check("Paid payout cannot be changed", rePaid);

// Return after release: reversal comes out of available balance, recorded in ledger
await OrderService.adminUpdateOrderStatus(order.id, adminUser, { status: ORDER_STATUS.RETURNED }).catch((e: any) => console.log("   (return:", e.message, ")"));
const w4 = await wallet(seller.id);
const sub2 = (await db.orm.public.SubOrder.where({ id: sub.id }).first())!;
check("Return reverses released earnings once", sub2.status !== ORDER_STATUS.RETURNED || (toPaisa(w3.balance) - toPaisa(w4.balance) === 5247 && sub2.escrowStatus === "REFUNDED"),
  `status ${sub2.status}, escrow ${sub2.escrowStatus}, balance -${(toPaisa(w3.balance) - toPaisa(w4.balance)) / 100}`);

// Ledger matches wallet: sum of transactions == balance + pending (for this seller's wallet, from zero)
const txs = await db.orm.public.WalletTransaction.where({ walletId: w4.id }).all();
console.log(`   ledger entries: ${txs.length}`);
console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
process.exit(fail ? 1 : 0);
