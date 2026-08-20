import type { IReflection } from '@/types/quest';
import { genLocalId, readLocalList, writeLocalList } from './local';

const REFLECTIONS_KEY = '__quest_guild_reflections';

/**
 * 方案A：reflectionsApi 本地持久化适配器。
 * useReflections 依赖 create/update/remove 的返回值做本地缓存更新，
 * 因此这里实现为「真写」：与 hooks 共用 __quest_guild_reflections 键。
 */
export const reflectionsApi = {
  getAll: async (params?: { taskId?: string }): Promise<IReflection[]> => {
    const list = readLocalList<IReflection>(REFLECTIONS_KEY);
    if (params?.taskId) return list.filter((r) => r.taskId === params.taskId);
    return list;
  },

  create: async (reflection: Partial<IReflection> & { taskId: string }): Promise<IReflection> => {
    const now = Date.now();
    const item: IReflection = {
      id: genLocalId('r'),
      taskId: reflection.taskId,
      expectedResult: reflection.expectedResult ?? '',
      actualResult: reflection.actualResult ?? '',
      lessonLearned: reflection.lessonLearned ?? '',
      nextAction: reflection.nextAction ?? '',
      createdAt: now,
    };
    writeLocalList(REFLECTIONS_KEY, [item, ...readLocalList<IReflection>(REFLECTIONS_KEY)]);
    return item;
  },

  update: async (id: string, patch: Partial<IReflection>): Promise<IReflection> => {
    const list = readLocalList<IReflection>(REFLECTIONS_KEY);
    const next = list.map((r) => (r.id === id ? { ...r, ...patch, id } : r));
    writeLocalList(REFLECTIONS_KEY, next);
    return next.find((r) => r.id === id) ?? ({ id } as IReflection);
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    writeLocalList(REFLECTIONS_KEY, readLocalList<IReflection>(REFLECTIONS_KEY).filter((r) => r.id !== id));
    return { success: true };
  },
};

export default reflectionsApi;
