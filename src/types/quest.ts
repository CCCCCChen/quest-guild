// EXPORTS: IQuestTask, ISkillNode, IShopItem, IGoal, IProject, IReflection, IManaConfig, IActiveTrack, IFocusLog, IRedemption, IAppSettings, TaskType, TaskDifficulty, TaskStatus, SkillStatus, GoalStatus, ProjectStatus

export type TaskType = 'epic' | 'daily';
export type TaskDifficulty = 'easy' | 'normal' | 'hard' | 'epic';
export type TaskImportance = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'active' | 'completed';
export type SkillStatus = 'locked' | 'unlocked' | 'enhanced';
export type GoalStatus = 'active' | 'archived';
export type ProjectStatus = 'active' | 'completed' | 'archived';

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
}
