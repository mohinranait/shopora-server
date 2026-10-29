import { Router } from "express";
import { NotificationController } from "./notification.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";

const router = Router();

// All notification operations require authentication
router.use(authGuard());

// Get my notifications (paginated, filterable by isRead & type)
router.get("/", NotificationController.getMyNotifications);

// Get unread notifications count for badges
router.get("/unread-count", NotificationController.getUnreadCount);

// Mark single notification as read
router.patch("/:id/read", NotificationController.markAsRead);

// Mark all unread notifications as read
router.patch("/read-all", NotificationController.markAllAsRead);

// Clear all read notifications
router.delete("/clear-read", NotificationController.clearReadNotifications);

// Delete single notification
router.delete("/:id", NotificationController.deleteNotification);

export const NotificationRoutes = router;
