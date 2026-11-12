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
  ESCROW_STATUS,
  ENABLED_PAYMENT_METHODS,
  type PaymentMethod,
} from "../../constants/index.ts";
import { ENV } from "../../config/env.ts";
import { adjustWallet, transitionEscrow } from "../payouts/wallet.ts";
import { getAllSettings } from "../settings/settings.service.ts";
import { toPaisa, toTaka, paisaToTaka, fromPaisa, percentOfPaisa, toDb, toDbOrNull, toDbRate } from "../../utils/money.ts";

import type {
  IOrderItemInput,
  IShippingAddress,
  IPricedLine,
  ICreateOrderPayload,
  IOrderRequester,
} from "./order.interface.ts";

export type { IOrderItemInput, IPricedLine };

export const SHIPPING_RULES = { freeShippingThreshold: 1500, flatFee: 70 } as const;

/** Round paisa to whole taka (half away from zero) */
const roundToTaka = (paisa: number) => Math.sign(paisa) * Math.round(Math.abs(paisa) / 100) * 100;

/** Shipping fee and free-shipping threshold from settings, in paisa */
const shippingRules = (settings: Record<string, any>) => ({
  standardFee: toPaisa(
    typeof settings.shipping_fee_standard === "number" ? settings.shipping_fee_standard : SHIPPING_RULES.flatFee
  ),
  freeShippingThreshold: toPaisa(
    typeof settings.free_shipping_threshold === "number"
      ? settings.free_shipping_threshold
      : SHIPPING_RULES.freeShippingThreshold
  ),
});

/**
 * Shipping for one vendor package (multi-vendor split shipping): free when every item ships
 * free or the package subtotal reaches the threshold. Shared by quotes and checkout.
 */
const packageShippingPaisa = (
  lines: Pick<IPricedLine, "isFreeShipping">[],
  subtotalPaisa: number,
  rules: { standardFee: number; freeShippingThreshold: number }
) =>
  lines.length === 0 || lines.every((l) => l.isFreeShipping) || subtotalPaisa >= rules.freeShippingThreshold
    ? 0
    : rules.standardFee;

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
  const eligibleSubtotal = eligible.reduce((sum, l) => sum + toPaisa(l.totalPrice), 0);
  if (eligible.length === 0) return fail("This coupon doesn't apply to items in your cart");
  const minOrder = toPaisa(coupon.minOrderAmount);
  if (eligibleSubtotal < minOrder) {
    return fail(`Add ৳${Math.ceil(paisaToTaka(minOrder - eligibleSubtotal)).toLocaleString("en-US")} more to use this coupon`);
  }

  let discount =
    coupon.discountType === "PERCENTAGE"
      ? percentOfPaisa(eligibleSubtotal, coupon.discountValue)
      : toPaisa(coupon.discountValue);
  const maxDiscount = toPaisa(coupon.maxDiscountAmount);
  if (maxDiscount > 0 && discount > maxDiscount) discount = maxDiscount;
  // Discounts are whole taka
  discount = roundToTaka(Math.min(discount, eligibleSubtotal));

  return { coupon, discount: paisaToTaka(discount), message: "Coupon applied" };
};

/**
 * Price an order: validates products, variants and stock, applies the coupon and
 * shipping rules. Shared by checkout and the cart/checkout quote endpoint so the
 * totals a customer sees are exactly what gets charged.
 */
export const priceOrder = async (items: IOrderItemInput[], couponCode?: string) => {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const [products, variants] = await Promise.all([
    productIds.length ? db.orm.public.Product.where((p) => p.id.in(productIds)).all() : [],
    variantIds.length ? db.orm.public.ProductVariant.where((v) => v.id.in(variantIds)).all() : [],
  ]);

  const allUseMediaIds = [
    ...new Set([
      ...products.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId),
      ...variants.map((v: any) => v.imageId ?? v.useMediaId),
    ].filter((id): id is string => typeof id === "string" && Boolean(id))),
  ];
  const useMedias = allUseMediaIds.length ? await db.orm.public.UseMedia.where((um) => um.id.in(allUseMediaIds)).all() : [];
  const mediaIds = [...new Set(useMedias.map((um) => um.mediaId))];
  const medias = mediaIds.length ? await db.orm.public.Media.where((m) => m.id.in(mediaIds)).all() : [];
  const mediaMap = new Map(medias.map((m) => [m.id, m.url]));
  const useMediaUrlMap = new Map(useMedias.map((um) => [um.id, mediaMap.get(um.mediaId) ?? ""]));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const lines: IPricedLine[] = [];
  const issues: { productId: string; variantId: string | null; message: string }[] = [];

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
    let unitPrice = toTaka(product.basePrice);
    let comparePrice = product.comparePrice != null ? toTaka(product.comparePrice) : null;
    let costPrice = product.costPrice != null ? toTaka(product.costPrice) : null;
    let stock = product.stock;
    let variantTitle: string | null = null;
    let sku = product.sku;

    if (product.productType === PRODUCT_TYPE.VARIABLE && variantId) {
      selectedVariant = variantMap.get(variantId);
      if (!selectedVariant || !selectedVariant.isActive || selectedVariant.productId !== product.id) {
        issue(`Selected option for "${product.name}" is no longer available`);
        continue;
      }
      unitPrice = toTaka(selectedVariant.price);
      comparePrice = selectedVariant.comparePrice != null ? toTaka(selectedVariant.comparePrice) : null;
      const variantCost = selectedVariant.costPrice ?? product.costPrice;
      costPrice = variantCost != null ? toTaka(variantCost) : null;
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

    const vImgId = selectedVariant?.imageId ?? selectedVariant?.useMediaId;
    const pImgId = (product as any)?.mainImageId ?? (product as any)?.mainImageUseMediaId;
    const variantImageUrl = vImgId ? useMediaUrlMap.get(vImgId) : null;
    const productImageUrl = pImgId ? useMediaUrlMap.get(pImgId) : null;

    lines.push({
      product,
      selectedVariant,
      productId: product.id,
      variantId,
      sellerId: product.sellerId ?? null,
      isPlatformOwned: product.isPlatformOwned,
      productName: product.name,
      variantTitle,
      productImage: variantImageUrl || productImageUrl || null,
      sku,
      price: unitPrice,
      comparePrice,
      costPrice,
      quantity: item.quantity,
      totalPrice: paisaToTaka(toPaisa(unitPrice) * item.quantity),
      isFreeShipping: Boolean(product.isFreeShipping),
    });
  }

  // All totals are summed in paisa and converted back to taka once
  const subtotalPaisa = lines.reduce((sum, l) => sum + toPaisa(l.totalPrice), 0);
  const savingsPaisa = lines.reduce(
    (sum, l) =>
      sum + (l.comparePrice && l.comparePrice > l.price ? (toPaisa(l.comparePrice) - toPaisa(l.price)) * l.quantity : 0),
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
  const { standardFee, freeShippingThreshold } = shippingRules(settings);
  const vatPercentage = typeof settings.vat_percentage === "number" ? settings.vat_percentage : 0;

  // Group lines by vendor (Platform vs individual sellers) - Daraz Multi-Vendor Split Shipping Model
  const vendorGroupsMap = new Map<string, IPricedLine[]>();
  for (const line of lines) {
    const key = line.isPlatformOwned || !line.sellerId ? "PLATFORM" : line.sellerId;
    const existing = vendorGroupsMap.get(key) || [];
    existing.push(line);
    vendorGroupsMap.set(key, existing);
  }

  let totalShippingPaisa = 0;
  const packages: Array<{
    sellerId: string | null;
    isPlatformOwned: boolean;
    itemCount: number;
    subtotal: number;
    shippingFee: number;
    isFreeShipping: boolean;
  }> = [];

  for (const [key, groupLines] of vendorGroupsMap.entries()) {
    const groupSubtotal = groupLines.reduce((acc, l) => acc + toPaisa(l.totalPrice), 0);
    const packageFee = packageShippingPaisa(groupLines, groupSubtotal, { standardFee, freeShippingThreshold });
    totalShippingPaisa += packageFee;

    packages.push({
      sellerId: key === "PLATFORM" ? null : key,
      isPlatformOwned: key === "PLATFORM",
      itemCount: groupLines.reduce((acc, l) => acc + l.quantity, 0),
      subtotal: paisaToTaka(groupSubtotal),
      shippingFee: paisaToTaka(packageFee),
      isFreeShipping: packageFee === 0,
    });
  }

  const discountPaisa = toPaisa(discount);
  const shippingPaisa = lines.length === 0 ? 0 : totalShippingPaisa;
  // VAT is whole taka
  const taxPaisa = roundToTaka(percentOfPaisa(subtotalPaisa, vatPercentage));
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa + shippingPaisa + taxPaisa);

  return {
    lines,
    issues,
    subtotal: paisaToTaka(subtotalPaisa),
    savings: paisaToTaka(savingsPaisa),
    discount: paisaToTaka(discountPaisa),
    coupon,
    couponMessage,
    shippingFee: paisaToTaka(shippingPaisa),
    packages,
    tax: paisaToTaka(taxPaisa),
    totalAmount: paisaToTaka(totalPaisa),
    freeShippingThreshold: paisaToTaka(freeShippingThreshold),
  };
};

/**
 * Public price quote for the cart / checkout summary
 */
export const quoteOrder = async (items: IOrderItemInput[], couponCode?: string) => {
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
    packages: priced.packages,
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
  userId: string | { id?: string } | null,
  payload: ICreateOrderPayload,
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
    let resolvedUserId: string | null = typeof userId === "object" && userId !== null ? (userId as any).id ?? null : userId;

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
      shippingAddress: ({
        ...payload.shippingAddress,
        phone: normalizedPhone,
      } as any),
      billingAddress: ((payload.billingAddress ?? {
        ...payload.shippingAddress,
        phone: normalizedPhone,
      }) as any),
      subtotal: toDb(subtotal),
      discount: toDb(discount),
      shippingFee: toDb(shippingFee),
      tax: toDb(tax),
      totalAmount: toDb(totalAmount),
      paymentMethod: payload.paymentMethod,
      paymentStatus: PAYMENT_STATUS.PENDING,
      orderStatus: ORDER_STATUS.PENDING,
      couponCode: appliedCouponCode,
      notes: payload.notes ?? null,
    });

    // 5.2. Create SubOrders and OrderItems for each Seller group
    const rules = shippingRules(settings);
    // Seller profiles for every vendor in the cart, fetched once
    const sellerIds = [...new Set(validatedItems.map((it) => it.sellerId).filter((id): id is string => Boolean(id)))];
    const sellerProfiles = sellerIds.length > 0
      ? await tx.orm.public.SellerProfile.where((sp) => sp.id.in(sellerIds)).select("id", "userId", "commissionRate").all()
      : [];
    const sellerProfileMap = new Map(sellerProfiles.map((sp) => [sp.id, sp]));
    // Notifications are collected and written in one insert at the end
    const notifications: { userId: string; title: string; message: string; type: string; link: string }[] = [];

    let vendorIndex = 1;
    for (const [groupKey, groupItems] of vendorGroups.entries()) {
      const isPlatformOwned = groupKey === "PLATFORM";
      const sellerId = isPlatformOwned ? null : groupItems[0].sellerId;
      const subOrderNumber = generateSubOrderNumber(orderNumber, vendorIndex++);

      const groupSubtotal = groupItems.reduce((acc, it) => acc + toPaisa(it.totalPrice), 0);

      // Determine commission rate (percent)
      let commissionRate: string | number = 0;
      if (!isPlatformOwned && sellerId) {
        const sellerProfile = sellerProfileMap.get(sellerId);
        commissionRate =
          sellerProfile?.commissionRate !== null && sellerProfile?.commissionRate !== undefined
            ? sellerProfile.commissionRate
            : defaultCommissionRate;
      }

      // Calculate platform commission and seller net earnings
      const commissionAmount = isPlatformOwned ? 0 : percentOfPaisa(groupSubtotal, commissionRate);
      const sellerEarnings = groupSubtotal - commissionAmount;

      // Multi-Vendor Split Shipping Calculation for this vendor package (same rule as the quote)
      const packageShippingFee = packageShippingPaisa(groupItems, groupSubtotal, rules);

      // Create SubOrder
      const subOrder = await tx.orm.public.SubOrder.create({
        subOrderNumber,
        orderId: order.id,
        sellerId,
        isPlatformOwned,
        subtotal: fromPaisa(groupSubtotal),
        shippingFee: fromPaisa(packageShippingFee),
        shippingCost: fromPaisa(packageShippingFee),
        tax: fromPaisa(0),
        totalAmount: fromPaisa(groupSubtotal + packageShippingFee),
        commissionRate: toDbRate(commissionRate),
        commissionAmount: fromPaisa(commissionAmount),
        sellerEarnings: fromPaisa(sellerEarnings),
        isPayoutSettled: false,
        escrowStatus: "PENDING",
        status: ORDER_STATUS.PENDING,
      });

      // Create OrderItem records (one insert per vendor package)
      await tx.orm.public.OrderItem.createAndCount(
        groupItems.map((it) => ({
          orderId: order.id,
          subOrderId: subOrder.id,
          productId: it.productId,
          variantId: it.variantId,
          sellerId: it.sellerId,
          productName: it.productName,
          variantTitle: it.variantTitle,
          productImage: it.productImage,
          sku: it.sku,
          price: toDb(it.price),
          costPrice: toDbOrNull(it.costPrice),
          quantity: it.quantity,
          totalPrice: toDb(it.totalPrice),
        }))
      );

      // 5.3. Deduct stock and increment totalSold
      for (const it of groupItems) {
        await deductStock(tx, { ...it, variantId: it.selectedVariant ? it.variantId : null });
      }

      // Notify Seller if third-party vendor
      const sellerUserId = sellerId ? sellerProfileMap.get(sellerId)?.userId : undefined;
      if (!isPlatformOwned && sellerUserId) {
        notifications.push({
          userId: sellerUserId,
          title: `New Order Received: ${subOrderNumber}`,
          message: `You received a new order for ${groupItems.length} item(s). Total: ${paisaToTaka(groupSubtotal)} BDT. Please process it.`,
          type: "ORDER",
          link: `/seller/orders/${subOrder.id}`,
        });
      }
    }

    if (priced.coupon) {
      await claimCouponUse(tx, priced.coupon.id);
    }

    await notify(
      tx,
      resolvedUserId,
      `Order ${orderNumber} placed`,
      `Thanks for your order! We'll let you know when it's confirmed.`,
      `/orders/${orderNumber}`
    );

    // Broadcast notification to all store Administrators
    const admins = await tx.orm.public.User.where({ role: "ADMIN", isActive: true }).select("id").all();
    for (const admin of admins) {
      notifications.push({
        userId: admin.id,
        title: `New Order Placed: ${orderNumber}`,
        message: `${payload.shippingAddress.fullName} placed order #${orderNumber} (${payload.items.length} item(s), Total: ${toTaka(order.totalAmount)} BDT).`,
        type: "ORDER",
        link: `/admin/orders/${order.id}`,
      });
    }
    if (notifications.length > 0) {
      await tx.orm.public.Notification.createAndCount(notifications);
    }

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

type Requester = IOrderRequester | null | undefined;

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

/**
 * Atomically deduct stock for one order line. The `stock >= qty` guard runs in the
 * same UPDATE, so two concurrent checkouts can never both take the last unit.
 */
const deductStock = async (tx: any, it: { productId: string; variantId?: string | null; quantity: number; productName: string; variantTitle?: string | null }) => {
  const qty = it.quantity;
  const label = `"${it.productName}${it.variantTitle ? ` (${it.variantTitle})` : ""}"`;

  if (it.variantId) {
    const { affectedRows } = await tx.execute(
      db.raw.sql`UPDATE "ProductVariant" SET "stock" = "stock" - ${qty} WHERE "id" = ${it.variantId} AND "stock" >= ${qty}`
        .affectedCount()
        .build()
    );
    if (affectedRows === 0) throw new AppError(`${label} just went out of stock. Please update your cart.`, 409);

    // Variant stock is the source of truth; the product-level counter is kept as a floor-at-zero aggregate
    await tx.execute(
      db.raw.sql`UPDATE "Product" SET "stock" = GREATEST("stock" - ${qty}, 0), "totalSold" = "totalSold" + ${qty} WHERE "id" = ${it.productId}`
        .affectedCount()
        .build()
    );
    return;
  }

  const { affectedRows } = await tx.execute(
    db.raw.sql`UPDATE "Product" SET "stock" = "stock" - ${qty}, "totalSold" = "totalSold" + ${qty} WHERE "id" = ${it.productId} AND "stock" >= ${qty}`
      .affectedCount()
      .build()
  );
  if (affectedRows === 0) throw new AppError(`${label} just went out of stock. Please update your cart.`, 409);
};

/** Put stock back (and undo units sold) for a set of order items */
const restoreStock = async (tx: any, items: any[]) => {
  for (const it of items) {
    if (it.variantId) {
      await tx.execute(
        db.raw.sql`UPDATE "ProductVariant" SET "stock" = "stock" + ${it.quantity} WHERE "id" = ${it.variantId}`
          .affectedCount()
          .build()
      );
    }
    await tx.execute(
      db.raw.sql`UPDATE "Product" SET "stock" = "stock" + ${it.quantity}, "totalSold" = GREATEST("totalSold" - ${it.quantity}, 0) WHERE "id" = ${it.productId}`
        .affectedCount()
        .build()
    );
  }
};

/** Atomically count one coupon use, refusing if the usage limit was reached concurrently */
const claimCouponUse = async (tx: any, couponId: string) => {
  const { affectedRows } = await tx.execute(
    db.raw.sql`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`
      .affectedCount()
      .build()
  );
  if (affectedRows === 0) throw new AppError("This coupon has reached its usage limit", 409);
};

/** Give a coupon use back (order cancelled) */
const releaseCouponUse = async (tx: any, couponCode: string) => {
  await tx.execute(
    db.raw.sql`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "code" = ${couponCode}`
      .affectedCount()
      .build()
  );
};

const notify = async (tx: any, userId: string | null | undefined, title: string, message: string, link: string) => {
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

  const earnings = toPaisa(subOrder.sellerEarnings);
  const commission = toPaisa(subOrder.commissionAmount);

  // Credit the seller once the shipment is delivered via Escrow Hold.
  // The PENDING -> HELD transition is atomic, so a repeated "delivered" update can't credit twice.
  if (status === ORDER_STATUS.DELIVERED && subOrder.sellerId) {
    const wallet = await tx.orm.public.SellerWallet.where({ sellerId: subOrder.sellerId }).select("id").first();
    if (wallet && (await transitionEscrow(tx, subOrder.id, [ESCROW_STATUS.PENDING], ESCROW_STATUS.HELD, { settled: false }))) {
      const holdDays = 7; // 7-day escrow return window
      const holdUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
      update.escrowHoldUntil = holdUntil;

      await adjustWallet(
        tx,
        wallet.id,
        { pendingBalance: earnings, totalEarnings: earnings, totalCommissionPaid: commission },
        {
          subOrderId: subOrder.id,
          amount: earnings,
          type: TRANSACTION_TYPE.ORDER_EARNING,
          description: `Delivered order payout held in escrow for ${holdDays} days (Available on ${new Date(holdUntil).toLocaleDateString()})`,
        }
      );
    }
  }

  // Reverse the seller credit if a delivered shipment comes back during or after escrow.
  // Only money that was actually credited (HELD or RELEASED) is reversed, exactly once.
  if (status === ORDER_STATUS.RETURNED && subOrder.sellerId) {
    const wallet = await tx.orm.public.SellerWallet.where({ sellerId: subOrder.sellerId }).select("id").first();
    const wasReleased = subOrder.escrowStatus === ESCROW_STATUS.RELEASED;
    if (
      wallet &&
      (await transitionEscrow(tx, subOrder.id, [ESCROW_STATUS.HELD, ESCROW_STATUS.RELEASED], ESCROW_STATUS.REFUNDED, { settled: false }))
    ) {
      // A released payout comes out of the available balance, which may go negative (seller owes it back)
      await adjustWallet(
        tx,
        wallet.id,
        wasReleased
          ? { balance: -earnings, totalEarnings: -earnings, totalCommissionPaid: -commission }
          : { pendingBalance: -earnings, totalEarnings: -earnings, totalCommissionPaid: -commission },
        {
          subOrderId: subOrder.id,
          amount: -earnings,
          type: TRANSACTION_TYPE.REFUND_REVERSAL,
          description: `Return reversal for sub-order #${subOrder.subOrderNumber}`,
        }
      );
    }
  }

  return await tx.orm.public.SubOrder.where({ id: subOrder.id }).update(update);
};

/**
 * Recompute the parent order's status (and COD payment) after sub-order changes
 */
export const syncParentOrder = async (tx: any, orderId: string) => {
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
    .reduce((sum, s) => sum + toPaisa(s.subtotal), 0);
  if (activeSubtotal === 0) return 0;
  const orderSubtotal = toPaisa(order.subtotal);
  const discount = orderSubtotal > 0 ? Math.round((toPaisa(order.discount) * activeSubtotal) / orderSubtotal) : 0;
  const payable = activeSubtotal - discount + toPaisa(order.shippingFee) + toPaisa(order.tax);
  // Whole taka, as before
  return Math.max(0, Math.round(payable / 100));
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

  const sellerIds = [...new Set(subOrders.map((s) => s.sellerId).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const userIds = withCustomer
    ? [...new Set(orders.map((o) => o.userId).filter((id): id is string => typeof id === "string" && Boolean(id)))]
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
      .sort((x, y) => x.id.localeCompare(y.id))
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
  const str = String(identifier).trim();
  let order = await db.orm.public.Order.where({ id: str }).first();
  if (!order) {
    order = await db.orm.public.Order.where({ orderNumber: str }).first();
  }
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
  userId: string,
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
      await releaseCouponUse(tx, order.couponCode);
    }
    await syncParentOrder(tx, order.id);
  });

  return getOrderDetails(order.id, { id: "system", role: USER_ROLES.ADMIN });
};

/* ============================================================
 * Seller
 * ============================================================ */

/**
 * Seller: Get their SubOrders list
 */
export const getSellerSubOrders = async (userId: string, status?: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  let query = db.orm.public.SubOrder.where({ sellerId: seller.id });
  if (status) {
    query = query.where({ status });
  }

  const subOrders: any[] = await query
    .orderBy((o) => o.createdAt.desc())
    .include("order")
    .include("items")
    .all();

  return subOrders.map((so) => ({
    ...so,
    items: so.items || [],
    orderNumber: so.order?.orderNumber,
    // Customer personal information & address are kept hidden from sellers for privacy
    shippingAddress: null,
    destinationCity: (so.order?.shippingAddress as any)?.city ?? null,
    destinationState: (so.order?.shippingAddress as any)?.state ?? null,
    paymentStatus: so.order?.paymentStatus,
    paymentMethod: so.order?.paymentMethod,
  }));
};

/* ============================================================
 * Seller & Admin: fulfilment
 * ============================================================ */

/**
 * Update one SubOrder's status (validated transition, stock / wallet side effects,
 * parent order + COD payment kept in sync)
 */
export const updateSubOrderStatus = async (
  subOrderId: string,
  requestingUser: { id: string; role: string; sellerId?: string | null },
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
  orderId: string,
  admin: { id: string; role: string },
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
      await releaseCouponUse(tx, order.couponCode);
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
  let revenuePaisa = 0;
  for (const g of statusGroups) {
    const c = Number(g.count) || 0;
    counts[g.orderStatus] = c;
    counts.ALL += c;
    if (g.orderStatus === ORDER_STATUS.DELIVERED) revenuePaisa += toPaisa(g.revenue);
  }
  const revenue = paisaToTaka(revenuePaisa);

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
  orderId: string,
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

/**
 * Seller: Get a single SubOrder by ID
 */
export const getSellerSubOrderById = async (userId: string, subOrderId: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  const subOrder: any = await db.orm.public.SubOrder
    .where({ id: subOrderId, sellerId: seller.id })
    .include("order")
    .include("items")
    .first();

  if (!subOrder) {
    throw new AppError("Sub-order not found", 404);
  }

  const items = subOrder.items || [];
  return {
    ...subOrder,
    items,
    orderNumber: subOrder.order?.orderNumber,
    // Customer personal information & address are kept hidden from sellers for privacy
    shippingAddress: null,
    destinationCity: (subOrder.order?.shippingAddress as any)?.city ?? null,
    destinationState: (subOrder.order?.shippingAddress as any)?.state ?? null,
    paymentStatus: subOrder.order?.paymentStatus,
    paymentMethod: subOrder.order?.paymentMethod,
    totalItems: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
  };
};

/**
 * Escrow: Release matured suborders whose 7-day return hold has elapsed
 */
export const releaseMaturedEscrow = async () => {
  const matureSubOrders = await db.orm.public.SubOrder
    .where({ status: ORDER_STATUS.DELIVERED, escrowStatus: ESCROW_STATUS.HELD })
    .all();

  const toRelease = matureSubOrders.filter(
    (s: any) => s.sellerId && s.escrowHoldUntil && new Date(s.escrowHoldUntil).getTime() <= Date.now()
  );

  let releasedCount = 0;
  for (const s of toRelease) {
    if (await releaseEscrow(s, `Escrow released to available balance for sub-order #${s.subOrderNumber}`)) {
      releasedCount++;
    }
  }

  return { releasedCount };
};

/**
 * Move one sub-order's held earnings from pending to available balance. The HELD -> RELEASED
 * transition and the wallet move happen in one transaction, so a cron run racing an admin's
 * manual release can never pay the seller twice. Returns false when it was already released.
 */
const releaseEscrow = async (subOrder: any, description: string) => {
  const wallet = await db.orm.public.SellerWallet.where({ sellerId: subOrder.sellerId }).select("id").first();
  if (!wallet) throw new AppError("Seller wallet not found", 404);
  const earnings = toPaisa(subOrder.sellerEarnings);

  return await db.transaction(async (tx) => {
    const moved = await transitionEscrow(tx, subOrder.id, [ESCROW_STATUS.HELD], ESCROW_STATUS.RELEASED, {
      releasedAt: true,
      settled: true,
    });
    if (!moved) return false;
    await adjustWallet(
      tx,
      wallet.id,
      { pendingBalance: -earnings, balance: earnings },
      { subOrderId: subOrder.id, amount: earnings, type: TRANSACTION_TYPE.ESCROW_RELEASE, description }
    );
    return true;
  });
};

/**
 * Admin: Manually release escrow early for a sub-order
 */
export const releaseSubOrderEscrowEarly = async (subOrderId: string, adminUser: any) => {
  if (adminUser.role !== USER_ROLES.ADMIN) {
    throw new AppError("Only administrators can release escrow early", 403);
  }

  const subOrder = await db.orm.public.SubOrder.where({ id: subOrderId }).first();
  if (!subOrder) throw new AppError("Sub-order not found", 404);
  if (!subOrder.sellerId) throw new AppError("Platform shipments do not have seller escrow", 400);
  if (subOrder.escrowStatus === ESCROW_STATUS.RELEASED) throw new AppError("Escrow already released", 400);
  // Only delivered shipments have earnings sitting in escrow
  if (subOrder.escrowStatus !== ESCROW_STATUS.HELD) {
    throw new AppError("Only delivered shipments with earnings held in escrow can be released", 400);
  }

  const released = await releaseEscrow(subOrder, `Admin manual early escrow release for #${subOrder.subOrderNumber}`);
  if (!released) throw new AppError("Escrow already released", 409);

  return { success: true, message: `Escrow released for #${subOrder.subOrderNumber}` };
};

/**
 * Seller: View active escrow holds
 */
export const getSellerEscrowHoldings = async (userId: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) throw new AppError("Seller profile not found", 404);

  const heldSubOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id, escrowStatus: "HELD" })
    .orderBy((s) => s.createdAt.desc())
    .all();

  const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();

  return {
    pendingBalance: toTaka(wallet?.pendingBalance),
    availableBalance: toTaka(wallet?.balance),
    heldShipments: heldSubOrders.map((s) => ({
      subOrderId: s.id,
      subOrderNumber: s.subOrderNumber,
      sellerEarnings: s.sellerEarnings,
      deliveredAt: s.updatedAt,
      holdUntil: s.escrowHoldUntil,
      status: s.escrowStatus,
    })),
  };
};

/**
 * Master Order Invoice Generator Data
 */
export const getOrderInvoiceData = async (orderId: string) => {
  const order = await db.orm.public.Order.where({ id: orderId }).first();
  if (!order) throw new AppError("Order not found", 404);

  const [items, subOrders] = await Promise.all([
    db.orm.public.OrderItem.where({ orderId }).all(),
    db.orm.public.SubOrder.where({ orderId }).all(),
  ]);

  const sellerIds = subOrders.map((s) => s.sellerId).filter((id): id is string => typeof id === "string" && Boolean(id));
  const sellers = sellerIds.length ? await db.orm.public.SellerProfile.where((s) => s.id.in(sellerIds)).all() : [];
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));

  return {
    invoiceNumber: `INV-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    date: order.createdAt,
    customer: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    discount: order.discount,
    shippingFee: order.shippingFee,
    tax: order.tax,
    totalAmount: order.totalAmount,
    packages: subOrders.map((s) => ({
      subOrderNumber: s.subOrderNumber,
      storeName: s.sellerId ? sellerMap.get(s.sellerId)?.storeName ?? "Vendor" : "Shopora Direct",
      courierName: s.courierName,
      trackingNumber: s.trackingNumber,
      shippingFee: s.shippingFee,
      items: items.filter((i) => i.subOrderId === s.id),
    })),
  };
};

export const OrderService = {
  quoteOrder,
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  cancelOrderByCustomer,
  adminUpdateOrderStatus,
  getSellerSubOrders,
  getSellerSubOrderById,
  updateSubOrderStatus,
  adminGetAllOrders,
  updatePaymentStatus,
  releaseMaturedEscrow,
  releaseSubOrderEscrowEarly,
  getSellerEscrowHoldings,
  getOrderInvoiceData,
  syncParentOrder,
};
