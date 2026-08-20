import { store } from '@/lib/storage';

/**
 * 方案A（纯本地模式）共享辅助函数。
 *
 * 背景：为彻底去掉本地 Express/SQLite server，所有 api 模块改为
 * 「本地持久化适配器」——直读/写与 hooks 相同的 localStorage 键。
 * hooks 本身已是「先写本地缓存、HTTP 仅做镜像」的乐观模式，因此
 * 把镜像层指向本地存储后，hook 代码无需改动即可脱离 server 运行。
 */

/** 生成本地唯一 id（与 useTasks/useShop 的 genId 风格一致） */
export function genLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** 读取本地列表（损坏或缺失时返回空数组，由 hooks 的 fallback 逻辑兜底） */
export function readLocalList<T>(key: string): T[] {
  try {
    const raw = store.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

/** 写入本地列表 */
export function writeLocalList<T>(key: string, list: T[]): void {
  try { store.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
}

/** 读取本地标量（null 表示未设置） */
export function readLocalScalar(key: string): string | null {
  try { return store.getItem(key); } catch { return null; }
}
