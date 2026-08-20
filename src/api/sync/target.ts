// 同步目标实现（Phase 2 架构缝）
// WorkspaceServerTarget：当前 B+ 方案，把数据推到 workspace-server 的 /api/tasks/sync。
// QuestServiceTarget：未来方案 C（独立 quest.hchch.tech）的占位实现，届时填实即可升级。
import type { SyncPayload, SyncResult, SyncTarget } from './types';

function getSyncConfig(): { url: string; token: string } {
  const url = import.meta.env.VITE_SYNC_URL || 'https://life.hchch.tech';
  const token = import.meta.env.VITE_SYNC_TOKEN || '';
  return { url, token };
}

export class WorkspaceServerTarget implements SyncTarget {
  async push(payload: SyncPayload): Promise<SyncResult> {
    const { url, token } = getSyncConfig();
    const res = await fetch(`${url}/api/tasks/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `同步失败 HTTP ${res.status}`);
    }
    return (await res.json()) as SyncResult;
  }
}

// 架构缝：方案 C 独立服务（Phase 7 可选）。仅需实现 push + 翻 SYNC_TARGET='quest-service'。
export class QuestServiceTarget implements SyncTarget {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async push(_payload: SyncPayload): Promise<SyncResult> {
    throw new Error('QuestServiceTarget 尚未实现（Phase 7 方案 C）');
  }
}
