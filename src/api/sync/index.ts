// 同步装配（Phase 2 B+ 延迟同步）
// 负责：组装快照载荷（任务 + 公会 meta）、选择同步目标、推送并维护本地同步状态。
// 采用"全量快照 + upsert"策略：B+ 低频同步，任务量小，整体推送最稳（幂等、无漏更）。
import type { IQuestTask } from '@/types/quest';
import { store } from '@/lib/storage';
import { computeStreak, computeTodayReputation } from '@/lib/streak';
import { syncState } from './state';
import { WorkspaceServerTarget, QuestServiceTarget } from './target';
import { mergeRemoteTasks } from '@/hooks/useTasks';
import type { QgMeta, QgTaskSnapshot, SyncPayload, SyncResult, SyncTarget } from './types';

const SYNC_TARGET = import.meta.env.VITE_SYNC_TARGET || 'workspace';

const REPUTATION_KEY = '__quest_guild_reputation';
const SKILL_POINTS_KEY = '__quest_guild_skill_points';
const TASKS_KEY = '__quest_guild_tasks';

export function getActiveTarget(): SyncTarget {
  return SYNC_TARGET === 'quest-service' ? new QuestServiceTarget() : new WorkspaceServerTarget();
}

function loadTasks(): IQuestTask[] {
  try {
    const raw = store.getItem(TASKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IQuestTask[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function toIso(ts?: number): string {
  return ts ? new Date(ts).toISOString() : new Date().toISOString();
}

function mapTask(t: IQuestTask): QgTaskSnapshot {
  return {
    id: t.id,
    title: t.name,
    type: t.type,
    difficulty: t.difficulty,
    status: t.status,
    description: t.description || '',
    source: 'qg',
    rewardSkillPoints: t.rewardSkillPoints || 0,
    estimatedMinutes: t.estimatedMinutes || null,
    dueDate: null,
    completedDate: t.completedAt ? toIso(t.completedAt) : null,
    reputation: t.rewardReputation || 0,
    parentId: t.parentId || null,
    stage: t.stage ?? null,
    createdAt: toIso(t.createdAt),
    updatedAt: toIso(t.updatedAt),
    importance: t.importance || '',
    actualMinutes: t.actualMinutes ?? null,
    goalId: t.goalId || null,
    projectId: t.projectId || null,
    tags: t.tags || [],
  };
}

function buildMeta(): QgMeta {
  const tasks = loadTasks();
  const reputation = Number(store.getItem(REPUTATION_KEY) || 0) || 0;
  const skillPoints = Number(store.getItem(SKILL_POINTS_KEY) || 0) || 0;
  return {
    reputation,
    skillPoints,
    streak: computeStreak(tasks),
    todayReputation: computeTodayReputation(tasks),
  };
}

// 推送一次全量快照。成功则清空脏标记并记录 serverTime；失败则记录错误并上抛。
export async function pushSync(): Promise<SyncResult> {
  const state = syncState.load();
  const tasks = loadTasks().map(mapTask);
  const meta = buildMeta();
  const payload: SyncPayload = {
    lastSyncAt: state.lastSyncAt,
    tasks,
    meta,
    deletedTaskIds: state.deletedTaskIds,
  };
  try {
    const result = await getActiveTarget().push(payload);
    // 双向同步：把云端返回的 qg 任务 + 云端删除集合合并回本地（LWW by updatedAt）
    mergeRemoteTasks(result.tasks ?? [], result.deletedOnCloudIds ?? []);
    syncState.clearAfterSync(result.serverTime);
    syncState.setResult(`已同步 ${result.synced} 条 · ${new Date(result.serverTime).toLocaleString()}`);
    return result;
  } catch (e) {
    syncState.setError(e instanceof Error ? e.message : String(e));
    throw e;
  }
}
