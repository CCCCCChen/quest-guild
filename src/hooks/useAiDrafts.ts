// AI 草稿 React hook（单例状态 + 跨窗口/跨组件订阅）
// 草稿数据独立于任务列表，UI 通过本 hook 读写，变更自动广播到所有订阅者。
import { useEffect, useState, useCallback } from 'react';
import { store, subscribeStorageChange } from '@/lib/storage';
import {
  loadAiDrafts,
  getDraftByParent,
  removeDraft as _removeDraft,
  clearAllDrafts as _clearAllDrafts,
  removeSubtask as _removeSubtask,
  updateSubtask as _updateSubtask,
  upsertDraft as _upsertDraft,
  type IAiDraft,
  type IAiSubtaskDraft,
} from '@/lib/aiDraft';

const AI_DRAFTS_KEY = '__quest_guild_ai_drafts';

// 单例状态（跨组件共享）
let draftsState: IAiDraft[] = loadAiDrafts();
const listeners = new Set<() => void>();

function refresh() {
  draftsState = loadAiDrafts();
  listeners.forEach((fn) => fn());
}

subscribeStorageChange((event) => {
  if (event.key === AI_DRAFTS_KEY) refresh();
});

export function useAiDrafts() {
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const getDraft = useCallback(
    (parentTaskId: string) => getDraftByParent(parentTaskId),
    [],
  );

  return {
    drafts: draftsState,
    getDraft,
    saveDraft: useCallback(
      (parent: { id: string; name: string }, subtasks: Omit<IAiSubtaskDraft, 'id'>[]) => {
        const d = _upsertDraft(parent, subtasks);
        refresh();
        return d;
      },
      [],
    ),
    removeDraft: useCallback((id: string) => {
      _removeDraft(id);
      refresh();
    }, []),
    removeSubtask: useCallback((draftId: string, subtaskId: string) => {
      _removeSubtask(draftId, subtaskId);
      refresh();
    }, []),
    updateSubtask: useCallback(
      (draftId: string, subtaskId: string, patch: Partial<IAiSubtaskDraft>) => {
        _updateSubtask(draftId, subtaskId, patch);
        refresh();
      },
      [],
    ),
    clearAll: useCallback(() => {
      _clearAllDrafts();
      refresh();
    }, []),
  };
}
