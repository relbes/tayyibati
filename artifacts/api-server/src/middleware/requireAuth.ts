import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/session";

/**
 * Middleware that requires a valid session token in the Authorization header.
 * Sets req.userId to the verified user ID or returns 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired session. Please sign in again." });
    return;
  }
  req.userId = userId;
  next();
}

/**
 * Middleware that optionally reads a session token if present.
 * Sets req.userId only when a valid token is provided — never trusts caller-supplied body/query fields.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const userId = verifyToken(token);
    if (userId) req.userId = userId;
  }
  next();
}
