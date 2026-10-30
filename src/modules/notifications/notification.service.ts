import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { USER_ROLES } from "../../constants/index.ts";

export type NotificationType =
  | "ORDER"
  | "ORDER_STATUS"
  | "PAYOUT"
  | "PRODUCT_APPROVAL"
  | "KYC"
  | "LOW_STOCK"
  | "SYSTEM";

export interface ICreateNotificationPayload {
  userId: number;
  title: string;
  message: string;
  type?: NotificationType | string;
  link?: string;
}

export interface INotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

/**
 * Fetch paginated notifications for a specific user
 */
export const getUserNotifications = async (
  userId: number,
  query: INotificationQuery = {}
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 15));
  const offset = (page - 1) * limit;

  // Retrieve user notifications
  const allUserNotifs = await db.orm.public.Notification
    .where({ userId })
    .orderBy((n) => n.createdAt.desc())
    .all();

  // Filter in memory for maximum reliability with prisma-8 orm
  let filtered = allUserNotifs;
  if (query.isRead !== undefined) {
    filtered = filtered.filter((n) => n.isRead === query.isRead);
  }
  if (query.type) {
    filtered = filtered.filter((n) => n.type.toLowerCase() === query.type?.toLowerCase());
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);
  const unreadCount = allUserNotifs.filter((n) => !n.isRead).length;

  return {
    notifications: paginated,
    meta: {
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Fast endpoint to get unread notifications count for header badges
 */
export const getUnreadCount = async (userId: number) => {
  const unread = await db.orm.public.Notification
    .where({ userId, isRead: false })
    .all();

  return {
    unreadCount: unread.length,
  };
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (userId: number, notificationId: number) => {
  const notif = await db.orm.public.Notification
    .where({ id: notificationId, userId })
    .first();

  if (!notif) {
    throw new AppError("Notification not found or access denied", 404);
  }

  if (!notif.isRead) {
    await db.orm.public.Notification.where({ id: notificationId }).update({
      isRead: true,
    });
  }

  return {
    id: notificationId,
    isRead: true,
  };
};

/**
 * Mark all unread notifications as read for a user
 */
export const markAllAsRead = async (userId: number) => {
  const unread = await db.orm.public.Notification
    .where({ userId, isRead: false })
    .all();

  await Promise.all(
    unread.map((n) =>
      db.orm.public.Notification.where({ id: n.id }).update({ isRead: true })
    )
  );

  return {
    markedCount: unread.length,
  };
};

/**
 * Delete a single notification
 */
export const deleteNotification = async (userId: number, notificationId: number) => {
  const notif = await db.orm.public.Notification
    .where({ id: notificationId, userId })
    .first();

  if (!notif) {
    throw new AppError("Notification not found", 404);
  }

  await db.orm.public.Notification.where({ id: notificationId }).delete();

  return {
    id: notificationId,
    deleted: true,
  };
};

/**
 * Clear all read notifications for a user
 */
export const clearReadNotifications = async (userId: number) => {
  const readList = await db.orm.public.Notification
    .where({ userId, isRead: true })
    .all();

  await Promise.all(
    readList.map((n) =>
      db.orm.public.Notification.where({ id: n.id }).delete()
    )
  );

  return {
    clearedCount: readList.length,
  };
};

/**
 * Dispatcher: Create a notification for a specific user
 */
export const createNotification = async (payload: ICreateNotificationPayload) => {
  return await db.orm.public.Notification.create({
    userId: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || "SYSTEM",
    link: payload.link || null,
    isRead: false,
  });
};

/**
 * Dispatcher: Broadcast a notification to all Platform Admins
 */
export const notifyAdmins = async (payload: {
  title: string;
  message: string;
  type?: NotificationType | string;
  link?: string;
}) => {
  const admins = await db.orm.public.User
    .where({ role: USER_ROLES.ADMIN, isActive: true })
    .all();

  if (admins.length === 0) return [];

  return await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: payload.title,
        message: payload.message,
        type: payload.type || "SYSTEM",
        link: payload.link,
      })
    )
  );
};

/**
 * Dispatcher: Notify a seller by their SellerProfile ID
 */
export const notifySeller = async (
  sellerId: number,
  payload: {
    title: string;
    message: string;
    type?: NotificationType | string;
    link?: string;
  }
) => {
  const seller = await db.orm.public.SellerProfile
    .where({ id: sellerId })
    .first();

  if (!seller) return null;

  return await createNotification({
    userId: seller.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type || "SYSTEM",
    link: payload.link,
  });
};

export const NotificationService = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  createNotification,
  notifyAdmins,
  notifySeller,
};
