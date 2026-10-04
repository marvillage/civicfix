import { prisma } from "../lib/prisma";
import { sendEmail } from "./email.service";
import { BRAND } from "../config/brand";

export async function createNotification(
  userId: string,
  title: string,
  message: string
) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
    },
  });

  prisma.user
    .findUnique({
      where: { id: userId },
      select: { email: true },
    })
    .then((user) => {
      if (user?.email) {
        return sendEmail(
          user.email,
          `${BRAND.name}: ${title}`,
          message
        );
      }
    })
    .catch((error) => {
      console.error(
        "Notification email failed:",
        error
      );
    });

  return notification;
}

interface WatcherOptions {
  excludeComplainants?: boolean;
  excludeUserId?: string;
}

// Notifies everyone watching an issue — upvoters and
// (optionally) complainants — deduplicated.
export async function notifyIssueWatchers(
  issueId: string,
  title: string,
  message: string,
  options: WatcherOptions = {}
) {
  const [complaints, upvotes] = await Promise.all([
    prisma.complaint.findMany({
      where: { issueId },
      select: { citizenId: true },
    }),
    prisma.upvote.findMany({
      where: { issueId },
      select: { userId: true },
    }),
  ]);

  const complainantIds = new Set(
    complaints
      .map((complaint) => complaint.citizenId)
      .filter((id): id is string => !!id)
  );

  const recipients = new Set<string>();

  upvotes.forEach((upvote) =>
    recipients.add(upvote.userId)
  );

  if (options.excludeComplainants) {
    complainantIds.forEach((id) =>
      recipients.delete(id)
    );
  } else {
    complainantIds.forEach((id) =>
      recipients.add(id)
    );
  }

  if (options.excludeUserId) {
    recipients.delete(options.excludeUserId);
  }

  for (const userId of recipients) {
    await createNotification(userId, title, message);
  }
}

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error("NOTIFICATION_NOT_FOUND");
  }

  return prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      isRead: true,
    },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
}