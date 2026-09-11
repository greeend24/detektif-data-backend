import { Router, Request, Response } from "express";
import { getTopPlayers } from "../services/leaderboard.service.js";

const router = Router();

/**
 * GET /api/leaderboard
 * Public endpoint — no authentication required.
 * Returns the global leaderboard sorted by totalScore.
 * Query params: ?limit=50 (optional)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 50, 1),
      100
    );

    const leaderboard = await getTopPlayers(limit);

    res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("[leaderboard.routes] GET / error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
});

export default router;
