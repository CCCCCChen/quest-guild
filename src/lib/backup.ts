// EXPORTS: createBackup, restoreBackup, listBackups, getLatestBackup, validateData, getStorageUsage, pruneOldBackups, BACKUP_KEY_PREFIX, type IBackupSnapshot, type IBackupInfo, type IDataSnapshot, type ValidationResult

import { store } from './storage';

const BACKUP_KEY_PREFIX = '__quest_guild_backup_';
const DAILY_BACKUP_PREFIX = '__quest_guild_daily_';
const BACKUP_REGISTRY_KEY = '__quest_guild_backup_registry';
const MAX_OPERATION_BACKUPS = 10;
const MAX_DAILY_BACKUPS = 7;

const DATA_KEYS = [
  '__quest_guild_tasks',
  '__quest_guild_skills',
  '__quest_guild_skill_points',
  '__quest_guild_shop_items',
  '__quest_guild_reputation',
  '__quest_guild_redemptions',
  '__quest_guild_active_track',
  '__quest_guild_focus_log',
  '__quest_guild_settings',
  // P0-1：补齐目标 / 项目 / 复盘（goals/projects 现已镜像进本地 store，reflections 本就在此）
  '__quest_guild_goals',
  '__quest_guild_projects',
  '__quest_guild_reflections',
];

export interface IDataSnapshot {
  [key: string]: string;
}

export interface IBackupSnapshot {
  id: string;
  timestamp: number;
  type: 'operation' | 'daily';
  reason?: string;
  data: IDataSnapshot;
  stats: {
    taskCount: number;
    skillCount: number;
    reputation: number;
    totalBytes: number;
  };
}

export interface IBackupInfo {
  id: string;
  timestamp: number;
  type: 'operation' | 'daily';
  reason?: string;
  stats: IBackupSnapshot['stats'];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function countTasks(data: IDataSnapshot): number {
  const tasks = safeParse(data['__quest_guild_tasks'], [] as unknown[]);
  return Array.isArray(tasks) ? tasks.length : 0;
}

function countSkills(data: IDataSnapshot): number {
  const skills = safeParse(data['__quest_guild_skills'], [] as unknown[]);
  return Array.isArray(skills) ? skills.length : 0;
}

function getReputation(data: IDataSnapshot): number {
  const raw = data['__quest_guild_reputation'];
  if (raw === undefined) return 0;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) ? v : 0;
}

function calcTotalBytes(data: IDataSnapshot): number {
  let total = 0;
  for (const key of Object.keys(data)) {
    total += key.length + (data[key]?.length ?? 0);
  }
  return total;
}

function captureSnapshot(): IDataSnapshot {
  const data: IDataSnapshot = {};
  for (const key of DATA_KEYS) {
    const raw = store.getItem(key);
    if (raw !== null) {
      data[key] = raw;
    }
  }
  return data;
}

// ========== 备份注册表（替代 localStorage 前缀遍历） ==========

function loadRegistry(): string[] {
  try {
    const raw = store.getItem(BACKUP_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRegistry(keys: string[]) {
  store.setItem(BACKUP_REGISTRY_KEY, JSON.stringify(keys));
}

function addToRegistry(key: string) {
  const keys = loadRegistry();
  if (!keys.includes(key)) {
    keys.push(key);
    saveRegistry(keys);
  }
}

function removeFromRegistry(key: string) {
  const keys = loadRegistry().filter((k) => k !== key);
  saveRegistry(keys);
}

function getAllBackupKeys(): string[] {
  return loadRegistry().filter(
    (k) => k.startsWith(BACKUP_KEY_PREFIX) || k.startsWith(DAILY_BACKUP_PREFIX)
  );
}

function makeBackup(type: 'operation' | 'daily', reason?: string): IBackupSnapshot {
  const data = captureSnapshot();
  const now = Date.now();
  const id = `${type}_${now}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    timestamp: now,
    type,
    reason,
    data,
    stats: {
      taskCount: countTasks(data),
      skillCount: countSkills(data),
      reputation: getReputation(data),
      totalBytes: calcTotalBytes(data),
    },
  };
}

function getBackupFromKey(key: string): IBackupSnapshot | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as IBackupSnapshot;
  } catch {
    return null;
  }
}

function getBackupKey(snapshot: IBackupSnapshot): string {
  return snapshot.type === 'daily'
    ? `${DAILY_BACKUP_PREFIX}${snapshot.id}`
    : `${BACKUP_KEY_PREFIX}${snapshot.id}`;
}

export function pruneOldBackups(): void {
  try {
    const allKeys = getAllBackupKeys();
    const opBackups: IBackupInfo[] = [];
    const dailyBackups: IBackupInfo[] = [];

    for (const key of allKeys) {
      const b = getBackupFromKey(key);
      if (!b) continue;
      const info: IBackupInfo = {
        id: b.id,
        timestamp: b.timestamp,
        type: b.type,
        reason: b.reason,
        stats: b.stats,
      };
      if (b.type === 'operation') opBackups.push(info);
      else dailyBackups.push(info);
    }

    opBackups.sort((a, b) => b.timestamp - a.timestamp);
    dailyBackups.sort((a, b) => b.timestamp - a.timestamp);

    if (opBackups.length > MAX_OPERATION_BACKUPS) {
      const toRemove = opBackups.slice(MAX_OPERATION_BACKUPS);
      for (const b of toRemove) {
        const k = `${BACKUP_KEY_PREFIX}${b.id}`;
        store.removeItem(k);
        removeFromRegistry(k);
      }
    }

    if (dailyBackups.length > MAX_DAILY_BACKUPS) {
      const toRemove = dailyBackups.slice(MAX_DAILY_BACKUPS);
      for (const b of toRemove) {
        const k = `${DAILY_BACKUP_PREFIX}${b.id}`;
        store.removeItem(k);
        removeFromRegistry(k);
      }
    }
  } catch {
    // ignore
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function hasTodayDailyBackup(): boolean {
  const allKeys = getAllBackupKeys();
  const today = todayKey();
  for (const key of allKeys) {
    if (!key.startsWith(DAILY_BACKUP_PREFIX)) continue;
    const b = getBackupFromKey(key);
    if (!b) continue;
    const backupDate = new Date(b.timestamp);
    const bd = `${backupDate.getFullYear()}${String(backupDate.getMonth() + 1).padStart(2, '0')}${String(backupDate.getDate()).padStart(2, '0')}`;
    if (bd === today) return true;
  }
  return false;
}

export function createBackup(reason?: string, forceDaily = false): IBackupInfo | null {
  try {
    if (forceDaily && hasTodayDailyBackup()) {
      return null;
    }
    const type: 'operation' | 'daily' = forceDaily ? 'daily' : 'operation';
    const snapshot = makeBackup(type, reason);
    const key = getBackupKey(snapshot);
    store.setItem(key, JSON.stringify(snapshot));
    addToRegistry(key);
    pruneOldBackups();
    return {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      type: snapshot.type,
      reason: snapshot.reason,
      stats: snapshot.stats,
    };
  } catch {
    return null;
  }
}

export function listBackups(): IBackupInfo[] {
  const allKeys = getAllBackupKeys();
  const backups: IBackupInfo[] = [];
  for (const key of allKeys) {
    const b = getBackupFromKey(key);
    if (!b) continue;
    backups.push({
      id: b.id,
      timestamp: b.timestamp,
      type: b.type,
      reason: b.reason,
      stats: b.stats,
    });
  }
  backups.sort((a, b) => b.timestamp - a.timestamp);
  return backups;
}

export function getLatestBackup(): IBackupSnapshot | null {
  const allKeys = getAllBackupKeys();
  let latest: IBackupSnapshot | null = null;
  let latestTime = 0;
  for (const key of allKeys) {
    const b = getBackupFromKey(key);
    if (!b) continue;
    if (b.timestamp > latestTime) {
      latest = b;
      latestTime = b.timestamp;
    }
  }
  return latest;
}

export function restoreBackup(backupId: string): boolean {
  try {
    const allKeys = getAllBackupKeys();
    let target: IBackupSnapshot | null = null;
    for (const key of allKeys) {
      const b = getBackupFromKey(key);
      if (b && b.id === backupId) {
        target = b;
        break;
      }
    }
    if (!target) return false;

    for (const key of DATA_KEYS) {
      store.removeItem(key);
    }

    for (const key of Object.keys(target.data)) {
      store.setItem(key, target.data[key]);
    }

    return true;
  } catch {
    return false;
  }
}

export function validateData(data?: IDataSnapshot): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const snapshot = data ?? captureSnapshot();

  const tasksRaw = snapshot['__quest_guild_tasks'];
  if (tasksRaw === undefined) {
    errors.push('任务数据缺失');
  } else {
    const tasks = safeParse(tasksRaw, null as unknown[] | null);
    if (tasks === null || !Array.isArray(tasks)) {
      errors.push('任务数据格式损坏');
    } else if (tasks.length === 0) {
      warnings.push('任务列表为空');
    }
  }

  const skillsRaw = snapshot['__quest_guild_skills'];
  if (skillsRaw === undefined) {
    errors.push('能力树数据缺失');
  } else {
    const skills = safeParse(skillsRaw, null as unknown[] | null);
    if (skills === null || !Array.isArray(skills)) {
      errors.push('能力树数据格式损坏');
    }
  }

  const repRaw = snapshot['__quest_guild_reputation'];
  if (repRaw !== undefined) {
    const v = parseInt(repRaw, 10);
    if (!Number.isFinite(v)) {
      errors.push('声望数据格式损坏');
    }
  }

  const shopRaw = snapshot['__quest_guild_shop_items'];
  if (shopRaw === undefined) {
    warnings.push('商店数据缺失，将使用默认商品');
  } else {
    const items = safeParse(shopRaw, null as unknown[] | null);
    if (items === null || !Array.isArray(items)) {
      errors.push('商店数据格式损坏');
    }
  }

  const settingsRaw = snapshot['__quest_guild_settings'];
  if (settingsRaw === undefined) {
    warnings.push('设置数据缺失，将使用默认配置');
  } else {
    const settings = safeParse(settingsRaw, null as Record<string, unknown> | null);
    if (settings === null || typeof settings !== 'object') {
      errors.push('设置数据格式损坏');
    }
  }

  // P0-1：目标 / 项目 / 复盘 完整性校验
  const goalsRaw = snapshot['__quest_guild_goals'];
  if (goalsRaw !== undefined) {
    const goals = safeParse(goalsRaw, null as unknown[] | null);
    if (goals === null || !Array.isArray(goals)) errors.push('目标数据格式损坏');
  }
  const projectsRaw = snapshot['__quest_guild_projects'];
  if (projectsRaw !== undefined) {
    const projects = safeParse(projectsRaw, null as unknown[] | null);
    if (projects === null || !Array.isArray(projects)) errors.push('项目数据格式损坏');
  }
  const reflectionsRaw = snapshot['__quest_guild_reflections'];
  if (reflectionsRaw !== undefined) {
    const reflections = safeParse(reflectionsRaw, null as unknown[] | null);
    if (reflections === null || !Array.isArray(reflections)) errors.push('复盘数据格式损坏');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getStorageUsage(): {
  usedBytes: number;
  estimatedLimit: number;
  usagePercent: number;
  breakdown: { key: string; bytes: number }[];
} {
  const breakdown: { key: string; bytes: number }[] = [];
  let usedBytes = 0;
  const ESTIMATED_LIMIT = 5 * 1024 * 1024;

  try {
    // 通过注册表和数据键估算存储用量（兼容 Electron IPC 存储）
    const allKeys = [...DATA_KEYS, ...loadRegistry()];
    const seen = new Set<string>();
    for (const k of allKeys) {
      if (seen.has(k)) continue;
      seen.add(k);
      const v = store.getItem(k) ?? '';
      const bytes = k.length + v.length;
      usedBytes += bytes;
      breakdown.push({ key: k, bytes });
    }
  } catch {
    // ignore
  }

  breakdown.sort((a, b) => b.bytes - a.bytes);

  return {
    usedBytes,
    estimatedLimit: ESTIMATED_LIMIT,
    usagePercent: Math.min(100, Math.round((usedBytes / ESTIMATED_LIMIT) * 100)),
    breakdown,
  };
}
