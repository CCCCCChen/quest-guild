// P0-G：时间账聚合（纯函数）
//
// 把"还剩多少事、要花多久、按维度怎么分布、DDL 倒排每天至少做多少"算清楚。
// 全部为纯函数，便于单测与面板复用。统计口径：只算「未完成的叶子任务」
// （即没有子任务引用它的任务），避免父任务与子任务重复计数。

import type { IQuestTask, LifeDomain, ContentType, TaskDifficulty, ExecutionContext } from '@/types/quest';

export const LIFEDOMAIN_LABELS: Record<LifeDomain, string> = {
  work: '工作',
  parttime: '兼职',
  growth: '成长',
  health: '健康',
};

export const CONTENTTYPE_LABELS: Record<ContentType, string> = {
  coding: '编码',
  writing: '写作',
  research: '调研',
  communication: '沟通',
  design: '设计',
  mechanical: '机械',
  learning: '学习',
  errand: '跑腿',
};

export const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  easy: '易',
  normal: '中',
  hard: '难',
  epic: '史诗',
};

export const EXECUTION_LABELS: Record<ExecutionContext, string> = {
  commute: '通勤',
  snippet: '碎片',
  focus: '专注',
  lowEnergy: '低精力',
};

export interface DimSlice {
  key: string;
  label: string;
  minutes: number;
}

export interface TimeAccountSummary {
  today: number;
  week: number;
  total: number;
  overdue: number;
  byLifeDomain: DimSlice[];
  byContentType: DimSlice[];
  byDifficulty: DimSlice[];
  byExecutionContext: DimSlice[];
  /** DDL 倒排：距最早截止还有多少天、那之前每天至少做多少分钟；无 deadline 则为 null */
  ddlReverse: { deadline: number; daysLeft: number; perDay: number } | null;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** 返回未完成的叶子任务（没有任何任务以它为 parentId） */
export function getIncompleteLeafTasks(tasks: IQuestTask[]): IQuestTask[] {
  const parentIds = new Set(tasks.map((t) => t.parentId).filter(Boolean) as string[]);
  return tasks.filter((t) => t.status !== 'completed' && !parentIds.has(t.id));
}

function sum(arr: IQuestTask[]): number {
  return arr.reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
}

function sliceBy<T extends string>(
  leaves: IQuestTask[],
  pick: (t: IQuestTask) => T[] | T | undefined,
  labels: Record<T, string>,
): DimSlice[] {
  const acc = new Map<string, number>();
  for (const t of leaves) {
    const v = pick(t);
    const keys = Array.isArray(v) ? v : v ? [v] : [];
    for (const k of keys) {
      acc.set(k, (acc.get(k) || 0) + (t.estimatedMinutes || 0));
    }
  }
  return [...acc.entries()]
    .map(([key, minutes]) => ({ key, label: labels[key as T] ?? key, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

export function computeTimeAccount(tasks: IQuestTask[], now = Date.now()): TimeAccountSummary {
  const leaves = getIncompleteLeafTasks(tasks);
  const todayStart = startOfDay(now);

  const open = leaves.filter((t) => !t.deadline); // 无截止 = 开放待办
  const dueToday = leaves.filter((t) => t.deadline && isSameDay(t.deadline, now));
  const dueThisWeek = leaves.filter((t) => {
    if (!t.deadline) return false;
    const d = startOfDay(t.deadline);
    const diff = d - todayStart;
    const days = Math.round(diff / 86400000);
    return days >= 0 && days < 7;
  });

  const overdue = leaves.filter((t) => t.deadline != null && t.deadline < todayStart);

  // DDL 倒排：取未完成叶子中最早的有截止任务
  const withDeadline = leaves
    .filter((t) => t.deadline != null)
    .sort((a, b) => (a.deadline as number) - (b.deadline as number));
  let ddlReverse: TimeAccountSummary['ddlReverse'] = null;
  if (withDeadline.length) {
    const earliest = withDeadline[0].deadline as number;
    const daysLeft = Math.max(1, Math.ceil((startOfDay(earliest) - todayStart) / 86400000));
    // 该最早截止之前（含当天）所有有截止的未完成叶子预估之和
    const minutesBefore = withDeadline
      .filter((t) => (t.deadline as number) <= earliest)
      .reduce((s, t) => s + (t.estimatedMinutes || 0), 0);
    ddlReverse = {
      deadline: earliest,
      daysLeft,
      perDay: Math.ceil(minutesBefore / daysLeft),
    };
  }

  return {
    today: sum([...open, ...dueToday]),
    week: sum([...open, ...dueThisWeek]),
    total: sum(leaves),
    overdue: sum(overdue),
    byLifeDomain: sliceBy(leaves, (t) => t.lifeDomain, LIFEDOMAIN_LABELS),
    byContentType: sliceBy(leaves, (t) => t.contentType, CONTENTTYPE_LABELS),
    byDifficulty: sliceBy(leaves, (t) => t.difficulty, DIFFICULTY_LABELS),
    byExecutionContext: sliceBy(leaves, (t) => t.executionContext, EXECUTION_LABELS),
    ddlReverse,
  };
}

/** 把分钟格式化为「Xh Ym」 */
export function formatMinutes(min: number): string {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  return `${m}m`;
}
