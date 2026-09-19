import { Request, Response, NextFunction } from "express";
import { Channel, CHANNELS, ErrorResponse } from "../types";

export function validateChannel(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const channel = req.params.channel;

  if (!channel || !CHANNELS.includes(channel as Channel)) {
    const err: ErrorResponse = {
      error: "Invalid channel",
      details: `:channel must be one of: ${CHANNELS.join(", ")}`,
    };
    res.status(400).json(err);
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
    errors.push("Request body must be a valid JSON object (single event)");
  }

  if (errors.length > 0) {
    const err: ErrorResponse = { error: "Invalid request body", details: errors.join("; ") };
    res.status(400).json(err);
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
  } else if (typeof body.raw_identifiers !== "object" || Array.isArray(body.raw_identifiers)) {
    errors.push("raw_identifiers is required and must be an object");
  } else {
    const entries = Object.entries(body.raw_identifiers);
    if (entries.length === 0) {
      errors.push("raw_identifiers must contain at least one key");
    } else {
      const hasValue = entries.some(
        ([, value]) =>
          value !== null && value !== undefined && typeof value === "string" && value.trim() !== ""
      );
      if (!hasValue) {
        errors.push("At least one raw_identifier must be present and non-null");
      }
    }
  }

  if (errors.length > 0) {
    const err: ErrorResponse = { error: "Invalid request body", details: errors.join("; ") };
    res.status(400).json(err);
    return;
  }

  next();
}
