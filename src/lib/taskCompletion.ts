// 任务完成后的级联逻辑（Phase 0.4 重构 + 修复 2 个 edge case）：
//   1. 幂等：父任务已 completed 时不再重复发奖励（防止撤销→再完成刷声望）
//   2. 级联向上：子通关触发布尔完成时，继续向上检查父的父是否也应通关（3 层嵌套场景）
//   3. 进度对齐：任何子完成 → 沿途所有祖先 bossProgress 按子女实际完成比例更新
//
// 纯函数实现（无 store / 无 React），便于测试与多入口复用（completeTask / 云端完成 / 批量导入结算）。

import type { IQuestTask } from '@/types/quest';

export interface ITaskUpdatePatch {
  id: string;
  status?: IQuestTask['status'];
  bossProgress?: number;
  completedAt?: number;
  updatedAt: number;
  // 幂等标记：仅在此任务「首次通关」时产出 true，用于奖励发放判断
  __firstTimeCleared?: boolean;
}

export interface IClearanceBonus {
  parentId: string;
  parentName: string;
  rep: number;
  sp: number;
  difficulty: IQuestTask['difficulty'];
  relatedSkillId?: string;
}

export interface CascadeCompletionResult {
  patches: ITaskUpdatePatch[];
  bonuses: IClearanceBonus[];
}

interface IInternalTraverseCtx {
  now: number;
  patches: ITaskUpdatePatch[];
  patchedMap: Map<string, ITaskUpdatePatch>;
  bonuses: IClearanceBonus[];
  tasks: IQuestTask[];
  childrenByParent: Map<string, IQuestTask[]>;
  coeff: number;
}

function buildChildrenIndex(tasks: IQuestTask[]): Map<string, IQuestTask[]> {
  const idx = new Map<string, IQuestTask[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const arr = idx.get(t.parentId) ?? [];
      arr.push(t);
      idx.set(t.parentId, arr);
    }
  }
  return idx;
}

// 获取某父任务当前状态：优先取 ctx 内已 patch 的快照，否则 tasks 数组原记录
function getEffective(ctx: IInternalTraverseCtx, taskId: string): IQuestTask | undefined {
  const p = ctx.patchedMap.get(taskId);
  if (!p) return ctx.tasks.find((t) => t.id === taskId);
  const orig = ctx.tasks.find((t) => t.id === taskId);
  if (!orig) return undefined;
  return { ...orig, ...p } as IQuestTask;
}

// 计算某父任务按「子任务完成数 / 子任务总数」的 bossProgress 百分比（0~100 整数）
export function computeBossProgressForParent(
  tasks: IQuestTask[],
  parentId: string,
  overridePatches: ITaskUpdatePatch[] = [],
): number {
  const patchMap = new Map(overridePatches.map((p) => [p.id, p]));
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.parentId !== parentId) continue;
    total++;
    const p = patchMap.get(t.id);
    const status = p?.status ?? t.status;
    if (status === 'completed') done++;
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// 检查某父任务的所有子女是否已 completed（考虑 patch 覆盖）
function allChildrenCompleted(ctx: IInternalTraverseCtx, parentId: string): boolean {
  const children = ctx.childrenByParent.get(parentId) ?? [];
  if (children.length === 0) return false;
  for (const c of children) {
    const eff = getEffective(ctx, c.id);
    if (!eff || eff.status !== 'completed') return false;
  }
  return true;
}

// 对某祖先节点更新 bossProgress，并根据需要触发「通关→状态→奖励→继续向上递归」
function visitAncestor(ctx: IInternalTraverseCtx, parentId: string) {
  const parent = getEffective(ctx, parentId);
  if (!parent) return;

  const progress = computeBossProgressForParent(ctx.tasks, parentId, [...ctx.patches]);
  const patch: ITaskUpdatePatch = { id: parentId, bossProgress: progress, updatedAt: ctx.now };

  const wasAlreadyCompleted = parent.status === 'completed';
  const shouldClear = !wasAlreadyCompleted && allChildrenCompleted(ctx, parentId);
  if (shouldClear) {
    patch.status = 'completed';
    patch.bossProgress = 100;
    patch.completedAt = ctx.now;
    patch.__firstTimeCleared = true;
  }

  ctx.patches.push(patch);
  ctx.patchedMap.set(parentId, patch);

  if (shouldClear) {
    const rep = Math.round((parent.rewardReputation || 0) * ctx.coeff);
    const sp = Math.round((parent.rewardSkillPoints || 0) * ctx.coeff);
    if (rep > 0 || sp > 0) {
      ctx.bonuses.push({
        parentId,
        parentName: parent.name,
        rep,
        sp,
        difficulty: parent.difficulty,
        relatedSkillId: parent.relatedSkillId,
      });
    }
    // 级联向上：本父通关了，它的父可能也满足条件
    if (parent.parentId) visitAncestor(ctx, parent.parentId);
    return;
  }

  // 未通关也要向上走，同步更高祖先的 bossProgress（子女完成率影响爷爷进度条）
  if (parent.parentId) visitAncestor(ctx, parent.parentId);
}

/**
 * 入口：某任务被标记为 completed 后，计算沿途所有祖先应更新的字段与奖励。
 *
 * @param tasks 全量任务数组（不可变，函数内不会修改）
 * @param completedTaskId 刚被标记为 completed 的任务 id
 * @param epicClearCoeff 史诗通关奖励系数（默认 1.0）
 * @param now 当前时间戳（Date.now()，测试时可注入）
 * @returns 应用方需遍历 patches 合并回 tasksState、并逐条发放 bonuses 中的奖励
 */
export function cascadeTaskCompletion(
  tasks: IQuestTask[],
  completedTaskId: string,
  epicClearCoeff: number = 1.0,
  now: number = Date.now(),
): CascadeCompletionResult {
  const ctx: IInternalTraverseCtx = {
    now,
    patches: [],
    patchedMap: new Map(),
    bonuses: [],
    tasks,
    childrenByParent: buildChildrenIndex(tasks),
    coeff: Number.isFinite(epicClearCoeff) && epicClearCoeff > 0 ? epicClearCoeff : 1.0,
  };

  const justCompleted = tasks.find((t) => t.id === completedTaskId);
  if (!justCompleted) return { patches: [], bonuses: [] };

  // 起点：刚完成任务的直接父
  if (justCompleted.parentId) visitAncestor(ctx, justCompleted.parentId);

  return { patches: ctx.patches, bonuses: ctx.bonuses };
}
