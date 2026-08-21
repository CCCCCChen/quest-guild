// 存量数据校验器（P0-4）
// 在备份 / 迁移 / 专家导入前对本地数据做一致性体检，输出 human-readable 报告。
// 设计为纯函数、无 React 依赖，便于单测与复用。

import type { IQuestTask, ISkillNode, IGoal, IProject } from '@/types/quest';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  taskId?: string;
}

export interface StorageValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  /** 通过校验后生成的简短指纹，可写入迁移元信息 */
  checksum?: string;
}

export interface ValidationInput {
  tasks: IQuestTask[];
  skills: ISkillNode[];
  goals?: IGoal[];
  projects?: IProject[];
}

function simpleChecksum(input: ValidationInput): string {
  try {
    const s = JSON.stringify({
      t: input.tasks.map((t) => t.id).sort(),
      s: input.skills.map((x) => x.id).sort(),
      g: (input.goals ?? []).map((x) => x.id).sort(),
      p: (input.projects ?? []).map((x) => x.id).sort(),
    });
    // 轻量哈希（非加密，仅作一致性指纹）
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return `v1-${h.toString(36)}`;
  } catch {
    return 'v1-0';
  }
}

export function validateStorage(input: ValidationInput): StorageValidationReport {
  const { tasks, skills, goals = [], projects = [] } = input;
  const issues: ValidationIssue[] = [];

  const taskIds = new Set<string>();
  const skillIds = new Set(skills.map((s) => s.id));
  const goalIds = new Set(goals.map((g) => g.id));
  const projectIds = new Set(projects.map((p) => p.id));

  // 1. id 唯一性
  for (const t of tasks) {
    if (!t.id) {
      issues.push({ level: 'error', message: '存在缺少 id 的任务' });
      continue;
    }
    if (taskIds.has(t.id)) {
      issues.push({ level: 'error', message: `任务 id 重复：${t.id}`, taskId: t.id });
    } else {
      taskIds.add(t.id);
    }
  }

  // 2. 外键回链存在性
  for (const t of tasks) {
    if (t.parentId && !taskIds.has(t.parentId)) {
      issues.push({
        level: 'error',
        message: `孤儿任务：「${t.name}」的父任务 ${t.parentId} 不存在`,
        taskId: t.id,
      });
    }
    if (t.goalId && !goalIds.has(t.goalId)) {
      issues.push({
        level: 'warning',
        message: `任务「${t.name}」关联的目标 ${t.goalId} 不存在`,
        taskId: t.id,
      });
    }
    if (t.projectId && !projectIds.has(t.projectId)) {
      issues.push({
        level: 'warning',
        message: `任务「${t.name}」关联的项目 ${t.projectId} 不存在`,
        taskId: t.id,
      });
    }
    for (const c of t.capabilityIds || []) {
      if (!skillIds.has(c)) {
        issues.push({
          level: 'warning',
          message: `任务「${t.name}」关联的能力 ${c} 不存在`,
          taskId: t.id,
        });
      }
    }
  }

  // 3. 已完成子任务 → 父 bossProgress 一致性
  const childrenByParent = new Map<string, IQuestTask[]>();
  for (const t of tasks) {
    if (t.parentId) {
      const arr = childrenByParent.get(t.parentId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentId, arr);
    }
  }
  for (const [parentId, children] of childrenByParent) {
    const parent = tasks.find((t) => t.id === parentId);
    if (!parent) continue;
    const done = children.filter((c) => c.status === 'completed').length;
    const ratio = children.length ? Math.round((done / children.length) * 100) : 0;
    // 父已标记完成，但子任务未全部完成 → 状态不一致
    if (parent.status === 'completed' && done < children.length) {
      issues.push({
        level: 'warning',
        message: `父任务「${parent.name}」标记为完成，但仍有 ${children.length - done} 个子任务未完成`,
        taskId: parent.id,
      });
    }
    // 父 bossProgress 明显低于实际完成比例（差 >10%）→ 进度虚低
    if (parent.bossProgress != null && ratio - (parent.bossProgress || 0) > 10) {
      issues.push({
        level: 'warning',
        message: `父任务「${parent.name}」bossProgress ${parent.bossProgress}% 低于实际完成比例 ${ratio}%`,
        taskId: parent.id,
      });
    }
  }

  const valid = !issues.some((i) => i.level === 'error');
  return {
    valid,
    issues,
    checksum: valid ? simpleChecksum(input) : undefined,
  };
}
