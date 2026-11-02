// P0-F：完成即问反馈 → 动态预估校正（estimationProfile）
//
// 用户完成一个任务时，不直接要"实际多少分钟"（记不准），而是给一个相对偏差：
//   准 / 慢一点 / 慢一倍 / 快很多
// 我们把相对偏差映射成 target 乘数，再用指数滑动平均（EMA）滚动更新
// estimationProfile[`${contentType}:${difficulty}`]，从而逐步校正同类任务的预估。

export type FeedbackChoice = 'accurate' | 'slower' | 'much_slower' | 'much_faster' | 'skip';

/** 相对选择 → 目标乘数（相对"预估"而言） */
export const FEEDBACK_TARGET: Record<Exclude<FeedbackChoice, 'skip'>, number> = {
  accurate: 1.0, // 预估挺准
  slower: 1.3, // 慢一点
  much_slower: 2.0, // 慢一倍
  much_faster: 0.6, // 快很多
};

export const FEEDBACK_LABELS: { choice: FeedbackChoice; label: string; hint: string }[] = [
  { choice: 'accurate', label: '挺准', hint: '预估和实际差不多' },
  { choice: 'slower', label: '慢一点', hint: '实际比预估多花约 30%' },
  { choice: 'much_slower', label: '慢一倍', hint: '实际约翻倍' },
  { choice: 'much_faster', label: '快很多', hint: '实际远少于预估' },
  { choice: 'skip', label: '跳过', hint: '这次不评价' },
];

/** 由 contentType + difficulty 构造 profile key */
export function profileKey(contentType: string | undefined, difficulty: string): string {
  return `${contentType || 'unknown'}:${difficulty}`;
}

const EMA_ALPHA = 0.4; // 收敛速度：单样本即可拉 40%，样本越多越稳

/**
 * 把一次反馈滚动合并进 profile。
 * @param profile 当前乘数表
 * @param contentType 任务内容性质（可能 undefined）
 * @param difficulty 任务难度
 * @param choice 用户相对选择（skip 原样返回）
 * @returns 新的 profile（不可变更新）
 */
export function applyEstimationFeedback(
  profile: Record<string, number> | undefined,
  contentType: string | undefined,
  difficulty: string,
  choice: FeedbackChoice,
): Record<string, number> {
  if (choice === 'skip') return profile ?? {};
  const key = profileKey(contentType, difficulty);
  const current = profile?.[key] ?? 1.0;
  const target = FEEDBACK_TARGET[choice as Exclude<FeedbackChoice, 'skip'>] ?? 1.0;
  // EMA：first sample → target；之后逐步靠拢
  const next = current === 1.0 ? target : current + EMA_ALPHA * (target - current);
  return { ...(profile ?? {}), [key]: Math.round(next * 100) / 100 };
}

/**
 * 读取某个 (contentType, difficulty) 的当前乘数，默认 1.0。
 * 供 AI 拆解 / 创建任务时校正预估用。
 */
export function getEstimationMultiplier(
  profile: Record<string, number> | undefined,
  contentType: string | undefined,
  difficulty: string,
): number {
  const v = profile?.[profileKey(contentType, difficulty)];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 1.0;
}
