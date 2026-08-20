// 同步载荷契约（Phase 2 B+ 延迟同步）
// 与 workspace-server POST /api/tasks/sync 的载荷格式一一对应，是跨端唯一契约。
import type { IQuestTask } from '@/types/quest';

export interface QgTaskSnapshot {
  id: string;
  title: string;
  type: 'daily' | 'epic';
  difficulty: string | null;
  status: string;
  description: string;
  source: 'qg';
  rewardSkillPoints: number;
  estimatedMinutes: number | null;
  dueDate: string | null;
  completedDate: string | null;
  reputation: number;
  parentId: string | null;
  stage: number | null;
  createdAt: string;
  updatedAt: string;
  // Phase 2 终对齐：重要性 + 实际用时（完成时重算用）
  importance?: string;
  actualMinutes?: number | null;
  // P1：关联项目/目标与标签，避免同步后丢关联
  goalId?: string | null;
  projectId?: string | null;
  tags?: string[];
}

export interface QgMeta {
  reputation: number;
  skillPoints: number;
  streak: number;
  todayReputation: number;
  lastSyncAt?: number;
}

export interface SyncPayload {
  lastSyncAt: number;
  tasks: QgTaskSnapshot[];
  meta: QgMeta;
  deletedTaskIds?: string[];
}

export interface SyncResult {
  success: boolean;
  serverTime: number;
  synced: number;
  // 双向同步：云端返回的当前 qg 任务全集 + 自上次同步以来云端删除的 id（供本地 LWW 合并）
  tasks?: QgTaskSnapshot[];
  deletedOnCloudIds?: string[];
}

// 架构缝：同步目标抽象。未来方案 C（独立服务）只需新增一个实现类 + 翻 SYNC_TARGET，
// 业务代码只依赖此接口，不感知后端是 workspace-server 还是独立 quest 服务。
export interface SyncTarget {
  push(payload: SyncPayload): Promise<SyncResult>;
}

// 仅为类型推导方便：前端内部使用的任务快照构造入参
export type QgTaskSource = IQuestTask;
