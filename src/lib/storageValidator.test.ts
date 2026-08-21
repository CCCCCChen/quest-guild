import { describe, it, expect } from 'vitest';
import { validateStorage } from '@/lib/storageValidator';
import type { IQuestTask, ISkillNode, IGoal, IProject } from '@/types/quest';

const SKILL: ISkillNode = {
  id: 'cap-1',
  name: '编程',
  description: '',
  category: '创造',
  level: 1,
  status: 'unlocked',
  x: 0,
  y: 0,
  requiredSkillPoints: 1,
};
const GOAL: IGoal = {
  id: 'g-1',
  name: '建立 AI 核心能力',
  description: '',
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
};
const PROJECT: IProject = {
  id: 'p-1',
  goalId: 'g-1',
  name: 'AI 实战项目',
  description: '',
  capabilityIds: ['cap-1'],
  progress: 0,
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
};

describe('storageValidator', () => {
  function baseTask(overrides: Partial<IQuestTask> = {}): IQuestTask {
    return {
      id: 't-1',
      name: '基础任务',
      description: '',
      type: 'daily',
      difficulty: 'normal',
      estimatedMinutes: 30,
      actualMinutes: 0,
      bossProgress: 0,
      stage: 1,
      status: 'pending',
      isTracking: false,
      isAttention: false,
      rewardReputation: 10,
      rewardSkillPoints: 0,
      createdAt: 0,
      updatedAt: 0,
      goalId: 'g-1',
      projectId: 'p-1',
      capabilityIds: ['cap-1'],
      ...overrides,
    };
  }

  it('空数据但格式合法 → valid=false（任务缺少 id 唯一性检查通过但 tasks 空没问题）', () => {
    const r = validateStorage({ tasks: [], skills: [SKILL], goals: [GOAL], projects: [PROJECT] });
    expect(r.valid).toBe(true);
    expect(r.checksum).toBeDefined();
  });

  it('id 重复 → error + invalid', () => {
    const r = validateStorage({
      tasks: [baseTask({ id: 'dup' }), baseTask({ id: 'dup', name: 'dup2' })],
      skills: [SKILL],
      goals: [GOAL],
      projects: [PROJECT],
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.level === 'error' && i.message.includes('id 重复'))).toBe(true);
  });

  it('孤儿任务（parentId 不存在）→ error + invalid', () => {
    const r = validateStorage({
      tasks: [baseTask({ parentId: 'no-such-parent' })],
      skills: [SKILL],
      goals: [GOAL],
      projects: [PROJECT],
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.message.includes('孤儿任务'))).toBe(true);
  });

  it('父任务已 completed，但仍有子任务 pending → warning', () => {
    const parent = baseTask({ id: 'parent', type: 'epic', status: 'completed', bossProgress: 100 });
    const child = baseTask({ id: 'child', parentId: 'parent', status: 'pending' });
    const r = validateStorage({ tasks: [parent, child], skills: [SKILL], goals: [GOAL], projects: [PROJECT] });
    expect(r.valid).toBe(true); // warning 不破坏 valid
    expect(r.issues.some((i) => i.message.includes('仍有') && i.message.includes('未完成'))).toBe(true);
  });

  it('父 bossProgress 明显低于实际完成比例 → warning', () => {
    const parent = baseTask({ id: 'parent', type: 'epic', status: 'pending', bossProgress: 0 });
    const c1 = baseTask({ id: 'c1', parentId: 'parent', status: 'completed' });
    const c2 = baseTask({ id: 'c2', parentId: 'parent', status: 'completed' });
    const c3 = baseTask({ id: 'c3', parentId: 'parent', status: 'pending' });
    const r = validateStorage({
      tasks: [parent, c1, c2, c3],
      skills: [SKILL],
      goals: [GOAL],
      projects: [PROJECT],
    });
    // 2/3 ≈ 67%，bossProgress=0，差距 >10% → 命中 warning
    expect(r.issues.some((i) => i.message.includes('bossProgress') && i.message.includes('低于实际完成比例'))).toBe(true);
  });

  it('外键警告：task.goalId 不存在 → warning（valid=true）', () => {
    const r = validateStorage({
      tasks: [baseTask({ goalId: 'ghost', projectId: 'p-1' })],
      skills: [SKILL],
      goals: [GOAL],
      projects: [PROJECT],
    });
    expect(r.valid).toBe(true);
    expect(r.issues.some((i) => i.message.includes('关联的目标'))).toBe(true);
  });
});
