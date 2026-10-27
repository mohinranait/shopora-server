import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { hashPassword } from "../../utils/hash.ts";
import { generateOrderNumber, generateSubOrderNumber } from "../../utils/orderNumber.ts";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_TYPE,
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  USER_ROLES,
  TRANSACTION_TYPE,
  ENABLED_PAYMENT_METHODS,
  type PaymentMethod,
} from "../../constants/index.ts";
import { ENV } from "../../config/env.ts";
import { getAllSettings } from "../settings/settings.service.ts";

type OrderItemInput = { productId: number; variantId?: number | null; quantity: number };

export const SHIPPING_RULES = { freeShippingThreshold: 1500, flatFee: 70 } as const;

interface IPricedLine {
  product: any;
  selectedVariant: any;
  productId: number;
  variantId: number | null;
  sellerId: number | null;
  isPlatformOwned: boolean;
  productName: string;
  variantTitle: string | null;
  productImage: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  quantity: number;
  totalPrice: number;
  isFreeShipping: boolean;
}

/**
 * Validate a coupon against the priced lines. Never throws: returns why it doesn't apply.
 */
const evaluateCoupon = async (code: string, lines: IPricedLine[]) => {
  const normalized = code.trim().toUpperCase();
  const coupon = await db.orm.public.Coupon.where({ code: normalized }).first();
  const fail = (message: string) => ({ coupon: null, discount: 0, message });

  if (!coupon || !coupon.isActive) return fail("This coupon code is not valid");
  const now = Date.now();
  const toTime = (v: unknown) => (v ? new Date(String(v).replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime() : NaN);
  if (coupon.startDate && toTime(coupon.startDate) > now) return fail("This coupon is not active yet");
  if (coupon.endDate && toTime(coupon.endDate) < now) return fail("This coupon has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return fail("This coupon has reached its usage limit");
  }

  // Seller coupons only discount that seller's items
  const eligible = coupon.sellerId ? lines.filter((l) => l.sellerId === coupon.sellerId) : lines;
  const eligibleSubtotal = eligible.reduce((sum, l) => sum + l.totalPrice, 0);
  if (eligible.length === 0) return fail("This coupon doesn't apply to items in your cart");
  if (eligibleSubtotal < coupon.minOrderAmount) {
    return fail(`Add ৳${Math.ceil(coupon.minOrderAmount - eligibleSubtotal).toLocaleString("en-US")} more to use this coupon`);
  }

  let discount =
    coupon.discountType === "PERCENTAGE" ? (eligibleSubtotal * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) discount = coupon.maxDiscountAmount;
  discount = Math.round(Math.min(discount, eligibleSubtotal));

  return { coupon, discount, message: "Coupon applied" };
};

/**
 * Price an order: validates products, variants and stock, applies the coupon and
 * shipping rules. Shared by checkout and the cart/checkout quote endpoint so the
 * totals a customer sees are exactly what gets charged.
 */
export const priceOrder = async (items: OrderItemInput[], couponCode?: string) => {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId).filter((id): id is number => id != null))];
  const [products, variants] = await Promise.all([
    productIds.length ? db.orm.public.Product.where((p) => p.id.in(productIds)).all() : [],
    variantIds.length ? db.orm.public.ProductVariant.where((v) => v.id.in(variantIds)).all() : [],
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const lines: IPricedLine[] = [];
  const issues: { productId: number; variantId: number | null; message: string }[] = [];

  for (const item of items) {
    const variantId = item.variantId ?? null;
    const issue = (message: string) => issues.push({ productId: item.productId, variantId, message });
    const product = productMap.get(item.productId);

    if (!product) {
      issue("This product no longer exists");
      continue;
    }
    if (product.approvalStatus !== PRODUCT_APPROVAL_STATUS.APPROVED || product.status !== PRODUCT_STATUS.PUBLISHED) {
      issue(`"${product.name}" is currently not available for purchase`);
      continue;
    }

    let selectedVariant: any = null;
    let unitPrice = product.basePrice;
    let comparePrice = product.comparePrice ?? null;
    let stock = product.stock;
    let variantTitle: string | null = null;
    let sku = product.sku;

    if (product.productType === PRODUCT_TYPE.VARIABLE && variantId) {
      selectedVariant = variantMap.get(variantId);
      if (!selectedVariant || !selectedVariant.isActive || selectedVariant.productId !== product.id) {
        issue(`Selected option for "${product.name}" is no longer available`);
        continue;
      }
      unitPrice = selectedVariant.price;
      comparePrice = selectedVariant.comparePrice ?? null;
      stock = selectedVariant.stock;
      variantTitle = selectedVariant.title;
      sku = selectedVariant.sku;
    }

    if (stock < item.quantity) {
      issue(
        stock <= 0
          ? `"${product.name}${variantTitle ? ` (${variantTitle})` : ""}" is out of stock`
          : `Only ${stock} left of "${product.name}${variantTitle ? ` (${variantTitle})` : ""}"`
      );
      continue;
    }

    lines.push({
      product,
      selectedVariant,
      productId: product.id,
      variantId,
      sellerId: product.sellerId ?? null,
      isPlatformOwned: product.isPlatformOwned,
      productName: product.name,
      variantTitle,
      productImage: selectedVariant?.image || product.mainImage,
      sku,
      price: unitPrice,
      comparePrice,
      quantity: item.quantity,
      totalPrice: unitPrice * item.quantity,
      isFreeShipping: Boolean(product.isFreeShipping),
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.totalPrice, 0);
  const savings = lines.reduce(
    (sum, l) => sum + (l.comparePrice && l.comparePrice > l.price ? (l.comparePrice - l.price) * l.quantity : 0),
    0
  );

  let discount = 0;
  let coupon: any = null;
  let couponMessage: string | null = null;
  if (couponCode?.trim() && lines.length > 0) {
    const result = await evaluateCoupon(couponCode, lines);
    discount = result.discount;
    coupon = result.coupon;
    couponMessage = result.message;
  }

  const settings: Record<string, any> = await getAllSettings().catch(() => ({} as Record<string, any>));
  const standardFee = typeof settings.shipping_fee_standard === "number" ? settings.shipping_fee_standard : 70;
  const freeShippingThreshold = typeof settings.free_shipping_threshold === "number" ? settings.free_shipping_threshold : 1500;
  const vatPercentage = typeof settings.vat_percentage === "number" ? settings.vat_percentage : 0;

  const allFreeShipping = lines.length > 0 && lines.every((l) => l.isFreeShipping);
  const shippingFee =
    lines.length === 0 || allFreeShipping || subtotal >= freeShippingThreshold
      ? 0
      : standardFee;
  const tax = Math.round(subtotal * (vatPercentage / 100));
  const totalAmount = Math.max(0, subtotal - discount + shippingFee + tax);

  return {
    lines,
    issues,
    subtotal,
    savings,
    discount,
    coupon,
    couponMessage,
    shippingFee,
    tax,
    totalAmount,
    freeShippingThreshold,
  };
};

/**
 * Public price quote for the cart / checkout summary
 */
export const quoteOrder = async (items: OrderItemInput[], couponCode?: string) => {
  const priced = await priceOrder(items, couponCode);
  const settings: Record<string, any> = await getAllSettings().catch(() => ({} as Record<string, any>));

  const enabledPaymentMethods: PaymentMethod[] = [];
  if (settings.enable_cod !== false) enabledPaymentMethods.push("COD");
  if (settings.enable_bkash) enabledPaymentMethods.push("BKASH");
  if (settings.enable_nagad) enabledPaymentMethods.push("NAGAD");
  if (enabledPaymentMethods.length === 0) enabledPaymentMethods.push("COD");

  return {
    subtotal: priced.subtotal,
    savings: priced.savings,
    discount: priced.discount,
    shippingFee: priced.shippingFee,
    tax: priced.tax,
    totalAmount: priced.totalAmount,
    freeShippingThreshold: priced.freeShippingThreshold,
    coupon: priced.coupon
      ? {
          code: priced.coupon.code,
          discountType: priced.coupon.discountType,
          discountValue: priced.coupon.discountValue,
        }
      : null,
    couponMessage: priced.couponMessage,
    issues: priced.issues,
    itemCount: priced.lines.reduce((sum, l) => sum + l.quantity, 0),
    paymentMethods: enabledPaymentMethods,
  };
};

/**
 * Checkout / Place Order with Multi-Vendor Splitting & Commission Accounting
 */
export const createOrder = async (
  userId: number | null,
  payload: {
    items: { productId: number; variantId?: number | null; quantity: number }[];
    shippingAddress: any;
    billingAddress?: any;
    paymentMethod: string;
    couponCode?: string;
    notes?: string;
    guestEmail?: string;
    guestPhone?: string;
  },
  sessionId?: string
) => {
  if (payload.items.length === 0) {
    throw new AppError("Cannot place an order with zero items", 400);
  }
  const settings: Record<string, any> = await getAllSettings().catch(() => ({} as Record<string, any>));
  const enabledMethods: string[] = [];
  if (settings.enable_cod !== false) enabledMethods.push("COD");
  if (settings.enable_bkash) enabledMethods.push("BKASH");
  if (settings.enable_nagad) enabledMethods.push("NAGAD");
  if (enabledMethods.length === 0) enabledMethods.push("COD");

  if (!enabledMethods.includes(payload.paymentMethod)) {
    throw new AppError(`The payment method "${payload.paymentMethod}" is currently disabled. Please select an available payment method.`, 400);
  }

  // 1. Fetch default platform commission from WebsiteSetting or fallback
  const defaultCommissionRate =
    typeof settings.default_commission_rate === "number"
      ? settings.default_commission_rate
      : ENV.DEFAULT_COMMISSION_RATE;

  // 2. Validate products & stock, apply coupon and shipping (single source of truth)
  const priced = await priceOrder(payload.items, payload.couponCode);
  if (priced.issues.length > 0) {
    throw new AppError(priced.issues[0].message, 400);
  }
  if (payload.couponCode?.trim() && !priced.coupon) {
    throw new AppError(priced.couponMessage || "This coupon code is not valid", 400);
  }

  const validatedItems = priced.lines;
  const { subtotal, discount, shippingFee, tax, totalAmount } = priced;
  const appliedCouponCode: string | null = priced.coupon?.code ?? null;
  const orderNumber = generateOrderNumber();

  // 3. Validate and normalize customer phone number (mandatory for all orders)
  const rawPhone = payload.shippingAddress?.phone || payload.guestPhone;
  const digits = String(rawPhone || "").replace(/\D/g, "").replace(/^88/, "");
  if (!/^01[3-9]\d{8}$/.test(digits)) {
    throw new AppError("A valid 11-digit Bangladeshi mobile number (01XXXXXXXXX) is required to place an order", 400);
  }
  const normalizedPhone = digits;

  // 4. Group items by Seller (or Platform)
  const vendorGroups = new Map<string, typeof validatedItems>();
  for (const item of validatedItems) {
    const groupKey = item.isPlatformOwned ? "PLATFORM" : `SELLER_${item.sellerId}`;
    if (!vendorGroups.has(groupKey)) {
      vendorGroups.set(groupKey, []);
    }
    vendorGroups.get(groupKey)!.push(item);
  }

  // 5. Execute Order Placement in Database Transaction
  return await db.transaction(async (tx) => {
    // 5.0. Resolve or Auto-Create User linked by Phone Number
    let resolvedUserId: number | null = userId;

    if (!resolvedUserId) {
      // Check if user already exists with this phone number
      const existingUser = await tx.orm.public.User.where({ phone: normalizedPhone }).first();

      if (existingUser) {
        resolvedUserId = existingUser.id;
        // If existing user has placeholder/empty name, update with shipping name
        if ((!existingUser.name || existingUser.name === "Customer") && payload.shippingAddress?.fullName) {
          await tx.orm.public.User.where({ id: existingUser.id }).update({
            name: payload.shippingAddress.fullName.trim(),
          });
        }
      } else {
        // Auto-create new customer account with checkout details
        const customerName = payload.shippingAddress?.fullName?.trim() || "Customer";
        const emailInput = payload.guestEmail?.trim() || payload.shippingAddress?.email?.trim();

        let userEmail = emailInput;
        if (!userEmail) {
          userEmail = `${normalizedPhone}@guest.shopora.com`;
        } else {
          const emailExists = await tx.orm.public.User.where({ email: userEmail }).first();
          if (emailExists) {
            userEmail = `${normalizedPhone}.${Date.now()}@guest.shopora.com`;
          }
        }

        const randomPassword = `Shopora@${normalizedPhone.slice(-4)}#${Math.random().toString(36).slice(2, 6)}`;
        const passwordHash = await hashPassword(randomPassword);

        const newUser = await tx.orm.public.User.create({
          name: customerName,
          phone: normalizedPhone,
          email: userEmail,
          password: passwordHash,
          role: USER_ROLES.CUSTOMER,
          isActive: true,
          isVerified: false,
        });

        resolvedUserId = newUser.id;

        // Auto-save shipping address for customer
        if (payload.shippingAddress) {
          await tx.orm.public.Address.create({
            userId: newUser.id,
            fullName: customerName,
            phone: normalizedPhone,
            streetAddress: payload.shippingAddress.streetAddress || "",
            city: payload.shippingAddress.city || "",
            state: payload.shippingAddress.state || null,
            postalCode: payload.shippingAddress.postalCode || null,
            country: payload.shippingAddress.country || "Bangladesh",
            isDefault: true,
            type: "SHIPPING",
          });
        }
      }
    } else {
      // If user was logged in, ensure their profile has their verified phone number
      const loggedInUser = await tx.orm.public.User.where({ id: resolvedUserId }).first();
      if (loggedInUser && !loggedInUser.phone) {
        await tx.orm.public.User.where({ id: resolvedUserId }).update({
          phone: normalizedPhone,
        });
      }
    }

    // 5.1. Create Main Customer Order
    const order = await tx.orm.public.Order.create({
      orderNumber,
      userId: resolvedUserId,
      guestEmail: payload.guestEmail ?? null,
      guestPhone: normalizedPhone,
      shippingAddress: {
        ...payload.shippingAddress,
        phone: normalizedPhone,
      },
      billingAddress: payload.billingAddress ?? {
        ...payload.shippingAddress,
        phone: normalizedPhone,
      },
      subtotal,
      discount,
      shippingFee,
      tax,
      totalAmount,
      paymentMethod: payload.paymentMethod,
      paymentStatus: PAYMENT_STATUS.PENDING,
      orderStatus: ORDER_STATUS.PENDING,
      couponCode: appliedCouponCode,
      notes: payload.notes ?? null,
    });

    // 5.2. Create SubOrders and OrderItems for each Seller group
    let vendorIndex = 1;
    for (const [groupKey, groupItems] of vendorGroups.entries()) {
      const isPlatformOwned = groupKey === "PLATFORM";
      const sellerId = isPlatformOwned ? null : groupItems[0].sellerId;
      const subOrderNumber = generateSubOrderNumber(orderNumber, vendorIndex++);

      const groupSubtotal = groupItems.reduce((acc, it) => acc + it.totalPrice, 0);

      // Determine commission rate
      let commissionRate = 0;
      if (!isPlatformOwned && sellerId) {
        const sellerProfile = await tx.orm.public.SellerProfile.where({ id: sellerId }).first();
        commissionRate =
          sellerProfile?.commissionRate !== null && sellerProfile?.commissionRate !== undefined
            ? sellerProfile.commissionRate
            : defaultCommissionRate;
      }

      // Calculate platform commission and seller net earnings
      const commissionAmount = isPlatformOwned ? 0 : (groupSubtotal * commissionRate) / 100;
      const sellerEarnings = isPlatformOwned ? groupSubtotal : groupSubtotal - commissionAmount;

      // Create SubOrder
      const subOrder = await tx.orm.public.SubOrder.create({
        subOrderNumber,
        orderId: order.id,
        sellerId,
        isPlatformOwned,
        subtotal: groupSubtotal,
        shippingFee: 0,
        tax: 0,
        totalAmount: groupSubtotal,
        commissionRate,
        commissionAmount,
        sellerEarnings,
        isPayoutSettled: false,
        status: ORDER_STATUS.PENDING,
      });

      // Create OrderItem records
      for (const it of groupItems) {
        await tx.orm.public.OrderItem.create({
          orderId: order.id,
          subOrderId: subOrder.id,
          productId: it.productId,
          variantId: it.variantId,
          sellerId: it.sellerId,
          productName: it.productName,
          variantTitle: it.variantTitle,
          productImage: it.productImage,
          sku: it.sku,
          price: it.price,
          quantity: it.quantity,
          totalPrice: it.totalPrice,
        });

        // 5.3. Deduct stock and increment totalSold
        if (it.variantId) {
          await tx.orm.public.ProductVariant.where({ id: it.variantId }).update({
            stock: Math.max(0, it.selectedVariant.stock - it.quantity),
          });
        }

        await tx.orm.public.Product.where({ id: it.productId }).update({
          stock: Math.max(0, it.product.stock - it.quantity),
          totalSold: it.product.totalSold + it.quantity,
        });
      }

      // Notify Seller if third-party vendor
      if (!isPlatformOwned && sellerId) {
        const sellerProfile = await tx.orm.public.SellerProfile.where({ id: sellerId }).first();
        if (sellerProfile) {
          await tx.orm.public.Notification.create({
            userId: sellerProfile.userId,
            title: `New Order Received: ${subOrderNumber}`,
            message: `You received a new order for ${groupItems.length} item(s). Total: ${groupSubtotal} BDT. Please process it.`,
            type: "ORDER",
            link: `/seller/orders/${subOrder.id}`,
          });
        }
      }
    }

    if (priced.coupon) {
      await tx.orm.public.Coupon.where({ id: priced.coupon.id }).update({
        usedCount: priced.coupon.usedCount + 1,
      });
    }

    await notify(
      tx,
      userId,
      `Order ${orderNumber} placed`,
      `Thanks for your order! We'll let you know when it's confirmed.`,
      `/orders/${orderNumber}`
    );

    // Clear cart items for this customer (or guest session)
    if (resolvedUserId) {
      await tx.orm.public.CartItem.where({ userId: resolvedUserId }).deleteAll();
    }
    if (sessionId) {
      await tx.orm.public.CartItem.where({ sessionId }).deleteAll();
    }

    return order;
  });
};

/* ============================================================
 * Order lifecycle helpers
 * ============================================================ */

type Requester = { id: number; role: string; sellerId?: number | null } | null | undefined;

/** Forward-only fulfilment pipeline; CANCELLED / RETURNED are side exits */
const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

const TERMINAL = new Set<string>([ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED]);

/** Statuses a customer may still cancel from */
const CUSTOMER_CANCELLABLE = new Set<string>([ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED]);

/**
 * Validate a sub-order status change. Sellers move one step at a time; admins may
 * skip ahead. Nobody moves backwards, and cancelled/returned are final.
 */
const assertTransition = (from: string, to: string, role: string) => {
  if (from === to) throw new AppError(`Order is already ${to.toLowerCase()}`, 400);
  if (TERMINAL.has(from)) throw new AppError(`A ${from.toLowerCase()} order can't be changed`, 400);

  if (to === ORDER_STATUS.CANCELLED) {
    if (from === ORDER_STATUS.SHIPPED || from === ORDER_STATUS.DELIVERED) {
      throw new AppError("Shipped or delivered orders can't be cancelled", 400);
    }
    return;
  }
  if (to === ORDER_STATUS.RETURNED) {
    if (from !== ORDER_STATUS.DELIVERED && from !== ORDER_STATUS.SHIPPED) {
      throw new AppError("Only shipped or delivered orders can be marked as returned", 400);
    }
    if (role !== USER_ROLES.ADMIN) throw new AppError("Only an admin can mark an order as returned", 403);
    return;
  }

  const fromRank = STATUS_RANK[from];
  const toRank = STATUS_RANK[to];
  if (fromRank === undefined || toRank === undefined) throw new AppError("Invalid order status", 400);
  if (toRank < fromRank) throw new AppError("Order status can't move backwards", 400);
  if (role !== USER_ROLES.ADMIN && toRank - fromRank > 1) {
    throw new AppError(`Next step for this order is ${Object.keys(STATUS_RANK)[fromRank + 1].toLowerCase()}`, 400);
  }
};

/** Main order status derived from its sub-orders */
const deriveOrderStatus = (statuses: string[]) => {
  const active = statuses.filter((s) => s !== ORDER_STATUS.CANCELLED);
  if (active.length === 0) return ORDER_STATUS.CANCELLED;
  const live = active.filter((s) => s !== ORDER_STATUS.RETURNED);
  if (live.length === 0) return ORDER_STATUS.RETURNED;
  // The order is only as far along as its slowest live shipment
  const minRank = Math.min(...live.map((s) => STATUS_RANK[s] ?? 0));
  return Object.keys(STATUS_RANK)[minRank];
};

/** Put stock back (and undo units sold) for a set of order items */
const restoreStock = async (tx: any, items: any[]) => {
  for (const it of items) {
    if (it.variantId) {
      const variant = await tx.orm.public.ProductVariant.where({ id: it.variantId }).first();
      if (variant) {
        await tx.orm.public.ProductVariant.where({ id: it.variantId }).update({ stock: variant.stock + it.quantity });
      }
    }
    const product = await tx.orm.public.Product.where({ id: it.productId }).first();
    if (product) {
      await tx.orm.public.Product.where({ id: it.productId }).update({
        stock: product.stock + it.quantity,
        totalSold: Math.max(0, product.totalSold - it.quantity),
      });
    }
  }
};

const notify = async (tx: any, userId: number | null | undefined, title: string, message: string, link: string) => {
  if (!userId) return;
  await tx.orm.public.Notification.create({ userId, title, message, type: "ORDER", link });
};

/**
 * Apply a status change to one sub-order inside a transaction: stock restore on
 * cancel/return, seller wallet credit on delivery and reversal on return.
 */
const applySubOrderStatus = async (
  tx: any,
  subOrder: any,
  status: string,
  extra: { trackingNumber?: string; courierName?: string } = {}
) => {
  const update: any = { status };
  if (extra.trackingNumber !== undefined) update.trackingNumber = extra.trackingNumber || null;
  if (extra.courierName !== undefined) update.courierName = extra.courierName || null;

  if (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.RETURNED) {
    const items = await tx.orm.public.OrderItem.where({ subOrderId: subOrder.id }).all();
    await restoreStock(tx, items);
  }

  // Credit the seller once the shipment is delivered
  if (status === ORDER_STATUS.DELIVERED && !subOrder.isPayoutSettled && subOrder.sellerId) {
    const wallet = await tx.orm.public.SellerWallet.where({ sellerId: subOrder.sellerId }).first();
    if (wallet) {
      update.isPayoutSettled = true;
      await tx.orm.public.SellerWallet.where({ id: wallet.id }).update({
        balance: wallet.balance + subOrder.sellerEarnings,
        totalEarnings: wallet.totalEarnings + subOrder.sellerEarnings,
        totalCommissionPaid: wallet.totalCommissionPaid + subOrder.commissionAmount,
      });
      await tx.orm.public.WalletTransaction.create({
        walletId: wallet.id,
        subOrderId: subOrder.id,
        amount: subOrder.sellerEarnings,
        type: TRANSACTION_TYPE.ORDER_EARNING,
        description: `Order delivery payout for sub-order #${subOrder.subOrderNumber} (Subtotal: ${subOrder.subtotal} BDT - Commission: ${subOrder.commissionAmount} BDT)`,
      });
    }
  }

  // Reverse the seller credit if a delivered shipment comes back
  if (status === ORDER_STATUS.RETURNED && subOrder.isPayoutSettled && subOrder.sellerId) {
    const wallet = await tx.orm.public.SellerWallet.where({ sellerId: subOrder.sellerId }).first();
    if (wallet) {
      update.isPayoutSettled = false;
      await tx.orm.public.SellerWallet.where({ id: wallet.id }).update({
        balance: wallet.balance - subOrder.sellerEarnings,
        totalEarnings: Math.max(0, wallet.totalEarnings - subOrder.sellerEarnings),
        totalCommissionPaid: Math.max(0, wallet.totalCommissionPaid - subOrder.commissionAmount),
      });
      await tx.orm.public.WalletTransaction.create({
        walletId: wallet.id,
        subOrderId: subOrder.id,
        amount: -subOrder.sellerEarnings,
        type: TRANSACTION_TYPE.REFUND_REVERSAL,
        description: `Return reversal for sub-order #${subOrder.subOrderNumber}`,
      });
    }
  }

  return await tx.orm.public.SubOrder.where({ id: subOrder.id }).update(update);
};

/**
 * Recompute the parent order's status (and COD payment) after sub-order changes
 */
const syncParentOrder = async (tx: any, orderId: number) => {
  const order = await tx.orm.public.Order.where({ id: orderId }).first();
  const subOrders = await tx.orm.public.SubOrder.where({ orderId }).all();
  const orderStatus = deriveOrderStatus(subOrders.map((s: any) => s.status));
  const update: any = { orderStatus };

  // Cash on delivery is collected when everything is delivered
  if (
    orderStatus === ORDER_STATUS.DELIVERED &&
    order.paymentMethod === "COD" &&
    order.paymentStatus === PAYMENT_STATUS.PENDING
  ) {
    update.paymentStatus = PAYMENT_STATUS.PAID;
  }

  if (orderStatus !== order.orderStatus || update.paymentStatus) {
    await tx.orm.public.Order.where({ id: orderId }).update(update);
    if (orderStatus !== order.orderStatus) {
      const labels: Record<string, string> = {
        CONFIRMED: "has been confirmed",
        PROCESSING: "is being packed",
        SHIPPED: "is on the way",
        DELIVERED: "has been delivered",
        CANCELLED: "has been cancelled",
        RETURNED: "has been returned",
      };
      if (labels[orderStatus]) {
        await notify(
          tx,
          order.userId,
          `Order ${order.orderNumber} ${labels[orderStatus]}`,
          `Your order ${order.orderNumber} ${labels[orderStatus]}.`,
          `/orders/${order.orderNumber}`
        );
      }
    }
  }
  return orderStatus;
};

/** Amount still payable after cancelled shipments (discount is prorated) */
const payableAmount = (order: any, subOrders: any[]) => {
  const activeSubtotal = subOrders
    .filter((s) => s.status !== ORDER_STATUS.CANCELLED)
    .reduce((sum, s) => sum + s.subtotal, 0);
  if (activeSubtotal === 0) return 0;
  const discount = order.subtotal > 0 ? (order.discount * activeSubtotal) / order.subtotal : 0;
  return Math.max(0, Math.round(activeSubtotal - discount + order.shippingFee + (order.tax ?? 0)));
};

/**
 * Batch-load items, sub-orders (with store info) and customers for a list of orders
 */
const hydrateOrders = async (orders: any[], { withCustomer = false } = {}) => {
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);
  const [items, subOrders] = await Promise.all([
    db.orm.public.OrderItem.where((i) => i.orderId.in(orderIds)).all(),
    db.orm.public.SubOrder.where((s) => s.orderId.in(orderIds)).all(),
  ]);

  const sellerIds = [...new Set(subOrders.map((s) => s.sellerId).filter((id): id is number => id != null))];
  const userIds = withCustomer
    ? [...new Set(orders.map((o) => o.userId).filter((id): id is number => id != null))]
    : [];
  const productIds = [...new Set(items.map((i) => i.productId))];

  const [sellers, users, products] = await Promise.all([
    sellerIds.length
      ? db.orm.public.SellerProfile.where((s) => s.id.in(sellerIds)).select("id", "storeName", "storeSlug", "phone").all()
      : [],
    userIds.length ? db.orm.public.User.where((u) => u.id.in(userIds)).select("id", "name", "email", "phone").all() : [],
    productIds.length ? db.orm.public.Product.where((p) => p.id.in(productIds)).select("id", "slug").all() : [],
  ]);
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const slugMap = new Map(products.map((p) => [p.id, p.slug]));

  return orders.map((order) => {
    const orderItems = items
      .filter((i) => i.orderId === order.id)
      .map((i) => ({ ...i, productSlug: slugMap.get(i.productId) ?? null }));
    const orderSubOrders = subOrders
      .filter((s) => s.orderId === order.id)
      .sort((x, y) => x.id - y.id)
      .map((s) => ({
        ...s,
        store: s.sellerId ? sellerMap.get(s.sellerId) ?? null : null,
        items: orderItems.filter((i) => i.subOrderId === s.id),
      }));
    return {
      ...order,
      customer: withCustomer && order.userId ? userMap.get(order.userId) ?? null : undefined,
      items: orderItems,
      subOrders: orderSubOrders,
      itemCount: orderItems.reduce((sum, i) => sum + i.quantity, 0),
      payableAmount: payableAmount(order, orderSubOrders),
      canCancel:
        orderSubOrders.length > 0 &&
        orderSubOrders.every((s) => CUSTOMER_CANCELLABLE.has(s.status) || s.status === ORDER_STATUS.CANCELLED) &&
        orderSubOrders.some((s) => s.status !== ORDER_STATUS.CANCELLED),
    };
  });
};

const normalizePhone = (p?: string | null) => (p ?? "").replace(/\D/g, "").replace(/^88/, "");

const findOrder = async (identifier: string | number) => {
  const asNumber = Number(identifier);
  const order =
    typeof identifier === "number" || (!Number.isNaN(asNumber) && String(identifier).trim() !== "")
      ? await db.orm.public.Order.where({ id: asNumber }).first()
      : await db.orm.public.Order.where({ orderNumber: String(identifier) }).first();
  if (!order) throw new AppError("Order not found", 404);
  return order;
};

/**
 * Who may see/act on an order: admins; the customer who placed it; a seller with a
 * shipment in it; or a guest who knows both the order number and the phone number.
 */
const assertOrderAccess = async (order: any, requester: Requester, guestPhone?: string) => {
  if (requester?.role === USER_ROLES.ADMIN) return;
  if (requester && order.userId === requester.id) return;
  if (requester?.role === USER_ROLES.SELLER && requester.sellerId) {
    const own = await db.orm.public.SubOrder.where({ orderId: order.id }).where({ sellerId: requester.sellerId }).first();
    if (own) return;
  }
  const phone = normalizePhone(guestPhone);
  if (phone.length >= 10) {
    const candidates = [order.guestPhone, (order.shippingAddress as any)?.phone].map(normalizePhone);
    if (candidates.includes(phone)) return;
  }
  // Same response as a missing order so order numbers can't be probed
  throw new AppError("Order not found", 404);
};

/* ============================================================
 * Customer
 * ============================================================ */

/**
 * Get Customer Orders (paginated, optional status filter)
 */
export const getCustomerOrders = async (
  userId: number,
  filters: { status?: string; page?: number; limit?: number } = {}
) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));

  let query = db.orm.public.Order.where({ userId });
  if (filters.status) query = query.where({ orderStatus: filters.status });

  const [countResult, orders] = await Promise.all([
    query.aggregate((a) => ({ total: a.count() })),
    query.orderBy([(o) => o.createdAt.desc(), (o) => o.id.desc()]).limit(limit).offset((page - 1) * limit).all(),
  ]);
  const total = Number(countResult.total) || 0;

  return {
    orders: await hydrateOrders(orders),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get Single Order Details by orderNumber or ID (access-checked)
 */
export const getOrderDetails = async (orderIdentifier: string | number, requestingUser?: Requester, guestPhone?: string) => {
  const order = await findOrder(orderIdentifier);
  await assertOrderAccess(order, requestingUser, guestPhone);
  const [hydrated] = await hydrateOrders([order], { withCustomer: requestingUser?.role === USER_ROLES.ADMIN });

  // Sellers only see their own shipments of a shared order
  if (requestingUser?.role === USER_ROLES.SELLER && order.userId !== requestingUser.id) {
    hydrated.subOrders = hydrated.subOrders.filter((s: any) => s.sellerId === requestingUser.sellerId);
    hydrated.items = hydrated.subOrders.flatMap((s: any) => s.items);
  }
  return hydrated;
};

/**
 * Customer (or guest with phone) cancels an order that hasn't been packed yet
 */
export const cancelOrderByCustomer = async (
  orderIdentifier: string | number,
  requestingUser: Requester,
  payload: { reason?: string; phone?: string }
) => {
  const order = await findOrder(orderIdentifier);
  // Sellers/admins use their own tools; here only the buyer (or guest) may cancel
  await assertOrderAccess(order, requestingUser?.role === USER_ROLES.ADMIN ? null : requestingUser, payload.phone);

  const subOrders = await db.orm.public.SubOrder.where({ orderId: order.id }).all();
  const active = subOrders.filter((s) => s.status !== ORDER_STATUS.CANCELLED);
  if (active.length === 0) throw new AppError("This order is already cancelled", 400);
  if (!active.every((s) => CUSTOMER_CANCELLABLE.has(s.status))) {
    const shipped = active.some((s) => s.status !== ORDER_STATUS.PROCESSING);
    throw new AppError(
      shipped
        ? "This order has already been shipped and can no longer be cancelled. Please contact support."
        : "This order is already being packed and can no longer be cancelled. Please contact support.",
      400
    );
  }

  const reason = payload.reason?.trim().slice(0, 300) || "No reason given";

  await db.transaction(async (tx) => {
    for (const so of active) {
      await applySubOrderStatus(tx, so, ORDER_STATUS.CANCELLED);
      if (so.sellerId) {
        const seller = await tx.orm.public.SellerProfile.where({ id: so.sellerId }).first();
        await notify(
          tx,
          seller?.userId,
          `Order cancelled: ${so.subOrderNumber}`,
          `The customer cancelled this order. Reason: ${reason}`,
          `/seller/orders/${so.id}`
        );
      }
    }
    if (order.couponCode) {
      const coupon = await tx.orm.public.Coupon.where({ code: order.couponCode }).first();
      if (coupon && coupon.usedCount > 0) {
        await tx.orm.public.Coupon.where({ id: coupon.id }).update({ usedCount: coupon.usedCount - 1 });
      }
    }
    await syncParentOrder(tx, order.id);
  });

  return getOrderDetails(order.id, { id: -1, role: USER_ROLES.ADMIN });
};

/* ============================================================
 * Seller
 * ============================================================ */

/**
 * Seller: Get their SubOrders list
 */
export const getSellerSubOrders = async (userId: number, status?: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  let query = db.orm.public.SubOrder.where({ sellerId: seller.id });
  if (status) {
    query = query.where({ status });
  }

  const subOrders = await query.orderBy((o) => o.createdAt.desc()).all();
  if (subOrders.length === 0) return [];

  const ids = subOrders.map((s) => s.id);
  const orderIds = [...new Set(subOrders.map((s) => s.orderId))];
  const [items, parents] = await Promise.all([
    db.orm.public.OrderItem.where((i) => i.subOrderId.in(ids)).all(),
    db.orm.public.Order.where((o) => o.id.in(orderIds)).all(),
  ]);
  const parentMap = new Map(parents.map((o) => [o.id, o]));

  return subOrders.map((so) => {
    const parent = parentMap.get(so.orderId);
    return {
      ...so,
      items: items.filter((i) => i.subOrderId === so.id),
      orderNumber: parent?.orderNumber,
      shippingAddress: parent?.shippingAddress,
      paymentStatus: parent?.paymentStatus,
      paymentMethod: parent?.paymentMethod,
    };
  });
};

/* ============================================================
 * Seller & Admin: fulfilment
 * ============================================================ */

/**
 * Update one SubOrder's status (validated transition, stock / wallet side effects,
 * parent order + COD payment kept in sync)
 */
export const updateSubOrderStatus = async (
  subOrderId: number,
  requestingUser: { id: number; role: string; sellerId?: number | null },
  payload: { status: string; trackingNumber?: string; courierName?: string }
) => {
  const subOrder = await db.orm.public.SubOrder.where({ id: subOrderId }).first();
  if (!subOrder) {
    throw new AppError("SubOrder not found", 404);
  }

  if (requestingUser.role === USER_ROLES.SELLER && subOrder.sellerId !== requestingUser.sellerId) {
    throw new AppError("You can only manage your own sub-orders", 403);
  }
  // Platform-owned shipments are fulfilled by the admin team
  if (requestingUser.role !== USER_ROLES.ADMIN && subOrder.isPlatformOwned) {
    throw new AppError("Only an admin can manage platform orders", 403);
  }

  const tracking = { trackingNumber: payload.trackingNumber, courierName: payload.courierName };
  const onlyTracking = payload.status === subOrder.status;
  if (!onlyTracking) assertTransition(subOrder.status, payload.status, requestingUser.role);

  return await db.transaction(async (tx) => {
    const updated = onlyTracking
      ? await tx.orm.public.SubOrder.where({ id: subOrderId }).update({
          trackingNumber: payload.trackingNumber ?? subOrder.trackingNumber,
          courierName: payload.courierName ?? subOrder.courierName,
        })
      : await applySubOrderStatus(tx, subOrder, payload.status, tracking);
    await syncParentOrder(tx, subOrder.orderId);
    return updated;
  });
};

/**
 * Admin: move every active shipment of an order to a status in one go
 */
export const adminUpdateOrderStatus = async (
  orderId: number,
  admin: { id: number; role: string },
  payload: { status: string; reason?: string }
) => {
  const order = await findOrder(orderId);
  const subOrders = await db.orm.public.SubOrder.where({ orderId: order.id }).all();
  const targets = subOrders.filter((s) => !TERMINAL.has(s.status) && s.status !== payload.status);
  if (targets.length === 0) throw new AppError(`Nothing to update — order is already ${payload.status.toLowerCase()}`, 400);
  targets.forEach((s) => assertTransition(s.status, payload.status, admin.role));

  await db.transaction(async (tx) => {
    for (const so of targets) {
      await applySubOrderStatus(tx, so, payload.status);
      if (payload.status === ORDER_STATUS.CANCELLED && so.sellerId) {
        const seller = await tx.orm.public.SellerProfile.where({ id: so.sellerId }).first();
        await notify(
          tx,
          seller?.userId,
          `Order cancelled by admin: ${so.subOrderNumber}`,
          payload.reason?.trim() ? `Reason: ${payload.reason.trim()}` : "This order was cancelled by the Shopora team.",
          `/seller/orders/${so.id}`
        );
      }
    }
    if (payload.status === ORDER_STATUS.CANCELLED && order.couponCode) {
      const coupon = await tx.orm.public.Coupon.where({ code: order.couponCode }).first();
      if (coupon && coupon.usedCount > 0) {
        await tx.orm.public.Coupon.where({ id: coupon.id }).update({ usedCount: coupon.usedCount - 1 });
      }
    }
    await syncParentOrder(tx, order.id);
  });

  return getOrderDetails(order.id, admin);
};

/* ============================================================
 * Admin
 * ============================================================ */

/**
 * Admin: Get all Orders with search, filters and per-status counts
 */
export const adminGetAllOrders = async (filters: {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  // Base query without the status filter, so the tab counts reflect the search
  let base = db.orm.public.Order;
  if (filters.paymentStatus) base = base.where({ paymentStatus: filters.paymentStatus });
  if (filters.paymentMethod) base = base.where({ paymentMethod: filters.paymentMethod });
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    const pattern = `%${term}%`;
    const users = await db.orm.public.User.where((u, { fns }) => fns.or(u.name.ilike(pattern), u.email.ilike(pattern)))
      .select("id")
      .all();
    const userIds = users.map((u) => u.id);
    base = base.where((o, { fns }) =>
      userIds.length
        ? fns.or(o.orderNumber.ilike(pattern), o.guestPhone.ilike(pattern), o.guestEmail.ilike(pattern), o.userId.in(userIds))
        : fns.or(o.orderNumber.ilike(pattern), o.guestPhone.ilike(pattern), o.guestEmail.ilike(pattern))
    );
  }

  const query = filters.status ? base.where({ orderStatus: filters.status }) : base;

  const [countResult, statusGroups, orders] = await Promise.all([
    query.aggregate((a) => ({ total: a.count() })),
    base.groupBy("orderStatus").aggregate((a) => ({ count: a.count(), revenue: a.sum("totalAmount") })),
    query.orderBy([(o) => o.createdAt.desc(), (o) => o.id.desc()]).limit(limit).offset(offset).all(),
  ]);

  const total = Number(countResult.total) || 0;
  const counts: Record<string, number> = { ALL: 0 };
  let revenue = 0;
  for (const g of statusGroups) {
    const c = Number(g.count) || 0;
    counts[g.orderStatus] = c;
    counts.ALL += c;
    if (g.orderStatus === ORDER_STATUS.DELIVERED) revenue += Number(g.revenue) || 0;
  }

  return {
    orders: await hydrateOrders(orders, { withCustomer: true }),
    counts,
    revenue,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Admin: Update Payment Status (e.g. mark COD as PAID or refund)
 */
export const updatePaymentStatus = async (
  orderId: number,
  payload: { paymentStatus: string; transactionId?: string }
) => {
  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  return await db.orm.public.Order.where({ id: orderId }).update({
    paymentStatus: payload.paymentStatus,
    paymentTransactionId: payload.transactionId ?? order.paymentTransactionId,
  });
};

export const OrderService = {
  quoteOrder,
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  cancelOrderByCustomer,
  adminUpdateOrderStatus,
  getSellerSubOrders,
  updateSubOrderStatus,
  adminGetAllOrders,
  updatePaymentStatus,
};
