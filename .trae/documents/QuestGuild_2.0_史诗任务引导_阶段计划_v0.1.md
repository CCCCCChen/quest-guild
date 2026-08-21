# 悬赏任务公会 Quest Guild 2.0 · 史诗任务引导体系 · 阶段计划 v0.1

> 定位：基于「史诗任务引导设计头脑风暴稿」+ 现状代码核查输出的**执行蓝图 v0.1**。  
> 本计划与 `.trae/documents/QuestGuild_2.0_方案与阶段开发计划.md` 互补：  
> - 上文：定 2.0 架构方向（Electron 优先 + server/SQLite 主干）与 P0/P1 阻塞缺口；  
> - 本文：定**引导链路**（Goal→Project→Epic→子任务→能力→进度反馈）的落地批次、验收标准、以及**专家咨询结果标准化导入/导出闭环**。  
> 状态：**蓝图稿，待你拍板后进入实施**。  
> 修订：2026-08-21 据 SeniorDeveloper 评审修订（v0.1 → 含 3 处过时假设修正 + §6 标独立排期 + 与 Part 1 同步工作脱节补充 + 2 处逻辑微调）。

---

## 背景：workspace ↔ quest 数据打通现状与约束（Part 1 已落地，本计划须遵守）

> 本计划动手前，quest-guide 与 workspace-server 之间已通过「Part 1 数据打通」完成第一层集成（详见本次会话实施，仓库提交 `6ea0fce`）。**后续所有 Phase 凡触及 workspace 边界的改动，均不得破坏下列已生效规则**——这条边界是后续「双端互通 / 只读展示 / 声望权威」的总前提。

### 已实现：两端集成现状
- **每日悬赏（daily）= 双端互通**：quest 桌面端 与 workspace 网页端 任意一端均可新建 / 编辑 / 完成 / 删除，靠双向 LWW 同步（按 `updatedAt` 做 last-write-wins，云端用 `julianday` 比较）。
- **史诗任务（epic）+ 子任务 = workspace 只读**：workspace 端不可勾选完成 / 编辑 / 删除，归属 quest 管；云端 `PUT/DELETE` 对 `source='qg'` 的 epic 返回 403。
- **声望结算权威永远在 quest 端**：workspace 端只翻任务状态（写 `completed_date`），**不计算、不存储权威声望**；quest 合并云端数据时检测「云端完成」转换 → 本地补跑结算管线（声望 / 技能点 / 能力经验），再把权威值推回云端。
- **云端数据守卫**：`workspace_tasks` 新增 `origin` 列（`'quest'` 出生桌面端 / `'cloud'` 出生网页端）；双向同步的「差额删除」只删 `origin='quest'` 的行（cloud 新生任务在 quest 首次拉取前不会被误删）；删除走墓碑（`workspace_task_tombstones`），本地下次同步感知删除、杜绝复活。
- **workspace 展示分层**：Guild 模块拆为「每日悬赏（可交互：勾选完成 / 编辑 / 删除 / 新建）」+「史诗远征（只读看板：按阶段分组展示待办子任务 = 用户说的『告诉自己要做的事』）」。

### 本计划须遵守的硬约束
1. **史诗在 workspace 永不可写**：B1/B2/B3/B4/2.1/2.2 等任务分解与里程碑能力仅作用于 quest 端 epic；workspace 端 epic 保持只读看板，任何 Phase 不得给 workspace 加 epic 的编辑 / 完成入口。
2. **声望 / 技能点结算只发生在 quest**：任何 Phase 不得在 workspace 端计算或落库权威奖励；云端完成任务只翻状态，结算回灌由 quest 合并管线负责（已实现，见 `src/hooks/useTasks.ts` 的云端完成结算 pass）。
3. **云端新建的 daily（origin='cloud'）是「被收养」角色**：3.4 的 AI 属性补全发生在 quest 收养之后、以「建议」呈现；补全结果须经 LWW 安全写回（quest 推回的 `updatedAt` 必须晚于云端创建时间），不能被云端旧快照冲掉。
4. **同步字段已含核心关联属性**：`goalId` / `projectId` / `tags` / `importance` / `actualMinutes` 均已进同步快照；本计划新增的里程碑、阶段、能力关联等字段若要跨端可见，须同步扩展同步映射（见各 Phase 备注），否则 workspace 端会断链。
5. **远征地图（4.1）是 workspace 只读看板的增强版，不是从零**：复用 Part 1 已落地的只读数据结构，桌面端补交互与可视化，不重复造 workspace 的 epic 展示层。

### 受影响的本计划子项
- **3.4 云端新建任务收养后 AI 属性补全** → 遵守约束 3（建议呈现 + LWW 安全写回）。
- **4.1 远征地图** → 遵守约束 5（增强而非从零）。
- **B2 / B4 AI 上下文注入与分层拆解** → 仅作用于 quest 端 epic（约束 1），workspace 不参与深度拆解。
- **2.1 里程碑 / 2.2 下一步行动** → 在 workspace 看板展示「当前阶段待办」属只读消费（Part 1 已做），不违反约束；但若要把里程碑 / 阶段写回 workspace，须走约束 4 的同步扩展。

---

## 0. 前置：底座修正项 P0（所有 Phase 的前提）

> 来源：你要求「Goal/Project 类业务数据本地留存 + SQLite 优先 + 迁移到 Electron」，已正式登记为高优先级待办。  
> 预计工作量：1~2 天  
> 依赖：无（可立即开工，不影响其他 Phase 的 UI/交互开发，但若跳过则备份/迁移/导入全不安全）

> ✅ **本批已全部落地（commit `a679751`，2026-08-21）** — tsc / eslint(0 errors) / pre-commit hook 通过；P0-3 迁移脚本冒烟、P0-4 存量校验器单测、P0-5 zod `safeParse` + `z.toJSONSchema` 导出均有运行时证据。下表各 `#` 列加 ✅ 前缀标记完成。
>
> ⚠ **P0-2 勘误**：原风险表「main.cjs 托管 server 已落地」系**陈旧错误**——实测 `quest-guild-electron/main.cjs` **并不** spawn `server/index.js`（无 child_process），server 是独立 `node server/index.js` 进程。据此 P0-2 只做两件实事：① DB 子目录 `quest-guild`→`db`（最终 `<userData>/db/quest-guild.db`，去三级同名嵌套）；② main.cjs 注入 `QUEST_GUILD_USER_DATA` 铺路契约（server 独立运行时回退 `__dirname`）。
>
> 🔧 **P0-3 运行注意**：`server/node_modules/better-sqlite3` 编译于 ABI 137（Node 24），迁移脚本须用 `D:\TinySoftware\nodejs\node.exe` 运行，默认 `node`(v22, ABI 127) 会 `ERR_DLOPEN_FAILED`。

| # | 子项 | 验收标准 | 对应代码位置 |
|---|---|---|---|
| ✅ P0-1 | backup.ts `DATA_KEYS` + Settings 页 `STORAGE_KEYS` 补齐 3 个遗漏 key：`__quest_guild_goals` / `__quest_guild_projects` / `__quest_guild_reflections`；`validateData()` 同步新增 3 个 key 的类型校验<br>⚠ **隐含前置**：goals/projects 现已落**本地 SQLite**（Phase 5.5），而 backup.ts 是 localStorage 备份——需先明确「SQLite 数据如何进备份」（否则补了 key 也备份不到库里的目标/项目），再动手 | 用户点「手动导出」→ JSON 里可看到 goals/projects/reflections 数组；Settings「恢复」可完整回写 | `src/lib/backup.ts` + `src/pages/Settings/SettingsPage.tsx` |
| ✅ P0-2 | 定 Electron 安装版 SQLite 最终目录锚点 + 修复三级同名嵌套风险：当前 server/index.js 路径为 `%APPDATA%\quest-guild\quest-guild\quest-guild.db`，改到 `%APPDATA%\quest-guild\db\quest-guild.db` 或根目录直接写，避免未来维护混乱 | Electron 启动后 explorer 打开 `%APPDATA%\quest-guild\`，db 文件在约定路径（需与「2.0 方案文档」P0-1 主进程托管 server 联调） | `server/index.js#L47-L54` + `quest-guild-electron/main.cjs`（需补 QUEST_GUILD_USER_DATA 注入） |
| ✅ P0-3 | 写「localStorage → SQLite」迁移脚本（独立可执行脚本），支持一键从浏览器试用版迁移到安装版 Electron：从 Settings 导出的 JSON 读 → 写入 SQLite 对应表 | 迁移后 SQLite 里 tasks/goals/projects/skills/settings 行数与 localStorage 一致；存在差异时报告冲突项并提示 merge 策略选择 | `scripts/local-to-sqlite-migrate.mjs` 或纳入 Settings「高级操作」 |
| ✅ P0-4 | 存量校验机制（校验器独立、可复用给后续导入）：① 每条记录 id 唯一性；② parentId / goalId / projectId 外键回链存在性；③ 已完成子任务 → 父任务 bossProgress ≥ 实际完成比例；④ capabilityIds 都存在于能力树 | 校验失败输出 human-readable 报告（xxx 条 id 冲突、yyy 条孤儿任务），通过后生成 `checksum` 写入迁移元信息 | `src/lib/storageValidator.ts`（新建，单测覆盖） |
| ✅ P0-5 | 专家导入/导出格式的 **JSON Schema 文件**（Zod 描述 → 输出 `.schema.json`），作为导入校验器 & 专家交付模板依据 | 导入格式错误可精确定位到「第 3 个 goal.deadline 格式不正确 / project p-ai 找不到对应 goalExternalId」 | `src/data/career-plan-v1.schema.ts` + 构建时导出 schema 到 `public/schemas/` |
| ✅ P0-6 | preset.ts 新增 `PRESET_GOALS` / `PRESET_PROJECTS` 常量（就用 `quest-guild-默认目标与能力树初始值.md` 里的 7 Goal + 7 Project 转成标准 IGoal/IProject），useGoals / useProjects fallback 从空数组改注入 | 新用户首次打开 GoalsPage/ProjectsPage 不再是空白页，有可参考骨架 | `src/data/preset.ts` + `src/hooks/useGoals.ts#L13` + `src/hooks/useProjects.ts#L13` |

---

## 1. Phase 0 · 快赢批次（半天，ROI 最高：低改动、止血性修复）

对应头脑风暴方案：**A3 上下文继承 + A2 过大预警 + B5 提示词升级 + E1 父史诗通关奖励**

| # | 子项 | 验收标准 | 备注 |
|---|---|---|---|
| ✅ 0.1 | 统一 `inheritContext(parent, patch?)` 函数（抽成 lib 函数，不在 hook 里），覆盖 3 个入口：① AI 转正 handleConvertOne/All；② 手动「添加子任务」；③ ProjectDetailPage 直接建任务。继承字段：goalId / projectId / capabilityIds / tags / source / 阶段 stage（若无 patch 覆盖） | 从项目页建任务自动带 goalId & projectId；AI 拆解子任务继承父 epic 的上下文，不再是孤儿 todo | 可作为 isLeaf 等工具的同文件 `src/lib/contextInherit.ts` |
| ✅ 0.2 | 派生 `isLeaf(task)` + 「过大预警」徽章：estimatedMinutes > 120min && 无子任务 → 任务卡右上黄徽章 ⚠「过大，建议拆解」+ 徽章一键调 AI 拆解弹层 | 所有 ≥2h 且无子女的任务都能看到；徽章点击正确弹出 AI 拆解对话框 | 复用现有 AI 草稿箱弹层，仅新增快捷入口 |
| ✅ 0.3 | 浏览器端 `aiDraft.ts` 的 prompt 移植 `server/services/llm.js` 里已验证的专业拆解规则：① 时间基准 20~120min；② 阶段 2~5 个；③ 动词开头优先；④ 默认 simple/normal 难度；并把 server 版 prompt 区域标记 @deprecated | AI 拆解结果质量对齐服务端专业版；无 server 时纯前端也能出一致结果 | ⚠ server 端 `/decompose`（`server/index.js:6` `require('./services/llm')`）**仍存活**；移植后让 server 端也复用同一套共享规则常量，避免 llm.js / aiClient / B2 注入**三处分叉** |
| ✅ 0.4 | 父史诗「通关奖励结算」（**⚠ 检测逻辑已存在，勿重写**）：① 子任务全 completed → 父置 completed 已由 `useTasks.ts:707-711`（`siblings.every(completed) → 父 completed + bossProgress=100`）实现，**本项只补奖励发放**；② 发放 `epic.rewardReputation × 系数(起步1.0) + epic.rewardSkillPoints × 系数`——epic 自身带预置 rewardReputation（preset 如 800），系数写进 settings 留后续可调；③ toast「史诗通关 +X 声望」+ 可选 CelebrationLayer confetti（复用现有粒子特效） | 完成某史诗全部子任务 → 父史诗卡片变绿完成态 + 弹出通关 toast + 可选粒子；声望/技能点入账与 epic 预置值一致 | 系数后续可在 Settings 加滑条（Phase 1 后补）；⚠ daily 任务奖励在完成时按 actualMinutes 重算（`useTasks.ts:662-665`），**本奖励仅针对 epic 预置值，不要对 daily 套用同系数** |

---

## 2. Phase 1 · 反馈闭环（1 天，让进度条真的动起来）

对应：**C1 全链路进度贯通 + C3 通关判定精修 + Today 推荐与目标联动**

| # | 子项 | 验收标准 | 备注 |
|---|---|---|---|
| 1.1 | 进度计算公式定稿并落地（写进 `src/lib/progress.ts`，附单测）：<br>• **项目进度** = Σ(completed 子孙任务 `actualMinutes`) / Σ(全部子孙任务 `estimatedMinutes`)（按时间加权），空项目进度=0；<br>• **目标进度** = 下属项目平均值（起步简单平均，后续可加 weight）；<br>• **里程碑 reached** = 其下项目全部 completed 或整体进度≥100%（起步用后者，兼容里程碑下有未激活项目） | ProjectsPage 列表进度条、ProjectDetailPage 进度、GoalsPage 目标进度三者，随叶子任务完成实时跳动，数值与公式结果一致 | 进度函数**必须做成纯函数+单测**，否则回归极难发现；⚠ 里程碑 reached 建议最终以「其下项目全部 completed」为准（非整体进度≥100%），因 actual/estimated 偏差会让 100% 虚高 |
| 1.2 | Settings「备份/恢复」与 backup.ts 完整联调：手动导出后，清 localStorage 再恢复 → Goals/Projects/Reflections 与导出前数量、id、字段完全一致；备份文件 `dataVersion` 递增 | 用户日常备份链路安全可靠 | 此条即 P0-1 的验收项，放 Phase 1 联调验证 |
| 1.3 | TodayPage 推荐引擎联调：在现有「最高价值 / 最大成长」基础上，新增因子 `所属目标进度落后程度 (goalProgress < 期望进度 → 加权)`；法力槽满时 Today 顶部软提示：「💎 法力已满，建议先完成 1 个注意力任务清槽」+ 附「一键移回悬赏池最老任务」按钮（软提示，不阻塞） | 目标滞后的任务在 Today 推荐里排名上升；满槽时提示可见且点击生效 | 排序公式做成可配置，起步 settings 可看，Phase 2 再开放用户改权重 |

---

## 3. Phase 2 · 结构升级（1.5~2 天，链路骨架完整）

对应：**A1 结构化里程碑 + C2 下一步行动引擎独立化 + D2 能力反向追溯（提前做，ROI 高）**

| # | 子项 | 验收标准 | 备注 |
|---|---|---|---|
| 2.1 | Goal schema 升级（对齐方案 A1）：<br>• Type：`IGoal.milestones?: IMilestone[]` 取代旧 `milestone: string`；<br>• SQLite goals 表加 `milestones TEXT` JSON 列；<br>• Type 兼容：读时优先 milestones 字段，没有则把旧 milestone 字符串包成单元素数组（一次性迁移脚本）；<br>• IProject 加 `milestoneId?`（弱关联起步，不强制必填） | Goals 详情页可增删改里程碑（含名称、deadline、verification）；项目详情弹层可选择「归属于第 X 个里程碑」；里程碑进度条正确显示 | 里程碑 UI 直接用 GoalsPage 内嵌展开区，不新增页面 |
| 2.2 | 下一步行动引擎（独立纯函数，附单测）：叶子任务过滤 status=pending + 前置 stage 已完成 → 按 importance（若缺省按 difficulty 映射）→ deadline 临近 → goalProgress 落后程度 排序，返回 Top 3 `NextAction` 结构（taskId, why, suggestedSlot） | 在 Story/单测中可预测：改变 deadline / goalProgress，结果排序按预期变化；TodayPage 正确消费并展示「下一步推荐」卡片 | 函数**不要依赖 React**，做成 IO 无关纯函数方便测；⚠ 须**合并**进 TodayPage 现有排序（rewardReputation+skillPoints 加权，`TodayPage.tsx:111-135`），别做成两套推荐逻辑并存 |
| 2.3 | 能力反向追溯（D2 提前实现）：能力节点详情侧栏新增两块——<br>① 「滋养此能力的最近 5 个任务」（按 completedAt desc，从 `actualMinutes * capabilityId 命中` 聚合）<br>② 「主要来自哪些项目」（同上按 projectId 汇总）<br>时间轴或列表样式二选一，起步用列表，和现有 Celebration Timeline 复用 UI 组件 | 打开能力详情页，能看到最近完成的 5 条任务与对应项目，点击任务可跳转到 TaskDetail 或 ProjectDetail | 这一块是「成长轨迹可视化」最小闭环，代码量低但感知度高 |

---

## 4. Phase 3 · 分解引导升级（1.5~2 天：AI 拆解从可用到好用）

对应：**B1 递归分解 + B2 AI 上下文注入 + B3 分解体检报告**

| # | 子项 | 验收标准 | 备注 |
|---|---|---|---|
| 3.1 | UI 放开 3 层嵌套限制（**⚠ 已确认现状为 2 层，非加按钮，是重构渲染层**）：<br>• 现状 `QuestPoolPage` 仅渲染 epic→直接 children（`getChildren` L216 单层查 + 顶层 `epic && !parentId` L194），无递归树/缩进；<br>• 需新增 `TaskTreeNode` 递归组件承载 3 层；<br>• 任务详情操作区「继续拆解」入口：叶子任务 always 可继续拆（自动变成父、新增子 under 它） | 能手动创建「孙任务」；悬赏池树形视图显示 3 层深度；缩进清晰不重叠 | **成本 ~1 天（非半天）**：重构渲染层 + 递归组件；数据层 `collectDescendantIds` 本就递归，无需改 |
| 3.2 | AI 拆解 prompt 上下文注入（对齐 B2）：调用时把 Goal→Project→Epic 整条链路拼入 system prompt；要求 LLM 返回 JSON 结果**必须包含**：subtasks[].name/.estimatedMinutes/.stage/.difficulty/.relatedSkillId；AI 草稿箱的「奖励预览」用 `computeReputation()` 同一公式实时计算 | AI 拆出的子任务带预填属性（难度/阶段/关联能力），草稿箱卡片展示「预奖励：+30 声望 / +0 技能点」，转正后入账一致 | `computeReputation` 已在 `lib/economy.ts`（`useTasks.ts:8` 即 import），草稿预览与实际入账共用即可，无需再抽；回应对齐头脑风暴开放问题 4：云端新建的 daily 任务被 quest 收养后，同理走本 prompt 预填 difficulty/importance/stage（见 3.4） |
| 3.3 | 转正前「分解体检报告」：<br>• 🔴 颗粒度硬伤：subtask.estimatedMinutes > 120min → 建议继续拆（仍可手动跳过）；<br>• 🟡 时间守恒（软阻塞可跳过）：Σ 子任务总预估 vs 父 epic 预估偏差 > 50% → 提示「父任务预估 8h，但拆分后合计 2.3h，建议微调」；<br>• 🟡 stage 自动重排：按深度优先重新编号；<br>• 🟡 动词开头启发式：给出 3 条可编辑改写建议；<br>体检报告在「确认转正」按钮上方常驻，红/黄点可点开详情 | 用户体验到「AI 不是黑盒，我能检查质量再确认」；**时间守恒做成软阻塞**，避免让用户改一个错的数对齐另一个错的数 | 体检函数抽 lib，单测覆盖各命中分支 |
| 3.4 | **云端新建任务收养后的 AI 属性补全**（补头脑风暴开放问题 4 的落地链路）：workspace 端新建的 daily 任务（仅标题+分钟，origin='cloud'）被 quest 同步收养后，触发一次后台 AI 预填，补全 difficulty/importance/stage/relatedSkillId（复用 3.2 的链路 prompt 与 `computeReputation` 预览）；补填结果以「建议」呈现 | 从 workspace 新建的任务在 quest 端不再是无属性孤儿；属性补全后可正常进入进度聚合与下一步推荐 | 与 B2 共用预填逻辑；静默 vs 按钮策略待定（头脑风暴 Q4），**默认「建议补全」按钮触发**，控制 LLM 成本与错填风险<br>⚠ **须遵守文首背景约束 3**：补全经 LWW 安全写回（quest 推回 `updatedAt` 须晚于云端创建时间），不能被云端旧快照冲掉 |

---

## 5. Phase 4 · 体验升维（按需延后）

对应：**D1 远征地图独立新页面 + B4 分层 AI 工作流 + E3 远征回顾**

> 定位：体验升维，非交付阻塞。在用户把 P0~Phase3 链路跑顺、有实际数据后再决定优先级，避免先做"好看的大屏"回头改链路返工。

| # | 子项 | 验收（建议） |
|---|---|---|
| 4.1 | 远征地图独立页 `ExpeditionMapPage`（不进 Sidebar，TodayPage 顶部大卡片入口）：目标 → 里程碑 → 项目 三层画布，每节点显示进度徽章 + 关联能力色点，只读大屏作战室风格 | 进入后可缩放、点击节点跳转到目标/项目详情；深色 RPG 风格对齐现有面板<br>⚠ **workspace 端只读史诗看板（按阶段展示待办子任务 = "告诉自己要做的事"）已在 Part 1 同步工作中落地**（详见文首「背景：workspace ↔ quest 数据打通现状与约束」），本页为桌面端增强版而非从零，**须遵守背景约束 5** |
| 4.2 | B4 分层 AI 工作流（远期）：目标→项目→史诗的多轮对话式拆解（当前一键拆解仅 subtask 级）。建议在「专家导入方案跑通、用户有职业规划骨架」后才做，避免 AI 自由发挥生成无意义上层 | 用户能基于一个「想要的方向」让 AI 出 Goal→Project→Epic 三层草案，每步都有草稿箱确认 |
| 4.3 | 远征回顾彩蛋：某个 Goal 达到 100% 时，生成一页「通关战报」——用时、关联项目数、点亮的能力节点、TOP3 耗时任务、声望合计；可截图或导出 PNG | 触发后出现 Modal，附庆祝粒子 + 下载按钮 |

---

## 6. 专家咨询结果 · 标准化导入/导出双向闭环（**独立排期轨道，非各 Phase 顺手子项**）

> ⚠ **排期警示**：本节体量约等于 Phase 0~3 总和的增量（导出器 + Zod Schema + 映射面板 + 冲突策略 + 结果报告），横跨 P0-5 schema 与 Phase 2 映射面板与 Phase 3 冲突策略。请勿伪装成顺手做的子项——**单列轨道、单独排期与验收**，否则会在各 Phase 估算里被悄悄吃掉工期。

> 需求新增：除了「专家结果导入」，还要**支持把现有系统里的目标/项目/能力/种子史诗导出为同一份标准化格式**，供专家在**现有基础上**评判、调整、再回导，形成闭环。  
> 拆分后归入各 Phase：基础格式与导出在 **Phase 0~1** 开工，能力映射 / 导入 UI 在 **Phase 2~3** 完成。

### 6.1 标准化格式 `quest-guild-career-plan-v1.json`（字段规格）

```jsonc
{
  "schemaVersion": "1.0",
  "generator": "Quest Guild v2.0 export / expert hand-fill / consultant-system",
  "generatedAt": "2026-08-21T12:00:00Z",
  "meta": {
    "clientName": "可选：用户昵称",
    "consultationDate": "2026-08-20",
    "sourceExportVersion": "可选：系统内导出时附带 appVersion"
  },

  "capabilities": {
    "action": "merge",                              // merge=增量追加（推荐）；replace=整棵能力树替换（危险，需二次确认）
    "items": [
      {
        "externalId": "专家自定义ID，可被 goals/projects 引用",
        "name": "健康与体能",
        "category": "健康与体能",                    // 分类名，用于能力树画布分组
        "parentId": null,                            // 挂接：null=一级；或 "cap-*" 内部ID；或本 items 内另一条 externalId
        "description": "支撑 10 年持续积累的身体底盘",
        "level": 1,                                  // 1=一级域, 2=二级子域, 3=三级叶
        "requiredSkillPoints": 1,
        "x": 250, "y": 400,                          // 画布坐标可缺省（系统自动布局）
        "children": [
          {
            "externalId": "exp-health-strength",
            "name": "力量训练",
            "level": 2,
            "requiredSkillPoints": 2,
            "description": "背/腿/核心力量，居家渐进式",
            "children": [
              { "externalId": "exp-health-core", "name": "核心训练", "level": 3, "requiredSkillPoints": 3 }
            ]
          }
        ]
      }
    ]
  },

  "goals": [
    {
      "externalId": "g-ai-core",
      "name": "建立 AI 核心能力",
      "description": "为什么重要 + 成功标准（支持 markdown 字符串）",
      "deadline": "2031-01-01",
      "weight": 35,                                  // 目标权重 1-100（加和建议 100，供排序引擎用）
      "status": "active",                            // active / archived
      "milestones": [
        {
          "name": "完成 1 个真实 LLM/RAG 小项目并跑通",
          "deadline": "2026-11-16",
          "verification": "有 repo + 可访问 demo 链接"
        }
      ]
    }
  ],

  "projects": [
    {
      "externalId": "p-ai-practice",
      "goalExternalId": "g-ai-core",                // 必填，挂到 goals 数组里的一条
      "milestoneIndex": 0,                           // 可选，承接第 0 个里程碑
      "name": "AI 实战项目",
      "description": "从数据准备到 demo 上线的完整链路",
      "capabilityExternalIds": ["exp-health-core", "cap-creation-tech-frontend"],
      "status": "active"
    }
  ],

  "epics": [
    {
      "externalId": "epic-rag-demo",
      "projectExternalId": "p-ai-practice",
      "name": "搭建一个本地 RAG 知识库问答 demo",
      "description": "把 quest-guild 文档索引起来，支持自然语言问项目决策依据",
      "difficulty": "hard",
      "estimatedMinutes": 2400,
      "bossName": "知识库上线幽灵",                   // 可选，未填系统自动生成
      "stages": [
        ["选型向量库与 embedding 模型", "数据清洗与切分", "索引入库脚本"],
        ["API 服务封装", "简单前端 UI"],
        ["端到端联调", "demo 部署上线"]
      ]
    }
  ]
}
```

### 6.2 导入 UI 流程（Settings 新增卡片，与现有备份复用按钮组）

```
Settings 页「专家咨询与职业规划 · 导入/导出」新卡片
├─ 📤 【导出】导出当前规划（career-plan-v1 JSON）     ← 新增：用于把现有手填/试错内容发专家
│      选项：
│        ○ 仅导出骨架（不含任务运行时状态/实际分钟）【默认，专家用】
│        ● 导出骨架 + 种子史诗任务的 stage 分组（推荐）
│        ● 包含已完成任务（用于复盘回顾，文件较大）
│
└─ 📥 【导入】导入专家规划文件 (.json)                ← 新增：专家返回结果，闭环回写
       Step 1：选文件 / 拖拽 JSON
       Step 2：Schema 校验（Zod，P0-5 产物）→ 错误明细列出（行号+字段）
       Step 3：能力 ID 映射面板（Phase 2 做）
                左：专家能力分类列表（高亮「自动匹配 8/10，需手动映射 2/10」）
                右：现有能力树画布，点击或拖拽映射；未匹配的默认作为「新分支一级节点」插入
       Step 4：统计预览 + 冲突策略
                新增：Goals X / Projects Y / Capabilities +N / Epics Z（含 W 子任务）
                同名冲突策略：○ 跳过（默认）○ 加后缀「(专家版)」● 覆盖（二次确认）
                ID 生成：全部 genId() 重生成，避免冲突
       Step 5：执行导入 → 结果报告（成功 N/跳过 M/失败 K）→ 跳转 GoalsPage 或远征地图预览
```

### 6.3 归入各 Phase 的时间节点

| Phase | 具体子项 | 验收 |
|---|---|---|
| **Phase 0** | 6.3-1 写 **导出器** `src/lib/careerPlanExport.ts`：从 storage（useGoals/useProjects/useSkills/useTasks 的 epics）读取 → 序列化为上面的格式；**种子史诗阶段 stages 从现有 subtasks 的 stage 字段聚合** | Settings 「导出当前规划」按钮可下载 JSON，打开后 goals/projects 与应用内一致 |
| **Phase 0** | 6.3-2 提供一份 **样例文件** `sample-career-plan-v1.json`（用 `quest-guild-默认目标与能力树初始值.md` 内容直接转），Settings 卡片附「下载模板」按钮 | 用户/专家点击就能拿到一份可直接改写的样例 |
| **Phase 0 或 P0** | 6.3-3 Schema + 基础校验器（P0-5 产物）与导入 Step 1/2 UI 骨架 | 导入错误 JSON 可精确提示哪里错了 |
| **Phase 2** | 6.3-4 能力 ID 映射面板（Step 3）+ 自动匹配（起步：精确名 + 编辑距离≥0.8，精度不够再 Phase 4 补中文分词） | 外部 id "力量训练" 能 90%+ 匹配到 `cap-health-strength`，未命中的进入手动映射 UI，完成后正确挂载 |
| **Phase 3** | 6.3-5 导入 Step 4 冲突策略 + Step 5 结果报告，整体联调 | 完整跑通：从样例 JSON → 预览 → 映射 → 确认 → GoaslPage 正确出现新目标 |

---

## 7. 验收矩阵总览

| 阶段 | 主要修复的差距（对应头脑风暴 G1~G14） | 业务验收 | 工程验收 |
|---|---|---|---|
| ✅ P0 底座 | G5 备份安全（补 3 个遗漏 key）+ 「Goal/Project 留存」正式项 | 备份/恢复安全；新用户 Goals/Projects 有初值；Electron 版 SQLite 路径合规 | ✅ 全过（commit `a679751`）：Zod `safeParse` 精确定位 path（`["goals",0,"deadline"]`） / `storageValidator` 单测 6 issue 全中 / 迁移脚本 dry-run 行数一致 / tsc+eslint 0 errors |
| ✅ Phase 0 | G1 任务不再是孤儿 / G6 里程碑能存 / G14 父史诗奖励 / AI 拆解规则对齐 | 从项目页建任务自动带父上下文；≥2h 任务有拆解预警；父史诗通关有奖励 toast | ✅ 已落地（commit `a679751`）：`inheritContext` 覆盖 3 入口（QuestPool 转正×2 + ProjectDetail 提交）/ `decomposeRules.json` 单源消除 aiClient·llm.js·B2 三处分叉 / 过大预警徽章 / `epicClearCoefficient` 通关奖励 + 庆祝事件 |
| Phase 1 | G12 进度条真的动 + Today 推荐与目标联动 | 叶子任务完成 → 项目/目标进度条实时变化且数值正确 | progress.ts 单测覆盖边界（空项目、子任务无预估、完成率超 100%） |
| Phase 2 | G6 结构化里程碑 / C2 下一步推荐可预测 / D2 能力有轨迹 | Goals 详情可增删里程碑；下一步推荐排序结果与公式一致；能力详情能看到近 5 任务 | nextAction 纯函数 10+ case 单测；能力反向追溯 SQL/聚合无 N+1 问题 |
| Phase 3 | B1 递归 3 层 / B2 AI 预填属性 / B3 体检报告 | UI 可手动建孙任务；AI 子任务带预属性，预览奖励与入账一致；转正前可看红/黄体检点 | 体检函数单测覆盖各分支；QuestPoolPage 树渲染 3 层无布局错位 |
| Phase 4 | D1 远征地图 / B4 分层 AI / E3 回顾彩蛋 | 远征地图可用；分层 AI 3 层草案草稿箱能过；Goal 100% 有战报 | 远征地图大屏 1920×1080 不溢出；战报可导出 PNG |
| 专家导入/导出闭环 | 新增需求：支持专家在现有基础上迭代 | 导出→专家改动→回导→能力映射→合并→预览→生效的完整链路 | Schema 校验 100%；导入回滚（失败不写库）原子性保证 |

---

## 8. 风险与预留

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| ~~`server/index.js` 的 SQLite 路径为 `%APPDATA%\quest-guild\quest-guild\quest-guild.db`（三级同名嵌套，维护易乱）~~ | ✅ 已改到 `%APPDATA%\quest-guild\db\quest-guild.db`（commit `a679751`） | ⚠ **勘误**：原注「~~原风险『main.cjs 未托管 server』已不成立（main.cjs 托管 server 已落地）~~」系陈旧错误——实测 `main.cjs` **不 spawn** server（无 child_process），server 为独立进程。P0-2 已落地路径锚点 + `QUEST_GUILD_USER_DATA` 铺路契约（详见文首 P0 勘误段） |
| ~~QuestPoolPage 树形 UI 目前是否支持 >2 层渲染未确认~~（**已确认：现状仅 2 层，见 3.1**） | Phase 3.1 已从"加按钮"定为"重构渲染层"，工期 ~1 天（见 3.1） | 3.1 已据此改估算，无需再读代码确认 |
| 能力 ID 自动匹配算法起步用编辑距离，中文能力名误匹配率可能高 | Phase 2 映射面板用户需要手动映射的比例大 | 起步先接受 85% 自动命中率，把未命中的按高亮提示，Phase 4 再补中文分词 + 分类别名词典 |
| 父史诗通关奖励 ×1.0 vs ×1.2~1.5 的系数争议 | 用户反馈"通关没成就感"或"声望通胀"皆可能 | 系数写进 Settings（UI Phase 1 后补），默认 1.0，先跑 2 周看用户实际声望获取速率再定是否调 |

---

**文档状态**：蓝图 v0.1 — 待你审阅后标记「定稿 → 进入实施」。后续每次迭代，建议在 `.trae/documents/` 下追加新的版本迭代记录，保留决策依据（为什么用这个进度公式、为什么通关系数起步 1.0 等），方便项目复盘。
