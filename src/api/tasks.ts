import type { IQuestTask, IActiveTrack, IFocusLog, TaskDifficulty, TaskImportance, TaskType } from '@/types/quest';
import { genLocalId, readLocalList, readLocalScalar } from './local';
import { callDecomposeLLM } from '@/lib/aiClient';
import type { IAiSubtaskDraft } from '@/lib/aiDraft';

const TASKS_KEY = '__quest_guild_tasks';
const TRACK_KEY = '__quest_guild_active_track';
const FOCUS_LOG_KEY = '__quest_guild_focus_log';

/**
 * 方案A：tasksApi 本地持久化适配器。
 * useTasks 已是「先写本地缓存、HTTP 仅镜像」的乐观模式；这里镜像层直接指向
 * 本地存储，写操作立即成功，读操作返回与 hooks 相同键位的数据（不覆盖缓存）。
 */

function readTrack(): IActiveTrack | null {
  try {
    const raw = readLocalScalar(TRACK_KEY);
    if (raw) return JSON.parse(raw) as IActiveTrack;
  } catch { /* ignore */ }
  return null;
}

export const tasksApi = {
  getAll: async (): Promise<IQuestTask[]> => readLocalList<IQuestTask>(TASKS_KEY),

  create: async (data: {
    id?: string;
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
    lifeDomain?: import('@/types/quest').LifeDomain[];
    contentType?: import('@/types/quest').ContentType;
    executionContext?: import('@/types/quest').ExecutionContext[];
    howToHint?: string;
    startDate?: number;
    deadline?: number;
    recurrence?: import('@/types/quest').IRecurrenceRule;
    reminderAt?: number;
  }): Promise<IQuestTask> =>
    ({ ...data, id: data.id ?? genLocalId('t') }) as IQuestTask,

  update: async (id: string, patch: Partial<IQuestTask>): Promise<IQuestTask> =>
    ({ id, ...patch }) as IQuestTask,

  remove: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  complete: async (id: string): Promise<IQuestTask> => ({ id }) as IQuestTask,

  addAttention: async (id: string, _maxAttention: number): Promise<IQuestTask> =>
    ({ id }) as IQuestTask,

  removeAttention: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  // 方案A：浏览器端直接调用 OpenAI 兼容 LLM 生成子任务草稿（不写任务列表，先交草稿层）。
  // 返回的 subtasks 由调用方存入 AI 草稿箱，用户确认后才正式加入任务。
  decompose: async (data: {
    name: string;
    description?: string;
    difficulty?: string;
    type?: string;
    estimatedMinutes?: number;
  }): Promise<{ subtasks: Omit<IAiSubtaskDraft, 'id'>[] }> => {
    const subtasks = await callDecomposeLLM({
      name: data.name,
      description: data.description,
      difficulty: data.difficulty,
      estimatedMinutes: data.estimatedMinutes,
    });
    return { subtasks };
  },

  getActiveTrack: async (): Promise<IActiveTrack | null> => readTrack(),

  setActiveTrack: async (_taskId: string | null): Promise<IActiveTrack | null> => readTrack(),

  startTracking: async (): Promise<{ ok: boolean }> => ({ ok: true }),

  pauseTracking: async (): Promise<{ ok: boolean }> => ({ ok: true }),

  getFocusLogs: async (): Promise<IFocusLog[]> => readLocalList<IFocusLog>(FOCUS_LOG_KEY),

  bootstrap: async (_data: {
    tasks?: IQuestTask[];
    skills?: unknown[];
    shopItems?: unknown[];
  }): Promise<{ success: boolean }> => ({ success: true }),
};

export default tasksApi;
