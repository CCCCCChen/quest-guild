import { describe, it, expect } from 'vitest';
import { inheritContext, getTaskContext } from '@/lib/contextInherit';

describe('contextInherit', () => {
  const base: { goalId: string; projectId: string; capabilityIds: string[]; tags: string[] } = {
    goalId: 'g-1',
    projectId: 'p-1',
    capabilityIds: ['cap-1', 'cap-2'],
    tags: ['RPG', '成长'],
  };

  it('patch 提供的字段覆盖继承值', () => {
    const ctx = inheritContext(base, { goalId: 'g-new', capabilityIds: ['cap-x'] });
    expect(ctx.goalId).toBe('g-new');
    expect(ctx.projectId).toBe('p-1');
    expect(ctx.capabilityIds).toEqual(['cap-x']);
    expect(ctx.tags).toEqual(['RPG', '成长']);
  });

  it('空数组 / 空字符串 / null / undefined 被 pick 过滤（不作为继承值）', () => {
    const emptySource: {
      goalId: string;
      projectId: string | undefined;
      capabilityIds: string[];
      tags: string[] | undefined;
    } = {
      goalId: '',
      projectId: undefined,
      capabilityIds: [],
      tags: undefined,
    };
    expect(getTaskContext(emptySource)).toEqual({});
  });

  it('source 为 null/undefined 时返回空上下文', () => {
    expect(getTaskContext(null)).toEqual({});
    expect(getTaskContext(undefined)).toEqual({});
    expect(inheritContext(null, { projectId: 'x' })).toEqual({ projectId: 'x' });
  });

  it('stage 仅在 patch 显式传入时才出现在结果（不自动继承）', () => {
    const withStageAtSource = { ...base, stage: 5 } as any;
    expect(getTaskContext(withStageAtSource).stage).toBeUndefined();
    expect(inheritContext(base, { stage: 2 }).stage).toBe(2);
    expect(inheritContext(base).stage).toBeUndefined();
  });
});
