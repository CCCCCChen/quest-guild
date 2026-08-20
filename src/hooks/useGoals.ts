import { useCallback, useEffect, useState } from 'react';
import type { IGoal } from '@/types/quest';
import { store, subscribeStorageChange } from '@/lib/storage';
import { goalsApi } from '@/api';
import { cascadeDeleteTasksByGoal } from '@/hooks/useTasks';

const GOALS_KEY = '__quest_guild_goals';

let goalsCache: IGoal[] | null = null;
const listeners = new Set<(v: IGoal[]) => void>();
let initialized = false;

function loadGoals(): IGoal[] {
  try {
    const raw = store.getItem(GOALS_KEY);
    if (raw) return JSON.parse(raw) as IGoal[];
  } catch { /* ignore */ }
  return [];
}

function setGoalsValue(v: IGoal[]) {
  goalsCache = v;
  store.setItem(GOALS_KEY, JSON.stringify(v));
  listeners.forEach((fn) => fn(v));
}

async function syncFromServer() {
  try {
    const goals = await goalsApi.getAll();
    setGoalsValue(goals);
  } catch {
    // ignore
  }
}

export function useGoals() {
  const [goals, setGoals] = useState<IGoal[]>(() => goalsCache ?? loadGoals());

  useEffect(() => {
    if (goalsCache === null) goalsCache = goals;
    const fn = (v: IGoal[]) => setGoals(v);
    listeners.add(fn);

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    const unsubscribe = subscribeStorageChange(({ key }) => {
      if (key === GOALS_KEY) {
        const next = loadGoals();
        goalsCache = next;
        listeners.forEach((l) => l(next));
      }
    });

    return () => {
      listeners.delete(fn);
      unsubscribe();
    };
  }, [goals]);

  const addGoal = useCallback(async (payload: Partial<IGoal> & { name: string }) => {
    const goal = await goalsApi.create(payload);
    const next = [goal, ...(goalsCache ?? loadGoals())];
    setGoalsValue(next);
    return goal;
  }, []);

  const updateGoal = useCallback(async (id: string, patch: Partial<IGoal>) => {
    const updated = await goalsApi.update(id, patch);
    const base = goalsCache ?? loadGoals();
    const next = base.map((g) => (g.id === id ? updated : g));
    setGoalsValue(next);
    return updated;
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    // 级联删除目标下所有任务（含子树），并标记云端删除
    cascadeDeleteTasksByGoal(id);
    await goalsApi.remove(id);
    const base = goalsCache ?? loadGoals();
    setGoalsValue(base.filter((g) => g.id !== id));
  }, []);

  return { goals, addGoal, updateGoal, deleteGoal };
}

