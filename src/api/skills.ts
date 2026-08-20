import type { ISkillNode } from '@/types/quest';
import { PRESET_SKILL_POINTS } from '@/data/preset';
import { genLocalId, readLocalList, readLocalScalar } from './local';

const SKILLS_KEY = '__quest_guild_skills';
const SKILL_POINTS_KEY = '__quest_guild_skill_points';

/**
 * 方案A：skillsApi 本地持久化适配器。
 * 读方法返回本地真实数据（syncFromServer 依赖），写方法立即成功
 * （useSkills 本身已先写本地缓存，此处无需再落盘，避免双重写入）。
 */
export const skillsApi = {
  getAll: async (): Promise<ISkillNode[]> => readLocalList<ISkillNode>(SKILLS_KEY),

  getSkillPoints: async (): Promise<number> => {
    const raw = readLocalScalar(SKILL_POINTS_KEY);
    if (raw === null) return PRESET_SKILL_POINTS;
    const v = Number(raw);
    return Number.isFinite(v) ? v : PRESET_SKILL_POINTS;
  },

  unlock: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  enhance: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  batchInit: async (_skills: ISkillNode[]): Promise<{ success: boolean; count: number }> =>
    ({ success: true, count: 0 }),

  // 管理接口（本地模式直接成功）
  create: async (skill: Partial<ISkillNode>): Promise<{ success: boolean; id: string }> =>
    ({ success: true, id: skill.id ?? genLocalId('cap') }),

  update: async (_id: string, _data: Partial<ISkillNode>): Promise<{ success: boolean }> =>
    ({ success: true }),

  remove: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),

  import: async (_skills: ISkillNode[]): Promise<{ success: boolean; count: number }> =>
    ({ success: true, count: 0 }),
};

export default skillsApi;
