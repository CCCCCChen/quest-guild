import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ISkillNode } from '@/types/quest';
import { PRESET_SKILLS, PRESET_SKILL_POINTS } from '@/data/preset';
import { playSound } from '@/lib/sound';
import { store } from '@/lib/storage';
import { skillsApi } from '@/api';
import { syncState } from '@/api/sync/state';

const SKILLS_KEY = '__quest_guild_skills';
const SKILL_POINTS_KEY = '__quest_guild_skill_points';
const CAPABILITY_TREE_MARKER_ID = 'cap-meta';

let skillsCache: ISkillNode[] | null = null;
let skillPointsCache: number | null = null;
const skillsListeners = new Set<(v: ISkillNode[]) => void>();
const pointsListeners = new Set<(v: number) => void>();
let initialized = false;

const PROFICIENCY_THRESHOLDS = [0, 60, 180, 420, 900, 1800];

function calcProficiencyLevel(totalMinutes: number): number {
  for (let i = PROFICIENCY_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (totalMinutes >= PROFICIENCY_THRESHOLDS[i]) return i;
  }
  return 0;
}

function isLegacySkillTree(skills: ISkillNode[]): boolean {
  if (skills.length === 0) return false;
  const ids = new Set(skills.map((s) => s.id));
  return !ids.has(CAPABILITY_TREE_MARKER_ID) || ids.has('skill-programming') || ids.has('skill-design');
}

export function grantCapabilityExperience(skillId: string, minutes: number) {
  if (!skillId) return;
  const delta = Math.max(0, Math.floor(minutes));
  if (delta <= 0) return;
  const base = skillsCache ?? loadSkills();
  const now = Date.now();
  const target = base.find((s) => s.id === skillId);
  if (!target) return;
  const next = base.map((s) => {
    if (s.id !== skillId) return s;
    const currentExp = s.experience ?? 0;
    const newExp = currentExp + delta;
    const newLevel = Math.min(5, calcProficiencyLevel(newExp));
    return {
      ...s,
      experience: newExp,
      proficiencyLevel: newLevel,
      lastImprovedAt: now,
    };
  });

  setSkillsValue(next);
  skillsApi.update(skillId, {
    experience: (next.find((n) => n.id === skillId)?.experience) ?? 0,
    proficiencyLevel: (next.find((n) => n.id === skillId)?.proficiencyLevel) ?? 0,
    lastImprovedAt: now,
  }).catch(() => {});
}

function loadSkills(): ISkillNode[] {
  try {
    const raw = store.getItem(SKILLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ISkillNode[];
      return isLegacySkillTree(parsed) ? PRESET_SKILLS : parsed;
    }
  } catch { /* ignore */ }
  return PRESET_SKILLS;
}

function loadPoints(): number {
  try {
    const raw = store.getItem(SKILL_POINTS_KEY);
    if (raw !== null) return Number(raw);
  } catch { /* ignore */ }
  return PRESET_SKILL_POINTS;
}

function setSkillsValue(v: ISkillNode[]) {
  skillsCache = v;
  store.setItem(SKILLS_KEY, JSON.stringify(v));
  skillsListeners.forEach((fn) => fn(v));
}

function setPointsValue(v: number) {
  skillPointsCache = v;
  store.setItem(SKILL_POINTS_KEY, String(v));
  pointsListeners.forEach((fn) => fn(v));
}

async function syncFromServer() {
  try {
    const [skills, points] = await Promise.all([
      skillsApi.getAll(),
      skillsApi.getSkillPoints(),
    ]);
    if (skills.length === 0) {
      // 服务端为空，初始化当前能力树预设
      await skillsApi.batchInit(PRESET_SKILLS);
      setSkillsValue(PRESET_SKILLS);
    } else if (isLegacySkillTree(skills)) {
      // 旧版技能树自动升级为新版能力树
      await skillsApi.import(PRESET_SKILLS);
      setSkillsValue(PRESET_SKILLS);
    } else {
      setSkillsValue(skills);
    }
    setPointsValue(points);
  } catch {
    // 使用本地缓存
  }
}

export function useSkills() {
  const [skills, setSkillsState] = useState<ISkillNode[]>(
    () => skillsCache ?? loadSkills()
  );
  const [skillPoints, setSkillPointsState] = useState<number>(
    () => skillPointsCache ?? loadPoints()
  );

  useEffect(() => {
    if (skillsCache === null) skillsCache = skills;
    if (skillPointsCache === null) skillPointsCache = skillPoints;

    const sFn = (v: ISkillNode[]) => setSkillsState(v);
    const pFn = (v: number) => setSkillPointsState(v);
    skillsListeners.add(sFn);
    pointsListeners.add(pFn);

    if (!initialized) {
      initialized = true;
      syncFromServer();
    }

    return () => {
      skillsListeners.delete(sFn);
      pointsListeners.delete(pFn);
    };
  }, [skills, skillPoints]);

  const canUnlock = useCallback(
    (id: string): boolean => {
      const node = skills.find((s) => s.id === id);
      if (!node) return false;
      if (node.status !== 'locked') return false;
      if (skillPoints < node.requiredSkillPoints) return false;
      if (!node.parentId) return true;
      const parent = skills.find((s) => s.id === node.parentId);
      if (!parent) return false;
      return parent.status === 'unlocked' || parent.status === 'enhanced';
    },
    [skills, skillPoints],
  );

  const unlockSkill = useCallback(
    (id: string): boolean => {
      if (!canUnlock(id)) return false;
      const node = skills.find((s) => s.id === id);
      if (!node) return false;

      const next = skills.map((s) =>
        s.id === id
          ? { ...s, status: 'unlocked' as const, unlockedAt: Date.now() }
          : s,
      );
      setSkillsValue(next);
      setPointsValue(skillPoints - node.requiredSkillPoints);
      playSound('levelup');
      syncState.markMetaDirty();

      skillsApi.unlock(id).catch(() => {});
      return true;
    },
    [skills, canUnlock, skillPoints],
  );

  const enhanceSkill = useCallback(
    (id: string): boolean => {
      const node = skills.find((s) => s.id === id);
      if (!node) return false;
      if (node.status !== 'unlocked') return false;
      const enhanceCost = Math.ceil(node.requiredSkillPoints * 1.5);
      if (skillPoints < enhanceCost) return false;

      const next = skills.map((s) =>
        s.id === id ? { ...s, status: 'enhanced' as const } : s,
      );
      setSkillsValue(next);
      setPointsValue(skillPoints - enhanceCost);
      playSound('levelup');
      syncState.markMetaDirty();

      skillsApi.enhance(id).catch(() => {});
      return true;
    },
    [skills, skillPoints],
  );

  const getSkillsByCategory = useCallback(
    (category: string): ISkillNode[] => {
      return skills.filter((s) => s.category === category);
    },
    [skills],
  );

  const getUnlockedCount = useCallback((): number => {
    return skills.filter((s) => s.status === 'unlocked' || s.status === 'enhanced').length;
  }, [skills]);

  const addSkillPoints = useCallback(
    (amount: number) => {
      setPointsValue(skillPoints + amount);
      syncState.markMetaDirty();
    },
    [skillPoints],
  );

  const categories = useMemo(() => {
    const set = new Set(skills.map((s) => s.category));
    return Array.from(set);
  }, [skills]);

  return {
    skills,
    skillPoints,
    initialized: true,
    categories,
    unlockSkill,
    enhanceSkill,
    canUnlock,
    getSkillsByCategory,
    getUnlockedCount,
    addSkillPoints,
    grantCapabilityExperience,
  };
}

export default useSkills;
