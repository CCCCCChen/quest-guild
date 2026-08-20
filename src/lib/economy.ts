// Quest Guild 前端经济模块（Phase 4）
// 与 server/constants.js 保持一致的单一可信源镜像（TS 端，供前端预览/乐观更新使用）。
// 服务端 server/constants.js 仍为权威源；两处数值必须同步修改。

import type { TaskDifficulty, TaskImportance } from '@/types/quest';

export const DIFFICULTY_BASE_REPUTATION: Record<TaskDifficulty, number> = {
  easy: 5,
  normal: 10,
  hard: 25,
  epic: 80,
};

// normal 不给技能点，走熟练度进度（Phase 4 定案）
export const DIFFICULTY_SKILL_POINTS: Record<TaskDifficulty, number> = {
  easy: 0,
  normal: 0,
  hard: 1,
  epic: 3,
};

export const IMPORTANCE_WEIGHTS: Record<TaskImportance, number> = {
  low: 1.0,
  medium: 1.2,
  high: 1.6,
  urgent: 2.0,
};

export const DEFAULT_IMPORTANCE: TaskImportance = 'medium';

export const TIME_REWARD_CAP_MINUTES = 60;
export const TIME_REWARD_PER_MIN = 0.1;
export const PROFICIENCY_THRESHOLD = 10;
export const WEEKLY_REP_CAP = 800;

export function normalizeDifficulty(d: string): TaskDifficulty {
  return d === 'easy' || d === 'normal' || d === 'hard' || d === 'epic' ? d : 'normal';
}

export function normalizeImportance(m: string): TaskImportance {
  return m === 'low' || m === 'medium' || m === 'high' || m === 'urgent' ? m : 'medium';
}

// 声望公式：声望 = round(B × M + D)，D = min(minutes, CAP) × PER_MIN
export function computeReputation({
  difficulty,
  importance = DEFAULT_IMPORTANCE,
  minutes = 0,
}: {
  difficulty: TaskDifficulty | string;
  importance?: TaskImportance | string;
  minutes?: number;
}): number {
  const d = normalizeDifficulty(difficulty as string);
  const m = normalizeImportance(importance as string);
  const B = DIFFICULTY_BASE_REPUTATION[d];
  const M = IMPORTANCE_WEIGHTS[m];
  const capped = Math.min(Math.max(0, Number(minutes) || 0), TIME_REWARD_CAP_MINUTES);
  const D = capped * TIME_REWARD_PER_MIN;
  return Math.round(B * M + D);
}

export function computeSkillPoints(difficulty: TaskDifficulty | string): number {
  const d = normalizeDifficulty(difficulty as string);
  return DIFFICULTY_SKILL_POINTS[d];
}

// 本周起点（周一 00:00 本地时间）
export function getWeekStartISO(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 防自灌软上限：本周已得 currentWeekRep，本次 rawRep，超出 WEEKLY_REP_CAP 后仅计 50%
export function awardWithWeeklySoftCap(
  currentWeekRep: number,
  rawRep: number,
  cap: number = WEEKLY_REP_CAP,
): number {
  const cwr = Math.max(0, Number(currentWeekRep) || 0);
  const raw = Math.max(0, Number(rawRep) || 0);
  if (cwr >= cap) return Math.round(raw * 0.5);
  const room = cap - cwr;
  if (raw <= room) return raw;
  return room + Math.round((raw - room) * 0.5);
}
