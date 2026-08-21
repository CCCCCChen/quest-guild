// 进度计算纯函数（Phase 1.1）：
//   - computeProjectProgress: 项目工时加权进度（完成任务实际工时 / 所有任务预估工时）
//   - computeGoalProgress: 目标下属项目进度简单平均
//   - computeMilestoneReached: 里程碑达成判断（松规则：所有项目 completed 或整体进度≥100%）
//
// 纯函数无 React 依赖，可单测与跨端复用。

import type { IQuestTask, IProject } from '@/types/quest';

/** 里程碑结构：一个目标可拆分为若干里程碑节点，每个节点包含若干需完成的项目 */
export interface IGoalMilestone {
  index: number;
  title?: string;
  projectIds: string[];
  deadline?: number;
}

/**
 * 项目进度 = Σ（已完成任务 actualMinutes，缺则 fallback estimatedMinutes）
 *           / Σ（所有任务 estimatedMinutes，无预估的不计入分母）
 *
 * - 空项目（0 个任务，或 0 个有预估的任务）→ 返回 0
 * - 返回 0 ~ 1 之间的小数（百分比 = Math.round(p * 100)）
 */
export function computeProjectProgress(
  tasks: IQuestTask[],
  projectId: string,
): number {
  if (!projectId) return 0;
  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  if (projectTasks.length === 0) return 0;

  let numerator = 0;
  let denominator = 0;
  for (const t of projectTasks) {
    // 分母：只要有预估就计入
    if (t.estimatedMinutes && t.estimatedMinutes > 0) {
      denominator += t.estimatedMinutes;
    }
    // 分子：仅已完成任务，actual 无则 fallback estimated
    if (t.status === 'completed') {
      const minutes =
        t.actualMinutes && t.actualMinutes > 0
          ? t.actualMinutes
          : t.estimatedMinutes && t.estimatedMinutes > 0
            ? t.estimatedMinutes
            : 0;
      numerator += minutes;
    }
  }

  if (denominator === 0) return 0;
  const ratio = numerator / denominator;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * 目标进度 = 下属项目 computeProjectProgress 结果的简单平均
 * （后续 Phase 可扩展为「按项目预估总工时」加权）
 *
 * - 目标无项目 → 返回 0
 * - 某个项目任务为 0 或 分母为 0 → 该项目贡献 0（不拖平均，避免误判目标进度）
 */
export function computeGoalProgress(
  tasks: IQuestTask[],
  projects: IProject[],
  goalId: string,
): number {
  if (!goalId) return 0;
  const goalProjects = projects.filter((p) => p.goalId === goalId);
  if (goalProjects.length === 0) return 0;

  let sum = 0;
  for (const p of goalProjects) {
    sum += computeProjectProgress(tasks, p.id);
  }
  return sum / goalProjects.length;
}

/**
 * 里程碑是否达成（松规则）：
 *   true 当且仅当满足以下任一：
 *   A) 里程碑 projectIds 对应的**全部**项目状态都是 completed
 *   B) 里程碑所有项目的进度整体简单平均 ≥ 100%（≥ 0.995 视为 100%）
 *
 * 注：
 *   - 若某个 projectId 在 projects 数组里不存在，视为进度 0 且状态非 completed，会拖整体平均
 *   - 里程碑 projectIds 为空数组 → 视为 trivially reached（返回 true，避免空里程碑无限未达成）
 */
export function computeMilestoneReached(
  tasks: IQuestTask[],
  projects: IProject[],
  milestones: IGoalMilestone[],
  milestoneIndex: number,
): boolean {
  if (!milestones || milestones.length === 0) return false;
  const ms = milestones.find((m) => m.index === milestoneIndex);
  if (!ms) return false;
  if (!ms.projectIds || ms.projectIds.length === 0) return true;

  let allCompleted = true;
  let progressSum = 0;
  const n = ms.projectIds.length;

  for (const pid of ms.projectIds) {
    const p = projects.find((x) => x.id === pid);
    if (!p) {
      allCompleted = false;
      continue; // 不存在的项目进度记为 0
    }
    if (p.status !== 'completed') {
      allCompleted = false;
    }
    progressSum += computeProjectProgress(tasks, pid);
  }

  if (allCompleted) return true;

  const avg = progressSum / n;
  return avg >= 0.995;
}
