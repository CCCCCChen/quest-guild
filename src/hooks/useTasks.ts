import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { IQuestTask, IActiveTrack, IFocusLog, TaskType, TaskDifficulty, TaskStatus, TaskImportance } from '@/types/quest';
import { PRESET_TASKS, PRESET_FOCUS_LOGS } from '@/data/preset';
import { SAMPLE_TASKS } from '@/data/sampleTasks';
import { playSound } from '@/lib/sound';
import { computeStreak, computeTodayReputation } from '@/lib/streak';
import { computeReputation, computeSkillPoints } from '@/lib/economy';
import { store, subscribeStorageChange } from '@/lib/storage';
import { appLogger } from '@/lib/runtime';
import { tasksApi } from '@/api';
import { grantCapabilityExperience, addSkillPointsSync } from '@/hooks/useSkills';
import { addReputationSync } from '@/hooks/useShop';
import { syncState } from '@/api/sync/state';
import type { QgTaskSnapshot } from '@/api/sync/types';

const STORAGE_KEY_TASKS = '__quest_guild_tasks';
const STORAGE_KEY_TRACK = '__quest_guild_active_track';
const STORAGE_KEY_FOCUS_LOG = '__quest_guild_focus_log';

function normalizeTask(t: IQuestTask): IQuestTask {
  // 保证 updatedAt 存在（老数据/旧预设可能没有），默认取 createdAt
  if (!t.updatedAt) t.updatedAt = t.createdAt || Date.now();
  return t;
}

function loadTasksFromCache(): IQuestTask[] {
  const raw = store.getItem(STORAGE_KEY_TASKS);
  if (raw === null) {
    // 首次运行（存储键从未创建）：自动种入示例任务，避免冷启动空白
    const seeded = SAMPLE_TASKS.map(normalizeTask);
    saveTasksCache(seeded);
    return seeded;
  }
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as IQuestTask[];
      if (Array.isArray(parsed)) return parsed.map(normalizeTask);
    }
  } catch { /* ignore */ }
  return PRESET_TASKS.map(normalizeTask);
}

function loadTrackFromCache(): IActiveTrack | null {
  try {
    const raw = store.getItem(STORAGE_KEY_TRACK);
    if (raw) return JSON.parse(raw) as IActiveTrack;
  } catch { /* ignore */ }
  return null;
}

function loadFocusLogsFromCache(): IFocusLog[] {
  try {
    const raw = store.getItem(STORAGE_KEY_FOCUS_LOG);
    if (raw) return JSON.parse(raw) as IFocusLog[];
  } catch { /* ignore */ }
  return PRESET_FOCUS_LOGS;
}

function saveTasksCache(tasks: IQuestTask[]) {
  try { store.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks)); } catch { /* ignore */ }
}

function saveTrackCache(track: IActiveTrack | null) {
  try {
    if (track) store.setItem(STORAGE_KEY_TRACK, JSON.stringify(track));
    else store.removeItem(STORAGE_KEY_TRACK);
  } catch { /* ignore */ }
}

function saveFocusLogsCache(logs: IFocusLog[]) {
  try { store.setItem(STORAGE_KEY_FOCUS_LOG, JSON.stringify(logs)); } catch { /* ignore */ }
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let globalTick = 0;
const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach((fn) => fn());
}

// 单例状态（跨组件共享）
let tasksState: IQuestTask[] = loadTasksFromCache();
let trackState: IActiveTrack | null = loadTrackFromCache();
let focusLogsState: IFocusLog[] = loadFocusLogsFromCache();
let initialized = false;

// 计时 tick：每秒更新一次追踪任务累计时长
let timerId: number | null = null;
function ensureTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    globalTick++;
    notifyAll();
  }, 1000);
}

function genId(prefix = 't'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// 收集某任务的所有后代 id（含直接子与更深层子树）
function collectDescendantIds(rootId: string): string[] {
  const direct = tasksState.filter((t) => t.parentId === rootId).map((t) => t.id);
  const out = [...direct];
  for (const d of direct) out.push(...collectDescendantIds(d));
  return out;
}

// 删除一个任务及其整棵子树：本地移除 + 标记云端删除（B+ 延迟同步）
// 替代原 deleteTask 的「只删父 + 仅 mark 父 id」，修复子任务云端残留
function deleteTaskTree(id: string): void {
  const task = tasksState.find((t) => t.id === id);
  const descendantIds = collectDescendantIds(id);
  const removeIds = [id, ...descendantIds];
  tasksState = tasksState.filter((t) => !removeIds.includes(t.id));
  if (trackState && removeIds.includes(trackState.taskId)) {
    trackState = null;
    saveTrackCache(null);
  }
  saveTasksCache(tasksState);
  notifyAll();
  for (const rid of removeIds) {
    tasksApi.remove(rid).catch(() => {/* 静默失败 */});
    syncState.markTaskDeleted(rid);
  }
  toast.success(`任务「${task?.name || ''}」已移除`);
}

// 级联删除某项目下所有任务（及其子树），并标记云端删除
export function cascadeDeleteTasksByProject(projectId: string): void {
  for (const t of tasksState.filter((t) => t.projectId === projectId)) {
    deleteTaskTree(t.id);
  }
}

// 级联删除某目标下所有任务（及其子树），并标记云端删除
export function cascadeDeleteTasksByGoal(goalId: string): void {
  for (const t of tasksState.filter((t) => t.goalId === goalId)) {
    deleteTaskTree(t.id);
  }
}

// 双向同步：把云端返回的 qg 任务合并回本地（按 updatedAt 做 last-write-wins）
// - 云端较新 → 采用云端同步字段（status/completed/name 等），保留本地独有字段（goalId/projectId/tags…）
// - 本地较新 → 保留本地（下次同步会推上去）
// - deletedIds → 云端已删，本地移除
// - 云端独有 → 新增到本地（workspace 悬赏专区新建的任务，补齐 quest 专属字段默认值）
// - 云端完成 → 本地补跑结算管线（声望/技能点/能力经验），结算权威在 quest 端
export function mergeRemoteTasks(remoteTasks: QgTaskSnapshot[], deletedIds: string[]): void {
  const remoteById = new Map(remoteTasks.map((t) => [t.id, t]));
  const deletedSet = new Set(deletedIds);
  const merged: IQuestTask[] = [];
  // 云端标记完成、本地尚未结算过奖励的任务（含「本地已有→云端完成」与「云端新建即完成」两条路径）
  const cloudCompleted: IQuestTask[] = [];

  for (const local of tasksState) {
    if (deletedSet.has(local.id)) continue; // 云端已删
    const remote = remoteById.get(local.id);
    if (!remote) {
      merged.push(local);
      continue;
    }
    const remoteUpdated = Date.parse(remote.updatedAt);
    if (remoteUpdated >= local.updatedAt) {
      const wasCompleted = local.status === 'completed';
      const next: IQuestTask = {
        ...local,
        name: remote.title,
        description: remote.description || '',
        type: remote.type === 'epic' ? 'epic' : 'daily',
        difficulty: (remote.difficulty as TaskDifficulty) || local.difficulty,
        status: (remote.status as TaskStatus) || local.status,
        importance: (remote.importance as TaskImportance) || local.importance,
        estimatedMinutes: remote.estimatedMinutes != null ? remote.estimatedMinutes : local.estimatedMinutes,
        actualMinutes: remote.actualMinutes != null ? remote.actualMinutes : local.actualMinutes,
        rewardReputation: remote.reputation,
        rewardSkillPoints: remote.rewardSkillPoints,
        parentId: remote.parentId ?? undefined,
        stage: remote.stage ?? local.stage,
        goalId: remote.goalId ?? local.goalId,
        projectId: remote.projectId ?? local.projectId,
        tags: remote.tags ?? local.tags,
        // 云端撤销完成（status 回 pending）时清掉本地 completedAt，避免 streak/今日声望误算
        completedAt: remote.status === 'completed'
          ? (remote.completedDate ? Date.parse(remote.completedDate) : local.completedAt)
          : undefined,
        updatedAt: remoteUpdated,
      };
      merged.push(next);
      if (!wasCompleted && next.status === 'completed') cloudCompleted.push(next);
    } else {
      merged.push(local);
    }
  }

  // 云端独有任务
  for (const remote of remoteTasks) {
    if (deletedSet.has(remote.id)) continue;
    if (merged.some((t) => t.id === remote.id)) continue;
    const remoteUpdated = Date.parse(remote.updatedAt);
    const imported: IQuestTask = {
      id: remote.id,
      name: remote.title,
      description: remote.description || '',
      type: remote.type === 'epic' ? 'epic' : 'daily',
      difficulty: (remote.difficulty as TaskDifficulty) || 'normal',
      importance: (remote.importance as TaskImportance) || 'medium',
      estimatedMinutes: remote.estimatedMinutes != null ? remote.estimatedMinutes : 0,
      actualMinutes: remote.actualMinutes != null ? remote.actualMinutes : 0,
      relatedSkillId: undefined,
      goalId: remote.goalId ?? undefined,
      projectId: remote.projectId ?? undefined,
      capabilityIds: [],
      bossName: undefined,
      bossProgress: remote.status === 'completed' ? 100 : 0,
      parentId: remote.parentId ?? undefined,
      stage: remote.stage ?? 0,
      status: (remote.status as TaskStatus) || 'pending',
      isTracking: false,
      isAttention: false,
      rewardReputation: remote.reputation,
      rewardSkillPoints: remote.rewardSkillPoints,
      createdAt: Date.parse(remote.createdAt) || Date.now(),
      updatedAt: remoteUpdated,
      completedAt: remote.completedDate ? Date.parse(remote.completedDate) : undefined,
      source: 'user',
      tags: remote.tags ?? [],
    };
    merged.push(imported);
    // 云端新建且已完成的任务（创建到完成都在 workspace 发生）同样需要结算
    if (imported.status === 'completed') cloudCompleted.push(imported);
  }

  // 云端完成结算 pass：按 quest 权威公式重算奖励并入账。
  // - actualMinutes 云端不记录（无专注计时），回退用预估分钟
  // - 本地在追踪该任务时，把已累计专注时长算进 actualMinutes 并停止追踪
  // - 结算后 bump updatedAt：本地版本成为最新，下次同步推回权威值（覆盖云端预览值）
  if (cloudCompleted.length) {
    const now = Date.now();
    const settleIds = new Set(cloudCompleted.map((t) => t.id));
    let settleSummaryRep = 0;
    let settleSummarySp = 0;

    tasksState = merged.map((t) => {
      if (!settleIds.has(t.id)) return t;

      // 本地仍在追踪此任务 → 把累计专注时长结算进 actualMinutes，并结束追踪
      let trackedSeconds = 0;
      if (trackState?.taskId === t.id) {
        trackedSeconds = trackState.accumulatedSeconds;
        if (trackState.isRunning && trackState.lastStartTime) {
          trackedSeconds += Math.floor((Date.now() - trackState.lastStartTime) / 1000);
        }
      }

      const trackedMinutes = trackedSeconds > 0 ? Math.round(trackedSeconds / 60) : 0;
      const actualMinutes = trackedMinutes > 0
        ? trackedMinutes
        : (t.actualMinutes > 0 ? t.actualMinutes : t.estimatedMinutes);

      const finalReputation = computeReputation({ difficulty: t.difficulty, importance: t.importance, minutes: actualMinutes });
      const finalSkillPoints = computeSkillPoints(t.difficulty);

      settleSummaryRep += finalReputation;
      settleSummarySp += finalSkillPoints;

      if (t.relatedSkillId) {
        const minutes = actualMinutes > 0 ? actualMinutes : t.estimatedMinutes;
        grantCapabilityExperience(t.relatedSkillId, minutes);
      }

      return {
        ...t,
        status: 'completed',
        isTracking: false,
        isAttention: false,
        actualMinutes,
        rewardReputation: finalReputation,
        rewardSkillPoints: finalSkillPoints,
        bossProgress: t.type === 'epic' ? 100 : t.bossProgress,
        updatedAt: now,
      };
    });

    // 本地在追踪的任务被云端完成 → 结束追踪状态
    if (trackState && settleIds.has(trackState.taskId)) {
      trackState = null;
      saveTrackCache(null);
    }

    // 结算副作用：声望/技能点入账（模块级，脱离 React hook）+ 脏标记（推回权威值）
    addReputationSync(settleSummaryRep, `云端完成 ${cloudCompleted.length} 个任务`);
    addSkillPointsSync(settleSummarySp);
    for (const t of cloudCompleted) {
      syncState.markTaskDirty(t.id);
    }
    syncState.markMetaDirty();
  } else {
    tasksState = merged;
  }

  saveTasksCache(tasksState);
  notifyAll();
}

// 从服务端拉取最新数据
async function syncFromServer() {
  try {
    const [tasks, track, logs] = await Promise.all([
      tasksApi.getAll(),
      tasksApi.getActiveTrack(),
      tasksApi.getFocusLogs(),
    ]);
    tasksState = tasks;
    trackState = track;
    focusLogsState = logs;
    saveTasksCache(tasks);
    saveTrackCache(track);
    saveFocusLogsCache(logs);
    notifyAll();
  } catch (e) {
    appLogger.error('同步服务端数据失败，使用本地缓存', String(e));
  } finally {
    initialized = true;
  }
}

// ========== 跨窗口同步 ==========
// 订阅存储变更事件：其他窗口修改数据时，本窗口自动从 electron-store 重载
subscribeStorageChange((event) => {
  if (event.key === STORAGE_KEY_TASKS) {
    tasksState = loadTasksFromCache();
    notifyAll();
  } else if (event.key === STORAGE_KEY_TRACK) {
    trackState = loadTrackFromCache();
    notifyAll();
  } else if (event.key === STORAGE_KEY_FOCUS_LOG) {
    focusLogsState = loadFocusLogsFromCache();
    notifyAll();
  }
});

export function useTasks() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    ensureTimer();

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    return () => {
      listeners.delete(fn);
    };
  }, []);

  const tasks = tasksState;
  const activeTrack = trackState;
  const focusLogs = focusLogsState;

  // 计算当前追踪任务的实时秒数（依赖 tick 以每秒刷新）
  const currentTrackSeconds = useMemo(() => {
    if (!activeTrack) return 0;
    let secs = activeTrack.accumulatedSeconds;
    if (activeTrack.isRunning && activeTrack.lastStartTime) {
      secs += Math.floor((Date.now() - activeTrack.lastStartTime) / 1000);
    }
    return secs;
  }, [activeTrack, tick]);

  const trackingTask = useMemo(() => {
    if (!activeTrack) return null;
    return tasks.find((t) => t.id === activeTrack.taskId) || null;
  }, [tasks, activeTrack]);

  const activeAttentionTasks = useMemo(
    () => tasks.filter((t) => t.isAttention && t.status !== 'completed'),
    [tasks],
  );

  const epicTasks = useMemo(
    () => tasks.filter((t) => t.type === 'epic' && !t.parentId),
    [tasks],
  );

  const dailyTasks = useMemo(
    () => tasks.filter((t) => t.type === 'daily'),
    [tasks],
  );

  const focusTodaySeconds = useMemo(() => {
    const today = todayStr();
    const minutes = focusLogs
      .filter((l) => l.date === today)
      .reduce((sum, l) => sum + l.durationMinutes, 0);
    return minutes * 60 + (activeTrack?.isRunning ? currentTrackSeconds : 0);
  }, [focusLogs, activeTrack, currentTrackSeconds]);

  // 连续完成天数（移植云端已验证算法）
  const streak = useMemo(() => computeStreak(tasks), [tasks]);

  // 今日声望：今天已完成任务累计奖励
  const todayReputation = useMemo(() => computeTodayReputation(tasks), [tasks]);

  // ========== 操作 ==========

  const addTask = useCallback(
    (data: {
      name: string;
      description?: string;
      type: TaskType;
      difficulty: TaskDifficulty;
      importance?: TaskImportance;
      estimatedMinutes: number;
      relatedSkillId?: string;
      goalId?: string;
      projectId?: string;
      capabilityIds?: string[];
      bossName?: string;
      parentId?: string;
      stage?: number;
      tags?: string[];
    }) => {
      const rewardReputation = computeReputation({ difficulty: data.difficulty, importance: data.importance, minutes: data.estimatedMinutes });
      const rewardSkillPoints = computeSkillPoints(data.difficulty);

      // 计算 stage：传入时优先使用；否则每日悬赏为 0，史诗父任务为 1，史诗子任务编号递增
      let stage: number;
      if (data.stage !== undefined) {
        stage = data.stage;
      } else if (data.type === 'epic') {
        if (data.parentId) {
          const siblings = tasksState.filter((t) => t.parentId === data.parentId);
          stage = siblings.length + 1;
        } else {
          stage = 1;
        }
      } else {
        stage = 0;
      }

      const newTask: IQuestTask = {
        id: genId(data.type === 'epic' ? 'ep' : 'dy'),
        name: data.name,
        description: data.description || '',
        type: data.type,
        difficulty: data.difficulty,
        importance: data.importance || 'medium',
        estimatedMinutes: data.estimatedMinutes,
        actualMinutes: 0,
        relatedSkillId: data.relatedSkillId,
        goalId: data.goalId,
        projectId: data.projectId,
        capabilityIds: data.capabilityIds || (data.relatedSkillId ? [data.relatedSkillId] : []),
        bossName: data.bossName,
        bossProgress: 0,
        parentId: data.parentId,
        stage,
        status: 'pending',
        isTracking: false,
        isAttention: false,
        rewardReputation,
        rewardSkillPoints,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'user',
        tags: data.tags || [],
      };

      // 乐观更新
      tasksState = [...tasksState, newTask];
      saveTasksCache(tasksState);
      notifyAll();

      // 异步同步到服务端（传前端生成的 id，保持父子关系一致）
      tasksApi.create({ ...data, id: newTask.id, stage }).catch((e) => {
        toast.error('任务同步失败', { description: String(e) });
      });

      // Phase 2：标记待同步（B+ 延迟同步）
      syncState.markTaskDirty(newTask.id);

      toast.success(`任务「${data.name}」已加入悬赏池`);
      return newTask;
    },
    [],
  );

  const updateTask = useCallback((id: string, patch: Partial<IQuestTask>) => {
    tasksState = tasksState.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t));
    saveTasksCache(tasksState);
    notifyAll();
    tasksApi.update(id, patch).catch(() => {/* 静默失败 */});
    syncState.markTaskDirty(id);
  }, []);

  const deleteTask = useCallback((id: string) => {
    deleteTaskTree(id);
  }, []);

  // 一键导入示例任务（评审提议的史诗 + 每日悬赏）。已存在 id 跳过，避免重复。
  const importSampleTasks = useCallback(() => {
    const existingIds = new Set(tasksState.map((t) => t.id));
    const toAdd = SAMPLE_TASKS.filter((t) => !existingIds.has(t.id));
    if (toAdd.length === 0) {
      toast.info('示例任务已全部在库中');
      return toAdd.length;
    }
    tasksState = [...tasksState, ...toAdd];
    saveTasksCache(tasksState);
    notifyAll();
    toAdd.forEach((t) => syncState.markTaskDirty(t.id));
    toast.success(`已导入 ${toAdd.length} 个示例任务（史诗 + 每日悬赏）`);
    return toAdd.length;
  }, []);

  // 设为追踪任务
  const setTrackingTask = useCallback(
    (taskId: string | null) => {
      tasksState = tasksState.map((t) => ({ ...t, isTracking: false }));

      if (!taskId) {
        if (trackState?.isRunning && trackState.lastStartTime) {
          const elapsed = Math.floor((Date.now() - trackState.lastStartTime) / 1000);
          trackState = { ...trackState, accumulatedSeconds: trackState.accumulatedSeconds + elapsed, isRunning: false, lastStartTime: undefined };
        }
        trackState = null;
        saveTrackCache(null);
        saveTasksCache(tasksState);
        notifyAll();
        tasksApi.setActiveTrack(null).catch(() => {});
        return;
      }

      const task = tasksState.find((t) => t.id === taskId);
      if (!task) return;

      if (task.isAttention) {
        tasksState = tasksState.map((t) =>
          t.id === taskId ? { ...t, isAttention: false, isTracking: true, status: 'active', updatedAt: Date.now() } : t,
        );
      } else {
        tasksState = tasksState.map((t) =>
          t.id === taskId ? { ...t, isTracking: true, status: 'active', updatedAt: Date.now() } : t,
        );
      }

      let accumulatedSeconds = 0;
      if (trackState?.taskId === taskId) {
        accumulatedSeconds = trackState.accumulatedSeconds;
        if (trackState.isRunning && trackState.lastStartTime) {
          accumulatedSeconds += Math.floor((Date.now() - trackState.lastStartTime) / 1000);
        }
      }

      trackState = { taskId, accumulatedSeconds, isRunning: false };
      saveTrackCache(trackState);
      saveTasksCache(tasksState);
      notifyAll();
      tasksApi.setActiveTrack(taskId).catch(() => {});
      syncState.markTaskDirty(taskId);
      toast.success(`「${task.name}」已设为主线追踪任务`);
    },
    [],
  );

  const startTracking = useCallback(() => {
    if (!trackState) return;
    if (trackState.isRunning) return;
    trackState = { ...trackState, isRunning: true, lastStartTime: Date.now() };
    saveTrackCache(trackState);
    notifyAll();
    tasksApi.startTracking().catch(() => {});
  }, []);

  const pauseTracking = useCallback(() => {
    if (!trackState || !trackState.isRunning) return;
    const elapsed = Math.floor((Date.now() - (trackState.lastStartTime || Date.now())) / 1000);
    trackState = {
      ...trackState,
      accumulatedSeconds: trackState.accumulatedSeconds + elapsed,
      isRunning: false,
      lastStartTime: undefined,
    };
    saveTrackCache(trackState);
    notifyAll();
    tasksApi.pauseTracking().catch(() => {});
  }, []);

  // 添加到注意力任务
  const addAttentionTask = useCallback(
    (taskId: string, maxAttention: number): boolean => {
      const task = tasksState.find((t) => t.id === taskId);
      if (!task) return false;
      if (task.isTracking) {
        toast.error('追踪任务不能同时作为注意力任务');
        return false;
      }
      const currentCount = tasksState.filter((t) => t.isAttention && t.status !== 'completed').length;
      if (currentCount >= maxAttention) {
        toast.error(`专注槽已满！最多激活 ${maxAttention} 个注意力任务`);
        return false;
      }
      tasksState = tasksState.map((t) =>
        t.id === taskId ? { ...t, isAttention: true, status: 'active', updatedAt: Date.now() } : t,
      );
      saveTasksCache(tasksState);
      notifyAll();
      tasksApi.addAttention(taskId, maxAttention).catch(() => {});
      syncState.markTaskDirty(taskId);
      toast.success(`「${task.name}」已加入注意力任务`);
      return true;
    },
    [],
  );

  const removeAttentionTask = useCallback((taskId: string) => {
    tasksState = tasksState.map((t) =>
      t.id === taskId ? { ...t, isAttention: false, updatedAt: Date.now() } : t,
    );
    saveTasksCache(tasksState);
    notifyAll();
    tasksApi.removeAttention(taskId).catch(() => {});
    syncState.markTaskDirty(taskId);
  }, []);

  // 完成任务
  const completeTask = useCallback(
    (taskId: string) => {
      const task = tasksState.find((t) => t.id === taskId);
      if (!task) return;

      let actualSeconds = 0;
      if (task.isTracking && trackState?.taskId === taskId) {
        actualSeconds = trackState.accumulatedSeconds;
        if (trackState.isRunning && trackState.lastStartTime) {
          actualSeconds += Math.floor((Date.now() - trackState.lastStartTime) / 1000);
        }
        const log: IFocusLog = {
          id: genId('fl'),
          taskId,
          date: todayStr(),
          durationMinutes: Math.max(1, Math.round(actualSeconds / 60)),
          completedAt: Date.now(),
        };
        focusLogsState = [...focusLogsState, log];
        saveFocusLogsCache(focusLogsState);
        trackState = null;
        saveTrackCache(null);
      }

      const actualMinutes = actualSeconds > 0 ? Math.round(actualSeconds / 60) : task.actualMinutes;

      // Phase 4：按实际时长 + 重要性重算奖励（与 server 一致）
      const finalReputation = computeReputation({ difficulty: task.difficulty, importance: task.importance, minutes: actualMinutes });
      const finalSkillPoints = computeSkillPoints(task.difficulty);

      tasksState = tasksState.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'completed',
              isTracking: false,
              isAttention: false,
              actualMinutes,
              rewardReputation: finalReputation,
              rewardSkillPoints: finalSkillPoints,
              bossProgress: t.type === 'epic' ? 100 : t.bossProgress,
              completedAt: Date.now(),
              updatedAt: Date.now(),
            }
          : t,
      );

      playSound(task.difficulty === 'epic' ? 'levelup' : 'complete');

      // 派发全局庆祝事件（CelebrationLayer 监听），与声音解耦
      try {
        window.dispatchEvent(
          new CustomEvent('quest:celebrate', {
            detail: {
              taskName: task.name,
              difficulty: task.difficulty,
              reputation: finalReputation,
              skillPoints: finalSkillPoints,
              skillId: task.relatedSkillId,
            },
          }),
        );
      } catch {
        /* 事件派发失败不影响完成主流程 */
      }

      // 史诗任务：检查子任务
      if (task.parentId) {
        const siblings = tasksState.filter((t) => t.parentId === task.parentId && t.id !== taskId);
        const allDone = siblings.every((t) => t.status === 'completed');
        if (allDone) {
          tasksState = tasksState.map((t) =>
            t.id === task.parentId
              ? { ...t, status: 'completed', bossProgress: 100, completedAt: Date.now(), updatedAt: Date.now() }
              : t,
          );
        } else {
          const total = siblings.length + 1;
          const done = siblings.filter((t) => t.status === 'completed').length + 1;
          const progress = Math.round((done / total) * 100);
          tasksState = tasksState.map((t) =>
            t.id === task.parentId ? { ...t, bossProgress: progress, updatedAt: Date.now() } : t,
          );
        }
      }

      saveTasksCache(tasksState);
      notifyAll();

      tasksApi.complete(taskId).catch(() => {});

      // Phase 2：任务完成 → 任务状态 + 声望/能力点均变更，标记脏
      syncState.markTaskDirty(taskId);
      syncState.markMetaDirty();

      if (task.relatedSkillId) {
        const minutes = actualMinutes > 0 ? actualMinutes : task.estimatedMinutes;
        grantCapabilityExperience(task.relatedSkillId, minutes);
      }

      toast.success(`🎉 任务完成！获得 ${finalReputation} 声望${finalSkillPoints > 0 ? ` + ${finalSkillPoints} 能力点` : ''}`);

      return {
        reputation: finalReputation,
        skillPoints: finalSkillPoints,
        skillId: task.relatedSkillId,
      };
    },
    [],
  );

  // 更新 Boss 进度
  const updateBossProgress = useCallback((taskId: string, progress: number) => {
    tasksState = tasksState.map((t) =>
      t.id === taskId ? { ...t, bossProgress: Math.max(0, Math.min(100, progress)), updatedAt: Date.now() } : t,
    );
    saveTasksCache(tasksState);
    notifyAll();
    tasksApi.update(taskId, { bossProgress: Math.max(0, Math.min(100, progress)) }).catch(() => {});
    syncState.markTaskDirty(taskId);
  }, []);

  // 获取子任务
  const getSubTasks = useCallback(
    (parentId: string) => tasksState.filter((t) => t.parentId === parentId),
    [],
  );

  return {
    tasks,
    activeTrack,
    focusLogs,
    trackingTask,
    activeAttentionTasks,
    epicTasks,
    dailyTasks,
    currentTrackSeconds,
    focusTodaySeconds,
    streak,
    todayReputation,
    addTask,
    updateTask,
    deleteTask,
    importSampleTasks,
    setTrackingTask,
    startTracking,
    pauseTracking,
    addAttentionTask,
    removeAttentionTask,
    completeTask,
    updateBossProgress,
    getSubTasks,
  };
}
