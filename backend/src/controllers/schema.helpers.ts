import { z } from "zod";

// Small zod building blocks shared by the v2 controllers.

// An optional id. Forms often send "" or null for "none", so
// both are treated as absent.
export const optionalId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().min(1).max(64).optional()
);

// Accepts an ISO string (or anything Date can parse).
export const dateField = (label: string) =>
  z.coerce.date({ error: `${label} must be a valid date` });

export const latitudeField = z
  .number({ error: "latitude must be a number" })
  .min(-90, "latitude must be between -90 and 90")
  .max(90, "latitude must be between -90 and 90");

export const longitudeField = z
  .number({ error: "longitude must be a number" })
  .min(-180, "longitude must be between -180 and 180")
  .max(180, "longitude must be between -180 and 180");

export const cursorPage = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: optionalId,
};
