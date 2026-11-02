# QuestGuild 需求再梳理 v2

> 版本：v2.3 ｜ 整理日期：2026-11-02 ｜ 状态：决策已锁定（**P0 已落地 ｜ P1 已完成 ｜ P2 已完成（2026-11-02）**）
> 关联文档：
> - 《QuestGuild 2.0 方案与阶段开发计划》
> - 《QuestGuild 2.0 史诗任务引导 阶段计划 v0.1》
> - 《quest-guild 史诗任务引导设计 头脑风暴》
> - 《quest-guild 数据上云 B+ 延迟同步》
> - 《quest-guild 游戏化评估》

---

## 0. 修订说明（v2 相对 v1 的核心变化）

v2 不是另起炉灶，而是把前几轮零散讨论里**已经拍板但散落在多份文档**的决议收敛成一份可落地的需求基线。相对 v1 / 2.0 阶段计划，关键变化如下：

| # | 主题 | v1 / 旧认知 | v2 决议 |
|---|------|------------|---------|
| 1 | 产品定位 | 「悬赏任务公会」游戏化待办 | **个人 AI 助理工作台 + 单一数据源**：任务系统是承载"做事"的底座，AI 拆解是入口，游戏化是可选激励层 |
| 2 | AI 拆解引擎 | quest 自带 `server/services/llm.js`（仅 name/difficulty/estimatedMinutes/stage） | **统一复用 workspace-server 的 `inbox-decompose` 成熟引擎**，quest 的 `decomposeRules.json` 退化为离线兜底 + 共享常量源；移除浏览器直连 LLM key |
| 3 | 第 1.4 维度命名 | "来源"（用户自述措辞） | 正式命名为 **`lifeDomain`（生活领域）**，值 work/parttime/growth/health，多选 |
| 4 | 第 8 维度 | 无 | 新增 **`executionContext`（执行情境）**：通勤 / 碎片时间 / 专注时段 / 低精力，服务 G2"现在能做什么" |
| 5 | 实际耗时采集 | 无可靠入口（创建期估算失真） | **完成即问·相对按钮**（准 / 慢一点 / 慢一倍 / 快很多），可跳过；AI 维护 `estimationProfile` 动态乘数 |
| 6 | 游戏化 | 声望/技能点/段位为主激励 | **弱化但保留数据层**：作为可选激励层，不再驱动核心流程；streak 保留 |
| 7 | 时间账 | 仅 completedAt 与 focus_logs | 新增**时间账聚合**：今日/本周/累计未完成预估分钟、按维度分布、DDL 倒排每日所需 |
| 8 | 路线节奏 | P0-P7 一次到位 | 收敛为 **P0（数据地基）→ P1（AI 统一+采集）→ P2（时间账+提醒）→ P3/P4（深化）** 渐进式 |

---

## 1. 产品愿景与定位

### 1.1 一句话定位
**QuestGuild 是个人做事的"单一数据源"与 AI 驱动的分解执行台**：把目标、项目、任务、子任务统一收口在一个结构化系统里，由 AI 负责把模糊的"想做的事"拆成可执行的"待做的事"，并围绕"现在该做什么、要花多久、什么时候必须完成"提供决策支持。

### 1.2 与 v1 游戏化定位的关系
- **游戏化不是目的，是糖衣**。声望、技能点、段位、专注槽等保留为数据层与可选激励，**不参与核心路径的强制门槛**（例如不再"必须先解锁才能接任务"）。
- streak（连续完成天数）作为温和正反馈保留。
- 这一调整让产品对"严肃做事"场景也成立，而不只服务于 gamified 用户。

### 1.3 技术形态（现状基线，来自代码确认）
- 前端：React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Radix + echarts + framer-motion。
- 本地存储：**localStorage 为主存储**（`useTasks` 等 hook 直读直写），后端与云端均为镜像。
- 桌面端：Electron（`.cjs` 主进程 + `renderer/` 构建产物，独立 `node server/index.js` 进程）。
- 云端同步：workspace-server，Bearer `API_TOKEN` 鉴权（前端 `VITE_SYNC_TOKEN` / `VITE_SYNC_URL`，默认 `https://life.hchch.tech`）。
- 后端服务：`server/index.js`（Express + better-sqlite3，WAL 模式，独立 SQLite 库，P0-3 起作为 localStorage 的可选持久层）。

---

## 2. 四个目标 → 功能映射

用户的核心诉求可归纳为四个"看得清"，每个对应一组功能：

### G1 · 看清"我在做什么 / 为什么做"
- 目标（Goal）→ 项目（Project）→ 任务（Task）→ 子任务（Subtask）四级链路，每级可关联上层。
- 目标含 `milestone`（里程碑）与 `milestoneDeadline`（里程碑截止），项目自动汇总进度。
- 能力树（SkillTree）映射到任务，回答"做这个事在练什么"。

### G2 · 看清"现在能做什么 / 怎么做 / 怎么拆"
- **AI 拆解入口**：把一个模糊的大任务（史诗）拆成带维度标签的子任务草稿，可编辑后转正。
- **执行情境（`executionContext`）筛选**：按"通勤 / 碎片时间 / 专注时段 / 低精力"推荐当下可做的任务。
- **推荐卡**：Today 页基于情境 + 重要性 + DDL 推荐。
- **上下文继承（inheritContext）**：子任务自动继承父任务的维度标签，避免重复填写。

### G3 · 看清"未来何时做 / 要花多久"
- **预估耗时 + 实际耗时双轨**：创建时估（AI 或用户），完成时问（相对按钮）。
- **`estimationProfile`**：AI 按 contentType × difficulty 维护乘数（初值 1.0），用稀疏反馈滚动校正预估。
- **DDL 倒排**：根据 deadline 与剩余预估分钟，倒推"每天至少需要做多少"。

### G4 · 截止提醒不漏接
- 任务级 `deadline` + `reminderAt`。
- 目标级 `milestoneDeadline` 高亮。
- 本地提醒（Electron 通知 / 浏览器 Notification）+ 逾期高亮。

---

## 3. 七维 + 一维 全量分类体系

每个任务（含子任务）同时携带以下维度。维度是**结构化字段**，AI 拆解时一次性填充，降低人工录入成本。

| 维度 | 字段名 | 取值 | 说明 |
|------|--------|------|------|
| 1.1 重要性 | `importance` | low / medium / high / urgent | 已落地（P4-1）。驱动排序与推荐权重 |
| 1.2 难度 | `difficulty` | easy / normal / hard / epic | 驱动声望/技能点公式与预估基准 |
| 1.3 耗时 | `estimatedMinutes` / `actualMinutes` | number（分钟） | 创建估 + 完成问；时间账基础 |
| 1.4 生活领域 | `lifeDomain` | work / parttime / growth / health（**多选**） | **v2 重命名**（原"来源"）。回答"这件事属于我生活的哪一块"。✅ 决策：默认 4 类固定，但设计为**种子 + 可扩展**枚举（用户可在设置页追加自定义标签，见 §11.2）；暂不加默认项 |
| 1.5 内容性质 | `contentType` | 见 3.1 | 回答"这是什么类型的事"，供 `estimationProfile` 与时间账分布用 |
| 1.6 周期 | `recurrence` | none / daily / weekly / monthly / custom | 复用 workspace 的 recurrenceType 语义 |
| 1.7 能力 | `capabilityIds` | string[] | 关联能力树节点，回答"练什么" |
| 1.8 执行情境 | `executionContext` | commute / snippet / focus / lowEnergy（**多选**） | **v2 新增第 8 维**。服务 G2"现在能做什么"。✅ 决策：允许**多选**（一个任务可同时适合碎片时间 + 通勤） |

### 3.1 `contentType` 候选取值（✅ 决策锁定：采用以下 8 类，不再增删）
- `coding`（写代码 / 调试）
- `writing`（写作 / 文档）
- `research`（调研 / 阅读）
- `communication`（沟通 / 会议 / 回复）
- `design`（设计 / 画图）
- `mechanical`（机械性操作 / 整理）
- `learning`（学习 / 练习）
- `errand`（跑腿 / 生活事务）

> `estimationProfile` 以 `(contentType, difficulty) → multiplier` 为键。例如 `coding×hard` 可能天然 ×1.3（隐性调试成本高），`mechanical×easy` 可能 ×0.9。

### 3.2 维度与 AI 拆解的关系
AI 拆解（统一到 workspace-server 后）一次性产出上述 8 维 + kind（task/decision）+ nextAction + dependsOn + parentTitle + dueDate/reviewDate + 阶段（stage）。quest 侧只消费与自身模型相关的字段，其余（decision/recurrence 等）映射到对应字段或忽略。

### 3.3 维度枚举的"单一可信源"约定（✅ 决策）
- `contentType` / `lifeDomain`（默认值）/ `executionContext` 的**取值清单与 difficulty×time 对齐表**统一维护在 `src/data/decomposeRules.json`（含 `dimensionVocab` 段）。
- 该 JSON 既是人类可编辑的配置，也是 AI system prompt 的拼装原料（详见 §11）。
- 旧 `type: 'epic'|'daily'`：**保留字段，过渡期不限时长**，新任务按"角色 + 维度"推导，旧数据不动；后续是否彻底弃用待 P3 深化分解时再定（当前无明确方案）。

---

## 4. 数据模型（目标 → 项目 → 任务 → 子任务）

```
Goal (目标)
 ├─ milestone / milestoneDeadline
 └─ Project (项目)            // 1 目标可含多项目
      └─ Task (任务/史诗)     // parentId=null 即顶层任务
           ├─ dimension fields (7+1)
           └─ Task (子任务)    // parentId = 父任务 id，最小执行单元
```

- **最小执行单元 = 子任务**（叶子）。父任务（史诗/项目级）本身是容器，不直接计入"今日可做"。
- 既有 `type: 'epic' | 'daily'` 在 P0 后逐步由"角色 + 维度字段"取代：
  - `epic` → 作为"含子任务的容器"，新增 `isLeaf=false` 概念；
  - `daily` → 由 `recurrence: daily` 表达，不再单列 type。
  - *兼容策略*：`type` 字段保留一个过渡期，新任务默认按角色推导，旧数据不动。

### 4.1 IQuestTask 目标形态（P0 后）
在现有字段基础上**增量新增**（不破坏既有）：
- `lifeDomain?: LifeDomain[]`
- `contentType?: ContentType`
- `executionContext?: ExecutionContext[]`
- `howToHint?: string`            // AI 给的"怎么做"提示（nextAction 落点）
- `startDate?: number`            // 计划开始
- `deadline?: number`             // 截止
- `recurrence?: IRecurrenceRule`  // 周期规则
- `reminderAt?: number`           // 提醒时间戳
- 既有 `parentId / stage / status / importance / difficulty / estimatedMinutes / actualMinutes` 保留。

### 4.2 IAppSettings 新增
- `estimationProfile?: Record<string, number>`  // key=`${contentType}:${difficulty}` → 乘数，初值 1.0

---

## 5. AI 拆解引擎统一（核心架构决议）

### 5.1 为什么统一到 workspace-server
- workspace-server 的 `inbox-decompose.cjs` 已是**成熟引擎**：normalizeTask 清洗、kind（task/decision）、nextAction、recurrenceType、dependsOn、parentTitle、dueDate/reviewDate、extractJson 三层兜底。
- quest 自带 `server/services/llm.js` 仅产出 name/difficulty/estimatedMinutes/stage，**能力残缺**。
- 统一后**浏览器不再直连 LLM key**（密钥只存 workspace-server 服务端），顺带缓解"安装包可提取前端 token"的既有设计债（见 S1 待办）。

### 5.2 目标架构
```
前端 aiClient.ts
  ├─ 优先: POST {VITE_SYNC_URL}/api/ai/decompose   (Bearer VITE_SYNC_TOKEN)
  │         ↑ workspace-server routes/ai.cjs → inbox-decompose 引擎 + quest 维度 schema
  └─ 兜底: 浏览器直连 LLM (loadAiConfig)  —— 仅当未配置云端同步时
```
- 新增 workspace-server 路由 `POST /api/ai/decompose`，合并双方 prompt 优势：
  - workspace 的 nextAction / kind / recurrenceType / dependsOn / parentTitle；
  - quest 的 importance / lifeDomain / contentType / executionContext / difficulty×time 对齐 / stage 分组。
- quest 的 `src/data/decomposeRules.json` 升级为**统一 7+1 维度 schema**，作为离线兜底与共享常量源，与服务端规则同源（避免三处分叉）。

### 5.3 输出契约
返回 `IAiSubtaskDraft[]`，每个草稿带全 8 维 + stage + howToHint；用户在 UI 中编辑后"加入任务"转正（`markTaskDirty` 上云）。

---

## 6. 实际耗时采集 + 动态预估

### 6.1 完成即问（Completion-Ask）
- 触发：`completeTask` 成功后派发 `quest:ask-feedback` 事件。
- UI：`CompletionFeedbackModal` 弹相对按钮 —— **准 / 慢一点 / 慢一倍 / 快很多**，可"跳过"。
- 不直接要绝对分钟数（用户记不准），用相对偏差反推：
  - 准 → ×1.0
  - 慢一点 → ×1.3
  - 慢一倍 → ×2.0
  - 快很多 → ×0.6
- 写入 `estimationProfile[contentType:difficulty]`，采用**稀疏滚动平均**（样本少时贴近 1.0，样本多时向实测收敛）。

### 6.2 estimationProfile 作用
- 下次 AI 拆解 / 用户创建同类任务时，`estimatedMinutes` 基准 × 该乘数，减少系统性乐观偏差。
- 设置页可查看/重置_profile。

---

## 7. 时间账（Time Accounting）

纯函数层 `src/lib/timeAccount.ts` + 面板 `TimeAccountPanel`：

- **今日未完成预估分钟** = Σ(未完成子任务的 estimatedMinutes，按维度过滤可选)。
- **本周未完成预估分钟**（含 DDL 在本周内的）。
- **累计未完成预估分钟**（全部未完成任务）。
- **按维度分布**：按 lifeDomain / contentType / difficulty / executionContext 拆分饼/柱图。
- **DDL 倒排**：给定 `deadline` 与剩余预估分钟，按"距今天数"平摊 → "每天至少需做 X 分钟"，逾期则标红。

挂载位置：Today 页 header 下方（P0-G）。

---

## 8. 游戏化（弱化但保留数据层）

| 元素 | 状态 | 说明 |
|------|------|------|
| 声望 reputation | 保留 | 完成结算仍发，作为长期成就度量 |
| 技能点 skillPoints | 保留 | 关联能力树解锁/强化 |
| 段位 rank | 保留（Phase 3B 已落地） | 基于总声望的 6 段位，纯展示 |
| 专注槽 mana | 保留 | 静态容量，语义诚实 |
| streak | 保留 | 连续完成天数，温和正反馈 |
| 商店 shop | 保留 | 可选激励，不与核心路径耦合 |

**原则**：游戏化元素可作为"锦上添花"展示，但**不得成为做事的前提门槛**。

---

## 9. 路线图（收敛版 P0–P4）

### P0 · 数据地基（本次启动） ✅ 已完成（2026-11-02）
- [x] P0-C 任务模型新增多维字段（lifeDomain / contentType / executionContext / howToHint / startDate / deadline / recurrence / reminderAt）+ IRecurrenceRule 类型
- [x] P0-D 升级 decomposeRules.json 至 7+1 维度 schema
- [x] P0-E 统一 AI 拆解到 workspace-server（routes/ai.cjs + 前端优先云端）
- [x] P0-F 完成即问耗时采集 + estimationProfile
- [x] P0-G 时间账聚合 + 面板
- [x] 类型检查与构建验证

### P1 · AI 体验打磨 ✅ 已完成（2026-11-02）
- [x] P1-A 草稿转正映射全维度（startDate/reminderAt 进草稿 + 转正；parent 上下文填空）
- [x] P1-B 情境筛选推荐（Today 页 executionContext 多选筛选 + 推荐卡复用）
- [x] P1-C estimationProfile 乘数回归应用（AI 拆解预估 × 动态乘数，aiClient.ts）
- [x] P1-D inheritContext 上下文继承强化（向下传递 lifeDomain/contentType/executionContext）
- [x] P1-E 过大预警徽章（>120min：AiDraftPanel Badge + ProjectsPage 表单提示）
- [x] 验证：typecheck + build + contextInherit 单测（4 项通过）
> 注：① estimationProfile 乘数回归（原 §11.4 建议提前到 P1）**已在 P1-C 完成**。

### P2 · 时间账与提醒 ✅ 已完成（2026-11-02）
> 用户就 §12 决策：12.1 确认无安全风险、采用 **A 客户端权威**；12.2–12.8 全部「按你做法」批准推荐方案。含三部分：(A) P0-E 遗留债修复；(B) ② 新维度云端真正落库；(C) 提醒与时间账深化。
- **A. P0-E 债修复（参数同源）** ✅
  - [x] A1 客户端权威：前端 `aiClient.ts` 把 `dimensionVocab`（默认种子 + `customLifeDomains` 合并去重）与 `difficultyTimeMatrix` 放进 `/api/ai/decompose` 请求体；云端 `routes/ai.cjs` 改为以请求携带 schema 为准，并做**服务端校验门**（白名单键、数组值、单值 ≤32 字符、总值 ≤50、非法即回退内置 `DEFAULT_VOCAB`）。`IAppSettings.customLifeDomains?: string[]` 已新增。改 JSON / 加自定义领域**无需重部署服务端**。
  - [x] A2 难度×耗时对齐表从 `systemPrompt` 抽离为 `constraints.difficultyTimeMatrix: {easy:25,normal:45,hard:75,epic:100}`，与 §11.1 单一可信源原则一致。
- **B. ② 新 7+1 维度云端真正落库** ✅（P2「上云」本体）
  - [x] B1 `workspace-server/server/db.cjs` `migrateWorkspaceTasksForQuestSync()` 内 `ensureColumn` 加 8 列：life_domain / content_type / execution_context / how_to_hint / start_date / deadline / reminder_at（标量）/ recurrence（JSON 文本）。烟雾测试确认迁移后 41 列、8 列齐全。
  - [x] B2 `routes/tasks.cjs` `upsert` 写入 8 列 + `mapTask` 落库还原（含 `parseJsonArray` / `parseJsonObj` 兜底 `{type:'none'}`）。`QgTaskSnapshot` 与 `mergeRemoteTasks` 此前已透传，quest 侧**无需改动**。往返落库已烟雾测试通过。
- **C. 提醒与时间账深化** ✅
  - [x] C1 DDL 倒排每日所需：Today 页 header 下新增 `ddlReverse` 横幅（按距截止天数 ≤1 红 / ≤3 黄 / 其余蓝），显示「每天至少投入 X 分钟」。
  - [x] C2 本地提醒引擎：`useReminderWatcher`（渲染进程轮询 60s + Notification API，`reminderAt ≤ now` 弹系统通知，已通知 id 存 localStorage 防重复去重），`App.tsx` 挂载。
  - [x] C3 目标里程碑高亮：GoalsPage 按 `milestoneStatus` 逾期（⚠ 已逾期，红）/ 临近 ≤3 天（黄）/ 正常（蓝）切换 Badge。
  - [x] C4 周期任务续生：`useTasks.completeTask` 内 `generateRecurrenceNext` 单代续生 daily（明天）/ weekly（下周同日）任务，继承全维度字段并重算声望/技能点，防递归失控。
- **安全结论（12.1）**：个人自用单用户场景风险低；服务端 vocab 校验门已阻断 prompt 注入 / 体积膨胀（白名单 + 长度封顶 + 结构校验 + 非法 400 回退），vocab 仅为数据、永不被 eval，无代码执行面。采用 A 客户端权威 + 服务端校验 + 内置兜底。

### P3 · 深化分解体系
- 目标→里程碑→项目→史诗→阶段→叶子 全链路引导。
- 史诗通关奖励结算（epicClearCoefficient 已落地，需接 UI）。

### P4 · 可选增强
- 玩家等级（可选，非必需）；更多图表；跨设备时间账对齐。

---

## 10. 待拍板 / 开放问题（✅ 2026-11-02 全部决策锁定）

| # | 问题 | 决策 |
|---|------|------|
| 1 | `contentType` 是否采用 §3.1 的 8 类？ | ✅ **采用 8 类，不再增删**（coding/writing/research/communication/design/mechanical/learning/errand） |
| 2 | `lifeDomain` 固定还是可自定义？ | ✅ **默认 4 类（work/parttime/growth/health）固定，设计为种子 + 可扩展**；用户可在设置页追加自定义标签（扩展机制见 §11.2，实现放 P1/P2）。暂不在默认值里加项 |
| 3 | `executionContext` 多选还是单选？ | ✅ **多选**（一个任务可同时适合「碎片时间 + 通勤」） |
| 4 | `recurrence` 自动续生放哪？ | ✅ **仅存字段（P0 已落），自动续生日/周放到 P2** |
| 5 | 旧 `type: 'epic'|'daily'` 兼容期？ | ✅ **保留字段，过渡期不限时长**；新任务按「角色 + 维度」推导，旧数据不动；彻底弃用方案待 P3 深化分解时再定 |

---

## 11. 参数维护与传递给 AI 的机制（✅ 设计锁定）

用户诉求："这些参数（维度枚举、难度×耗时对齐、拆解规则）我想能改，但平时不会经常改。" 据此设计如下。

### 11.1 单一可信源：`decomposeRules.json`
- 所有"喂给 AI 的静态参数"集中维护在 `quest-guild/src/data/decomposeRules.json`（P0-D 已落地），结构现状：
  ```json
  {
    "schemaVersion": "7+1",
    "systemPrompt": "... 7+1 维度 schema 指令 + 难度×耗时对齐（easy≈25/normal≈45/hard≈75/epic≈100）...",
    "constraints": {
      "minMinutes": 20, "maxMinutes": 120, "subtaskCountMin": 3, "subtaskCountMax": 8,
      "defaultDifficulty": "normal",
      "dimensionVocab": {                              // ✅ 维度枚举单一可信源
        "importance":    ["low","medium","high","urgent"],
        "difficulty":    ["easy","normal","hard","epic"],
        "lifeDomain":    ["work","parttime","growth","health"],   // 默认种子，可扩展
        "contentType":   ["coding","writing","research","communication","design","mechanical","learning","errand"],
        "executionContext": ["commute","snippet","focus","lowEnergy"],
        "recurrenceType": ["none","daily","weekly","monthly","custom"]
      }
    }
  }
  ```
- 该文件**人类可编辑**（改 JSON 即可调整维度枚举/对齐表/规则），同时被代码消费：浏览器回退路径 `aiClient.ts` 与（未来的）云端 prompt 拼装都应以它为准。
- 注：难度×耗时对齐表目前**内联在 `systemPrompt` 文本**里；P2 上云时可顺手抽成 `constraints.difficultyTimeMatrix` 独立字段，让"改对齐基准"也只动 JSON（可选优化，非必需）。

### 11.2 `lifeDomain` 可扩展机制
- 默认种子 = work/parttime/growth/health（见 11.1）。
- 用户可在**设置页**追加自定义 lifeDomain 标签（存 `IAppSettings.customLifeDomains?: string[]`）；AI 拆解时把"默认 + 自定义"合并进 prompt 的 `dimensionVocab.lifeDomain`。
- **建议候选（暂不加为默认，待用户需要时自行加）**：`family`（家庭/关系）、`leisure`（休闲/爱好，如拼高达）、`chores`（家务/生活）、`finance`（财务，注意与 ledgerBook 职责重叠需谨慎）、`community`（社群/公益）、`spirit`（心灵/精神）。
- 实现时机：P1/P2 的设置页扩展。

### 11.3 参数如何传递给 AI（两条路径，同源）
- **云端路径（默认）**：前端 `aiClient.ts` 调 `POST {VITE_SYNC_URL}/api/ai/decompose`。
  - ⚠️ **当前债（P0-E 遗留）**：`workspace-server/server/routes/ai.cjs` 的 system prompt 是**内联写死**的，与 `decomposeRules.json` 分叉。
  - **修复方案（放 P2 上云时一并做）**：让 `ai.cjs` 启动时读取一份与 `decomposeRules.json` 同源的 schema（两份文件保持同步，或在部署脚本里从 quest-guild 复制过去）；或更进一步——前端把当前 `dimensionVocab` 作为请求体的一部分发过去，云端以"请求携带的 schema"为准（客户端权威，改 JSON 无需重新部署服务端）。自用场景推荐后者。
- **浏览器回退路径**：未配置云端同步时，`aiClient.ts` 直接读 `decomposeRules.json` 拼 prompt 直连 LLM。

### 11.4 三个延后项 vs P2「上云」澄清
用户问："① 乘数回归 ② 新维度云端落库 ③ S1 受限 token，能否确认没问题后在 P2 一并上云？"

| 项 | 性质 | 是否进 P2 | 说明 |
|----|------|-----------|------|
| ① `estimationProfile` 乘数回归应用 | 前端逻辑（AI 预估/创建预估读取乘数） | 可随 P2 一并做，也可更早（P1） | 不依赖云端落库，纯前端闭环；建议 P1 就吃上，让 AI 越早越准 |
| ② 新 7+1 维度在 workspace-server 真正落库 | 云端 schema 变更 | ✅ **就是 P2「上云」的核心项** | 当前 `QgTaskSnapshot` 已携带 8 字段透传，但 workspace `workspace_tasks` 表**无对应列**会被丢弃；P2 需 ALTER 加列 + upsert 写入 + mapTask 落库 |
| ③ S1 前端专用受限 token | 安全（外发前才需） | ❌ **不进 P2** | 触发条件是「外发安装包/共享给他人」；当前仅自用，保持延后。P2 上云不等于要发安装包 |

> 结论：**② 是 P2 上云的本体**；① 建议提前到 P1；③ 维持「外发才做」的延后判断，不与 P2 强绑定。

---

## 12. P2 待用户决策清单（✅ 已拍板并落地，2026-11-02）

> 用户指令："到 P2 时输出需要我决策的项，我再判断后再继续。" 用户回复：**12.1 确认无安全风险（采用 A 客户端权威）；12.2–12.8 全部「按你做法」批准推荐方案。** 均已实现，详见 §9 P2 段。

**决策决议汇总：**
| 项 | 决策 | 落地 |
|----|------|------|
| 12.1 参数同源方式 | A 客户端权威（前端带 schema，服务端校验 + 内置兜底） | ✅ A1 + 服务端 vocab/matrix 校验门 |
| 12.2 对齐表抽离 | 做（A2） | ✅ `difficultyTimeMatrix` 独立字段 |
| 12.3 新维度落库 | JSON 文本列（recurrence/executionContext）+ 标量列 | ✅ B1/B2 |
| 12.4 DDL 通知形态 | C 站内提示（DDL 倒排横幅） | ✅ C1 |
| 12.5 Electron 提醒 | A 渲染进程轮询 + Notification API | ✅ C2 `useReminderWatcher` |
| 12.6 里程碑高亮 | 逾期标红 + 临近 3 天黄，GoalsPage | ✅ C3 |
| 12.7 周期续生 | 完成时单代续生 daily/weekly，继承维度，不递归 | ✅ C4 |
| 12.8 范围边界 | ③ S1 不做；① 已在 P1-C；lifeDomain 自定义并入 A1 | ✅ 边界已守 |

### 12.1 参数同源修复方式（A1）
- **背景**：`workspace-server/routes/ai.cjs` 的 system prompt 内联写死，与 `decomposeRules.json` 已分叉。
- **选项 A（⭐ 推荐）「客户端权威」**：前端把当前 `dimensionVocab`（默认种子 + 用户自定义 lifeDomain）作为请求体字段发给云端，`ai.cjs` 以请求携带的 schema 为准。改 JSON / 加自定义领域**无需重新部署服务端**。
- **选项 B「服务端同源文件」**：部署时把 `decomposeRules.json` 复制到 workspace-server，`ai.cjs` 启动时读取。简单但改枚举需重新部署。
- **需决策**：选 A 还是 B？（直接影响 A1 实现与后续"我想改参数但不常改"的体验。）

### 12.2 难度×耗时对齐表抽离（A2）
- **背景**：`easy≈25 / normal≈45 / hard≈75 / epic≈100` 目前内联在 `systemPrompt` 文本里。
- **选项 A（⭐ 推荐）「顺手抽成 `constraints.difficultyTimeMatrix`」**：让"改对齐基准"也只动 JSON，与 §11.1 单一可信源原则一致。
- **选项 B「维持内联」**：不动，省事。
- **需决策**：要不要做 A2？（非阻塞，可并入 A1 一起。）

### 12.3 新维度云端落库范围（B1/B2 —— ② 本体）
- **背景**：`QgTaskSnapshot` 已携带 8 字段透传，但 workspace `workspace_tasks` **无对应列**，同步后字段被丢弃。
- **必须做**：在 cloud `workspace_tasks` ALTER 加列并让 upsert / `mapTask` 落库。这是 P2「上云」的核心。
- **需决策（细节）**：
  1. **JSON 字段存储**：`recurrence`（IRecurrenceRule）与 `executionContext`（多选数组）存为 **JSON 文本列**还是拆多列？（⭐ 推荐 JSON 文本列，与 quest 侧 `rowToTask/taskToRow` 一致，降低迁移成本。）
  2. **是否同时清理 quest 侧多余透传字段**：当前 `QgTaskSnapshot` 已含这些字段，仅需云端接住；quest 侧**无需改动**。确认无异议即可。
  3. **双向同步字段映射**：续生任务、草稿转正后的字段是否要进同步快照 —— 确认现有 `markTaskDirty` 链路已覆盖（P2 仅保证云端**不丢**，不新增字段）。

### 12.4 DDL 倒排通知形态（C1）
- **背景**：`timeAccount.ts` 已有 DDL 倒排纯函数（"距截止 N 天，每天至少需做 X 分钟"）。
- **选项 A（⭐ 推荐）「Toast / 站内提示」**：Today 页/应用内每日推送"今日建议投入 X 分钟"，无系统级打扰。
- **选项 B「系统通知」**：Electron Notification + 浏览器 Notification，按 `reminderAt` 触发。
- **选项 C「两者结合」**：DDL 压力用站内提示，到点用系统通知。
- **需决策**：C1 用 A / B / C？（影响是否要 C2 Electron 调度先行。）

### 12.5 Electron 本地提醒机制（C2）
- **背景**：任务级 `reminderAt` 已存字段，但**无触发引擎**（Electron 未调度通知）。
- **选项 A（⭐ 推荐，自用优先）「渲染进程轮询 + Notification API」**：主进程启动后渲染进程定时检查 `reminderAt ≤ now` 的任务并弹系统通知；Electron/浏览器均可，零原生模块。
- **选项 B「主进程定时器」**：main.cjs 内 `setInterval` 直接弹，关窗口也提醒，但要常驻主进程读库（当前 SQLite 在独立 server 进程，跨进程读取成本高）。
- **需决策**：C2 机制选 A / B？以及 C1 的通知是否复用同一引擎？

### 12.6 目标里程碑高亮（C3）
- **背景**：`IGoal` 已有 `milestone` / `milestoneDeadline`（P5.5 落地）。
- **需决策（细节）**：
  1. **高亮触发**：仅 `milestoneDeadline` 逾期标红，还是临近（如 ≤3 天）也渐变预警？（⭐ 推荐逾期标红 + 临近 3 天黄色。）
  2. **展示位置**：GoalsPage 目标卡片（⭐）+ Today 页"近期里程碑"小组（可选）。

### 12.7 周期任务自动续生（C4）
- **背景**：`recurrence: daily/weekly/monthly/custom` 字段已存，但完成时**不自动续生**新任务。
- **需决策（细节）**：
  1. **触发时机**：父任务完成时生成下一周期子任务（⭐ 推荐），还是按日历定时批量续生？
  2. **续生规则**：`daily` 续生"明天"的任务并继承父维度；`weekly` 续生"下一周同日"。续生**最多链几代**防失控？（⭐ 推荐单代续生，即只生下一代、不递归。）
  3. **防重复**：用 `recurrence` + 上次生成日期做幂等，避免重复生成（已有 `markTaskDirty`/updatedAt 基础）。
  4. **`custom` 怎么表达**：放 P2 简版（仅 daily/weekly），custom 留 P3 或保持 manual？

### 12.8 范围边界确认
- **③ S1 前端专用受限 token**：确认 **P2 不做**（仅自用，外发才做）。已写入 §11.4。
- **① estimationProfile 乘数回归**：确认 **已在 P1-C 完成**，不占 P2 工作量。
- **lifeDomain 自定义扩展（§11.2）**：设置页追加自定义领域的 UI，是否纳入 P2 还是单独小 PR？（⭐ 推荐并入 P2-A1 客户端权威方案一起做，因为 A1 已要传自定义领域给云端。）

> 决策收集方式：用户逐条回复（可只回"默认/⭐"），我据此一次性推进 P2 全量实现。

---

## 附录 A · 术语表
- **AI 拆解草稿（AiSubtaskDraft）**：AI 产出、未转正的可编辑子任务。
- **转正**：草稿经用户确认后写入主任务库并标记上云。
- **单一数据源**：localStorage 为前端真值，云端/后端为镜像，同步采用 B+ 全量快照 + LWW。
- **LWW（Last-Write-Wins）**：按 updatedAt 比较的冲突解决策略，已落地双向同步。
- **estimationProfile**：AI 维护的"预估校正乘数表"。

## 附录 B · 关联代码锚点（现状）
- 任务类型：`src/types/quest.ts` → `IQuestTask`
- 主存储：`src/hooks/useTasks.ts`
- AI 客户端：`src/lib/aiClient.ts`（当前直连 LLM，P0-E 改为优先云端）
- 拆解规则：`src/data/decomposeRules.json`
- 后端：`server/index.js`（Express + better-sqlite3）
- 云端引擎：`../workspace-server/server/inbox-decompose.cjs`
- 同步：`src/api/sync/{index,state,target}.ts`
