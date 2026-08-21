import { useCallback, useEffect, useState } from 'react';
import type { IProject } from '@/types/quest';
import { store, subscribeStorageChange } from '@/lib/storage';
import { projectsApi } from '@/api';
import { cascadeDeleteTasksByProject } from '@/hooks/useTasks';
import { PRESET_PROJECTS } from '@/data/preset';

const PROJECTS_KEY = '__quest_guild_projects';

let projectsCache: IProject[] | null = null;
const listeners = new Set<(v: IProject[]) => void>();
let initialized = false;

function loadProjects(): IProject[] {
  try {
    const raw = store.getItem(PROJECTS_KEY);
    if (raw === null) {
      // 首次无数据：注入骨架预设并落盘，避免空白页 / 用户新增后骨架丢失
      store.setItem(PROJECTS_KEY, JSON.stringify(PRESET_PROJECTS));
      return PRESET_PROJECTS;
    }
    if (raw) return JSON.parse(raw) as IProject[];
  } catch { /* ignore */ }
  return [];
}

function setProjectsValue(v: IProject[]) {
  projectsCache = v;
  store.setItem(PROJECTS_KEY, JSON.stringify(v));
  listeners.forEach((fn) => fn(v));
}

async function syncFromServer() {
  try {
    const projects = await projectsApi.getAll();
    setProjectsValue(projects);
  } catch {
    // ignore
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<IProject[]>(() => projectsCache ?? loadProjects());

  useEffect(() => {
    if (projectsCache === null) projectsCache = projects;
    const fn = (v: IProject[]) => setProjects(v);
    listeners.add(fn);

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    const unsubscribe = subscribeStorageChange(({ key }) => {
      if (key === PROJECTS_KEY) {
        const next = loadProjects();
        projectsCache = next;
        listeners.forEach((l) => l(next));
      }
    });

    return () => {
      listeners.delete(fn);
      unsubscribe();
    };
  }, [projects]);

  const addProject = useCallback(async (payload: { name: string; description?: string; goalId?: string }) => {
    const project = await projectsApi.create({
      name: payload.name,
      description: payload.description,
      goalId: payload.goalId,
      capabilityIds: [],
      progress: 0,
      status: 'active',
    });
    const next = [project, ...(projectsCache ?? loadProjects())];
    setProjectsValue(next);
    return project;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<IProject>) => {
    const updated = await projectsApi.update(id, patch);
    const base = projectsCache ?? loadProjects();
    const next = base.map((p) => (p.id === id ? updated : p));
    setProjectsValue(next);
    return updated;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    // 级联删除项目下所有任务（含子树），并标记云端删除
    cascadeDeleteTasksByProject(id);
    await projectsApi.remove(id);
    const base = projectsCache ?? loadProjects();
    setProjectsValue(base.filter((p) => p.id !== id));
  }, []);

  return { projects, addProject, updateProject, deleteProject };
}

