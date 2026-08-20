import { useCallback, useEffect, useState } from 'react';
import type { IAppSettings } from '@/types/quest';
import { store, subscribeStorageChange } from '@/lib/storage';
import { settingsApi } from '@/api';

const STORAGE_KEY = '__quest_guild_settings';

const DEFAULT_SETTINGS: IAppSettings = {
  appName: '悬赏任务公会',
  manaMax: 5,
  resetTime: '06:00',
  soundEnabled: true,
  floatingPosition: { x: -24, y: -24 },
  floatingOpacity: 0.8,
  floatingCollapseDelay: 1000,
};

function loadSettings(): IAppSettings {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<IAppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let settingsCache: IAppSettings | null = null;
const settingsListeners = new Set<(v: IAppSettings) => void>();
let initialized = false;

function setSettingsValue(v: IAppSettings) {
  settingsCache = v;
  store.setItem(STORAGE_KEY, JSON.stringify(v));
  settingsListeners.forEach((fn) => fn(v));
}

async function syncFromServer() {
  try {
    const data = await settingsApi.get();
    if (data) setSettingsValue(data);
  } catch {
    // 使用本地缓存
  }
}

// ========== 跨窗口同步 ==========
subscribeStorageChange((event) => {
  if (event.key === STORAGE_KEY) {
    settingsCache = loadSettings();
    settingsListeners.forEach((fn) => fn(settingsCache!));
  }
});

export function useSettings() {
  const [settings, setSettingsState] = useState<IAppSettings>(
    () => settingsCache ?? loadSettings()
  );

  useEffect(() => {
    if (settingsCache === null) settingsCache = settings;
    const fn = (v: IAppSettings) => setSettingsState(v);
    settingsListeners.add(fn);

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    return () => {
      settingsListeners.delete(fn);
    };
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<IAppSettings>) => {
    const next = { ...(settingsCache || DEFAULT_SETTINGS), ...patch };
    setSettingsValue(next);
    settingsApi.update(patch).catch(() => {});
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsValue(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
