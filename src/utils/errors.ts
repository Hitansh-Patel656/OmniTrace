import { Response } from "express";

export interface ErrorResponse {
  error: string;
  details: string;
}

/**
 * Emit a standard OmniTrace error response.
 * All errors use { "error": "string", "details": "string" } per api.md Response Conventions.
 */
export function sendError(
  res: Response,
  status: number,
  error: string,
  details: string
): void {
  const body: ErrorResponse = { error, details };
  res.status(status).json(body);
}

/**
 * Extract a human-readable message from an unknown thrown value.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unknown error occurred";
}
