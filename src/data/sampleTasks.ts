// 示例任务种子（评审文档提议的史诗任务 + 每日悬赏）
// 用于在「悬赏池」一键导入到当前本地库，避免冷启动空白。
// 奖励声望/能力点用与本地一致的公式（@/lib/economy）计算。
import type { IQuestTask, TaskType, TaskDifficulty, TaskImportance } from '@/types/quest';
import { computeReputation, computeSkillPoints } from '@/lib/economy';

function makeTask(opts: {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  difficulty: TaskDifficulty;
  importance?: TaskImportance;
  estimatedMinutes: number;
  parentId?: string;
  bossName?: string;
  tags?: string[];
  stage?: number;
}): IQuestTask {
  const importance = opts.importance ?? 'medium';
  const now = Date.now();
  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    type: opts.type,
    difficulty: opts.difficulty,
    importance,
    estimatedMinutes: opts.estimatedMinutes,
    actualMinutes: 0,
    relatedSkillId: undefined,
    goalId: undefined,
    projectId: undefined,
    capabilityIds: [],
    bossName: opts.bossName,
    bossProgress: 0,
    parentId: opts.parentId,
    stage: opts.stage ?? (opts.type === 'epic' && !opts.parentId ? 1 : 0),
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation: computeReputation({ difficulty: opts.difficulty, importance, minutes: opts.estimatedMinutes }),
    rewardSkillPoints: computeSkillPoints(opts.difficulty),
    createdAt: now,
    updatedAt: now,
    source: 'user',
    tags: opts.tags ?? [],
  };
}

// ========== 应用开发线 ==========
export const SAMPLE_EPIC_TASKS: IQuestTask[] = [
  makeTask({
    id: 'sample-epic-stats',
    name: '统计面板重构',
    description: '把统计页从 3 张卡片扩展为含趋势图、完成率、能力成长曲线的「冒险者年报」雏形。',
    type: 'epic',
    difficulty: 'hard',
    estimatedMinutes: 600,
    bossName: '数据巨像',
    tags: ['开发', '统计'],
  }),
  makeTask({
    id: 'sample-epic-stats-1',
    name: '近 7/30 天完成任务柱状图',
    description: '实现按日聚合的完成任务数柱状图，支持 7/30 天切换。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 120,
    parentId: 'sample-epic-stats',
    stage: 1,
    tags: ['图表'],
  }),
  makeTask({
    id: 'sample-epic-stats-2',
    name: '专注时长折线图 + 完成率',
    description: '折线展示近 7/30 天专注时长，并补充完成率概览卡片。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 120,
    parentId: 'sample-epic-stats',
    stage: 2,
    tags: ['图表'],
  }),
  makeTask({
    id: 'sample-epic-stats-3',
    name: '难度分布饼图 + 能力经验 Top5',
    description: '环形图展示难度分布，列出能力经验最高的 5 个节点。',
    type: 'epic',
    difficulty: 'easy',
    estimatedMinutes: 90,
    parentId: 'sample-epic-stats',
    stage: 3,
    tags: ['图表'],
  }),

  makeTask({
    id: 'sample-epic-skilltree',
    name: '能力树交互增强',
    description: '节点 hover/点击显示名称、描述、解锁条件、当前经验；支持搜索/过滤。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 300,
    bossName: '知识古树',
    tags: ['开发', '能力树'],
  }),
  makeTask({
    id: 'sample-epic-skilltree-1',
    name: '节点详情浮层',
    description: '任意节点可查看详情，未解锁节点显示还差多少能力点/经验。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 150,
    parentId: 'sample-epic-skilltree',
    stage: 1,
    tags: ['交互'],
  }),
  makeTask({
    id: 'sample-epic-skilltree-2',
    name: '能力树搜索与过滤',
    description: '按大类/关键词搜索、按状态过滤节点。',
    type: 'epic',
    difficulty: 'easy',
    estimatedMinutes: 120,
    parentId: 'sample-epic-skilltree',
    stage: 2,
    tags: ['交互'],
  }),
];

// ========== 个人管理线 ==========
export const SAMPLE_PERSONAL_EPICS: IQuestTask[] = [
  makeTask({
    id: 'sample-epic-fitness',
    name: '建立「减脂健身」主线',
    description: '把训练计划结构化为目标→项目→史诗任务，每周跟踪背部强化、居家训练、饮食记录。',
    type: 'epic',
    difficulty: 'epic',
    importance: 'high',
    estimatedMinutes: 1200,
    bossName: '脂肪魔王',
    tags: ['健身', '减脂'],
  }),
  makeTask({
    id: 'sample-epic-fitness-1',
    name: '周二/三/四晚训练',
    description: '背部强化为主，居家渐进式训练，每次 45-60 分钟。',
    type: 'epic',
    difficulty: 'hard',
    estimatedMinutes: 240,
    parentId: 'sample-epic-fitness',
    stage: 1,
    tags: ['训练'],
  }),
  makeTask({
    id: 'sample-epic-fitness-2',
    name: '睡前微习惯',
    description: '睡前 5-10 分钟死虫/臀桥/靠墙站，防偷懒。',
    type: 'epic',
    difficulty: 'easy',
    estimatedMinutes: 70,
    parentId: 'sample-epic-fitness',
    stage: 2,
    tags: ['习惯'],
  }),
  makeTask({
    id: 'sample-epic-fitness-3',
    name: '周六户外恢复',
    description: '轻度有氧 + 拉伸，作为每周恢复日。',
    type: 'epic',
    difficulty: 'easy',
    estimatedMinutes: 60,
    parentId: 'sample-epic-fitness',
    stage: 3,
    tags: ['恢复'],
  }),

  makeTask({
    id: 'sample-epic-streak7',
    name: '连续 7 天每日主线',
    description: '培养每天用 Quest Guild 设定主线 + 完成至少 1 个每日悬赏的习惯，激活 streak。',
    type: 'epic',
    difficulty: 'hard',
    importance: 'high',
    estimatedMinutes: 420,
    bossName: '自律守卫',
    tags: ['习惯'],
  }),
];

export const SAMPLE_DAILY_TASKS: IQuestTask[] = [
  makeTask({
    id: 'sample-daily-import-fallback',
    name: '修复统计面板 0 数据空白',
    description: '为统计页各图表增加空状态兜底文案，不再一片空白。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 30,
    tags: ['开发'],
  }),
  makeTask({
    id: 'sample-daily-recommend-banner',
    name: '今日任务页加「今日推荐」横幅',
    description: '根据 overdue/高重要性任务智能建议主线。',
    type: 'daily',
    difficulty: 'normal',
    estimatedMinutes: 60,
    tags: ['开发'],
  }),
  makeTask({
    id: 'sample-daily-reflection-entry',
    name: '完成任务后弹「写复盘」入口',
    description: '庆祝动画后提供一键复盘快捷入口，闭合复盘环。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 30,
    tags: ['复盘'],
  }),
  makeTask({
    id: 'sample-daily-back-training',
    name: '今晚背部训练',
    description: '关联能力：背部力量。完成 1 组背部训练。',
    type: 'daily',
    difficulty: 'normal',
    estimatedMinutes: 50,
    tags: ['健身', '训练'],
  }),
  makeTask({
    id: 'sample-daily-bedtime-habit',
    name: '睡前微习惯（死虫/臀桥/靠墙站）',
    description: '三选一，5-10 分钟，防偷懒。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 10,
    tags: ['健身', '习惯'],
  }),
  makeTask({
    id: 'sample-daily-weight-log',
    name: '记录体重/体脂',
    description: '如逢周六则完整记录本周数据。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['健身', '记录'],
  }),
  makeTask({
    id: 'sample-daily-plan-tomorrow',
    name: '发布明日主线并设为追踪',
    description: '在悬赏池发布明天的主线任务并设为「追踪」。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 5,
    tags: ['规划'],
  }),
  makeTask({
    id: 'sample-daily-one-reflection',
    name: '完成 1 次任务复盘',
    description: '按预期/实际/教训/下一步写下复盘。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 15,
    tags: ['复盘'],
  }),
];

export const SAMPLE_TASKS: IQuestTask[] = [
  ...SAMPLE_EPIC_TASKS,
  ...SAMPLE_PERSONAL_EPICS,
  ...SAMPLE_DAILY_TASKS,
];
