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
      throw new Error(describeSyncError(res.status, err.error));
    }
    return (await res.json()) as SyncResult;
  }
}

// 鉴权类失败给出可操作提示：服务端 401/403/503 的裸 error 字样对用户毫无指引价值。
function describeSyncError(status: number, serverError?: string): string {
  if (status === 401) {
    return '云端鉴权失败（401）：未带 token。请在 .env 设置 VITE_SYNC_TOKEN 后重启 dev / 重新打包。';
  }
  if (status === 403) {
    return '云端鉴权被拒（403）：token 与服务器 API_TOKEN 不一致。请核对 workspace-server/.env 的 API_TOKEN 并重新打包。';
  }
  if (status === 503) {
    return '云端未配置鉴权（503）：服务器缺少 API_TOKEN 环境变量，需在部署侧补齐。';
  }
  return serverError || `同步失败 HTTP ${status}`;
}

// 架构缝：方案 C 独立服务（Phase 7 可选）。仅需实现 push + 翻 SYNC_TARGET='quest-service'。
export class QuestServiceTarget implements SyncTarget {
  async push(_payload: SyncPayload): Promise<SyncResult> {
    throw new Error('QuestServiceTarget 尚未实现（Phase 7 方案 C）');
  }
}
