import { describe, it, expect } from 'vitest';
import {
  computeProjectProgress,
  computeGoalProgress,
  computeMilestoneReached,
  type IGoalMilestone,
} from '@/lib/progress';
import type { IQuestTask, IProject } from '@/types/quest';

function baseTask(overrides: Partial<IQuestTask> = {}): IQuestTask {
  return {
    id: 't',
    name: 't',
    description: '',
    type: 'daily',
    difficulty: 'normal',
    estimatedMinutes: 60,
    actualMinutes: 0,
    bossProgress: 0,
    stage: 0,
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation: 0,
    rewardSkillPoints: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as IQuestTask;
}

function baseProject(overrides: Partial<IProject> = {}): IProject {
  return {
    id: 'p',
    goalId: 'g',
    name: 'p',
    description: '',
    capabilityIds: [],
    progress: 0,
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as IProject;
}

describe('progress 纯函数', () => {
  // ========== computeProjectProgress ==========
  it('1. 空项目 / projectId 不存在 → 进度 0', () => {
    expect(computeProjectProgress([], 'p-missing')).toBe(0);
    expect(computeProjectProgress([baseTask({ projectId: 'p-other' })], 'p-missing')).toBe(0);
  });

  it('2. 项目下所有任务无 estimatedMinutes → 进度 0（避免 0 除）', () => {
    const tasks = [
      baseTask({ projectId: 'p1', estimatedMinutes: 0, status: 'completed', actualMinutes: 60 }),
    ];
    expect(computeProjectProgress(tasks, 'p1')).toBe(0);
  });

  it('3. 项目所有任务 completed + actual 完整 → 1.0（100%）', () => {
    const tasks = [
      baseTask({ projectId: 'p-full', estimatedMinutes: 60, actualMinutes: 60, status: 'completed' }),
      baseTask({ projectId: 'p-full', estimatedMinutes: 120, actualMinutes: 130, status: 'completed' }),
    ];
    expect(computeProjectProgress(tasks, 'p-full')).toBe(1.0);
  });

  it('4. 工时加权 vs 任务数加权：大任务未完成会明显拖进度（工时加权更严格）', () => {
    // 小任务 30 分钟已完成，大任务 90 分钟未完成
    // 按任务数 = 50%（1/2）；按工时 = 30/(30+90) = 25%
    const tasks = [
      baseTask({ projectId: 'p-weight', estimatedMinutes: 30, actualMinutes: 30, status: 'completed' }),
      baseTask({ projectId: 'p-weight', estimatedMinutes: 90, status: 'pending' }),
    ];
    const p = computeProjectProgress(tasks, 'p-weight');
    expect(p).toBeCloseTo(0.25, 4);
  });

  it('5. 已 completed 但 actualMinutes 为 0 → fallback estimatedMinutes 计入分子', () => {
    const tasks = [
      baseTask({
        projectId: 'p-fallback',
        estimatedMinutes: 60,
        actualMinutes: 0,
        status: 'completed',
      }),
    ];
    expect(computeProjectProgress(tasks, 'p-fallback')).toBe(1.0);
  });

  // ========== computeGoalProgress ==========
  it('6. 目标无项目 → 0', () => {
    expect(computeGoalProgress([], [], 'g-none')).toBe(0);
    const p = baseProject({ goalId: 'g-other' });
    expect(computeGoalProgress([], [p], 'g-none')).toBe(0);
  });

  it('7. 目标 1 个项目：项目进度 0.6 → 目标进度 0.6', () => {
    const p = baseProject({ id: 'p1', goalId: 'g' });
    const tasks = [
      baseTask({ projectId: 'p1', estimatedMinutes: 60, actualMinutes: 36, status: 'completed' }), // 60%
    ];
    expect(computeGoalProgress(tasks, [p], 'g')).toBeCloseTo(0.6, 4);
  });

  it('8. 目标 2 个项目：60% + 90% 简单平均 = 75%', () => {
    const p1 = baseProject({ id: 'p1', goalId: 'g' });
    const p2 = baseProject({ id: 'p2', goalId: 'g' });
    const tasks = [
      baseTask({ projectId: 'p1', estimatedMinutes: 100, actualMinutes: 60, status: 'completed' }),
      baseTask({ projectId: 'p2', estimatedMinutes: 100, actualMinutes: 90, status: 'completed' }),
    ];
    expect(computeGoalProgress(tasks, [p1, p2], 'g')).toBeCloseTo(0.75, 4);
  });

  // ========== computeMilestoneReached ==========
  it('9. 里程碑 2 项目均 99% < 0.995 → 未 reached；均 completed 状态 → 已 reached', () => {
    const tasks: IQuestTask[] = [
      baseTask({ projectId: 'pa', estimatedMinutes: 1000, actualMinutes: 990, status: 'completed' }), // 0.99
      baseTask({ projectId: 'pb', estimatedMinutes: 1000, actualMinutes: 990, status: 'completed' }),
    ];
    const pa = baseProject({ id: 'pa', status: 'active' });
    const pb = baseProject({ id: 'pb', status: 'active' });
    const projects = [pa, pb];
    const m: IGoalMilestone[] = [{ index: 0, projectIds: ['pa', 'pb'] }];

    // 99% + 99% = 0.99 < 0.995 阈值，状态 active 非 completed → 未 reached
    expect(computeMilestoneReached(tasks, projects, m, 0)).toBe(false);

    // 状态改成 completed → 条件 A 触发 → reached
    expect(
      computeMilestoneReached(
        tasks,
        [{ ...pa, status: 'completed' }, { ...pb, status: 'completed' }],
        m,
        0,
      ),
    ).toBe(true);
  });

  it('10. 里程碑 2 项目：一个未激活（不存在于 projects 视为未完成）另一个 100% → 平均 0.5 未 reached；但另一个单独且 100% → reached', () => {
    const tasks = [
      baseTask({ projectId: 'pa', estimatedMinutes: 60, actualMinutes: 60, status: 'completed' }),
    ];
    const projects = [baseProject({ id: 'pa', status: 'active' })];

    // 两项目，其中 pb 不存在 → 0.5 平均，未 reached
    const twoProjects: IGoalMilestone[] = [{ index: 0, projectIds: ['pa', 'pb'] }];
    expect(computeMilestoneReached(tasks, projects, twoProjects, 0)).toBe(false);

    // 只有 pa → 1.0 ≥ 0.995 → reached
    const oneProject: IGoalMilestone[] = [{ index: 0, projectIds: ['pa'] }];
    expect(computeMilestoneReached(tasks, projects, oneProject, 0)).toBe(true);
  });

  it('11. 空 milestone 项目列表 / 找不到 milestone → 分别按 trivially true / false 处理', () => {
    const noMs: IGoalMilestone[] = [];
    expect(computeMilestoneReached([], [], noMs, 0)).toBe(false);

    const emptyProjects: IGoalMilestone[] = [{ index: 0, projectIds: [] }];
    expect(computeMilestoneReached([], [], emptyProjects, 0)).toBe(true);

    const hasMs = [{ index: 0, projectIds: ['p'] }];
    expect(computeMilestoneReached([], [], hasMs, 999)).toBe(false); // milestoneIndex 错
  });

  it('12. 半完成场景：2/3 子任务完成，且工时按比例，结果应严格符合分子分母公式', () => {
    const tasks = [
      baseTask({ projectId: 'p', estimatedMinutes: 30, actualMinutes: 30, status: 'completed' }), // 30
      baseTask({ projectId: 'p', estimatedMinutes: 30, actualMinutes: 30, status: 'completed' }), // 30
      baseTask({ projectId: 'p', estimatedMinutes: 40, status: 'pending' }), // 40
    ];
    // 分母 = 30+30+40 = 100，分子 = 30+30 = 60 → 0.6
    expect(computeProjectProgress(tasks, 'p')).toBeCloseTo(0.6, 4);
  });
});
