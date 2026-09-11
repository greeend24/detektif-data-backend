import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { recordQuestExamScore, getUserQuestScores } from "../services/quest.service.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/quest
 * Fetch all quest exam scores for the authenticated user (subbabs 1 to 7).
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const scores = await getUserQuestScores(userId);
    res.json({ success: true, data: scores });
  } catch (error) {
    console.error("[quest.routes] GET / error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch quest scores" });
  }
});

/**
 * POST /api/quest/submit
 * Submit and record a completed Quest Mode exam.
 * Body: { subbabId: number, score: number, correctCount: number, totalQuestions?: number, pointsEarned: number, timeRemainingSeconds?: number }
 */
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { subbabId, score, correctCount, totalQuestions, pointsEarned, timeRemainingSeconds } = req.body;

    if (
      typeof subbabId !== "number" ||
      subbabId < 1 ||
      subbabId > 7 ||
      typeof score !== "number" ||
      score < 0 ||
      typeof correctCount !== "number" ||
      typeof pointsEarned !== "number"
    ) {
      res.status(400).json({
        success: false,
        error: "Invalid input. Required: subbabId (1-7), score (0-100), correctCount (number), pointsEarned (number)",
      });
      return;
    }

    const result = await recordQuestExamScore(userId, subbabId, {
      score: Math.min(100, Math.max(0, Math.round(score))),
      correctCount,
      totalQuestions: totalQuestions || 30,
      pointsEarned,
      timeRemainingSeconds: timeRemainingSeconds || 0,
    });

    res.json({
      success: true,
      message: `Nilai Ujian Bab ${subbabId} berhasil disimpan!`,
      data: result.data,
    });
  } catch (error) {
    console.error("[quest.routes] POST /submit error:", error);
    res.status(500).json({ success: false, error: "Failed to submit quest exam score" });
  }
});

export default router;
