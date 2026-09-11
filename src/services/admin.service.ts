import { db } from "../db/index.js";
import { user, userStats, userSubbabProgress, questScores, userBadges, session, account } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export interface StudentSummary {
  id: string;
  name: string;
  username: string;
  email: string;
  createdAt: Date;
  totalScore: number;
  endlessHighScore: number;
  stagesCompletedTotal: number;
  chaptersProgress: Record<
    number,
    {
      currentStage: number;
      starsCount: number;
      isStage21Completed: boolean;
      questScore: number | null;
      questCorrectCount: number | null;
      questCompletedAt: Date | null;
    }
  >;
}

export async function getAllStudentsData(): Promise<StudentSummary[]> {
  // Fetch all users
  const users = await db.select().from(user).orderBy(desc(user.createdAt));
  const statsList = await db.select().from(userStats);
  const progressList = await db.select().from(userSubbabProgress);
  const questList = await db.select().from(questScores);

  const statsMap = new Map(statsList.map((s) => [s.id, s]));

  return users.map((u) => {
    const s = statsMap.get(u.id);
    const uProgress = progressList.filter((p) => p.userId === u.id);
    const uQuests = questList.filter((q) => q.userId === u.id);

    let totalStagesCount = 0;
    const chaptersProgress: StudentSummary["chaptersProgress"] = {};

    for (let subId = 1; subId <= 7; subId++) {
      const prog = uProgress.find((p) => p.subbabId === subId);
      const quest = uQuests.find((q) => q.subbabId === subId);

      let starsCount = 0;
      let isStage21Completed = false;

      if (prog) {
        try {
          const parsed = JSON.parse(prog.stars || "{}");
          starsCount = Object.keys(parsed).length;
          isStage21Completed = Boolean(parsed["21"]) || prog.currentStage > 21;
        } catch {}
      }

      totalStagesCount += starsCount;

      chaptersProgress[subId] = {
        currentStage: prog?.currentStage || 1,
        starsCount,
        isStage21Completed,
        questScore: quest ? quest.score : null,
        questCorrectCount: quest ? quest.correctCount : null,
        questCompletedAt: quest ? quest.completedAt : null,
      };
    }

    return {
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      createdAt: u.createdAt,
      totalScore: s?.totalScore ?? 0,
      endlessHighScore: s?.endlessHighScore ?? 0,
      stagesCompletedTotal: totalStagesCount,
      chaptersProgress,
    };
  });
}

export async function getAdminOverview() {
  const students = await getAllStudentsData();
  const totalStudents = students.length;

  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      averageEndless: 0,
      topScorer: null,
      totalQuestExamsTaken: 0,
    };
  }

  const totalScoreSum = students.reduce((acc, s) => acc + s.totalScore, 0);
  const totalEndlessSum = students.reduce((acc, s) => acc + s.endlessHighScore, 0);
  const sortedByScore = [...students].sort((a, b) => b.totalScore - a.totalScore);

  let totalQuestExamsTaken = 0;
  students.forEach((s) => {
    Object.values(s.chaptersProgress).forEach((c) => {
      if (c.questScore !== null) totalQuestExamsTaken++;
    });
  });

  return {
    totalStudents,
    averageScore: Math.round(totalScoreSum / totalStudents),
    averageEndless: Math.round(totalEndlessSum / totalStudents),
    topScorer: {
      name: sortedByScore[0]?.name || "-",
      username: sortedByScore[0]?.username || "-",
      score: sortedByScore[0]?.totalScore || 0,
    },
    totalQuestExamsTaken,
  };
}

export async function generateStudentsCsv(): Promise<string> {
  const students = await getAllStudentsData();

  // CSV Headers - Designed specifically for Thesis S2 Data Analysis
  const headers = [
    "No",
    "Nama Lengkap Siswa",
    "Username",
    "Email",
    "Total Stage Diselesaikan (Maks 147)",
    "Bab 1: Stage",
    "Bab 1: Nilai Ujian Quest (0-100)",
    "Bab 2: Stage",
    "Bab 2: Nilai Ujian Quest (0-100)",
    "Bab 3: Stage",
    "Bab 3: Nilai Ujian Quest (0-100)",
    "Bab 4: Stage",
    "Bab 4: Nilai Ujian Quest (0-100)",
    "Bab 5: Stage",
    "Bab 5: Nilai Ujian Quest (0-100)",
    "Bab 6: Stage",
    "Bab 6: Nilai Ujian Quest (0-100)",
    "Bab 7: Stage",
    "Bab 7: Nilai Ujian Quest (0-100)",
    "High Score Endless Mode",
    "Total Skor Game",
    "Tanggal Pendaftaran",
  ];

  const rows = students.map((s, idx) => {
    const c = s.chaptersProgress;
    const formatDate = s.createdAt
      ? new Date(s.createdAt).toISOString().split("T")[0]
      : "-";

    return [
      idx + 1,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.username || "").replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      s.stagesCompletedTotal,
      c[1].currentStage,
      c[1].questScore !== null ? c[1].questScore : "-",
      c[2].currentStage,
      c[2].questScore !== null ? c[2].questScore : "-",
      c[3].currentStage,
      c[3].questScore !== null ? c[3].questScore : "-",
      c[4].currentStage,
      c[4].questScore !== null ? c[4].questScore : "-",
      c[5].currentStage,
      c[5].questScore !== null ? c[5].questScore : "-",
      c[6].currentStage,
      c[6].questScore !== null ? c[6].questScore : "-",
      c[7].currentStage,
      c[7].questScore !== null ? c[7].questScore : "-",
      s.endlessHighScore,
      s.totalScore,
      formatDate,
    ].join(",");
  });

  // Prepend UTF-8 BOM so Microsoft Excel correctly renders all Indonesian characters
  return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
}

export async function deleteStudentById(userId: string) {
  await db.delete(questScores).where(eq(questScores.userId, userId));
  await db.delete(userSubbabProgress).where(eq(userSubbabProgress.userId, userId));
  await db.delete(userBadges).where(eq(userBadges.userId, userId));
  await db.delete(userStats).where(eq(userStats.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
  await db.delete(account).where(eq(account.userId, userId));
  await db.delete(user).where(eq(user.id, userId));
  return { success: true };
}

export async function resetAllStudentsData() {
  await db.delete(questScores);
  await db.delete(userSubbabProgress);
  await db.delete(userBadges);
  await db.delete(userStats);
  await db.delete(session);
  await db.delete(account);
  await db.delete(user);
  return { success: true };
}

