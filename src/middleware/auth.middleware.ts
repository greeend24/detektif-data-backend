import { Request, Response, NextFunction } from "express";
import { auth, Session, User } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

// Extend Express Request to include session data
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

/**
 * Middleware that verifies the user's session via Better Auth.
 * Attaches `req.user` and `req.session` on success.
 * Returns 401 if no valid session is found.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.user) {
      res.status(401).json({ error: "Unauthorized — no valid session" });
      return;
    }

    req.user = sessionData.user as User;
    req.session = sessionData.session as Session;
    next();
  } catch (error) {
    console.error("[auth.middleware] Session verification failed:", error);
    res.status(401).json({ error: "Unauthorized — session verification failed" });
  }
}
