import { db } from "../db/index.js";
import { questScores, userStats, userSubbabProgress, userBadges } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

interface QuestExamInput {
  score: number; // 0 to 100
  correctCount: number; // e.g. 26
  totalQuestions?: number; // default 30
  pointsEarned: number; // total points earned in quest
  timeRemainingSeconds?: number;
}

export async function recordQuestExamScore(
  userId: string,
  subbabId: number,
  input: QuestExamInput
) {
  const now = new Date();
  const id = `${userId}_quest_${subbabId}`;
  const totalQuestions = input.totalQuestions || 30;
  const timeRemainingSeconds = input.timeRemainingSeconds || 0;

  // Check existing quest score for this subbab
  const [existing] = await db
    .select()
    .from(questScores)
    .where(and(eq(questScores.userId, userId), eq(questScores.subbabId, subbabId)));

  let shouldUpdateScore = true;
  if (existing && existing.score > input.score) {
    // Keep higher score, but can still update timestamp or points if higher
    shouldUpdateScore = false;
  }

  if (!existing) {
    await db.insert(questScores).values({
      id,
      userId,
      subbabId,
      score: input.score,
      correctCount: input.correctCount,
      totalQuestions,
      pointsEarned: input.pointsEarned,
      timeRemainingSeconds,
      completedAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(questScores)
      .set({
        score: shouldUpdateScore ? input.score : existing.score,
        correctCount: shouldUpdateScore ? input.correctCount : existing.correctCount,
        totalQuestions,
        pointsEarned: Math.max(existing.pointsEarned, input.pointsEarned),
        timeRemainingSeconds: Math.max(existing.timeRemainingSeconds, timeRemainingSeconds),
        updatedAt: now,
      })
      .where(eq(questScores.id, existing.id));
  }

  // Update totalScore in user_stats
  const [currentStats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.id, userId));

  const addScore = Math.max(0, input.pointsEarned);
  if (currentStats) {
    await db
      .update(userStats)
      .set({
        totalScore: currentStats.totalScore + addScore,
        updatedAt: now,
      })
      .where(eq(userStats.id, userId));
  } else {
    await db.insert(userStats).values({
      id: userId,
      totalScore: addScore,
      endlessHighScore: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Ensure stage 21 of this subbab is marked completed with 3 stars
  const subbabRowId = `${userId}_subbab${subbabId}`;
  const [subProgress] = await db
    .select()
    .from(userSubbabProgress)
    .where(eq(userSubbabProgress.id, subbabRowId));

  if (subProgress) {
    let starsObj: Record<string, number> = {};
    try {
      starsObj = JSON.parse(subProgress.stars || "{}");
    } catch {}
    starsObj["21"] = 3;
    await db
      .update(userSubbabProgress)
      .set({
        stars: JSON.stringify(starsObj),
        currentStage: Math.max(subProgress.currentStage, 21),
        updatedAt: now,
      })
      .where(eq(userSubbabProgress.id, subbabRowId));
  }

  // Fetch updated quest scores for this user
  const allUserQuestScores = await getUserQuestScores(userId);

  return {
    success: true,
    data: allUserQuestScores,
  };
}

export async function getUserQuestScores(userId: string) {
  const rows = await db
    .select()
    .from(questScores)
    .where(eq(questScores.userId, userId));

  // Map into a dictionary keyed by subbabId for easy frontend consumption
  const result: Record<number, any> = {};
  for (let i = 1; i <= 7; i++) {
    const found = rows.find((r) => r.subbabId === i);
    if (found) {
      result[i] = {
        subbabId: found.subbabId,
        score: found.score,
        correctCount: found.correctCount,
        totalQuestions: found.totalQuestions,
        pointsEarned: found.pointsEarned,
        timeRemainingSeconds: found.timeRemainingSeconds,
        completedAt: found.completedAt,
      };
    } else {
      result[i] = null;
    }
  }

  return {
    subbabs: result,
    raw: rows,
  };
}
