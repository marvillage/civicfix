import { NextFunction, Request, RequestHandler, Response } from "express";

// An error that already knows its HTTP status. Services throw it;
// the central error handler turns it into a JSON response, so
// handlers don't need their own try/catch ladders.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, "BAD_REQUEST", details);

export const forbidden = (
  message = "You do not have permission to perform this action"
) => new HttpError(403, message, "FORBIDDEN");

export const notFound = (what = "Resource") =>
  new HttpError(404, `${what} not found`, "NOT_FOUND");

export const conflict = (message: string) =>
  new HttpError(409, message, "CONFLICT");

// Wraps an async handler so a rejected promise reaches next().
export function asyncHandler<Req extends Request = Request>(
  handler: (
    req: Req,
    res: Response,
    next: NextFunction
  ) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}

// Express 5 types route params as string | string[]; every route
// here uses single-segment params, so normalise once.
export function param(req: Request, name: string): string {
  const value = req.params[name];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Cursor pagination: fetch limit + 1 rows to know if there's more.
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number
) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}
