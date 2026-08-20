'use strict';

// ============================================================
// Quest Guild 全局常量（Phase 0 集中魔法数字 + Phase 4 默认集）
// 单一可信源：所有经济数值只在此定义，server/index.js 与未来云端同步均引用此处。
// ============================================================

// 难度白名单——用于校验，非法值一律回落默认，杜绝 NaN 经济崩坏
const VALID_DIFFICULTIES = ['easy', 'normal', 'hard', 'epic'];
const DEFAULT_DIFFICULTY = 'normal';

// 难度基础声望 B（Phase 4 定案）
const DIFFICULTY_BASE_REPUTATION = { easy: 5, normal: 10, hard: 25, epic: 80 };

// 难度技能点（Phase 4 定案：normal 走熟练度进度，不直接给点）
const DIFFICULTY_SKILL_POINTS = { easy: 0, normal: 0, hard: 1, epic: 3 };

// 重要性权重 M（Phase 4 定案）
const IMPORTANCE_WEIGHTS = { low: 1.0, medium: 1.2, high: 1.6, urgent: 2.0 };
const DEFAULT_IMPORTANCE = 'medium';

// 时长奖励封顶（Phase 4 定案）：D = min(minutes, CAP) × PER_MIN，上界 +6
const TIME_REWARD_CAP_MINUTES = 60;
const TIME_REWARD_PER_MIN = 0.1;

// 熟练度阈值：每完成 1 个 normal +1，满阈值解锁 1 普通节点（Phase 4 定案）
const PROFICIENCY_THRESHOLD = 10;

// 每周声望软上限（Phase 4 防自灌）：超出后收益递减为 50%，避免单周通胀
const WEEKLY_REP_CAP = 800;

// 默认 meta 初始值（与 server/index.js initMeta 种子保持一致）
const DEFAULT_META = { reputation: 100, skill_points: 3 };

// 本周起点（周一 00:00 本地时间），用于软上限的周聚合
function getWeekStartISO(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay(); // 0=周日 .. 6=周六
  const diff = day === 0 ? -6 : 1 - day; // 以周一为周起点
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 防自灌软上限：本周已得 currentWeekRep，本次 rawRep，超出 WEEKLY_REP_CAP 后仅计 50%
function awardWithWeeklySoftCap(currentWeekRep, rawRep, cap = WEEKLY_REP_CAP) {
  const cwr = Math.max(0, Number(currentWeekRep) || 0);
  const raw = Math.max(0, Number(rawRep) || 0);
  if (cwr >= cap) return Math.round(raw * 0.5);
  const room = cap - cwr;
  if (raw <= room) return raw;
  return room + Math.round((raw - room) * 0.5);
}

// 合法性校验：非法/缺失难度 → 默认 normal
function normalizeDifficulty(d) {
  return VALID_DIFFICULTIES.includes(d) ? d : DEFAULT_DIFFICULTY;
}

// 合法性校验：非法/缺失重要性 → 默认 medium
function normalizeImportance(m) {
  return Object.prototype.hasOwnProperty.call(IMPORTANCE_WEIGHTS, m) ? m : DEFAULT_IMPORTANCE;
}

// 声望公式（Phase 4 定案）：声望 = round(B × M + D)
// 输入 minutes 为预估或实际分钟，超出封顶部分无效（防自灌/刷分）。
function computeReputation({ difficulty, importance = DEFAULT_IMPORTANCE, minutes = 0 } = {}) {
  const d = normalizeDifficulty(difficulty);
  const m = normalizeImportance(importance);
  const B = DIFFICULTY_BASE_REPUTATION[d];
  const M = IMPORTANCE_WEIGHTS[m];
  const capped = Math.min(Math.max(0, Number(minutes) || 0), TIME_REWARD_CAP_MINUTES);
  const D = capped * TIME_REWARD_PER_MIN;
  return Math.round(B * M + D);
}

// 技能点（Phase 4 定案）
function computeSkillPoints(difficulty) {
  const d = normalizeDifficulty(difficulty);
  return DIFFICULTY_SKILL_POINTS[d];
}

module.exports = {
  VALID_DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_BASE_REPUTATION,
  DIFFICULTY_SKILL_POINTS,
  IMPORTANCE_WEIGHTS,
  DEFAULT_IMPORTANCE,
  TIME_REWARD_CAP_MINUTES,
  TIME_REWARD_PER_MIN,
  PROFICIENCY_THRESHOLD,
  WEEKLY_REP_CAP,
  DEFAULT_META,
  getWeekStartISO,
  awardWithWeeklySoftCap,
  normalizeDifficulty,
  normalizeImportance,
  computeReputation,
  computeSkillPoints,
};
