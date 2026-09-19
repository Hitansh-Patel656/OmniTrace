import { Request, Response, NextFunction } from "express";
import { Channel, CHANNELS } from "../types";
import { sendError } from "../utils/errors";

// ---------------------------------------------------------------------------
// UUID regex (RFC 4122)
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(value: string): boolean {
  return UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Ingestion validators (existing, ported to use sendError)
// ---------------------------------------------------------------------------

export function validateChannel(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const channel = req.params.channel;

  if (!channel || !CHANNELS.includes(channel as Channel)) {
    sendError(
      res,
      400,
      "Invalid channel",
      `:channel must be one of: ${CHANNELS.join(", ")}`
    );
    return;
  }

  next();
}

export function validateIngestBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendError(
      res,
      400,
      "Invalid request body",
      "Request body must be a valid JSON object (single event)"
    );
    return;
  }

  if (typeof body.event_type !== "string" || body.event_type.trim() === "") {
    errors.push("event_type is required and must be a non-empty string");
  }

  if (typeof body.timestamp !== "string" || isNaN(Date.parse(body.timestamp))) {
    errors.push("timestamp is required and must be a valid ISO 8601 date string");
  }

  if (body.raw_identifiers === undefined || body.raw_identifiers === null) {
    errors.push("raw_identifiers is required and must be an object");
  } else if (
    typeof body.raw_identifiers !== "object" ||
    Array.isArray(body.raw_identifiers)
  ) {
    errors.push("raw_identifiers is required and must be an object");
  } else {
    const entries = Object.entries(body.raw_identifiers);
    if (entries.length === 0) {
      errors.push("raw_identifiers must contain at least one key");
    } else {
      const hasValue = entries.some(
        ([, value]) =>
          value !== null &&
          value !== undefined &&
          typeof value === "string" &&
          value.trim() !== ""
      );
      if (!hasValue) {
        errors.push("At least one raw_identifier must be present and non-null");
      }
    }
  }

  if (errors.length > 0) {
    sendError(res, 400, "Invalid request body", errors.join("; "));
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// UUID param validator factory
// ---------------------------------------------------------------------------

/**
 * Returns middleware that validates req.params[paramName] is a valid UUID.
 * Usage: router.get("/:customer_id/...", validateUUID("customer_id"), handler)
 */
export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    if (!value || !isUUID(value)) {
      sendError(
        res,
        400,
        "Invalid identifier",
        `${paramName} must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)`
      );
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Identity body validators
// ---------------------------------------------------------------------------

export function validateMergeBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendError(res, 400, "Invalid request body", "Body must be a JSON object");
    return;
  }

  if (typeof body.customer_id_a !== "string" || body.customer_id_a.trim() === "") {
    errors.push("customer_id_a is required");
  }
  if (typeof body.customer_id_b !== "string" || body.customer_id_b.trim() === "") {
    errors.push("customer_id_b is required");
  }
  if (body.customer_id_a && body.customer_id_b && body.customer_id_a === body.customer_id_b) {
    errors.push("customer_id_a and customer_id_b must be different");
  }
  if (typeof body.reason !== "string" || body.reason.trim() === "") {
    errors.push("reason is required and must be a non-empty string");
  }

  if (errors.length > 0) {
    sendError(res, 400, "Invalid request body", errors.join("; "));
    return;
  }

  next();
}

export function validateSplitBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body;
  const errors: string[] = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    sendError(res, 400, "Invalid request body", "Body must be a JSON object");
    return;
  }

  if (typeof body.customer_id !== "string" || body.customer_id.trim() === "") {
    errors.push("customer_id is required");
  }
  if (typeof body.reason !== "string" || body.reason.trim() === "") {
    errors.push("reason is required and must be a non-empty string");
  }

  if (errors.length > 0) {
    sendError(res, 400, "Invalid request body", errors.join("; "));
    return;
  }

  next();
}
