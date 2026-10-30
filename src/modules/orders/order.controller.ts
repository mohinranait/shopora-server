import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { OrderService } from "./order.service.ts";

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers["x-session-id"] as string | undefined;
  const result = await OrderService.createOrder(userId, req.body, sessionId);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Order placed successfully",
    data: result,
  });
});

export const quoteOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.quoteOrder(req.body.items, req.body.couponCode);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order quote calculated",
    data: result,
  });
});

export const getCustomerOrders = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.getCustomerOrders(req.user!.id, {
    status: req.query.status as string | undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 10,
  });

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Orders retrieved successfully",
    meta: result.meta,
    data: result.orders,
  });
});

export const getOrderDetails = catchAsync(async (req: Request, res: Response) => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await OrderService.getOrderDetails(orderId, req.user, req.query.phone as string | undefined);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order details retrieved successfully",
    data: result,
  });
});

export const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await OrderService.cancelOrderByCustomer(orderId, req.user, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order cancelled",
    data: result,
  });
});

export const adminUpdateOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.adminUpdateOrderStatus(Number(req.params.id), req.user!, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated",
    data: result,
  });
});

export const getSellerSubOrders = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const result = await OrderService.getSellerSubOrders(req.user!.id, status);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller orders retrieved successfully",
    data: result,
  });
});

export const updateSubOrderStatus = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await OrderService.updateSubOrderStatus(id, req.user!, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Order status updated successfully",
    data: result,
  });
});

export const adminGetAllOrders = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    status: req.query.status as string | undefined,
    paymentStatus: req.query.paymentStatus as string | undefined,
    paymentMethod: req.query.paymentMethod as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  };

  const result = await OrderService.adminGetAllOrders(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All orders retrieved successfully",
    meta: { ...result.meta, counts: result.counts, revenue: result.revenue } as any,
    data: result.orders,
  });
});

export const updatePaymentStatus = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await OrderService.updatePaymentStatus(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payment status updated successfully",
    data: result,
  });
});

export const OrderController = {
  quoteOrder,
  createOrder,
  getCustomerOrders,
  getOrderDetails,
  cancelOrder,
  adminUpdateOrderStatus,
  getSellerSubOrders,
  updateSubOrderStatus,
  adminGetAllOrders,
  updatePaymentStatus,
};
