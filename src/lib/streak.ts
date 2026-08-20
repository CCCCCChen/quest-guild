// EXPORTS: computeStreak, computeTodayReputation
//
// 连续天数 / 今日声望 —— 移植自云端 workspace-server/public/index.html 的已验证算法
// （renderReputation, 线条 1504-1522）。差异：云端任务用 completedDate(ISO 字符串)，
// 本地任务用 completedAt(毫秒时间戳)，故这里统一从时间戳转换成本地日期后回退计算。
//
// 算法要点（与云端一致）：
//  - 从今天往前逐日回退，若当日有已完成任务则 streak++；
//  - 今天允许“尚未完成”而不中断（iso === today 时仅往前走一步继续）；
//  - 最多 365 天，避免极端边界死循环。

import type { IQuestTask } from '@/types/quest';

/** 将时间戳转成本地时区 YYYY-MM-DD（与云端 d.getFullYear()/getMonth()+1/getDate() 一致） */
function toLocalISO(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 连续完成天数：从今天往前数，遇到首個“无完成记录且非今天”的日期即中断 */
export function computeStreak(tasks: IQuestTask[]): number {
  const completedDates = new Set(
    tasks
      .filter((t) => t.status === 'completed' && t.completedAt)
      .map((t) => toLocalISO(t.completedAt as number)),
  );
  if (completedDates.size === 0) return 0;

  let streak = 0;
  const d = new Date();
  const today = toLocalISO(Date.now());

  while (true) {
    const iso = toLocalISO(d.getTime());
    if (completedDates.has(iso)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (iso === today) {
      // 今天还没完成，不中断，继续往前看昨天
      d.setDate(d.getDate() - 1);
      continue;
    } else {
      break;
    }
    if (streak > 365) break;
  }
  return streak;
}

/** 今日声望：今天已完成任务的 rewardReputation 之和 */
export function computeTodayReputation(tasks: IQuestTask[]): number {
  const today = toLocalISO(Date.now());
  return tasks
    .filter((t) => t.status === 'completed' && t.completedAt && toLocalISO(t.completedAt) === today)
    .reduce((sum, t) => sum + (t.rewardReputation || 0), 0);
}
