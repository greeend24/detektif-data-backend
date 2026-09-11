import { db } from "../db/index.js";
import { user, userStats, userSubbabProgress, userBadges } from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";

/**
 * Get the global leaderboard ranked by totalScore.
 * Returns player summary including completed stages count and badge count.
 */
export async function getTopPlayers(limit: number = 50) {
  // Join user + user_stats
  const rows = await db
    .select({
      userId: user.id,
      username: user.username,
      fullname: user.name,
      totalScore: userStats.totalScore,
      endlessHighScore: userStats.endlessHighScore,
    })
    .from(user)
    .innerJoin(userStats, eq(user.id, userStats.id))
    .orderBy(desc(userStats.totalScore))
    .limit(limit);

  // For each user, compute completedStages and badgeCount
  const leaderboard = await Promise.all(
    rows.map(async (row) => {
      // Count completed stages from JSON stars text
      const progressRows = await db
        .select({ stars: userSubbabProgress.stars })
        .from(userSubbabProgress)
        .where(eq(userSubbabProgress.userId, row.userId));

      let completedStages = 0;
      for (const p of progressRows) {
        try {
          const starsObj = JSON.parse(p.stars || "{}");
          completedStages += Object.keys(starsObj).length;
        } catch {
          // ignore parse errors
        }
      }

      // Count badges
      const [badgeResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(userBadges)
        .where(eq(userBadges.userId, row.userId));

      return {
        username: row.username,
        fullname: row.fullname,
        totalScore: row.totalScore,
        endlessHighScore: row.endlessHighScore,
        completedStages,
        badgeCount: Number(badgeResult?.count ?? 0),
      };
    })
  );

  return leaderboard;
}
