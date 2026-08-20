// AI 拆解草稿存储层（独立键，永不同步到云端）
// 草稿是「待确认」的中间态：AI 生成的子任务先存这里，用户编辑后「加入任务」才转正上云。
import type { TaskDifficulty } from '@/types/quest';
import { store } from '@/lib/storage';

const AI_DRAFTS_KEY = '__quest_guild_ai_drafts';

export interface IAiSubtaskDraft {
  id: string;
  name: string;
  description: string;
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  stage: number;
}

export interface IAiDraft {
  id: string;
  parentTaskId: string;
  parentTaskName: string;
  createdAt: number;
  updatedAt: number;
  subtasks: IAiSubtaskDraft[];
}

function genId(prefix = 'aid'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadAiDrafts(): IAiDraft[] {
  try {
    const raw = store.getItem(AI_DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as IAiDraft[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveAiDrafts(list: IAiDraft[]): void {
  try {
    store.setItem(AI_DRAFTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getDraftByParent(parentTaskId: string): IAiDraft | null {
  return loadAiDrafts().find((d) => d.parentTaskId === parentTaskId) ?? null;
}

/** 写/覆盖某史诗任务的草稿（按 parentTaskId 合并） */
export function upsertDraft(
  parent: { id: string; name: string },
  subtasksRaw: Omit<IAiSubtaskDraft, 'id'>[],
): IAiDraft {
  const list = loadAiDrafts();
  const now = Date.now();
  const subtasks: IAiSubtaskDraft[] = subtasksRaw.map((s) => ({ ...s, id: genId('adt') }));
  const idx = list.findIndex((d) => d.parentTaskId === parent.id);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      parentTaskName: parent.name,
      updatedAt: now,
      subtasks,
    };
  } else {
    list.push({
      id: genId('adr'),
      parentTaskId: parent.id,
      parentTaskName: parent.name,
      createdAt: now,
      updatedAt: now,
      subtasks,
    });
  }
  saveAiDrafts(list);
  return getDraftByParent(parent.id)!;
}

export function removeDraft(id: string): void {
  saveAiDrafts(loadAiDrafts().filter((d) => d.id !== id));
}

export function clearAllDrafts(): void {
  saveAiDrafts([]);
}

/** 从草稿移除一条子任务；若草稿变空则整份删除 */
export function removeSubtask(draftId: string, subtaskId: string): IAiDraft | null {
  const list = loadAiDrafts();
  const idx = list.findIndex((d) => d.id === draftId);
  if (idx < 0) return null;
  const updated: IAiDraft = {
    ...list[idx],
    updatedAt: Date.now(),
    subtasks: list[idx].subtasks.filter((s) => s.id !== subtaskId),
  };
  if (updated.subtasks.length === 0) {
    list.splice(idx, 1);
  } else {
    list[idx] = updated;
  }
  saveAiDrafts(list);
  return getDraftByParent(updated.parentTaskId);
}

export function updateSubtask(
  draftId: string,
  subtaskId: string,
  patch: Partial<IAiSubtaskDraft>,
): void {
  const list = loadAiDrafts();
  const idx = list.findIndex((d) => d.id === draftId);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    updatedAt: Date.now(),
    subtasks: list[idx].subtasks.map((s) =>
      s.id === subtaskId ? { ...s, ...patch } : s,
    ),
  };
  saveAiDrafts(list);
}
