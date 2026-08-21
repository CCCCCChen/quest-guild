import { describe, it, expect } from 'vitest';
import { cascadeTaskCompletion, computeBossProgressForParent } from '@/lib/taskCompletion';
import type { IQuestTask, TaskDifficulty } from '@/types/quest';

function base(id: string, overrides: Partial<IQuestTask> = {}): IQuestTask {
  return {
    id,
    name: id,
    description: '',
    type: 'epic',
    difficulty: 'normal' as TaskDifficulty,
    estimatedMinutes: 60,
    actualMinutes: 0,
    bossProgress: 0,
    stage: 1,
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation: 100,
    rewardSkillPoints: 2,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('taskCompletion', () => {
  const NOW = 1_700_000_000_000;

  it('独立 daily 任务（无父）→ patches 空 + bonuses 空', () => {
    const tasks = [base('daily', { type: 'daily' })];
    const r = cascadeTaskCompletion(tasks, 'daily', 1, NOW);
    expect(r.patches).toHaveLength(0);
    expect(r.bonuses).toHaveLength(0);
  });

  it('完成一个子任务（兄弟未全完成）→ 只更新父 bossProgress，无奖励', () => {
    const parent = base('p', { rewardReputation: 500, rewardSkillPoints: 3 });
    const c1 = base('c1', { parentId: 'p' });
    const c2 = base('c2', { parentId: 'p' });
    const tasks = [parent, c1, c2];
    // 模拟 completeTask：先把 c1 置 completed（此时兄弟 c2 仍 pending → 完成率 1/2 = 50%）
    const post = tasks.map((t) => (t.id === 'c1' ? { ...t, status: 'completed' as const } : t));
    const r = cascadeTaskCompletion(post, 'c1', 1, NOW);
    const pPatch = r.patches.find((x) => x.id === 'p')!;
    expect(pPatch.bossProgress).toBe(50); // 1/2 子任务完成
    expect(pPatch.status).toBeUndefined(); // 未全完成，父不置 completed
    expect(r.bonuses).toHaveLength(0); // 无通关奖励
  });

  it('完成最后一个子任务 → 父通关奖励：status=completed + bossProgress=100 + 奖励按系数 1.5', () => {
    const parent = base('p', { rewardReputation: 200, rewardSkillPoints: 3, status: 'pending' });
    const c1 = base('c1', { parentId: 'p', status: 'completed' });
    const c2 = base('c2', { parentId: 'p', status: 'pending' });
    const tasks = [parent, c1, c2];
    // 模拟 completeTask：先把 c2 改成 completed，再跑 cascade（本函数假设 tasks 中 c2 已是 completed，因此我们直接传 completed）
    const post = tasks.map((t) => (t.id === 'c2' ? { ...t, status: 'completed' as const } : t));
    const r = cascadeTaskCompletion(post, 'c2', 1.5, NOW);
    const pPatch = r.patches.find((x) => x.id === 'p')!;
    expect(pPatch.status).toBe('completed');
    expect(pPatch.bossProgress).toBe(100);
    expect(pPatch.completedAt).toBe(NOW);
    // 200 * 1.5 = 300, 3 * 1.5 = 4.5 round 到 4 还是 5？Math.round(4.5) = 5。
    expect(r.bonuses).toHaveLength(1);
    expect(r.bonuses[0].rep).toBe(300);
    expect(r.bonuses[0].sp).toBe(5);
  });

  it('幂等：父已 completed，再完成子 → 不重复发奖励', () => {
    const parent = base('p', { status: 'completed', rewardReputation: 200, rewardSkillPoints: 3 });
    const c1 = base('c1', { parentId: 'p', status: 'completed' });
    const c2 = base('c2', { parentId: 'p', status: 'pending' });
    const tasks = [parent, c1, c2];
    const post = tasks.map((t) => (t.id === 'c2' ? { ...t, status: 'completed' as const } : t));
    const r = cascadeTaskCompletion(post, 'c2', 1, NOW);
    expect(r.bonuses).toHaveLength(0); // 父已完成，不得再发
    const pPatch = r.patches.find((x) => x.id === 'p');
    expect(pPatch?.status).toBeUndefined(); // 不重复改
    expect(pPatch?.bossProgress).toBe(100); // 但 bossProgress 还是对齐
  });

  it('3 层嵌套级联：完成全部孙 → 父通关 + 祖父也通关；bonus 按每父各自计算', () => {
    // A（祖父 epic） → B（父 epic） → C1/C2（孙）
    const A = base('A', { rewardReputation: 900, rewardSkillPoints: 10 });
    const B = base('B', { parentId: 'A', rewardReputation: 300, rewardSkillPoints: 3 });
    const C1 = base('C1', { parentId: 'B', status: 'completed' });
    const C2 = base('C2', { parentId: 'B', status: 'pending' });
    const tasks = [A, B, C1, C2];
    const post = tasks.map((t) => (t.id === 'C2' ? { ...t, status: 'completed' as const } : t));
    const r = cascadeTaskCompletion(post, 'C2', 1.2, NOW);
    const b = r.patches.find((x) => x.id === 'B')!;
    const a = r.patches.find((x) => x.id === 'A')!;
    expect(b.status).toBe('completed');
    expect(a.status).toBe('completed');
    expect(r.bonuses.map((x) => x.parentId).sort()).toEqual(['A', 'B']);
    // B: 300 * 1.2 = 360 ;  A: 900 * 1.2 = 1080
    const byId = Object.fromEntries(r.bonuses.map((x) => [x.parentId, x]));
    expect(byId.B.rep).toBe(360);
    expect(byId.A.rep).toBe(1080);
  });

  it('未全完成场景：沿途祖先 bossProgress 都被刷新', () => {
    const A = base('A');
    const B = base('B', { parentId: 'A' });
    const C1 = base('C1', { parentId: 'B', status: 'completed' });
    const C2 = base('C2', { parentId: 'B', status: 'pending' });
    const C3 = base('C3', { parentId: 'B', status: 'pending' });
    const B2 = base('B2', { parentId: 'A', status: 'completed' }); // A 的另一个子，已完成
    const tasks = [A, B, B2, C1, C2, C3];
    // 现在完成 C2：B 的完成率变为 2/3 ≈ 67%；A 的完成率：B(未完成)+B2(完成) = 1/2 = 50%
    const post = tasks.map((t) => (t.id === 'C2' ? { ...t, status: 'completed' as const } : t));
    const r = cascadeTaskCompletion(post, 'C2', 1, NOW);
    const b = r.patches.find((x) => x.id === 'B')!;
    const a = r.patches.find((x) => x.id === 'A')!;
    expect(b.bossProgress).toBe(67);
    expect(a.bossProgress).toBe(50);
    expect(r.bonuses).toHaveLength(0); // 谁都没通关
  });

  it('computeBossProgressForParent：空父 → 0%；父有 2 子 1 完成 → 50%', () => {
    const p = base('p');
    const c1 = base('c1', { parentId: 'p', status: 'completed' });
    const c2 = base('c2', { parentId: 'p', status: 'pending' });
    expect(computeBossProgressForParent([p, c1, c2], 'p')).toBe(50);
    expect(computeBossProgressForParent([p], 'nonexistent')).toBe(0);
  });

  it('非法系数（负数/NaN）回退 1.0', () => {
    const parent = base('p', { rewardReputation: 100, rewardSkillPoints: 2 });
    const c1 = base('c1', { parentId: 'p', status: 'completed' });
    const c2 = base('c2', { parentId: 'p', status: 'pending' });
    const post = [parent, c1, { ...c2, status: 'completed' as const }];
    const r = cascadeTaskCompletion(post, 'c2', -9, NOW);
    expect(r.bonuses[0].rep).toBe(100); // -9 被替换成 1
  });
});
