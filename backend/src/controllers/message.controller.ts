import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { param } from "../lib/http";
import {
  getIssueMessages,
  sendIssueMessage,
} from "../services/message.service";

function handleMessageError(
  error: unknown,
  res: Response
) {
  if (error instanceof Error) {
    if (error.message === "ISSUE_NOT_FOUND") {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    if (error.message === "NOT_A_PARTICIPANT") {
      return res.status(403).json({
        message:
          "Only the reporter and the assigned authority can use this thread",
      });
    }
  }

  console.error("Message error:", error);

  return res.status(500).json({
    message: "Something went wrong with the message thread",
  });
}

export async function getIssueMessagesController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const messages = await getIssueMessages(
      param(req, "issueId"),
      req.user.userId,
      req.user.role
    );

    return res.status(200).json({ messages });
  } catch (error) {
    return handleMessageError(error, res);
  }
}

export async function sendIssueMessageController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const { text } = req.body;

    if (
      !text ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return res.status(400).json({
        message: "Message text is required",
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        message: "Message is too long (max 2000 characters)",
      });
    }

    const message = await sendIssueMessage(
      param(req, "issueId"),
      req.user.userId,
      req.user.role,
      text.trim()
    );

    return res.status(201).json({
      message: "Message sent",
      data: message,
    });
  } catch (error) {
    return handleMessageError(error, res);
  }
}
