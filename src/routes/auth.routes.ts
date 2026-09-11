import { Router } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { initializeUserProgress } from "../services/progress.service.js";

const router = Router();

/**
 * Better Auth catch-all handler.
 * All /api/auth/* requests are forwarded to Better Auth.
 */
router.all(/.*/, toNodeHandler(auth));

/**
 * Hook: After a user signs up, initialize their game progress.
 * Better Auth emits an `afterSignUp` hook internally — but since
 * we can't easily hook into the Express handler, we use an
 * `afterHook` approach or call init on first GET /api/progress.
 *
 * We rely on the progress service's `initializeUserProgress` being
 * called when the user first loads their progress (lazy init).
 */

export default router;
