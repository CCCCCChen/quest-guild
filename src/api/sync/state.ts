// 本地同步状态（Phase 2 B+ 延迟同步）
// 记录脏数据标记与上次成功同步时间，持久化到 localStorage，保证崩溃/重启后可重试。
import { store } from '@/lib/storage';

const SYNC_STATE_KEY = '__quest_guild_sync_v1';

export interface SyncState {
  lastSyncAt: number;
  dirtyTaskIds: string[];
  deletedTaskIds: string[];
  metaDirty: boolean;
  lastError?: string;
  lastResult?: string;
}

function load(): SyncState {
  try {
    const raw = store.getItem(SYNC_STATE_KEY);
    if (raw) {
      return {
        lastSyncAt: 0,
        dirtyTaskIds: [],
        deletedTaskIds: [],
        metaDirty: false,
        ...(JSON.parse(raw) as Partial<SyncState>),
      };
    }
  } catch {
    /* ignore */
  }
  return { lastSyncAt: 0, dirtyTaskIds: [], deletedTaskIds: [], metaDirty: false };
}

function save(s: SyncState): void {
  try {
    store.setItem(SYNC_STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export const syncState = {
  load,

  markTaskDirty(id: string): void {
    const s = load();
    if (!s.dirtyTaskIds.includes(id)) s.dirtyTaskIds.push(id);
    save(s);
  },

  markTaskDeleted(id: string): void {
    const s = load();
    // 删除优先：若曾标记脏，移除避免 upsert/delete 冲突
    s.dirtyTaskIds = s.dirtyTaskIds.filter((x) => x !== id);
    if (!s.deletedTaskIds.includes(id)) s.deletedTaskIds.push(id);
    save(s);
  },

  markMetaDirty(): void {
    const s = load();
    s.metaDirty = true;
    save(s);
  },

  clearAfterSync(serverTime: number): void {
    const s = load();
    s.lastSyncAt = serverTime;
    s.dirtyTaskIds = [];
    s.deletedTaskIds = [];
    s.metaDirty = false;
    s.lastError = undefined;
    save(s);
  },

  setError(msg: string): void {
    const s = load();
    s.lastError = msg;
    save(s);
  },

  setResult(msg: string): void {
    const s = load();
    s.lastResult = msg;
    save(s);
  },
};
