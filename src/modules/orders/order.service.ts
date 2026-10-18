import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { generateOrderNumber, generateSubOrderNumber } from "../../utils/orderNumber.ts";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRODUCT_TYPE,
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  USER_ROLES,
  TRANSACTION_TYPE,
} from "../../constants/index.ts";
import { ENV } from "../../config/env.ts";

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
  }
) => {
  if (payload.items.length === 0) {
    throw new AppError("Cannot place an order with zero items", 400);
  }

  // 1. Fetch default platform commission from WebsiteSetting or fallback
  let defaultCommissionRate = ENV.DEFAULT_COMMISSION_RATE;
  const commissionSetting = await db.orm.public.WebsiteSetting.where({
    key: "default_commission_rate",
  }).first();

  if (commissionSetting && typeof commissionSetting.value === "number") {
    defaultCommissionRate = commissionSetting.value;
  }

  // 2. Validate all products and stock availability
  const validatedItems: any[] = [];
  let subtotal = 0;

  for (const item of payload.items) {
    const product = await db.orm.public.Product.where({ id: item.productId }).first();
    if (!product) {
      throw new AppError(`Product with ID ${item.productId} not found`, 404);
    }

    if (
      product.approvalStatus !== PRODUCT_APPROVAL_STATUS.APPROVED ||
      product.status !== PRODUCT_STATUS.PUBLISHED
    ) {
      throw new AppError(`Product "${product.name}" is currently not available for purchase`, 400);
    }

    let unitPrice = product.basePrice;
    let variantTitle: string | null = null;
    let sku = product.sku;
    let selectedVariant = null;

    if (product.productType === PRODUCT_TYPE.VARIABLE && item.variantId) {
      selectedVariant = await db.orm.public.ProductVariant.where({ id: item.variantId }).first();
      if (!selectedVariant || !selectedVariant.isActive) {
        throw new AppError(`Selected variant for "${product.name}" is invalid or inactive`, 400);
      }
      if (selectedVariant.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name} (${selectedVariant.title})". Available: ${selectedVariant.stock}, Requested: ${item.quantity}`,
          400
        );
      }
      unitPrice = selectedVariant.price;
      variantTitle = selectedVariant.title;
      sku = selectedVariant.sku;
    } else {
      if (product.stock < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`,
          400
        );
      }
    }

    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;

    validatedItems.push({
      product,
      selectedVariant,
      productId: product.id,
      variantId: item.variantId ?? null,
      sellerId: product.sellerId,
      isPlatformOwned: product.isPlatformOwned,
      productName: product.name,
      variantTitle,
      productImage: selectedVariant?.image || product.mainImage,
      sku,
      price: unitPrice,
      quantity: item.quantity,
      totalPrice: itemTotal,
    });
  }

  // 3. Process Coupon Discount if provided
  let discount = 0;
  let appliedCouponCode: string | null = null;

  if (payload.couponCode) {
    const coupon = await db.orm.public.Coupon.where({
      code: payload.couponCode.trim().toUpperCase(),
    }).first();

    if (coupon && coupon.isActive) {
      if (subtotal >= coupon.minOrderAmount) {
        if (coupon.discountType === "PERCENTAGE") {
          discount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
            discount = coupon.maxDiscountAmount;
          }
        } else {
          discount = coupon.discountValue;
        }
        discount = Math.min(discount, subtotal);
        appliedCouponCode = coupon.code;

        // Increment used count
        await db.orm.public.Coupon.where({ id: coupon.id }).update({
          usedCount: coupon.usedCount + 1,
        });
      }
    }
  }

  const shippingFee = subtotal > 1500 ? 0 : 70; // e.g. Free shipping above 1500 BDT
  const tax = 0;
  const totalAmount = Math.max(0, subtotal - discount + shippingFee + tax);
  const orderNumber = generateOrderNumber();

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
    // 5.1. Create Main Customer Order
    const order = await tx.orm.public.Order.create({
      orderNumber,
      userId,
      guestEmail: payload.guestEmail ?? null,
      guestPhone: payload.guestPhone ?? null,
      shippingAddress: payload.shippingAddress,
      billingAddress: payload.billingAddress ?? payload.shippingAddress,
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

    // Clear cart items for this customer
    if (userId) {
      await tx.orm.public.CartItem.where({ userId }).deleteAll();
    }

    return order;
  });
};

/**
 * Get Customer Orders
 */
export const getCustomerOrders = async (userId: number) => {
  const orders = await db.orm.public.Order
    .where({ userId })
    .orderBy((o) => o.createdAt.desc())
    .all();

  const populated = await Promise.all(
    orders.map(async (order) => {
      const items = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
      const subOrders = await db.orm.public.SubOrder.where({ orderId: order.id }).all();
      return {
        ...order,
        items,
        subOrders,
      };
    })
  );

  return populated;
};

/**
 * Get Single Order Details by orderNumber or ID
 */
export const getOrderDetails = async (
  orderIdentifier: string | number,
  requestingUser?: any
) => {
  let order;
  const numId = Number(orderIdentifier);
  if (!Number.isNaN(numId)) {
    order = await db.orm.public.Order.where({ id: numId }).first();
  } else {
    order = await db.orm.public.Order.where({ orderNumber: String(orderIdentifier) }).first();
  }

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  // Check access permission
  if (
    requestingUser &&
    requestingUser.role === USER_ROLES.CUSTOMER &&
    order.userId !== requestingUser.id
  ) {
    throw new AppError("You do not have permission to view this order", 403);
  }

  const items = await db.orm.public.OrderItem.where({ orderId: order.id }).all();
  const subOrders = await db.orm.public.SubOrder.where({ orderId: order.id }).all();

  return {
    ...order,
    items,
    subOrders,
  };
};

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

  const populated = await Promise.all(
    subOrders.map(async (so) => {
      const items = await db.orm.public.OrderItem.where({ subOrderId: so.id }).all();
      const parentOrder = await db.orm.public.Order.where({ id: so.orderId }).first();
      return {
        ...so,
        items,
        shippingAddress: parentOrder?.shippingAddress,
        paymentStatus: parentOrder?.paymentStatus,
        paymentMethod: parentOrder?.paymentMethod,
      };
    })
  );

  return populated;
};

/**
 * Seller or Admin: Update SubOrder Status (Tracking, Shipping, Delivery, Wallet Settlement)
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

  // Authorization check
  if (requestingUser.role === USER_ROLES.SELLER) {
    if (subOrder.sellerId !== requestingUser.sellerId) {
      throw new AppError("You can only manage your own sub-orders", 403);
    }
  }

  return await db.transaction(async (tx) => {
    const updateData: any = {
      status: payload.status,
    };
    if (payload.trackingNumber !== undefined) updateData.trackingNumber = payload.trackingNumber;
    if (payload.courierName !== undefined) updateData.courierName = payload.courierName;

    // Financial settlement on DELIVERED
    if (payload.status === ORDER_STATUS.DELIVERED && !subOrder.isPayoutSettled && subOrder.sellerId) {
      updateData.isPayoutSettled = true;

      const wallet = await tx.orm.public.SellerWallet.where({
        sellerId: subOrder.sellerId,
      }).first();

      if (wallet) {
        // Credit available balance and lifetime stats
        const newBalance = wallet.balance + subOrder.sellerEarnings;
        const newTotalEarnings = wallet.totalEarnings + subOrder.sellerEarnings;
        const newCommissionPaid = wallet.totalCommissionPaid + subOrder.commissionAmount;

        await tx.orm.public.SellerWallet.where({ id: wallet.id }).update({
          balance: newBalance,
          totalEarnings: newTotalEarnings,
          totalCommissionPaid: newCommissionPaid,
        });

        // Record wallet transaction for earnings
        await tx.orm.public.WalletTransaction.create({
          walletId: wallet.id,
          subOrderId: subOrder.id,
          amount: subOrder.sellerEarnings,
          type: TRANSACTION_TYPE.ORDER_EARNING,
          description: `Order delivery payout for sub-order #${subOrder.subOrderNumber} (Subtotal: ${subOrder.subtotal} BDT - Commission: ${subOrder.commissionAmount} BDT)`,
        });
      }
    }

    const updatedSubOrder = await tx.orm.public.SubOrder
      .where({ id: subOrderId })
      .update(updateData);

    // Check if all subOrders of the main Order are delivered/completed
    const siblingSubOrders = await tx.orm.public.SubOrder
      .where({ orderId: subOrder.orderId })
      .all();

    const allDelivered = siblingSubOrders.every((s) =>
      s.id === subOrderId ? payload.status === ORDER_STATUS.DELIVERED : s.status === ORDER_STATUS.DELIVERED
    );

    if (allDelivered) {
      await tx.orm.public.Order.where({ id: subOrder.orderId }).update({
        orderStatus: ORDER_STATUS.DELIVERED,
      });
    }

    return updatedSubOrder;
  });
};

/**
 * Admin: Get all Orders with filters
 */
export const adminGetAllOrders = async (filters: {
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  let query = db.orm.public.Order;
  if (filters.status) {
    query = query.where({ orderStatus: filters.status });
  }
  if (filters.paymentStatus) {
    query = query.where({ paymentStatus: filters.paymentStatus });
  }

  const countResult = await query.aggregate((a) => ({ total: a.count() }));
  const orders = await query
    .orderBy((o) => o.createdAt.desc())
    .limit(limit)
    .offset(offset)
    .all();

  const populated = await Promise.all(
    orders.map(async (ord) => {
      const items = await db.orm.public.OrderItem.where({ orderId: ord.id }).all();
      const subOrders = await db.orm.public.SubOrder.where({ orderId: ord.id }).all();
      return {
        ...ord,
        items,
        subOrders,
      };
    })
  );

  return {
    orders: populated,
    meta: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
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
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  getSellerSubOrders,
  updateSubOrderStatus,
  adminGetAllOrders,
  updatePaymentStatus,
};
