# Quest Guild 项目长期记忆

## 技术栈与架构
- React+TS 前端 / `server/index.js`（Express 单文件 975 行 + better-sqlite3）/ Electron 桌面端。
- 本地 SQLite：`server/quest-guild.db`（WAL 模式）。备份放 `server/backups/<日期>-phaseN/`。
- 经济常量集中在 `server/constants.js`（单一可信源，Phase 0 抽出）。
- `/api/bootstrap` 仅当 `skills`/`tasks`/`shop_items` 表为空时才写（幂等）；**不**写 goals/projects，也不读 `src/data/preset.ts`。
- 云端：`../workspace-server`（独立仓库，已部署 life.hchch.tech）。Phase 2 同步以本地为准、last-write-wins。

## 已拍板决策（路线图 §6，2026-08-18 全部确认）
- **Phase 4 数值**：声望公式 `round(B×M + D)`；B={easy5,normal10,hard25,epic80}；M={低1.0,中1.2,高1.6,紧急2.0}；D=min(min,60)×0.1(≤+6)；技能点={easy0,normal0,hard1,epic3}（normal 走熟练度满10解锁）；防自灌。
- **Phase 3**：B 方案起步（数字框架 rank/段位），玩家等级留作可选增强。
- **AI 桥接**：**只解锁 `cap-creation-ai-basic`**（父节点 `cap-creation-ai` 保持 locked，符合用户决策）。
- **法力水晶**：改名「专注槽」（静态容量，语义诚实）。
- **Electron asar 只读**：随 Phase 5 做（db 迁 userData）；近期不发安装包则暂缓。

## 阶段状态（2026-08-18）
- ✅ **Phase 0**（地基）：完成。constants.js + 难度校验 + 本地公式统一 + NaN 杜绝。
- ✅ **Phase 5.5/5.6 本地种子（DB 侧）**：完成。健康分支 12 节点、AI basic 解锁、清垃圾项目、goals 加 milestone/milestoneDeadline 列 + 7 条、7 个项目种子（每目标 1 个）。
- ✅ **Phase 1**（streak 移植 + 完成庆祝）：完成。streak/今日声望为**前端纯函数**（`src/lib/streak.ts`，移植云端 workspace-server 算法、基于 completedAt 本地日期回退），接入 `useTasks` + `Topbar` 两状态块；完成庆祝为 `CelebrationLayer`（framer-motion confetti + 奖励卡牌翻面，监听 `completeTask` 派发的 `quest:celebrate` 事件，`Layout` 挂载）。
- ✅ **Phase 3B 等级数字框架**：完成。`src/lib/rank.ts`（基于总声望的 6 段位阈值表 computeRank，封顶传奇勇者），Topbar 加段位块（跟随 useShop.reputation，hover 显示距下一段位差）。不做升级曲线（决策 2 B）。
- ✅ **Phase 5.6 前端主链**：经核代码比路线图超前——项目进度自动汇总、主创建表单 goalId/projectId 关联+onSubmit 透传+projectOptions 联动**早已实现**；本轮补齐 IGoal 的 milestone/milestoneDeadline（修 Phase 5.5 列未同步前端类型债）、GoalsPage 目标汇总（项目数+任务进度条）+ deadline 逾期高亮 + 里程碑展示+表单维护。
- ✅ **决策4 法力水晶改名专注槽**：全局 7 文件 12 处文案改名（状态栏/设置/toast），内部变量 manaMax 等保留。
- ✅ **Phase 4 经济重构**：完成。importance 字段全链路（DB 列迁移 + type/api + 三处入口）；完成时用 `actualMinutes` + M 权重重算 `rewardReputation/rewardSkillPoints`（替换创建期估算值）；防自灌=每周软上限（cap=800，超出部分收益×50%）；normal 完成 +1 `meta.normal_proficiency`，满阈值解锁下一 locked 节点并重置（替代直接给技能点）。前端 `useTasks.calcReputation` 旧公式债务已清，改用 `src/lib/economy.ts` 镜像 `server/constants.js`。QuestPoolPage 主表单加「重要性」选择器、快加默认 medium。
- ✅ **代码审查优化**：ProjectsPage 进度重复 IIFE→抽 projectProgress useMemo；GoalsPage/ReflectionsPage 本地 formatDate/formatDateTime→统一 utils.ts 公共版（公共版改支持可选参数）；economy.ts 死导出 IMPORTANCE_LABELS 删除；useGoals.addGoal payload 改 Partial<IGoal> & {name}。
- ⏭️ **Phase 2/6**（B+ 同步）：含 P0-3 云端公式对齐（随同步落地）。
  - ✅ P0-3 公式/`/sync`/`stage`/`rewardSkillPoints` 已对齐。
  - ✅ 双向 LWW + 墓碑（`workspace_task_tombstones`）+ 快照对账删除（本地权威，杜绝复活）。
  - ✅ `importance`/`actualMinutes` 已进同步快照（2026-08-20 补齐，云端列+upsert+mapTask+前端映射）。
  - ✅ `tags`/`goalId`/`projectId` 已进同步（2026-08-20 补齐：云端 workspace_tasks 加 `goal_id`/`project_id`/`tags` 列 + upsert/mapTask，前端 QgTaskSnapshot/推送/双向合并全映射；`tags` 存 JSON 数组；修复"同步后丢关联"）。
  - ✅ workspace `public/index.html`「待办任务」排除 `source='qg'`，quest 任务只归「悬赏任务」专区，避免重复 + 删除残留。
- ⏭️ **Phase 7**（C 独立服务）：远期可选。

## 跨仓库架构关键点
- **workspace `workspace_tasks` 表**：quest 同步的任务存这里，`source='qg'` 标记。workspace 原生任务 `source=''`。POST 创建默认 `source=''`。GET `/api/tasks` 不带 source 过滤返回全量。
- **workspace 前端「日程统筹」**：两个列表——「待办任务」(过滤排除 qg) + 「悬赏任务」(source=qg 专区)。Overview 统计也排除 qg。
- **同步方向**：quest→cloud（全量快照 upsert）+ cloud→quest（回传 qg 全集 + 墓碑删除 id）。workspace 原生任务不进 quest。
- **AI 草稿箱（2026-08-20 落地）**：App 内「AI 拆解」走浏览器直连 LLM（`lib/aiClient.ts` + `lib/aiConfig.ts` 本地存 key），结果存独立键 `__quest_guild_ai_drafts`（`lib/aiDraft.ts` + `hooks/useAiDrafts.ts`）。草稿**仅本地、永不上云**（同步只读 `__quest_guild_tasks`）；用户「加入任务」才转正主任务库并 `markTaskDirty` 上云。草稿跨会话持久，不静默复活。
