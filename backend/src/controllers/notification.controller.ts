import { Request, Response } from "express";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notification.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { param } from "../lib/http";

export async function getNotificationsController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.userId;

    const notifications = await getUserNotifications(userId);

    return res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      message: "Something went wrong while fetching notifications.",
    });
  }
}

export async function markNotificationAsReadController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.userId;
    const notificationId = param(req, "notificationId");

    await markNotificationAsRead(notificationId, userId);

    return res.status(200).json({
      message: "Notification marked as read.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "NOTIFICATION_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    console.error("Mark notification as read error:", error);

    return res.status(500).json({
      message: "Something went wrong while updating the notification.",
    });
  }
}

export async function markAllNotificationsAsReadController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.userId;

    await markAllNotificationsAsRead(userId);

    return res.status(200).json({
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    return res.status(500).json({
      message: "Something went wrong while updating notifications.",
    });
  }
}