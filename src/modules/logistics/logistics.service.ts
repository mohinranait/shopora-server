import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { ORDER_STATUS, USER_ROLES } from "../../constants/index.ts";

export interface ICourierConsignment {
  consignmentId: string;
  trackingNumber: string;
  courierName: string;
  status: string;
  estimatedDeliveryDays: number;
}

/**
 * Daraz-Style Multi-Vendor Split Shipping Calculator
 * Each distinct vendor package incurs a shipment fee unless that vendor's items qualify for free shipping.
 */
export const calculateMultiVendorShipping = async (
  vendorGroups: Array<{
    sellerId: string | null;
    isPlatformOwned: boolean;
    subtotal: number;
    allFreeShipping: boolean;
  }>,
  city?: string
) => {
  const isInsideDhaka = city ? city.trim().toLowerCase().includes("dhaka") : true;
  const baseRate = isInsideDhaka ? 60 : 120; // ৳60 Inside Dhaka, ৳120 Outside Dhaka

  let totalShippingFee = 0;
  const packagesBreakdown = vendorGroups.map((group, idx) => {
    // If all items in this vendor's package have free shipping, package shipping is ৳0
    const packageFee = group.allFreeShipping || group.subtotal >= 1500 ? 0 : baseRate;
    totalShippingFee += packageFee;

    return {
      packageNumber: idx + 1,
      sellerId: group.sellerId,
      isPlatformOwned: group.isPlatformOwned,
      subtotal: group.subtotal,
      shippingFee: packageFee,
      isFreeShipping: packageFee === 0,
      deliveryScope: isInsideDhaka ? "Standard Delivery (Inside Dhaka)" : "Standard Delivery (Outside Dhaka)",
      estimatedDelivery: isInsideDhaka ? "2-3 business days" : "3-5 business days",
    };
  });

  return {
    totalShippingFee,
    packagesCount: vendorGroups.length,
    packages: packagesBreakdown,
  };
};

/**
 * Book automated courier consignment for a SubOrder (Steadfast / Pathao style)
 */
export const bookCourierConsignment = async (
  subOrderId: string,
  user: { id: string; role: string; sellerId?: string | null },
  requestedCourier: string = "Steadfast Courier"
) => {
  const subOrder = await db.orm.public.SubOrder.where({ id: subOrderId }).first();
  if (!subOrder) {
    throw new AppError("Sub-order not found", 404);
  }

  // Permission: Admin or the Seller who owns the SubOrder
  const isAdmin = user.role === USER_ROLES.ADMIN;
  const isOwnerSeller = user.role === USER_ROLES.SELLER && user.sellerId && user.sellerId === subOrder.sellerId;

  if (!isAdmin && !isOwnerSeller) {
    throw new AppError("Forbidden: You cannot dispatch this sub-order", 403);
  }

  if (subOrder.status === ORDER_STATUS.SHIPPED || subOrder.status === ORDER_STATUS.DELIVERED) {
    throw new AppError(`Sub-order is already ${subOrder.status}`, 400);
  }

  if (subOrder.status === ORDER_STATUS.CANCELLED) {
    throw new AppError("Cannot book courier for a cancelled shipment", 400);
  }

  // Generate unique Consignment & Tracking Number
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const trackingNumber = `ST-${randomSuffix}-BD`;
  const consignmentId = `CN-${Date.now().toString(36).toUpperCase()}-${randomSuffix.toString().slice(0, 4)}`;

  // Update SubOrder with courier details and set status to SHIPPED
  const updated = await db.orm.public.SubOrder.where({ id: subOrderId }).update({
    trackingNumber,
    courierName: requestedCourier,
    consignmentId,
    status: ORDER_STATUS.SHIPPED,
  });

  // Also notify customer
  const order = await db.orm.public.Order.where({ id: subOrder.orderId }).first();
  if (order?.userId) {
    await db.orm.public.Notification.create({
      userId: order.userId,
      title: `Shipment Dispatched: ${subOrder.subOrderNumber}`,
      message: `Your package has been dispatched via ${requestedCourier}. Tracking code: ${trackingNumber}`,
      type: "ORDER",
      link: `/orders/${order.orderNumber}`,
    });
  }

  return {
    subOrderId,
    subOrderNumber: subOrder.subOrderNumber,
    trackingNumber,
    consignmentId,
    courierName: requestedCourier,
    status: ORDER_STATUS.SHIPPED,
  };
};

/**
 * Public Consignment Tracking Information
 */
export const trackConsignment = async (trackingCode: string) => {
  const subOrder = await db.orm.public.SubOrder.where({ trackingNumber: trackingCode.trim() }).first();
  if (!subOrder) {
    throw new AppError("Tracking code not found or invalid", 404);
  }

  const order = await db.orm.public.Order.where({ id: subOrder.orderId }).first();
  const items = await db.orm.public.OrderItem.where({ subOrderId: subOrder.id }).all();

  const isDelivered = subOrder.status === ORDER_STATUS.DELIVERED;
  const isShipped = subOrder.status === ORDER_STATUS.SHIPPED || isDelivered;

  const timeline = [
    {
      title: "Order Placed & Confirmed",
      description: "Seller has received your order and started fulfillment",
      time: subOrder.createdAt,
      completed: true,
    },
    {
      title: "Picked up by Courier",
      description: `Package handed over to ${subOrder.courierName || "Courier Partner"} hub`,
      time: subOrder.updatedAt,
      completed: isShipped,
    },
    {
      title: "In Transit / Hub Transfer",
      description: "Package sorting completed, dispatched to destination delivery center",
      time: isShipped ? subOrder.updatedAt : null,
      completed: isShipped,
    },
    {
      title: "Out for Delivery",
      description: "Courier rider is on the way to your shipping address",
      time: isDelivered ? subOrder.updatedAt : null,
      completed: isDelivered,
    },
    {
      title: "Delivered",
      description: "Package successfully handed over to customer",
      time: isDelivered ? subOrder.updatedAt : null,
      completed: isDelivered,
    },
  ];

  return {
    trackingNumber: subOrder.trackingNumber,
    consignmentId: subOrder.consignmentId,
    courierName: subOrder.courierName,
    currentStatus: subOrder.status,
    subOrderNumber: subOrder.subOrderNumber,
    orderNumber: order?.orderNumber,
    shippingAddress: order?.shippingAddress,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    items: items.map((i) => ({
      name: i.productName,
      variantTitle: i.variantTitle,
      quantity: i.quantity,
      price: i.price,
    })),
    timeline,
  };
};

/**
 * Printable Packaging Slip Data (For Seller Box / Parcel Sticker)
 */
export const getPackagingSlipData = async (subOrderId: string, user: any) => {
  const subOrder = await db.orm.public.SubOrder.where({ id: subOrderId }).first();
  if (!subOrder) {
    throw new AppError("Sub-order not found", 404);
  }

  const order = await db.orm.public.Order.where({ id: subOrder.orderId }).first();
  const items = await db.orm.public.OrderItem.where({ subOrderId: subOrder.id }).all();
  const seller = subOrder.sellerId
    ? await db.orm.public.SellerProfile.where({ id: subOrder.sellerId }).first()
    : null;

  return {
    slipType: "MULTI_VENDOR_PACKAGING_SLIP",
    subOrderNumber: subOrder.subOrderNumber,
    orderNumber: order?.orderNumber,
    date: subOrder.createdAt,
    courierName: subOrder.courierName || "Standard Shipping",
    trackingNumber: subOrder.trackingNumber || "N/A",
    consignmentId: subOrder.consignmentId || "N/A",
    paymentMethod: order?.paymentMethod,
    paymentStatus: order?.paymentStatus,
    amountToCollectCOD: order?.paymentMethod === "COD" ? subOrder.totalAmount : 0,
    store: {
      name: seller?.storeName || "Shopora Direct Official Store",
      phone: seller?.phone || "+880 1700-000000",
      address: seller?.businessAddress || "Dhaka, Bangladesh",
    },
    customer: order?.shippingAddress,
    items: items.map((i) => ({
      name: i.productName,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      price: i.price,
      totalPrice: i.totalPrice,
    })),
    subtotal: subOrder.subtotal,
    shippingFee: subOrder.shippingFee,
    totalAmount: subOrder.totalAmount,
  };
};
