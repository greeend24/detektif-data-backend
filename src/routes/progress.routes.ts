import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getUserFullProgress,
  updateStageProgress,
  updateEndlessHighScore,
  resetProgress,
  unlockAllWithCheat,
  initializeUserProgress,
} from "../services/progress.service.js";
import { env } from "../config/env.js";

const router = Router();

// All progress routes require authentication
router.use(requireAuth);

/**
 * GET /api/progress
 * Fetch the current user's full progress profile.
 * Performs lazy initialization if this is the user's first load.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Lazy init: ensure stats/progress/badge rows exist
    await initializeUserProgress(userId);

    const progress = await getUserFullProgress(userId);
    res.json({
      success: true,
      data: {
        username: (req.user as any).username || req.user!.name,
        fullname: req.user!.name,
        ...progress,
      },
    });
  } catch (error) {
    console.error("[progress.routes] GET / error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch progress" });
  }
});

/**
 * POST /api/progress/stage
 * Update a specific stage completion.
 * Body: { subbabId: number, stageNum: number, scoreEarned: number, starsEarned: number }
 */
router.post("/stage", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { subbabId, stageNum, scoreEarned, starsEarned } = req.body;

    // Validate input
    if (
      typeof subbabId !== "number" ||
      subbabId < 1 ||
      subbabId > 7 ||
      typeof stageNum !== "number" ||
      stageNum < 1 ||
      stageNum > 21 ||
      typeof scoreEarned !== "number" ||
      typeof starsEarned !== "number"
    ) {
      res.status(400).json({
        success: false,
        error:
          "Invalid input. Required: subbabId (1-7), stageNum (1-21), scoreEarned (number), starsEarned (number)",
      });
      return;
    }

    const result = await updateStageProgress(
      userId,
      subbabId,
      stageNum,
      scoreEarned,
      starsEarned
    );

    // Return updated progress
    const updatedProgress = await getUserFullProgress(userId);

    res.json({
      success: true,
      data: {
        username: (req.user as any).username || req.user!.name,
        fullname: req.user!.name,
        ...updatedProgress,
      },
      newBadges: result.newBadges,
    });
  } catch (error) {
    console.error("[progress.routes] POST /stage error:", error);
    res.status(500).json({ success: false, error: "Failed to update stage progress" });
  }
});

/**
 * POST /api/progress/endless
 * Update the endless mode high score.
 * Body: { score: number }
 */
router.post("/endless", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { score } = req.body;

    if (typeof score !== "number" || score < 0) {
      res.status(400).json({
        success: false,
        error: "Invalid input. Required: score (non-negative number)",
      });
      return;
    }

    const result = await updateEndlessHighScore(userId, score);

    res.json({
      success: true,
      data: {
        updated: result.updated,
        newBadges: result.newBadges,
      },
    });
  } catch (error) {
    console.error("[progress.routes] POST /endless error:", error);
    res.status(500).json({ success: false, error: "Failed to update endless high score" });
  }
});

/**
 * POST /api/progress/reset
 * Reset all progress (New Game).
 */
router.post("/reset", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await resetProgress(userId);

    const freshProgress = await getUserFullProgress(userId);

    res.json({
      success: true,
      data: {
        username: (req.user as any).username || req.user!.name,
        fullname: req.user!.name,
        ...freshProgress,
      },
    });
  } catch (error) {
    console.error("[progress.routes] POST /reset error:", error);
    res.status(500).json({ success: false, error: "Failed to reset progress" });
  }
});

/**
 * POST /api/progress/cheat
 * Dev-only cheat code to unlock everything.
 * Body: { cheatCode: string }
 */
router.post("/cheat", async (req: Request, res: Response) => {
  try {
    if (env.NODE_ENV === "production") {
      res.status(403).json({ success: false, error: "Cheat codes disabled in production" });
      return;
    }

    const userId = req.user!.id;
    const { cheatCode } = req.body;

    if (cheatCode !== "fikrangantengbeut123") {
      res.status(400).json({ success: false, error: "Invalid cheat code" });
      return;
    }

    await unlockAllWithCheat(userId);
    const updatedProgress = await getUserFullProgress(userId);

    res.json({
      success: true,
      data: {
        username: (req.user as any).username || req.user!.name,
        fullname: req.user!.name,
        ...updatedProgress,
      },
    });
  } catch (error) {
    console.error("[progress.routes] POST /cheat error:", error);
    res.status(500).json({ success: false, error: "Failed to apply cheat code" });
  }
});

export default router;
