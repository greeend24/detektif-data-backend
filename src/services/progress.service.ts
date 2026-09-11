import { db } from "../db/index.js";
import { userStats, userSubbabProgress, userBadges } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// Badge Definitions (mirrors frontend BADGE_DEFINITIONS)
// ─────────────────────────────────────────────

const BADGE_DEFINITIONS = [
  { id: "badge1", reqStages: 1, reqScore: 0 },
  { id: "badge2", reqStages: 6, reqScore: 0 },
  { id: "badge3", reqStages: 16, reqScore: 200 },
  { id: "badge4", reqStages: 31, reqScore: 500 },
  { id: "badge5", reqStages: 51, reqScore: 1000 },
  { id: "badge6", reqStages: 71, reqScore: 1800 },
  { id: "badge7", reqStages: 91, reqScore: 2600 },
  { id: "badge8", reqStages: 111, reqScore: 3400 },
  { id: "badge9", reqStages: 131, reqScore: 4000 },
  { id: "badge10", reqStages: 147, reqScore: 4760 },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Parse stars from JSON text (SQLite stores as text) */
function parseStars(starsText: string | null): Record<string, number> {
  try {
    return JSON.parse(starsText || "{}") || {};
  } catch {
    return {};
  }
}

/** Generate a deterministic ID for subbab progress rows */
function subbabProgressId(userId: string, subbabId: number): string {
  return `${userId}_subbab${subbabId}`;
}

/** Generate a deterministic ID for badge rows */
function badgeId(userId: string, badge: string): string {
  return `${userId}_${badge}`;
}

/**
 * Count total completed stages across all subbabs for a user.
 * A completed stage is any key in the `stars` JSON string.
 */
async function getCompletedStagesCount(userId: string): Promise<number> {
  const rows = await db
    .select({ stars: userSubbabProgress.stars })
    .from(userSubbabProgress)
    .where(eq(userSubbabProgress.userId, userId));

  let count = 0;
  for (const row of rows) {
    const starsObj = parseStars(row.stars);
    count += Object.keys(starsObj).length;
  }
  return count;
}

/**
 * Evaluate which badges the user should have unlocked.
 * Inserts any newly qualifying badges.
 * Returns an array of newly unlocked badge IDs.
 */
async function evaluateAndGrantBadges(
  userId: string,
  completedStagesCount: number,
  totalScore: number
): Promise<string[]> {
  // Fetch currently owned badges
  const ownedRows = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  const ownedSet = new Set(ownedRows.map((r) => r.badgeId));

  const newlyUnlocked: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (ownedSet.has(badge.id)) continue;

    const meetsStages = completedStagesCount >= badge.reqStages;
    const meetsScore = badge.reqScore > 0 && totalScore >= badge.reqScore;

    if (meetsStages || meetsScore) {
      await db.insert(userBadges).values({
        id: badgeId(userId, badge.id),
        userId,
        badgeId: badge.id,
        unlockedAt: new Date(),
      }).onConflictDoNothing();
      newlyUnlocked.push(badge.id);
    }
  }

  return newlyUnlocked;
}

// ─────────────────────────────────────────────
// Service Methods
// ─────────────────────────────────────────────

/**
 * Initialize default progress for a newly registered user.
 * Creates user_stats row and unlocks subbab 1.
 */
export async function initializeUserProgress(userId: string): Promise<void> {
  const now = new Date();

  // Create stats row
  await db.insert(userStats).values({
    id: userId,
    totalScore: 0,
    endlessHighScore: 0,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  // Create subbab 1 as unlocked
  await db
    .insert(userSubbabProgress)
    .values({
      id: subbabProgressId(userId, 1),
      userId,
      subbabId: 1,
      unlocked: true,
      currentStage: 1,
      stars: "{}",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Grant badge1 (Detektif Pemula) by default
  await db
    .insert(userBadges)
    .values({
      id: badgeId(userId, "badge1"),
      userId,
      badgeId: "badge1",
      unlockedAt: now,
    })
    .onConflictDoNothing();
}

/**
 * Get the full user progress profile.
 * Returns stats, all subbab progress, and all badges.
 */
export async function getUserFullProgress(userId: string) {
  // Fetch stats
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.id, userId));

  // Fetch all subbab progress rows
  const progressRows = await db
    .select()
    .from(userSubbabProgress)
    .where(eq(userSubbabProgress.userId, userId));

  // Build the progress map matching frontend shape
  const progress: Record<
    string,
    { unlocked: boolean; currentStage: number; stars: Record<string, number> }
  > = {};

  // Initialize all 7 subbabs with defaults
  for (let i = 1; i <= 7; i++) {
    progress[`subbab${i}`] = {
      unlocked: i === 1,
      currentStage: 1,
      stars: {},
    };
  }

  // Override with actual data
  for (const row of progressRows) {
    const key = `subbab${row.subbabId}`;
    progress[key] = {
      unlocked: row.unlocked,
      currentStage: row.currentStage,
      stars: parseStars(row.stars),
    };
  }

  // Fetch badges
  const badgeRows = await db
    .select({ badgeId: userBadges.badgeId })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));

  const unlockedBadges = badgeRows.map((r) => r.badgeId);

  return {
    totalScore: stats?.totalScore ?? 0,
    endlessHighScore: stats?.endlessHighScore ?? 0,
    unlockedBadges,
    progress,
  };
}

/**
 * Update progress after completing a stage.
 * Handles: star update (only if better), score increment,
 * current stage advancement, next subbab unlock, and badge evaluation.
 */
export async function updateStageProgress(
  userId: string,
  subbabId: number,
  stageNum: number,
  scoreEarned: number,
  starsEarned: number
): Promise<{ newBadges: string[] }> {
  const now = new Date();

  // Ensure subbab progress row exists
  await db
    .insert(userSubbabProgress)
    .values({
      id: subbabProgressId(userId, subbabId),
      userId,
      subbabId,
      unlocked: true,
      currentStage: 1,
      stars: "{}",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Fetch current progress for this subbab
  const [currentProgress] = await db
    .select()
    .from(userSubbabProgress)
    .where(
      and(
        eq(userSubbabProgress.userId, userId),
        eq(userSubbabProgress.subbabId, subbabId)
      )
    );

  if (!currentProgress) {
    throw new Error(`Progress row not found for user ${userId}, subbab ${subbabId}`);
  }

  const currentStars = parseStars(currentProgress.stars);
  const prevStars = currentStars[String(stageNum)] || 0;

  let scoreToAdd = 0;

  // Only update if new stars are better
  if (starsEarned > prevStars) {
    currentStars[String(stageNum)] = starsEarned;
    scoreToAdd = scoreEarned;
  }

  // Advance currentStage
  let newCurrentStage = currentProgress.currentStage;
  if (stageNum >= currentProgress.currentStage && stageNum < 21) {
    newCurrentStage = stageNum + 1;
  }

  // Update subbab progress
  await db
    .update(userSubbabProgress)
    .set({
      stars: JSON.stringify(currentStars),
      currentStage: newCurrentStage,
      unlocked: true,
      updatedAt: now,
    })
    .where(
      and(
        eq(userSubbabProgress.userId, userId),
        eq(userSubbabProgress.subbabId, subbabId)
      )
    );

  // If stage 21 completed and subbabId < 7, unlock next subbab
  if (stageNum === 21 && subbabId < 7) {
    const nextSubbabId = subbabId + 1;
    await db
      .insert(userSubbabProgress)
      .values({
        id: subbabProgressId(userId, nextSubbabId),
        userId,
        subbabId: nextSubbabId,
        unlocked: true,
        currentStage: 1,
        stars: "{}",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userSubbabProgress.id],
        set: { unlocked: true, updatedAt: now },
      });
  }

  // Update total score
  if (scoreToAdd > 0) {
    await db
      .update(userStats)
      .set({
        totalScore: sql`${userStats.totalScore} + ${scoreToAdd}`,
        updatedAt: now,
      })
      .where(eq(userStats.id, userId));
  }

  // Evaluate badges
  const completedCount = await getCompletedStagesCount(userId);
  const [updatedStats] = await db
    .select({ totalScore: userStats.totalScore })
    .from(userStats)
    .where(eq(userStats.id, userId));

  const newBadges = await evaluateAndGrantBadges(
    userId,
    completedCount,
    updatedStats?.totalScore ?? 0
  );

  return { newBadges };
}

/**
 * Update endless mode high score.
 * Only updates if the new score beats the existing high score.
 */
export async function updateEndlessHighScore(
  userId: string,
  score: number
): Promise<{ updated: boolean; newBadges: string[] }> {
  const now = new Date();

  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.id, userId));

  if (!stats) {
    return { updated: false, newBadges: [] };
  }

  if (score > stats.endlessHighScore) {
    await db
      .update(userStats)
      .set({
        endlessHighScore: score,
        totalScore: sql`${userStats.totalScore} + ${score}`,
        updatedAt: now,
      })
      .where(eq(userStats.id, userId));

    // Re-evaluate badges
    const completedCount = await getCompletedStagesCount(userId);
    const [updatedStats] = await db
      .select({ totalScore: userStats.totalScore })
      .from(userStats)
      .where(eq(userStats.id, userId));

    const newBadges = await evaluateAndGrantBadges(
      userId,
      completedCount,
      updatedStats?.totalScore ?? 0
    );

    return { updated: true, newBadges };
  }

  return { updated: false, newBadges: [] };
}

/**
 * Reset all progress for a user (New Game).
 * Deletes all subbab progress and badges, resets stats, then re-initializes.
 */
export async function resetProgress(userId: string): Promise<void> {
  const now = new Date();

  await db
    .delete(userSubbabProgress)
    .where(eq(userSubbabProgress.userId, userId));

  await db.delete(userBadges).where(eq(userBadges.userId, userId));

  await db
    .update(userStats)
    .set({
      totalScore: 0,
      endlessHighScore: 0,
      updatedAt: now,
    })
    .where(eq(userStats.id, userId));

  // Re-initialize with defaults
  await initializeUserProgress(userId);
}

/**
 * Cheat code: Unlock all stages, all badges, max score.
 * Only allowed in development mode.
 */
export async function unlockAllWithCheat(userId: string): Promise<boolean> {
  const now = new Date();

  // Unlock all 7 subbabs with all 21 stages completed
  for (let i = 1; i <= 7; i++) {
    const allStars: Record<string, number> = {};
    for (let s = 1; s <= 21; s++) {
      allStars[String(s)] = 3;
    }

    await db
      .insert(userSubbabProgress)
      .values({
        id: subbabProgressId(userId, i),
        userId,
        subbabId: i,
        unlocked: true,
        currentStage: 21,
        stars: JSON.stringify(allStars),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userSubbabProgress.id],
        set: {
          unlocked: true,
          currentStage: 21,
          stars: JSON.stringify(allStars),
          updatedAt: now,
        },
      });
  }

  // Set max score
  await db
    .update(userStats)
    .set({
      totalScore: 99999,
      updatedAt: now,
    })
    .where(eq(userStats.id, userId));

  // Grant all badges
  for (const badge of BADGE_DEFINITIONS) {
    await db
      .insert(userBadges)
      .values({
        id: badgeId(userId, badge.id),
        userId,
        badgeId: badge.id,
        unlockedAt: now,
      })
      .onConflictDoNothing();
  }

  return true;
}
