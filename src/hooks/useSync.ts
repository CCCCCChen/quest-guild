// useSync：同步触发器与状态暴露（Phase 2 B+ 延迟同步）
// - syncNow()：手动触发全量推送（Topbar/设置页按钮调用）
// - state：同步状态（上次同步时间 / 待同步条数 / 错误），供状态指示器展示
// - 退出前尽力推送：beforeunload best-effort；Electron 另有 before-quit IPC flush（见 main.ts）
import { useCallback, useEffect, useState } from 'react';
import { syncState, type SyncState } from '@/api/sync/state';
import { pushSync } from '@/api/sync';
import { appLogger } from '@/lib/runtime';

// 保证 before-quit flush 监听全局只注册一次（useSync 可能被多组件挂载）
let flushListenerRegistered = false;

export function useSync() {
  const [state, setState] = useState<SyncState>(() => syncState.load());

  const refresh = useCallback(() => setState(syncState.load()), []);

  const syncNow = useCallback(async () => {
    try {
      const r = await pushSync();
      refresh();
      return r;
    } catch (e) {
      refresh();
      throw e;
    }
  }, [refresh]);

  useEffect(() => {
    const onBeforeUnload = () => {
      // 尽力推送（无法 await；Electron 端由 before-quit IPC 做可靠 flush）
      pushSync().catch((e) => appLogger.warn('[sync] beforeunload 推送失败', String(e)));
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Electron 可靠 flush：主进程 before-quit 发 'sync:flush-request'，推送完成后回 'sync:flush-done'
    let unsubFlush: (() => void) | null = null;
    if (!flushListenerRegistered) {
      flushListenerRegistered = true;
      const api = (window as unknown as { electronAPI?: any }).electronAPI;
      if (api?.on) {
        unsubFlush = api.on('sync:flush-request', () => {
          pushSync()
            .catch((e) => appLogger.warn('[sync] before-quit 推送失败', String(e)))
            .finally(() => {
              if (api.syncFlushDone) api.syncFlushDone();
            });
        });
      }
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (unsubFlush) {
        unsubFlush();
        flushListenerRegistered = false;
      }
    };
  }, []);

  return { state, syncNow, refresh };
}
