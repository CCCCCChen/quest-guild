// Phase 3B：玩家段位数字框架（决策 2 方案 B，仅展示，不做升级曲线）
// 段位仅给「声望总数」一个意义参照，避免等级通胀后失去目标感。

export interface RankTier {
  /** 最小声望门槛（含） */
  min: number;
  name: string;
  /** 展示用 emoji/标识 */
  badge: string;
}

// 段位表：由低到高，最后一个为封顶段位（无 next）
export const RANK_TIERS: RankTier[] = [
  { min: 0, name: '初心者', badge: '🌱' },
  { min: 50, name: '学徒', badge: '📘' },
  { min: 150, name: '好手', badge: '⚔️' },
  { min: 350, name: '专家', badge: '🛡️' },
  { min: 700, name: '大师', badge: '👑' },
  { min: 1200, name: '传奇勇者', badge: '🔥' },
];

export interface RankInfo {
  tier: RankTier;
  /** 当前声望 */
  reputation: number;
  /** 下一段位（封顶时为 null） */
  next: RankTier | null;
  /** 距下一段位还差多少声望（封顶为 0） */
  toNext: number;
  /** 在当前段位内的进度 0-1（封顶为 1） */
  progress: number;
}

export function computeRank(reputation: number): RankInfo {
  const rep = Number.isFinite(reputation) ? reputation : 0;
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (rep >= RANK_TIERS[i].min) idx = i;
  }
  const tier = RANK_TIERS[idx];
  const next = idx + 1 < RANK_TIERS.length ? RANK_TIERS[idx + 1] : null;

  if (!next) {
    return { tier, reputation: rep, next: null, toNext: 0, progress: 1 };
  }

  const span = next.min - tier.min;
  const into = rep - tier.min;
  const progress = span > 0 ? Math.min(1, Math.max(0, into / span)) : 1;
  return { tier, reputation: rep, next, toNext: next.min - rep, progress };
}
