import type { IGoal } from '@/types/quest';
import { genLocalId, readLocalList, writeLocalList } from './local';

const GOALS_KEY = '__quest_guild_goals';

/**
 * 方案A：goalsApi 本地持久化适配器。
 * useGoals 依赖 create/update/remove 的返回值做本地缓存更新，
 * 因此这里实现为「真写」：与 hooks 共用 __quest_guild_goals 键。
 */
export const goalsApi = {
  getAll: async (): Promise<IGoal[]> => readLocalList<IGoal>(GOALS_KEY),

  create: async (goal: Partial<IGoal> & { name: string }): Promise<IGoal> => {
    const now = Date.now();
    const item: IGoal = {
      id: genLocalId('g'),
      name: goal.name,
      description: goal.description ?? '',
      deadline: goal.deadline,
      milestone: goal.milestone,
      milestoneDeadline: goal.milestoneDeadline,
      status: goal.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    writeLocalList(GOALS_KEY, [item, ...readLocalList<IGoal>(GOALS_KEY)]);
    return item;
  },

  update: async (id: string, patch: Partial<IGoal>): Promise<IGoal> => {
    const list = readLocalList<IGoal>(GOALS_KEY);
    const next = list.map((g) =>
      g.id === id ? { ...g, ...patch, id, updatedAt: Date.now() } : g,
    );
    writeLocalList(GOALS_KEY, next);
    return next.find((g) => g.id === id) ?? ({ id } as IGoal);
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    writeLocalList(GOALS_KEY, readLocalList<IGoal>(GOALS_KEY).filter((g) => g.id !== id));
    return { success: true };
  },
};

export default goalsApi;
