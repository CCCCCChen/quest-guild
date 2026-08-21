// EXPORTS: PRESET_TASKS, PRESET_SKILLS, PRESET_SHOP_ITEMS, PRESET_FOCUS_LOGS, INITIAL_REPUTATION, INITIAL_SKILL_POINTS, PRESET_SKILL_POINTS, DEFAULT_SETTINGS, DEFAULT_MANA_CONFIG

import type { IQuestTask, ISkillNode, IShopItem, IAppSettings, IManaConfig, IFocusLog, IGoal, IProject } from '@/types/quest';

// ========== 预设任务 ==========
const PRESET_TASKS_RAW: Omit<IQuestTask, 'updatedAt'>[] = [
  // 史诗任务 1：打造个人作品集网站
  {
    id: 'epic-portfolio',
    name: '打造个人作品集网站',
    description: '从零开始构建一个展示个人项目与技能的专业作品集网站，包含项目展示、关于我、联系方式等模块。',
    type: 'epic',
    difficulty: 'hard',
    estimatedMinutes: 2400,
    actualMinutes: 480,
    relatedSkillId: 'cap-creation-tech-frontend',
    bossName: '作品集上线巨龙',
    bossProgress: 20,
    stage: 1,
    status: 'active',
    isTracking: false,
    isAttention: false,
    rewardReputation: 500,
    rewardSkillPoints: 3,
    createdAt: Date.now() - 86400000 * 7,
    source: 'mock',
    tags: ['开发', '前端', '作品集'],
  },
  {
    id: 'epic-portfolio-1',
    name: '设计网站整体视觉风格',
    description: '确定作品集的配色、字体、布局风格，产出设计稿。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 480,
    actualMinutes: 360,
    relatedSkillId: 'cap-creation-product-prototype',
    parentId: 'epic-portfolio',
    bossProgress: 75,
    stage: 1,
    status: 'completed',
    isTracking: false,
    isAttention: false,
    rewardReputation: 100,
    rewardSkillPoints: 1,
    createdAt: Date.now() - 86400000 * 6,
    completedAt: Date.now() - 86400000 * 4,
    source: 'mock',
    tags: ['设计', 'UI'],
  },
  {
    id: 'epic-portfolio-2',
    name: '搭建前端项目框架',
    description: '使用 React + Vite 搭建项目基础框架，配置路由、状态管理、样式方案。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 360,
    actualMinutes: 120,
    relatedSkillId: 'cap-creation-tech-software',
    parentId: 'epic-portfolio',
    bossProgress: 30,
    stage: 2,
    status: 'active',
    isTracking: true,
    isAttention: false,
    rewardReputation: 80,
    rewardSkillPoints: 1,
    createdAt: Date.now() - 86400000 * 5,
    source: 'mock',
    tags: ['开发', 'React'],
  },
  {
    id: 'epic-portfolio-3',
    name: '实现项目展示模块',
    description: '开发项目卡片、详情弹窗、筛选功能。',
    type: 'epic',
    difficulty: 'normal',
    estimatedMinutes: 480,
    actualMinutes: 0,
    relatedSkillId: 'cap-creation-tech-frontend',
    parentId: 'epic-portfolio',
    bossProgress: 0,
    stage: 3,
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation: 120,
    rewardSkillPoints: 1,
    createdAt: Date.now() - 86400000 * 3,
    source: 'mock',
    tags: ['开发', '组件'],
  },

  // 史诗任务 2：掌握 Python 数据分析
  {
    id: 'epic-python-data',
    name: '掌握 Python 数据分析',
    description: '系统学习 Python 数据分析栈，完成一个真实数据分析项目。',
    type: 'epic',
    difficulty: 'epic',
    estimatedMinutes: 4800,
    actualMinutes: 600,
    relatedSkillId: 'cap-system-data-analysis',
    bossName: '数据洞察巨兽',
    bossProgress: 12,
    stage: 1,
    status: 'active',
    isTracking: false,
    isAttention: false,
    rewardReputation: 800,
    rewardSkillPoints: 5,
    createdAt: Date.now() - 86400000 * 14,
    source: 'mock',
    tags: ['编程', 'Python', '数据'],
  },
  {
    id: 'epic-python-1',
    name: 'Python 基础语法巩固',
    description: '复习 Python 核心语法、数据结构、函数与面向对象。',
    type: 'epic',
    difficulty: 'easy',
    estimatedMinutes: 300,
    actualMinutes: 280,
    relatedSkillId: 'cap-creation-tech-programming',
    parentId: 'epic-python-data',
    bossProgress: 95,
    stage: 1,
    status: 'active',
    isTracking: false,
    isAttention: true,
    rewardReputation: 50,
    rewardSkillPoints: 0,
    createdAt: Date.now() - 86400000 * 10,
    source: 'mock',
    tags: ['编程', '基础'],
  },

  // 每日悬赏任务
  {
    id: 'daily-1',
    name: '晨间冥想 15 分钟',
    description: '开启一天的专注状态，进行正念冥想。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 15,
    actualMinutes: 0,
    relatedSkillId: 'cap-meta-self-focus',
    bossProgress: 0,
    stage: 0,
    status: 'active',
    isTracking: false,
    isAttention: true,
    rewardReputation: 15,
    rewardSkillPoints: 0,
    createdAt: Date.now() - 3600000 * 2,
    source: 'mock',
    tags: ['健康', '习惯'],
  },
  {
    id: 'daily-2',
    name: '阅读技术文章 30 分钟',
    description: '阅读一篇前端技术文章，做笔记。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 30,
    actualMinutes: 0,
    relatedSkillId: 'cap-meta-learning-input',
    bossProgress: 0,
    stage: 0,
    status: 'active',
    isTracking: false,
    isAttention: true,
    rewardReputation: 20,
    rewardSkillPoints: 0,
    createdAt: Date.now() - 3600000 * 5,
    source: 'mock',
    tags: ['学习', '前端'],
  },
  {
    id: 'daily-3',
    name: '背 20 个英语单词',
    description: '使用 Anki 背诵英语单词。',
    type: 'daily',
    difficulty: 'easy',
    estimatedMinutes: 20,
    actualMinutes: 20,
    relatedSkillId: 'cap-meta-learning-deep',
    bossProgress: 100,
    stage: 0,
    status: 'completed',
    isTracking: false,
    isAttention: false,
    rewardReputation: 15,
    rewardSkillPoints: 0,
    createdAt: Date.now() - 86400000,
    completedAt: Date.now() - 3600000 * 8,
    source: 'mock',
    tags: ['语言', '英语'],
  },
  {
    id: 'daily-4',
    name: '健身 45 分钟',
    description: '力量训练 + 有氧，保持身体健康。',
    type: 'daily',
    difficulty: 'normal',
    estimatedMinutes: 45,
    actualMinutes: 0,
    relatedSkillId: 'cap-meta-self-focus',
    bossProgress: 0,
    stage: 0,
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation: 30,
    rewardSkillPoints: 0,
    createdAt: Date.now() - 7200000,
    source: 'mock',
    tags: ['健康', '运动'],
  },
];

// 补全 updatedAt（与 createdAt 对齐，保证 LWW 合并时本地编辑优先）
export const PRESET_TASKS: IQuestTask[] = PRESET_TASKS_RAW.map((t) => ({
  ...t,
  updatedAt: t.createdAt,
}));

// ========== 预设目标 / 项目骨架（新用户首开 Goals/Projects 页不再空白） ==========
const PRESET_GOALS_RAW: Omit<IGoal, 'createdAt' | 'updatedAt'>[] = [
  { id: 'goal-portfolio', name: '打造个人作品集', description: '沉淀可展示的项目与技能，建立专业身份。', status: 'active' },
  { id: 'goal-python', name: '掌握 Python 数据分析', description: '系统学习数据分析栈并完成一个真实项目。', status: 'active' },
  { id: 'goal-ai', name: '建立 AI 核心能力', description: '理解并善用 LLM / RAG / Agent 等 AI 能力。', status: 'active' },
  { id: 'goal-body', name: '强化身体底盘', description: '居家渐进式健身，改善体态与精力。', status: 'active' },
  { id: 'goal-expression', name: '提升表达与影响力', description: '通过技术写作与分享放大价值。', status: 'active' },
  { id: 'goal-system', name: '搭建个人系统', description: '自我管理、时间与复盘的系统化闭环。', status: 'active' },
  { id: 'goal-learning', name: '持续学习输入', description: '保持稳定的学习与输入闭环。', status: 'active' },
];

const PRESET_PROJECTS_RAW: Omit<IProject, 'createdAt' | 'updatedAt'>[] = [
  { id: 'proj-portfolio', goalId: 'goal-portfolio', name: '作品集网站', description: 'React + Vite 构建个人作品集站点。', capabilityIds: ['cap-creation-tech-frontend'], progress: 0, status: 'active' },
  { id: 'proj-python', goalId: 'goal-python', name: 'Python 数据分析项目', description: '用 Python 完成一个端到端数据分析项目。', capabilityIds: ['cap-system-data-analysis'], progress: 0, status: 'active' },
  { id: 'proj-ai', goalId: 'goal-ai', name: 'AI 实战项目', description: '基于 LLM 构建一个可用的小工具或工作流。', capabilityIds: ['cap-creation-ai-basic'], progress: 0, status: 'active' },
  { id: 'proj-body', goalId: 'goal-body', name: '居家渐进式健身', description: '背部强化 + 体态改善的居家训练计划。', capabilityIds: ['cap-meta-self-focus'], progress: 0, status: 'active' },
  { id: 'proj-expression', goalId: 'goal-expression', name: '技术写作与分享', description: '把经验沉淀为可分享的技术文章。', capabilityIds: ['cap-influence-expression-writing'], progress: 0, status: 'active' },
  { id: 'proj-system', goalId: 'goal-system', name: '个人系统搭建', description: '目标 / 时间 / 复盘的系统化闭环。', capabilityIds: ['cap-system-opt-loop'], progress: 0, status: 'active' },
  { id: 'proj-learning', goalId: 'goal-learning', name: '每周学习闭环', description: '稳定输入 + 深度理解 + 输出表达。', capabilityIds: ['cap-meta-learning-deep'], progress: 0, status: 'active' },
];

const presetNow = Date.now();
export const PRESET_GOALS: IGoal[] = PRESET_GOALS_RAW.map((g) => ({ ...g, createdAt: presetNow, updatedAt: presetNow }));
export const PRESET_PROJECTS: IProject[] = PRESET_PROJECTS_RAW.map((p) => ({ ...p, createdAt: presetNow, updatedAt: presetNow }));

// ========== 预设能力树 ==========
type CapabilitySeedNode = {
  id: string;
  name: string;
  description: string;
  children?: CapabilitySeedNode[];
};

const CAPABILITY_ROOT_ID = 'skill-root';
const CAPABILITY_CENTER = { x: 500, y: 400 };
const now = Date.now();

function seedProgress(status: ISkillNode['status']) {
  if (status === 'enhanced') return { experience: 520, proficiencyLevel: 2 };
  if (status === 'unlocked') return { experience: 120, proficiencyLevel: 1 };
  return { experience: 0, proficiencyLevel: 0 };
}

function polarPosition(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.round(CAPABILITY_CENTER.x + Math.cos(rad) * radius),
    y: Math.round(CAPABILITY_CENTER.y + Math.sin(rad) * radius),
  };
}

function createCapabilityTree() {
  const nodes: ISkillNode[] = [];
  const unlockedIds = new Set([
    CAPABILITY_ROOT_ID,
    'cap-meta',
    'cap-creation',
    'cap-system',
    'cap-influence',
    'cap-meta-thinking',
    'cap-meta-learning',
    'cap-meta-self',
    'cap-creation-tech',
    'cap-system-design',
    'cap-meta-thinking-structured',
    'cap-meta-learning-deep',
    'cap-meta-self-focus',
    'cap-creation-tech-programming',
    'cap-creation-tech-software',
    'cap-creation-tech-frontend',
    'cap-system-design-architecture',
  ]);
  const enhancedIds = new Set(['cap-creation-tech-frontend']);

  const roots: Array<CapabilitySeedNode & { category: string; angle: number }> = [
    {
      id: 'cap-meta',
      name: '元能力',
      description: '决定学习、思考、管理与判断质量的底层能力。',
      category: '元能力',
      angle: -90,
      children: [
        {
          id: 'cap-meta-thinking',
          name: '思考能力',
          description: '将复杂问题抽象、结构化并形成判断的能力。',
          children: [
            { id: 'cap-meta-thinking-abstract', name: '问题抽象', description: '识别本质问题并抽离表象。' },
            { id: 'cap-meta-thinking-structured', name: '结构化思考', description: '把复杂内容拆成清晰结构。' },
            { id: 'cap-meta-thinking-first', name: '第一性原理', description: '回到底层约束重新思考。' },
            { id: 'cap-meta-thinking-decision', name: '决策判断', description: '在不确定中做出高质量选择。' },
          ],
        },
        {
          id: 'cap-meta-learning',
          name: '学习能力',
          description: '获取、理解、连接并转化知识的能力。',
          children: [
            { id: 'cap-meta-learning-input', name: '信息获取', description: '高效找到可靠信息源。' },
            { id: 'cap-meta-learning-deep', name: '深度理解', description: '把知识学透而不是只停留在表面。' },
            { id: 'cap-meta-learning-connect', name: '知识连接', description: '把分散知识组织成体系。' },
            { id: 'cap-meta-learning-expression', name: '输出表达', description: '用自己的话准确讲出来。' },
            { id: 'cap-meta-learning-transfer', name: '实践转化', description: '把知识转成真实行动与结果。' },
          ],
        },
        {
          id: 'cap-meta-self',
          name: '自我管理',
          description: '围绕目标、专注、节奏与复盘的自我调度能力。',
          children: [
            { id: 'cap-meta-self-goal', name: '目标管理', description: '明确方向并持续推进。' },
            { id: 'cap-meta-self-priority', name: '优先级判断', description: '识别当前最值得投入的事情。' },
            { id: 'cap-meta-self-time', name: '时间估算', description: '更准确地估计任务耗时。' },
            { id: 'cap-meta-self-focus', name: '专注能力', description: '维持深度专注并减少切换损耗。' },
            { id: 'cap-meta-self-review', name: '复盘优化', description: '从结果中提炼经验并改进。' },
          ],
        },
      ],
    },
    {
      id: 'cap-creation',
      name: '创造能力',
      description: '把想法变成产品、系统与实际产出的能力。',
      category: '创造能力',
      angle: -18,
      children: [
        {
          id: 'cap-creation-tech',
          name: '技术创造',
          description: '用工程方法构建真实可用的软件与系统。',
          children: [
            { id: 'cap-creation-tech-programming', name: '编程基础', description: '编程语言、数据结构与基础抽象能力。' },
            { id: 'cap-creation-tech-software', name: '软件工程', description: '工程结构、协作、质量与可维护性。' },
            { id: 'cap-creation-tech-backend', name: '后端开发', description: '服务端接口、业务逻辑与数据处理能力。' },
            { id: 'cap-creation-tech-frontend', name: '前端开发', description: '界面、交互与客户端工程能力。' },
            { id: 'cap-creation-tech-devops', name: 'DevOps', description: '部署、自动化、监控与交付能力。' },
          ],
        },
        {
          id: 'cap-creation-ai',
          name: 'AI创造',
          description: '用 AI/LLM 构建新工具、新流程与新体验。',
          children: [
            { id: 'cap-creation-ai-basic', name: 'AI基础', description: '理解 AI 的基本概念、能力边界与适用场景。' },
            { id: 'cap-creation-ai-llm', name: 'LLM理解', description: '理解大模型的工作方式与上下文特性。' },
            { id: 'cap-creation-ai-prompt', name: 'Prompt Engineering', description: '设计高质量提示词与交互结构。' },
            { id: 'cap-creation-ai-rag', name: 'RAG', description: '构建检索增强生成能力。' },
            { id: 'cap-creation-ai-agent', name: 'Agent', description: '构建具备目标、工具与执行能力的代理系统。' },
            { id: 'cap-creation-ai-workflow', name: 'AI Workflow', description: '把 AI 能力编排进真实工作流。' },
          ],
        },
        {
          id: 'cap-creation-product',
          name: '产品创造',
          description: '把需求洞察转为可验证的产品方案与迭代路径。',
          children: [
            { id: 'cap-creation-product-needs', name: '用户需求分析', description: '识别用户问题与价值点。' },
            { id: 'cap-creation-product-design', name: '产品设计', description: '定义产品结构、功能与价值链路。' },
            { id: 'cap-creation-product-prototype', name: '原型设计', description: '快速表达方案并验证交互。' },
            { id: 'cap-creation-product-ux', name: '用户体验', description: '提升理解成本、流畅度与满意度。' },
            { id: 'cap-creation-product-iteration', name: '产品迭代', description: '基于反馈持续优化产品。' },
          ],
        },
      ],
    },
    {
      id: 'cap-system',
      name: '系统能力',
      description: '面向复杂系统的结构设计、数据治理与闭环优化能力。',
      category: '系统能力',
      angle: 54,
      children: [
        {
          id: 'cap-system-design',
          name: '系统设计',
          description: '构建清晰、稳健且可扩展的系统结构。',
          children: [
            { id: 'cap-system-design-architecture', name: '架构设计', description: '定义系统整体结构与边界。' },
            { id: 'cap-system-design-modules', name: '模块拆分', description: '把复杂系统切分为稳定模块。' },
            { id: 'cap-system-design-dataflow', name: '数据流设计', description: '设计信息与状态在系统中的流动。' },
            { id: 'cap-system-design-scale', name: '扩展性设计', description: '为增长、变化与复用留出空间。' },
          ],
        },
        {
          id: 'cap-system-data',
          name: '数据能力',
          description: '围绕数据建模、存储、分析与治理的能力。',
          children: [
            { id: 'cap-system-data-model', name: '数据模型', description: '把现实世界抽象为稳定数据结构。' },
            { id: 'cap-system-data-db', name: '数据库设计', description: '设计可靠的数据存储与查询结构。' },
            { id: 'cap-system-data-analysis', name: '数据分析', description: '从数据中提炼可行动洞察。' },
            { id: 'cap-system-data-info', name: '信息管理', description: '组织、沉淀与检索信息资产。' },
          ],
        },
        {
          id: 'cap-system-opt',
          name: '复杂系统优化',
          description: '让流程、工具与协作形成高效闭环。',
          children: [
            { id: 'cap-system-opt-process', name: '流程优化', description: '识别关键瓶颈并优化流转效率。' },
            { id: 'cap-system-opt-automation', name: '自动化', description: '用系统替代重复性工作。' },
            { id: 'cap-system-opt-loop', name: '系统闭环设计', description: '把目标、执行、反馈与优化串起来。' },
          ],
        },
      ],
    },
    {
      id: 'cap-influence',
      name: '影响能力',
      description: '让价值被理解、被接受并带来协作与商业结果。',
      category: '影响能力',
      angle: 126,
      children: [
        {
          id: 'cap-influence-expression',
          name: '表达能力',
          description: '把复杂内容讲清楚、讲明白、讲动人。',
          children: [
            { id: 'cap-influence-expression-writing', name: '技术写作', description: '把技术内容写得准确、清晰、可复用。' },
            { id: 'cap-influence-expression-sharing', name: '知识分享', description: '把个人经验沉淀成他人可吸收的内容。' },
            { id: 'cap-influence-expression-explain', name: '复杂概念解释', description: '降低理解门槛，让复杂内容变可懂。' },
            { id: 'cap-influence-expression-story', name: 'Storytelling', description: '用叙事增强说服力与记忆点。' },
          ],
        },
        {
          id: 'cap-influence-collab',
          name: '协作能力',
          description: '在多角色场景中推动一致行动与结果达成。',
          children: [
            { id: 'cap-influence-collab-communication', name: '沟通', description: '准确传达信息并理解他人意图。' },
            { id: 'cap-influence-collab-coordination', name: '协调', description: '推动多人、多事、多约束协同运转。' },
            { id: 'cap-influence-collab-leadership', name: '领导', description: '在目标、方向与节奏上形成带动作用。' },
          ],
        },
        {
          id: 'cap-influence-business',
          name: '商业能力',
          description: '从价值、模式、成本与战略层理解决策。',
          children: [
            { id: 'cap-influence-business-value', name: '用户价值', description: '识别什么才是真正有价值的输出。' },
            { id: 'cap-influence-business-model', name: '商业模式', description: '理解价值创造、传递与变现方式。' },
            { id: 'cap-influence-business-cost', name: '成本收益分析', description: '平衡投入、回报与机会成本。' },
            { id: 'cap-influence-business-strategy', name: '战略判断', description: '从长期与全局视角做判断。' },
          ],
        },
      ],
    },
    {
      id: 'cap-innovation',
      name: '创新能力',
      description: '在跨领域连接中形成新想法，并快速验证成形。',
      category: '创新能力',
      angle: 198,
      children: [
        { id: 'cap-innovation-cross', name: '跨领域连接', description: '把不同领域知识连接出新可能。' },
        { id: 'cap-innovation-idea', name: '新想法产生', description: '持续提出值得实验的新方向。' },
        { id: 'cap-innovation-experiment', name: '快速实验', description: '快速验证想法而不是停留在构想。' },
        { id: 'cap-innovation-prototype', name: '原型开发', description: '把新想法尽快变成可感知的原型。' },
        { id: 'cap-innovation-product', name: '创造个人产品', description: '把个人能力组合成可持续的作品或产品。' },
      ],
    },
  ];

  nodes.push({
    id: CAPABILITY_ROOT_ID,
    name: '个人成长能力树',
    description: '围绕思考、创造、系统、影响与创新构建你的个人成长能力图谱。',
    category: '核心',
    level: 0,
    status: 'unlocked',
    x: CAPABILITY_CENTER.x,
    y: CAPABILITY_CENTER.y,
    icon: '🌟',
    requiredSkillPoints: 0,
    unlockedAt: now - 86400000 * 30,
    ...seedProgress('unlocked'),
    lastImprovedAt: now - 86400000 * 3,
  });

  roots.forEach((root, rootIndex) => {
    const rootPos = polarPosition(root.angle, 170);
    const rootStatus = unlockedIds.has(root.id) ? 'unlocked' : 'locked';
    nodes.push({
      id: root.id,
      name: root.name,
      description: root.description,
      category: root.category,
      parentId: CAPABILITY_ROOT_ID,
      level: 1,
      status: rootStatus,
      x: rootPos.x,
      y: rootPos.y,
      requiredSkillPoints: 1,
      unlockedAt: rootStatus !== 'locked' ? now - 86400000 * (20 - rootIndex) : undefined,
      ...seedProgress(rootStatus),
      lastImprovedAt: rootStatus !== 'locked' ? now - 86400000 * (6 - (rootIndex % 3)) : undefined,
    });

    const children = root.children ?? [];
    const childSpan = Math.max(36, children.length * 16);
    children.forEach((child, childIndex) => {
      const childAngle =
        children.length === 1
          ? root.angle
          : root.angle - childSpan / 2 + (childSpan / Math.max(children.length - 1, 1)) * childIndex;
      const childPos = polarPosition(childAngle, 285);
      const childStatus = unlockedIds.has(child.id) ? 'unlocked' : 'locked';
      nodes.push({
        id: child.id,
        name: child.name,
        description: child.description,
        category: root.category,
        parentId: root.id,
        level: 2,
        status: childStatus,
        x: childPos.x,
        y: childPos.y,
        requiredSkillPoints: 2,
        unlockedAt: childStatus !== 'locked' ? now - 86400000 * (10 - childIndex) : undefined,
        ...seedProgress(childStatus),
        lastImprovedAt: childStatus !== 'locked' ? now - 86400000 * (4 - (childIndex % 2)) : undefined,
      });

      const leaves = child.children ?? [];
      if (leaves.length === 0) return;

      const leafSpan = Math.max(42, leaves.length * 12);
      leaves.forEach((leaf, leafIndex) => {
        const leafAngle =
          leaves.length === 1
            ? childAngle
            : childAngle - leafSpan / 2 + (leafSpan / Math.max(leaves.length - 1, 1)) * leafIndex;
        const leafPos = polarPosition(leafAngle, 400);
        const leafStatus = enhancedIds.has(leaf.id)
          ? 'enhanced'
          : unlockedIds.has(leaf.id)
            ? 'unlocked'
            : 'locked';
        nodes.push({
          id: leaf.id,
          name: leaf.name,
          description: leaf.description,
          category: root.category,
          parentId: child.id,
          level: 3,
          status: leafStatus,
          x: leafPos.x,
          y: leafPos.y,
          requiredSkillPoints: 3,
          unlockedAt: leafStatus !== 'locked' ? now - 86400000 * (5 - (leafIndex % 3)) : undefined,
          ...seedProgress(leafStatus),
          lastImprovedAt: leafStatus !== 'locked' ? now - 86400000 * (2 - (leafIndex % 2)) : undefined,
        });
      });
    });
  });

  return nodes;
}

export const PRESET_SKILLS: ISkillNode[] = createCapabilityTree();

// ========== 预设商店商品 ==========
export const PRESET_SHOP_ITEMS: IShopItem[] = [
  {
    id: 'shop-coffee',
    name: '一杯精品咖啡',
    cost: 100,
    icon: '☕',
    color: 'from-amber-900/40 to-amber-700/20',
    description: '奖励自己一杯好喝的咖啡，享受悠闲时光。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-movie',
    name: '看一场电影',
    cost: 200,
    icon: '🎬',
    color: 'from-purple-900/40 to-purple-700/20',
    description: '去电影院看一场期待已久的电影。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-game',
    name: '买一款游戏',
    cost: 500,
    icon: '🎮',
    color: 'from-blue-900/40 to-blue-700/20',
    description: '入手一款心仪已久的游戏大作。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-book',
    name: '买一本好书',
    cost: 150,
    icon: '📚',
    color: 'from-green-900/40 to-green-700/20',
    description: '购买一本想读的书，投资自己的成长。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-travel',
    name: '短途旅行',
    cost: 1000,
    icon: '✈️',
    color: 'from-sky-900/40 to-sky-700/20',
    description: '来一场说走就走的短途旅行，放松身心。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-gadget',
    name: '数码小玩意',
    cost: 800,
    icon: '🔧',
    color: 'from-cyan-900/40 to-cyan-700/20',
    description: '买一个心仪的数码配件或小工具。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-rest',
    name: '躺平一天',
    cost: 300,
    icon: '🛌',
    color: 'from-indigo-900/40 to-indigo-700/20',
    description: '什么都不做，完全放松地休息一整天。',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'shop-food',
    name: '美食大餐',
    cost: 250,
    icon: '🍕',
    color: 'from-red-900/40 to-red-700/20',
    description: '去一家好吃的餐厅，饱餐一顿！',
    source: 'mock',
    createdAt: Date.now() - 86400000 * 30,
  },
];

// ========== 预设专注记录 ==========
export const PRESET_FOCUS_LOGS: IFocusLog[] = [
  {
    id: 'focus-1',
    taskId: 'epic-portfolio-2',
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    durationMinutes: 60,
    completedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'focus-2',
    taskId: 'daily-2',
    date: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    durationMinutes: 30,
    completedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'focus-3',
    taskId: 'daily-4',
    date: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    durationMinutes: 45,
    completedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'focus-4',
    taskId: 'epic-python-data',
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    durationMinutes: 90,
    completedAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'focus-5',
    taskId: 'daily-1',
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    durationMinutes: 15,
    completedAt: Date.now() - 86400000 * 4,
  },
];

// ========== 初始值 ==========
export const INITIAL_REPUTATION = 320;
export const INITIAL_SKILL_POINTS = 2;
export const PRESET_SKILL_POINTS = INITIAL_SKILL_POINTS;

export const DEFAULT_SETTINGS: IAppSettings = {
  appName: '悬赏任务公会',
  manaMax: 5,
  resetTime: '06:00',
  soundEnabled: true,
  floatingPosition: { x: 0, y: 0 },
  floatingOpacity: 1,
  floatingCollapseDelay: 3000,
  epicClearCoefficient: 1.0,
};

export const DEFAULT_MANA_CONFIG: IManaConfig = {
  maxAttentionTasks: 5,
  current: 0,
};
