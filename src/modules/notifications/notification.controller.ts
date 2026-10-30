import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { NotificationService } from "./notification.service.ts";

export const getMyNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const isReadParam = req.query.isRead;
    const isRead =
      isReadParam === "true" ? true : isReadParam === "false" ? false : undefined;

    const result = await NotificationService.getUserNotifications(userId, {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 15,
      isRead,
      type: req.query.type as string,
    });

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Notifications retrieved successfully",
      meta: result.meta,
      data: result.notifications,
    });
  }
);

export const getUnreadCount = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await NotificationService.getUnreadCount(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Unread notifications count retrieved",
      data: result,
    });
  }
);

export const markAsRead = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id as string;

    const result = await NotificationService.markAsRead(userId, notificationId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Notification marked as read",
      data: result,
    });
  }
);

export const markAllAsRead = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await NotificationService.markAllAsRead(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "All notifications marked as read",
      data: result,
    });
  }
);

export const deleteNotification = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const notificationId = req.params.id as string;

    const result = await NotificationService.deleteNotification(
      userId,
      notificationId
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Notification deleted successfully",
      data: result,
    });
  }
);

export const clearReadNotifications = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const result = await NotificationService.clearReadNotifications(userId);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Read notifications cleared successfully",
      data: result,
    });
  }
);

export const NotificationController = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
};
