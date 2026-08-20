import type { IAppSettings } from '@/types/quest';
import { readLocalScalar } from './local';

const SETTINGS_KEY = '__quest_guild_settings';

/**
 * 方案A：settingsApi 本地持久化适配器。
 * get() 在无本地数据时返回 undefined（由 useSettings 的默认值兜底），
 * 避免把默认值写进 localStorage、也避免与 useSettings 的 DEFAULT_SETTINGS 重复维护。
 */
export const settingsApi = {
  get: async (): Promise<IAppSettings | undefined> => {
    const raw = readLocalScalar(SETTINGS_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as IAppSettings;
    } catch {
      return undefined;
    }
  },

  update: async (_patch: Partial<IAppSettings>): Promise<IAppSettings | undefined> => {
    const raw = readLocalScalar(SETTINGS_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as IAppSettings;
    } catch {
      return undefined;
    }
  },
};

export default settingsApi;
