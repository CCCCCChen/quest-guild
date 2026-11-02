// 任务上下文继承：把父级（史诗任务 / 项目）的关联属性下传给新建的子任务，
// 避免出现「无家可归」的孤儿任务（缺失 goalId/projectId/capabilityIds/tags）。
//
// 设计要点：
// - 入参是「上下文源」(IQuestTask 或 IProject 都带 goalId/projectId/capabilityIds/tags)，
//   不依赖具体类型，方便在 AI 转正、项目页建任务、手动表单等多个入口复用。
// - patch 优先：调用方显式传入的字段覆盖继承值（尊重用户主动选择）。
// - stage 不自动继承：子任务 stage 由 AI 拆分 / 用户单独指定，调用方通过 patch.stage 传入。

import type { LifeDomain, ContentType, ExecutionContext } from '@/types/quest';

export interface ITaskContextSource {
  goalId?: string;
  projectId?: string;
  capabilityIds?: string[];
  tags?: string[];
  // P1-D：维度字段也可被继承（子任务未填时从父级继承，避免重复填写）
  lifeDomain?: LifeDomain[];
  contentType?: ContentType;
  executionContext?: ExecutionContext[];
}

export interface ITaskContext {
  goalId?: string;
  projectId?: string;
  capabilityIds?: string[];
  tags?: string[];
  stage?: number;
  // P1-D
  lifeDomain?: LifeDomain[];
  contentType?: ContentType;
  executionContext?: ExecutionContext[];
}

function pick<T>(v: T | undefined | null): T | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return (v.length ? v : undefined) as T | undefined;
  if (typeof v === 'string') return (v.trim() ? v : undefined) as T | undefined;
  return v;
}

/**
 * 从上下文源提取可继承字段。
 */
export function getTaskContext(source: ITaskContextSource | null | undefined): ITaskContext {
  if (!source) return {};
  return {
    goalId: pick(source.goalId),
    projectId: pick(source.projectId),
    capabilityIds: pick(source.capabilityIds),
    tags: pick(source.tags),
    lifeDomain: pick(source.lifeDomain),
    contentType: pick(source.contentType),
    executionContext: pick(source.executionContext),
  };
}

/**
 * 合并继承上下文：patch 提供的字段优先，否则从父级继承。
 * 仅当 patch.stage 显式提供时才带 stage（子任务 stage 不自动继承父级）。
 */
export function inheritContext(
  source: ITaskContextSource | null | undefined,
  patch: ITaskContext = {},
): ITaskContext {
  const base = getTaskContext(source);
  return {
    goalId: patch.goalId !== undefined ? patch.goalId : base.goalId,
    projectId: patch.projectId !== undefined ? patch.projectId : base.projectId,
    capabilityIds: patch.capabilityIds !== undefined ? patch.capabilityIds : base.capabilityIds,
    tags: patch.tags !== undefined ? patch.tags : base.tags,
    stage: patch.stage,
    // P1-D：子任务未显式填维度时，从父级继承
    lifeDomain: patch.lifeDomain !== undefined ? patch.lifeDomain : base.lifeDomain,
    contentType: patch.contentType !== undefined ? patch.contentType : base.contentType,
    executionContext: patch.executionContext !== undefined ? patch.executionContext : base.executionContext,
  };
}
