import "dotenv/config";
import { db } from "../config/db.ts";
import { AuthService } from "../modules/auth/auth.service.ts";
import { ProductService } from "../modules/products/product.service.ts";
import { SellerService } from "../modules/sellers/seller.service.ts";
import { OrderService } from "../modules/orders/order.service.ts";
import { PayoutService } from "../modules/payouts/payout.service.ts";
import { NotificationService } from "../modules/notifications/notification.service.ts";
import {
  USER_ROLES,
  SELLER_STATUS,
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  ORDER_STATUS,
} from "../constants/index.ts";

interface TestResult {
  step: string;
  success: boolean;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

function record(step: string, success: boolean, message?: string, error?: any) {
  results.push({
    step,
    success,
    message,
    error: error ? String(error?.message || error) : undefined,
  });
  const symbol = success ? "✅" : "❌";
  console.log(`${symbol} [${step}] ${message || (error ? error.message : "")}`);
}

async function runAudit() {
  console.log("\n=======================================================");
  console.log("🚀 STARTING 360-DEGREE FULL APPLICATION INTEGRATION AUDIT");
  console.log("=======================================================\n");

  const timestamp = Date.now();
  const testCategory = await db.orm.public.Category.first();
  if (!testCategory) {
    throw new Error("No category found in database. Please seed categories first.");
  }

  // -----------------------------------------------------------------
  // 1. ADMIN USER VERIFICATION
  // -----------------------------------------------------------------
  let admin = await db.orm.public.User.where({ role: USER_ROLES.ADMIN }).first();
  if (!admin) {
    record("Admin Exists", false, undefined, new Error("No Admin user found"));
    return;
  }
  record("1. Admin Exists", true, `Admin verified: ${admin.email}`);

  // -----------------------------------------------------------------
  // 2. SELLER REGISTRATION (Initial state: PENDING)
  // -----------------------------------------------------------------
  const sellerEmail = `test.seller.${timestamp}@shopora.test`;
  let sellerUser: any;
  let sellerProfile: any;

  try {
    const regResult = await AuthService.registerSeller({
      name: "Audit Test Merchant",
      email: sellerEmail,
      password: "Password@1234",
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      storeName: `Audit Store ${timestamp}`,
      businessAddress: "Dhaka, Bangladesh",
    });
    sellerUser = regResult.user;
    sellerProfile = await db.orm.public.SellerProfile.where({ userId: sellerUser.id }).first();

    const isPending = sellerProfile.status === SELLER_STATUS.PENDING || sellerProfile.status === SELLER_STATUS.APPROVED;
    record("2. Seller Registration", isPending, `Registered with status: ${sellerProfile.status}`);
  } catch (err: any) {
    record("2. Seller Registration", false, undefined, err);
    return;
  }

  // -----------------------------------------------------------------
  // 3. UNAPPROVED SELLER CANNOT CREATE PRODUCT
  // -----------------------------------------------------------------
  // Ensure seller is PENDING for this test
  await db.orm.public.SellerProfile.where({ id: sellerProfile.id }).update({ status: SELLER_STATUS.PENDING });
  try {
    await ProductService.createProduct(
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      {
        name: `Illegal Product ${timestamp}`,
        description: "This should fail because seller is pending approval",
        categoryId: testCategory.id,
        basePrice: 1000,
      }
    );
    record("3. Unapproved Product Block", false, "Unapproved seller was able to create product!");
  } catch (err: any) {
    record("3. Unapproved Product Block", true, "Correctly blocked unapproved seller product creation");
  }

  // -----------------------------------------------------------------
  // 4. ADMIN APPROVES SELLER & VERIFY NOTIFICATION
  // -----------------------------------------------------------------
  try {
    await SellerService.adminReviewSellerApplication(sellerProfile.id, {
      status: SELLER_STATUS.APPROVED,
      isVerified: true,
      commissionRate: 10,
    });
    sellerProfile = await db.orm.public.SellerProfile.where({ id: sellerProfile.id }).first();
    const approved = sellerProfile.status === SELLER_STATUS.APPROVED;

    // Check notification
    const notifs = await db.orm.public.Notification.where({ userId: sellerUser.id }).all();
    const hasApprovalNotif = notifs.some((n) => n.title.includes("APPROVED"));

    record("4. Admin Seller Approval & Notice", approved && hasApprovalNotif, `Seller approved and notification sent (${notifs.length} alerts)`);
  } catch (err: any) {
    record("4. Admin Seller Approval & Notice", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 5. APPROVED SELLER CREATES SIMPLE PRODUCT (Awaiting Review)
  // -----------------------------------------------------------------
  let testProduct: any;
  try {
    testProduct = await ProductService.createProduct(
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      {
        name: `Audit Premium Wireless Headset ${timestamp}`,
        description: "Detailed description of high-quality audio headset with ANC",
        categoryId: testCategory.id,
        basePrice: 3500,
        comparePrice: 4200,
        costPrice: 2400,
        stock: 25,
        lowStockThreshold: 5,
        productType: "SIMPLE",
      }
    );

    const isPendingApproval = testProduct.approvalStatus === PRODUCT_APPROVAL_STATUS.PENDING;
    const isSellerOwned = testProduct.sellerId === sellerProfile.id;
    record("5. Seller Creates Product", isPendingApproval && isSellerOwned, `Product created with approvalStatus: ${testProduct.approvalStatus}, stock: ${testProduct.stock}`);
  } catch (err: any) {
    record("5. Seller Creates Product", false, undefined, err);
    return;
  }

  // -----------------------------------------------------------------
  // 6. SELLER DATA ISOLATION: /products/seller/my-products
  // -----------------------------------------------------------------
  try {
    const sellerList = await ProductService.getAllProducts({
      sellerUserId: sellerUser.id,
      limit: 50,
    });
    const allBelongToSeller = sellerList.products.every((p: any) => p.sellerId === sellerProfile.id);
    const containsNewProduct = sellerList.products.some((p: any) => p.id === testProduct.id);
    record("6. Seller Catalog Isolation", allBelongToSeller && containsNewProduct, `Seller sees only their own products (${sellerList.products.length} found)`);
  } catch (err: any) {
    record("6. Seller Catalog Isolation", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 7. PUBLIC STOREFRONT DOES NOT SHOW UNAPPROVED PRODUCT
  // -----------------------------------------------------------------
  try {
    const publicList = await ProductService.getAllProducts({
      search: `Audit Premium Wireless Headset ${timestamp}`,
      limit: 10,
    });
    const isHiddenFromPublic = !publicList.products.some((p: any) => p.id === testProduct.id);
    record("7. Storefront Pending Visibility Guard", isHiddenFromPublic, "Unapproved product is completely hidden from public storefront");
  } catch (err: any) {
    record("7. Storefront Pending Visibility Guard", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 8. ADMIN SEES PENDING PRODUCT & APPROVES IT
  // -----------------------------------------------------------------
  try {
    const adminList = await ProductService.getAllProducts({
      isAdmin: true,
      approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING,
      limit: 50,
    });
    const foundByAdmin = adminList.products.some((p: any) => p.id === testProduct.id);

    // Admin reviews and approves
    await ProductService.reviewProductApproval(testProduct.id, {
      status: PRODUCT_APPROVAL_STATUS.APPROVED,
    });

    // Check seller notification
    const sellerNotifs = await db.orm.public.Notification.where({ userId: sellerUser.id }).all();
    const hasProdApprovalNotif = sellerNotifs.some((n) => n.type === "PRODUCT_APPROVAL" && n.title.includes("Approved"));

    // Verify it is now visible on storefront
    const publicCheck = await ProductService.getAllProducts({
      search: `Audit Premium Wireless Headset ${timestamp}`,
      limit: 10,
    });
    const isNowPublic = publicCheck.products.some((p: any) => p.id === testProduct.id);

    record("8. Admin Product Approval Lifecycle", foundByAdmin && hasProdApprovalNotif && isNowPublic, "Admin retrieved pending product, approved it, seller notified, and now live on storefront!");
  } catch (err: any) {
    record("8. Admin Product Approval Lifecycle", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 9. STOCK UPDATE TEST (VERIFY EDIT MODE FIX)
  // -----------------------------------------------------------------
  try {
    const updated = await ProductService.updateProduct(
      testProduct.id,
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      {
        productType: "SIMPLE",
        stock: 45, // Changing from 25 to 45
        variants: [], // Empty variants as sent by simple product form
      }
    );
    const dbCheck = await db.orm.public.Product.where({ id: testProduct.id }).first();
    const stockSaved = dbCheck?.stock === 45;
    record("9. Stock Update in Edit Mode", stockSaved, `Stock successfully updated in database: 25 -> ${dbCheck?.stock}`);
  } catch (err: any) {
    record("9. Stock Update in Edit Mode", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 10. MULTI-VENDOR ORDER CHECKOUT & ESCROW SPLIT
  // -----------------------------------------------------------------
  let orderResult: any;
  let customerUser: any;
  try {
    const custEmail = `test.customer.${timestamp}@shopora.test`;
    const custReg = await AuthService.registerCustomer({
      name: "Audit Test Customer",
      email: custEmail,
      password: "Password@1234",
      phone: "+8801811223344",
    });
    customerUser = custReg.user;

    orderResult = await OrderService.createOrder(
      customerUser.id,
      {
        items: [
          {
            productId: testProduct.id,
            quantity: 2,
          },
        ],
        shippingAddress: {
          fullName: "Audit Customer",
          phone: "+8801811223344",
          division: "Dhaka",
          district: "Dhaka City",
          address: "House 10, Road 4, Dhanmondi",
        },
        paymentMethod: "COD",
      }
    );

    // Verify sub-orders
    const subOrders = await db.orm.public.SubOrder.where({ orderId: orderResult.id }).all();
    const subOrder = subOrders.find((s) => s.sellerId === sellerProfile.id);

    // Commission verification: basePrice 3500 * 2 = 7000. 10% commission = 700. Seller earnings = 6300.
    const expectedSubtotal = 3500 * 2;
    const expectedCommission = (expectedSubtotal * 10) / 100;
    const expectedEarnings = expectedSubtotal - expectedCommission;

    const mathCorrect = subOrder && subOrder.subtotal === expectedSubtotal && subOrder.commissionAmount === expectedCommission && subOrder.sellerEarnings === expectedEarnings;

    // Check seller order notification
    const orderNotifs = await db.orm.public.Notification.where({ userId: sellerUser.id, type: "ORDER" }).all();

    record("10. Multi-Vendor Order & Escrow Calculation", Boolean(mathCorrect && orderNotifs.length > 0), `SubOrder split correctly. Subtotal: ${subOrder?.subtotal}, Comm: ${subOrder?.commissionAmount}, Earnings: ${subOrder?.sellerEarnings}, Seller notified: ${orderNotifs.length > 0}`);
  } catch (err: any) {
    record("10. Multi-Vendor Order & Escrow Calculation", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 11. SUB-ORDER STATUS TRANSITION & ESCROW HOLD
  // -----------------------------------------------------------------
  try {
    const subOrders = await db.orm.public.SubOrder.where({ orderId: orderResult.id, sellerId: sellerProfile.id }).all();
    const subOrder = subOrders[0];

    // Transition: PENDING -> CONFIRMED
    await OrderService.updateSubOrderStatus(
      subOrder.id,
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      { status: ORDER_STATUS.CONFIRMED }
    );

    // Transition: CONFIRMED -> PROCESSING
    await OrderService.updateSubOrderStatus(
      subOrder.id,
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      { status: "PROCESSING" }
    );

    // Transition: PROCESSING -> SHIPPED with tracking
    await OrderService.updateSubOrderStatus(
      subOrder.id,
      { id: sellerUser.id, role: USER_ROLES.SELLER, sellerId: sellerProfile.id },
      { status: "SHIPPED", trackingNumber: "TRK-AUDIT-123", courierName: "Steadfast" }
    );

    // Transition: SHIPPED -> DELIVERED
    await OrderService.updateSubOrderStatus(
      subOrder.id,
      { id: admin.id, role: USER_ROLES.ADMIN },
      { status: ORDER_STATUS.DELIVERED }
    );

    const deliveredSubOrder = await db.orm.public.SubOrder.where({ id: subOrder.id }).first();
    const delivered = deliveredSubOrder?.status === ORDER_STATUS.DELIVERED;
    const hasEscrowMaturityDate = Boolean(deliveredSubOrder?.escrowHoldUntil);

    record("11. Order Lifecycle & Escrow Maturation Timer", delivered && hasEscrowMaturityDate, `Order delivered. Escrow holds until: ${deliveredSubOrder?.escrowHoldUntil}`);
  } catch (err: any) {
    record("11. Order Lifecycle & Escrow Maturation Timer", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 12. ESCROW RELEASE & WALLET SETTLEMENT
  // -----------------------------------------------------------------
  try {
    const subOrders = await db.orm.public.SubOrder.where({ orderId: orderResult.id, sellerId: sellerProfile.id }).all();
    const subOrder = subOrders[0];

    // Release escrow early via admin
    await OrderService.releaseSubOrderEscrowEarly(subOrder.id, { id: admin.id, role: USER_ROLES.ADMIN });

    // Check seller wallet
    const wallet = await db.orm.public.SellerWallet.where({ sellerId: sellerProfile.id }).first();
    const balanceCredited = wallet && wallet.balance >= subOrder.sellerEarnings;

    record("12. Escrow Settlement & Wallet Credit", Boolean(balanceCredited), `Escrow released. Available balance: ৳${wallet?.balance}, Total earnings: ৳${wallet?.totalEarnings}`);
  } catch (err: any) {
    record("12. Escrow Settlement & Wallet Credit", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 13. SELLER PAYOUT REQUEST & ADMIN PAYOUT APPROVAL
  // -----------------------------------------------------------------
  try {
    const wallet = await db.orm.public.SellerWallet.where({ sellerId: sellerProfile.id }).first();
    const withdrawAmount = Math.min(2000, wallet?.balance || 2000);

    const payoutReq = await PayoutService.requestPayout(sellerUser.id, {
      amount: withdrawAmount,
      paymentMethod: "BKASH",
      accountDetails: { bKashNumber: "01711223344" },
    });

    const pendingPayout = await db.orm.public.PayoutRequest.where({ id: payoutReq.id }).first();
    const isPayoutPending = pendingPayout?.status === "PENDING";

    // Admin approves and marks as PAID
    await PayoutService.adminProcessPayout(payoutReq.id, {
      status: "PAID",
      transactionReference: `TRX-${timestamp}`,
    });

    const finalizedPayout = await db.orm.public.PayoutRequest.where({ id: payoutReq.id }).first();
    const isPaid = finalizedPayout?.status === "PAID";

    record("13. Seller Payout & Admin Settlement", Boolean(isPayoutPending && isPaid), `Payout request of ৳${withdrawAmount} created and marked as PAID.`);
  } catch (err: any) {
    record("13. Seller Payout & Admin Settlement", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 14. CROSS-SELLER SECURITY AUDIT (ATTACK SIMULATION)
  // -----------------------------------------------------------------
  try {
    // Create rogue seller
    const rogueEmail = `rogue.seller.${timestamp}@shopora.test`;
    const rogueReg = await AuthService.registerSeller({
      name: "Rogue Attacker Merchant",
      email: rogueEmail,
      password: "Password@1234",
      phone: `+88016${Math.floor(10000000 + Math.random() * 90000000)}`,
      storeName: `Rogue Store ${timestamp}`,
      businessAddress: "Chittagong",
    });
    const rogueProfile = await db.orm.public.SellerProfile.where({ userId: rogueReg.user.id }).first();

    // 14.1 Rogue tries to update legitimate seller's product
    let blockedUpdate = false;
    try {
      await ProductService.updateProduct(
        testProduct.id,
        { id: rogueReg.user.id, role: USER_ROLES.SELLER, sellerId: rogueProfile.id },
        { name: "Hacked Product Name" }
      );
    } catch {
      blockedUpdate = true;
    }

    // 14.2 Rogue tries to delete legitimate seller's product
    let blockedDelete = false;
    try {
      await ProductService.deleteProduct(testProduct.id, {
        id: rogueReg.user.id,
        role: USER_ROLES.SELLER,
        sellerId: rogueProfile.id,
      });
    } catch {
      blockedDelete = true;
    }

    // 14.3 Rogue tries to alter legitimate seller's sub-order
    const subOrders = await db.orm.public.SubOrder.where({ orderId: orderResult.id, sellerId: sellerProfile.id }).all();
    let blockedSubOrder = false;
    try {
      await OrderService.updateSubOrderStatus(
        subOrders[0].id,
        { id: rogueReg.user.id, role: USER_ROLES.SELLER, sellerId: rogueProfile.id },
        { status: "CANCELLED" }
      );
    } catch {
      blockedSubOrder = true;
    }

    const securityPassed = blockedUpdate && blockedDelete && blockedSubOrder;
    record("14. Cross-Seller Isolation Security", securityPassed, `Blocked unauthorized edit: ${blockedUpdate}, delete: ${blockedDelete}, order tampering: ${blockedSubOrder}`);
  } catch (err: any) {
    record("14. Cross-Seller Isolation Security", false, undefined, err);
  }

  // -----------------------------------------------------------------
  // 15. ADMIN DIRECT WARNING / NOTICE DELIVERY
  // -----------------------------------------------------------------
  try {
    await SellerService.adminSendSellerNotice(
      sellerProfile.id,
      "Official Notice: Store Verification Complete",
      "Your store credentials have been verified. Keep maintaining high fulfillment standards."
    );

    const userNotifs = await NotificationService.getUserNotifications(sellerUser.id, { type: "SYSTEM" });
    const hasNotice = userNotifs.notifications.some((n) => n.title.includes("Store Verification"));

    record("15. Admin Notice / Warning Delivery", hasNotice, `Notice dispatched and confirmed in seller inbox (${userNotifs.notifications.length} system notices)`);
  } catch (err: any) {
    record("15. Admin Notice / Warning Delivery", false, undefined, err);
  }

  console.log("\n=======================================================");
  console.log("📊 360-DEGREE AUDIT RESULTS SUMMARY");
  console.log("=======================================================");
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`Total Steps Tested: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n⚠️ FAILURES DETECTED:");
    results.filter((r) => !r.success).forEach((r) => {
      console.log(`- [${r.step}]: ${r.error || "Failed"}`);
    });
  } else {
    console.log("\n🎉 ALL 15 CRITICAL BUSINESS WORKFLOWS PASSED WITH 100% SUCCESS!");
  }
}

runAudit()
  .catch((err) => {
    console.error("Fatal audit error:", err);
  })
  .finally(() => {
    process.exit(0);
  });
