import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `No route for ${req.method} ${req.path}`,
    code: "NOT_FOUND",
  });
}

// Last stop for every error. Known HttpErrors keep their status
// and message; anything else is logged and reported as a 500
// without leaking internals.
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // Malformed JSON body (thrown by express.json)
  if (
    error instanceof SyntaxError &&
    (error as { status?: number }).status === 400
  ) {
    return res.status(400).json({
      message: "Request body is not valid JSON",
      code: "BAD_JSON",
    });
  }

  // Body over the size limit
  if ((error as { type?: string })?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large",
      code: "TOO_LARGE",
    });
  }

  // Prisma: unique constraint / record not found
  const prismaCode = (error as { code?: string })?.code;

  if (prismaCode === "P2002") {
    return res.status(409).json({
      message: "That already exists",
      code: "CONFLICT",
    });
  }

  if (prismaCode === "P2025") {
    return res.status(404).json({
      message: "Resource not found",
      code: "NOT_FOUND",
    });
  }

  console.error(
    `[${res.locals.requestId ?? "-"}] ${req.method} ${req.originalUrl}`,
    error
  );

  return res.status(500).json({
    message: "Something went wrong",
    code: "INTERNAL",
    requestId: res.locals.requestId,
  });
}
