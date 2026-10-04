import { NextFunction, Request, Response } from "express";
import { z, ZodType } from "zod";
import { HttpError } from "../lib/http";

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Validates and coerces request input against zod schemas.
// Parsed values land on res.locals, so handlers read typed,
// trimmed data instead of raw req.body.
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];

      if (!schema) continue;

      const result = schema.safeParse(req[part] ?? {});

      if (!result.success) {
        return next(
          new HttpError(
            400,
            result.error.issues[0]?.message ?? "Invalid request",
            "VALIDATION_FAILED",
            z.flattenError(result.error)
          )
        );
      }

      res.locals[part] = result.data;
    }

    next();
  };
}

// Reads what validate() stored, typed by the same schema.
export function input<S extends ZodType>(
  res: Response,
  part: "body" | "query" | "params",
  _schema: S
): z.infer<S> {
  return res.locals[part] as z.infer<S>;
}
