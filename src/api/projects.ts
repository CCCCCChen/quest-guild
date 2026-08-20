import type { IProject } from '@/types/quest';
import { genLocalId, readLocalList, writeLocalList } from './local';

const PROJECTS_KEY = '__quest_guild_projects';

/**
 * 方案A：projectsApi 本地持久化适配器。
 * useProjects 依赖 create/update/remove 的返回值做本地缓存更新，
 * 因此这里实现为「真写」：与 hooks 共用 __quest_guild_projects 键。
 */
export const projectsApi = {
  getAll: async (params?: { goalId?: string }): Promise<IProject[]> => {
    const list = readLocalList<IProject>(PROJECTS_KEY);
    if (params?.goalId) return list.filter((p) => p.goalId === params.goalId);
    return list;
  },

  create: async (project: Partial<IProject> & { name: string }): Promise<IProject> => {
    const now = Date.now();
    const item: IProject = {
      id: genLocalId('p'),
      goalId: project.goalId,
      name: project.name,
      description: project.description ?? '',
      capabilityIds: project.capabilityIds ?? [],
      progress: project.progress ?? 0,
      status: project.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    writeLocalList(PROJECTS_KEY, [item, ...readLocalList<IProject>(PROJECTS_KEY)]);
    return item;
  },

  update: async (id: string, patch: Partial<IProject>): Promise<IProject> => {
    const list = readLocalList<IProject>(PROJECTS_KEY);
    const next = list.map((p) =>
      p.id === id ? { ...p, ...patch, id, updatedAt: Date.now() } : p,
    );
    writeLocalList(PROJECTS_KEY, next);
    return next.find((p) => p.id === id) ?? ({ id } as IProject);
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    writeLocalList(PROJECTS_KEY, readLocalList<IProject>(PROJECTS_KEY).filter((p) => p.id !== id));
    return { success: true };
  },
};

export default projectsApi;
