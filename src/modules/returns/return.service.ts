import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { RETURN_STATUS, USER_ROLES } from "../../constants/index.ts";

/**
 * Customer request return / refund
 */
export const createReturnRequest = async (
  userId: number,
  payload: {
    orderId: number;
    orderItemId: number;
    reason: string;
    customerComment?: string;
    images?: string[];
  }
) => {
  const order = await db.orm.public.Order.where({ id: payload.orderId }).first();
  if (!order || order.userId !== userId) {
    throw new AppError("Order not found or unauthorized", 404);
  }

  const orderItem = await db.orm.public.OrderItem.where({ id: payload.orderItemId }).first();
  if (!orderItem || orderItem.orderId !== order.id) {
    throw new AppError("Order item not found", 404);
  }

  // Check if return request already exists
  const existing = await db.orm.public.ReturnRequest
    .where({ orderItemId: payload.orderItemId })
    .first();

  if (existing) {
    throw new AppError("A return request has already been filed for this item", 400);
  }

  return await db.orm.public.ReturnRequest.create({
    orderId: payload.orderId,
    orderItemId: payload.orderItemId,
    userId,
    reason: payload.reason,
    customerComment: payload.customerComment ?? null,
    images: payload.images || [],
    status: RETURN_STATUS.REQUESTED,
    refundAmount: orderItem.totalPrice,
  });
};

/**
 * Customer: Get their return requests
 */
export const getCustomerReturns = async (userId: number) => {
  const returns = await db.orm.public.ReturnRequest
    .where({ userId })
    .orderBy((r) => r.createdAt.desc())
    .all();

  const populated = await Promise.all(
    returns.map(async (ret) => {
      const item = await db.orm.public.OrderItem.where({ id: ret.orderItemId }).first();
      return {
        ...ret,
        item,
      };
    })
  );

  return populated;
};

/**
 * Admin: Get all return requests
 */
export const adminGetAllReturns = async (status?: string) => {
  let query = db.orm.public.ReturnRequest;
  if (status) {
    query = query.where({ status });
  }

  const returns = await query.orderBy((r) => r.createdAt.desc()).all();

  const populated = await Promise.all(
    returns.map(async (ret) => {
      const item = await db.orm.public.OrderItem.where({ id: ret.orderItemId }).first();
      const user = await db.orm.public.User.where({ id: ret.userId }).first();
      return {
        ...ret,
        item,
        customer: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
      };
    })
  );

  return populated;
};

/**
 * Admin: Review and update Return Request status
 */
export const adminReviewReturn = async (
  returnId: number,
  payload: { status: string; adminNote?: string }
) => {
  const ret = await db.orm.public.ReturnRequest.where({ id: returnId }).first();
  if (!ret) {
    throw new AppError("Return request not found", 404);
  }

  const updated = await db.orm.public.ReturnRequest.where({ id: returnId }).update({
    status: payload.status,
    adminNote: payload.adminNote ?? ret.adminNote,
  });

  // Notify customer
  await db.orm.public.Notification.create({
    userId: ret.userId,
    title: `Return Request ${payload.status}`,
    message: `Your return request for order item #${ret.orderItemId} has been updated to: ${payload.status}. Note: ${payload.adminNote || ""}`,
    type: "ORDER",
    link: "/customer/returns",
  });

  return updated;
};

export const ReturnService = {
  createReturnRequest,
  getCustomerReturns,
  adminGetAllReturns,
  adminReviewReturn,
};
