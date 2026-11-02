// EXPORTS: IQuestTask, ISkillNode, IShopItem, IGoal, IProject, IReflection, IManaConfig, IActiveTrack, IFocusLog, IRedemption, IAppSettings, TaskType, TaskDifficulty, TaskStatus, SkillStatus, GoalStatus, ProjectStatus

export type TaskType = 'epic' | 'daily';
export type TaskDifficulty = 'easy' | 'normal' | 'hard' | 'epic';
export type TaskImportance = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'active' | 'completed';
export type SkillStatus = 'locked' | 'unlocked' | 'enhanced';
export type GoalStatus = 'active' | 'archived';
export type ProjectStatus = 'active' | 'completed' | 'archived';

// ========== P0-C：7+1 多维分类体系 ==========
/** 1.4 生活领域（原"来源"重命名，多选） */
export type LifeDomain = 'work' | 'parttime' | 'growth' | 'health';
/** 1.5 内容性质（供 estimationProfile 与时间账分布） */
export type ContentType =
  | 'coding'
  | 'writing'
  | 'research'
  | 'communication'
  | 'design'
  | 'mechanical'
  | 'learning'
  | 'errand';
/** 1.8 执行情境（服务 G2"现在能做什么"，多选） */
export type ExecutionContext = 'commute' | 'snippet' | 'focus' | 'lowEnergy';

/** 1.6 周期规则 */
export interface IRecurrenceRule {
  type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
  /** 每 N 天/周/月（type!=none 时生效） */
  interval?: number;
  /** 0-6，weekly 用 */
  weekdays?: number[];
  /** 终止时间戳（可选） */
  endDate?: number;
}

export interface IQuestTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  difficulty: TaskDifficulty;
  importance?: TaskImportance;
  estimatedMinutes: number;
  actualMinutes: number;
  relatedSkillId?: string;
  goalId?: string;
  projectId?: string;
  capabilityIds?: string[];
  bossName?: string;
  bossProgress: number;
  parentId?: string;
  stage: number;
  status: TaskStatus;
  isTracking: boolean;
  isAttention: boolean;
  rewardReputation: number;
  rewardSkillPoints: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  source?: 'mock' | 'user';
  tags?: string[];
  // ========== P0-C：7+1 多维分类字段 ==========
  /** 1.4 生活领域（work/parttime/growth/health，多选） */
  lifeDomain?: LifeDomain[];
  /** 1.5 内容性质（供 estimationProfile 与时间账分布） */
  contentType?: ContentType;
  /** 1.8 执行情境（commute/snippet/focus/lowEnergy，多选） */
  executionContext?: ExecutionContext[];
  /** AI 给的"怎么做"提示（nextAction 落点） */
  howToHint?: string;
  /** 计划开始时间 */
  startDate?: number;
  /** 截止时间 */
  deadline?: number;
  /** 1.6 周期规则 */
  recurrence?: IRecurrenceRule;
  /** 提醒时间戳 */
  reminderAt?: number;
}

export interface ISkillNode {
  id: string;
  name: string;
  description: string;
  category: string;
  parentId?: string;
  level: number;
  status: SkillStatus;
  x: number;
  y: number;
  icon?: string;
  requiredSkillPoints: number;
  unlockedAt?: number;
  proficiencyLevel?: number;
  experience?: number;
  lastImprovedAt?: number;
}

export interface IShopItem {
  id: string;
  name: string;
  cost: number;
  icon: string;
  color?: string;
  description?: string;
  source: 'mock' | 'user';
  createdAt: number;
}

export interface IGoal {
  id: string;
  name: string;
  description: string;
  deadline?: number;
  milestone?: string;
  milestoneDeadline?: number;
  status: GoalStatus;
  createdAt: number;
  updatedAt: number;
}

export interface IProject {
  id: string;
  goalId?: string;
  name: string;
  description: string;
  capabilityIds: string[];
  progress: number;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
}

export interface IReflection {
  id: string;
  taskId: string;
  expectedResult: string;
  actualResult: string;
  lessonLearned: string;
  nextAction: string;
  createdAt: number;
}

export interface IManaConfig {
  maxAttentionTasks: number;
  current: number;
}

export interface IActiveTrack {
  taskId: string;
  accumulatedSeconds: number;
  lastStartTime?: number;
  isRunning: boolean;
}

export interface IFocusLog {
  id: string;
  taskId: string;
  date: string;
  durationMinutes: number;
  completedAt: number;
}

export interface IRedemption {
  id: string;
  itemId: string;
  itemName: string;
  cost: number;
  redeemedAt: number;
}

export interface IFloatingPosition {
  x: number;
  y: number;
}

export interface IAppSettings {
  appName: string;
  manaMax: number;
  resetTime: string;
  soundEnabled: boolean;
  floatingPosition: IFloatingPosition;
  floatingOpacity: number;
  floatingCollapseDelay: number;
  /** 史诗父任务「通关奖励」系数：子任务全完成后，按父任务预置 rewardReputation × 此系数发放。默认 1.0，UI 调参留待 Phase 1 后补 */
  epicClearCoefficient?: number;
  /**
   * P0-F：AI 维护的预估校正乘数表。
   * key = `${contentType}:${difficulty}`，value = 乘数（初值 1.0）。
   * 完成即问反馈后滚动更新，用于校正同类任务的 estimatedMinutes。
   */
  estimationProfile?: Record<string, number>;
  /**
   * P2-A1：用户自定义的 lifeDomain 扩展标签（种子值见 decomposeRules.json）。
   * AI 拆解时合并进 dimensionVocab.lifeDomain 随请求体发给云端（客户端权威），
   * 改枚举无需重新部署服务端。
   */
  customLifeDomains?: string[];
}
