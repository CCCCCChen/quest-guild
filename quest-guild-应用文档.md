# quest-guild 应用文档（当前状态）

> 文档类型：应用现状说明 ｜ 整理日期：2026-11-02 ｜ 代码基线：commit 前本地状态
> 关联：《QuestGuild 需求再梳理 v2》（`.trae/documents/`）—— 本文档描述"现在是什么"，需求文档描述"要往哪去"。

---

## 1. 产品概览

quest-guild（中文名"悬赏任务公会"）是一个**个人任务管理与游戏化执行**工具。核心思路是把待办任务包装成"悬赏任务"，通过声望、技能点、段位、专注槽等游戏化元素提供反馈，并辅以 AI 拆解把大任务拆成可执行子任务。

当前已落地的产品形态：
- **Web 应用**（Vite 开发/构建，可部署到 `life.hchch.tech`）。
- **Electron 桌面应用**（Windows 64 位，已跑通打包，产物在 `quest-guild-electron/out/`）。
- **云端同步**（workspace-server，Bearer 鉴权）。

---

## 2. 技术架构

### 2.1 前端
| 项 | 技术 |
|----|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite（含 rolldown 打包，已解决限核内存问题） |
| 样式 | Tailwind v4 + shadcn/ui + Radix |
| 图表 | echarts |
| 动效 | framer-motion |
| 路由 | react-router-dom（`src/app.tsx`） |

### 2.2 三层形态
```
┌─────────────────────────────┐
│  Electron 壳 (main.cjs)      │  仅注入 QUEST_GUILD_USER_DATA 环境变量
│  renderer/ (Vite 产物)       │  桌面窗口，独立 node server 进程
└─────────────────────────────┘
            │
┌─────────────────────────────┐
│  Web 前端 (React SPA)        │  localhost:5173 / life.hchch.tech
└─────────────────────────────┘
            │
┌─────────────────────────────┐
│  server/index.js            │  Express + better-sqlite3 (WAL)
│  （可选本地后端）            │  独立进程，提供 /api/* 与 SQLite 持久
└─────────────────────────────┘
            │  同步 (B+ 全量快照 + LWW)
┌─────────────────────────────┐
│  workspace-server           │  云端镜像，Bearer API_TOKEN 鉴权
└─────────────────────────────┘
```

### 2.3 数据存储分层（重要）
- **主存储 = localStorage**（`useTasks` / `useGoals` / `useProjects` / `useReflections` / `useShop` / `useSkills` 均为 localStorage-only，已与 server 解耦）。
- **SQLite（server/index.js）**：本地可选持久层（P0-3 起作为 localStorage 的可选后端，默认前端仍走 localStorage）。
- **云端（workspace-server）**：镜像，通过同步模块双向 LWW 合并。
- 同步方向：quest → cloud（全量快照 upsert）+ cloud → quest（回传 qg 全集 + 墓碑删除），workspace 原生任务不进 quest。

---

## 3. 页面与功能（共 10 个路由 + 浮窗）

路由定义在 `src/app.tsx`：

| 路由 | 页面 | 功能要点 |
|------|------|---------|
| `/` | **Today（今日）** | 待办任务、推荐卡、专注追踪（active-track）、关注任务、完成确认弹窗；P0-G 将挂载时间账面板 |
| `/goals` | **Goals（目标）** | 目标列表、进度汇总、里程碑与 `milestoneDeadline`、逾期高亮 |
| `/projects` | **Projects（项目）** | 项目列表、`projectProgress` useMemo 汇总进度 |
| `/projects/:id` | **ProjectDetail** | 单项目详情与任务 |
| `/reflections` | **Reflections（复盘）** | 任务复盘（expected/actual/lesson/nextAction） |
| `/quest-pool` | **QuestPool（悬赏池）** | 主任务创建表单（含重要性选择器）、AI 拆解草稿转正入口 |
| `/skill-tree` | **SkillTree（能力树）** | 能力节点解锁/强化，关联任务 `capabilityIds` |
| `/shop` | **Shop（商店）** | 专注槽兑换、声望消费 |
| `/stats` | **Stats（统计）** | 声望/streak/完成统计、图表 |
| `/settings` | **Settings（设置）** | 应用名、专注槽、AI 拆解配置、重置 |
| `?mode=floating` | **FloatingWidget** | 透明浮窗模式，独立于路由 |

---

## 4. 游戏化系统（已落地）

| 元素 | 实现位置 | 说明 |
|------|---------|------|
| 声望 reputation | `useShop.reputation` / `computeReputation` | 完成按难度×重要性重算（P4 经济重构） |
| 技能点 skillPoints | `server/constants.js` 公式 | normal 走熟练度满 10 解锁 |
| 段位 rank | `src/lib/rank.ts` | 基于总声望 6 段位，封顶"传奇勇者"（Phase 3B） |
| 专注槽 mana | 设置项 `manaMax` | 静态容量，语义诚实（决策4 改名） |
| streak | `src/lib/streak.ts` | 连续完成天数，纯函数（Phase 1） |
| 商店 shop | `ShopPage` | 可选激励，不与核心路径耦合 |
| 完成庆祝 | `CelebrationLayer` | framer-motion confetti + 卡牌翻面（Phase 1） |

**防自灌**（P4-2）：每周软上限（cap=800），超出部分收益 ×50%。

---

## 5. AI 拆解（当前实现）

### 5.1 现状
- 入口：`QuestPoolPage` 史诗任务节点草稿面板 + 全局 AI 草稿箱（Sheet）。
- 客户端：`src/lib/aiClient.ts` → 浏览器**直连** LLM（OpenAI 兼容 `/chat/completions`），密钥存本地 `aiConfig.ts`，请求头 `Authorization: Bearer ${apiKey}`。
- 规则源：`src/data/decomposeRules.json`（`systemPrompt` + `constraints`），与 `server/services/llm.js` 同源。
- 草稿存储：`src/lib/aiDraft.ts`（`IAiSubtaskDraft`）+ `hooks/useAiDrafts.ts`，**仅本地、永不上云**，用户"加入任务"才转正。
- 产出：子任务 `name / description / difficulty / estimatedMinutes / stage`，以动词开头、按 stage 分组。

### 5.2 已知局限（需求 v2 将解决）
- 拆解仅产出 5 字段，**未填充 7+1 维度**（lifeDomain/contentType/executionContext/recurrence 等）。
- 浏览器直连 LLM key，**密钥在客户端**；外发安装包前需改为云端代理（见 §8 S1）。
- 实际耗时无可靠采集入口，预估靠创建期估算（易乐观）。

---

## 6. 同步机制（B+ 延迟同步，已落地）

- 模块：`src/api/sync/{index,state,target}.ts`。
- 目标：`WorkspaceServerTarget`（`VITE_SYNC_URL` / `VITE_SYNC_TOKEN`）为主；`QuestServiceTarget` 为占位。
- 策略：全量快照 upsert + 双向 LWW（按 `updatedAt`）+ 墓碑删除（`workspace_task_tombstones`）。
- 差额删除只删 `origin='quest'`，云端原生任务不被误删。
- 云端：`workspace_tasks` 表 `source='qg'` 标记；`origin` 列区分 quest/cloud；workspace 原生任务排除在 quest 同步外。
- 鉴权：workspace-server 全局 Bearer 中间件（`/api/health` 除外），`API_TOKEN` 单一可信源 = `workspace-server/.env`。

---

## 7. 构建与发布

| 命令 | 作用 |
|------|------|
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | `export:schema` + `vite build` |
| `npm run typecheck` | `tsc -p tsconfig.app.json` |
| `npm run test` | vitest |
| `npm run electron:build:win64` | Electron Windows 64 打包 |
| `npm run electron:release` | 升版（patch）+ 打包 |
| `npm run version:patch/minor/major` | `bump-version.mjs` 升版 + tag |

- 版本流程：`scripts/bump-version.mjs`（调 `npm version`，自动 commit + `vX.Y.Z` tag）。
- 图标：`quest-guild-electron/assets/icon.ico`（`scripts/gen-electron-icon.py` 生成）。
- 打包坑：环境禁止 rename → NSIS 用 `fs.cpSync` 绕过；`ELECTRON_BUILDER_BINARIES_MIRROR` 走 npmmirror。

---

## 8. 当前限制与已知债

| ID | 问题 | 状态 | 触发条件 |
|----|------|------|---------|
| **S1** | 前端专用受限 token 缺失：单一全局 `API_TOKEN` 被 Vite 内联进 bundle，拿到安装包即可提取访问全站 API（含账本） | **延后** | 一旦外发/共享安装包或给他人用，须先做"前端专用 scoped token"（服务端签发只允许 `/api/tasks*`，与自动化 token 分离） |
| 浏览器 LLM key | 同上，AI 拆解密钥在客户端 | 待 P0-E 统一到云端解决 | — |
| 实际耗时失真 | 无完成即问机制 | 待 P0-F | — |
| 多维字段缺失 | 任务模型仅有 importance/difficulty/estimatedMinutes/actualMinutes，缺 7+1 维度 | 待 P0-C | — |
| 时间账缺失 | 无今日/本周/累计未完成预估聚合 | 待 P0-G | — |

> 注意：S1 为用户明确"先记着、目前自用不做"的延后项，**自用阶段不动**，仅在分发前处理。

---

## 9. 与需求 v2 的差距（衔接 P0）

| 需求 v2 项 | 当前状态 | P0 动作 |
|-----------|---------|--------|
| 7+1 多维字段 | 仅 importance/difficulty/耗时 | P0-C 新增 lifeDomain/contentType/executionContext/startDate/deadline/recurrence/reminderAt |
| AI 引擎统一 | quest 自带 llm.js，浏览器直连 | P0-E 复用 workspace-server inbox-decompose，前端优先云端 |
| 完成即问 + estimationProfile | 无 | P0-F 新增 modal + 乘数表 |
| 时间账 | 无 | P0-G 纯函数 + 面板 |
| decomposeRules 7+1 | 仅 stage/难度×时间 | P0-D 升级 schema |

---

## 10. 关键文件索引

| 关注点 | 文件 |
|--------|------|
| 类型定义 | `src/types/quest.ts` |
| 主任务存储 | `src/hooks/useTasks.ts` |
| 设置 | `src/hooks/useSettings.ts` / `src/types/quest.ts`(IAppSettings) |
| AI 客户端 | `src/lib/aiClient.ts` |
| AI 配置 | `src/lib/aiConfig.ts` |
| 草稿 | `src/lib/aiDraft.ts` / `hooks/useAiDrafts.ts` |
| 拆解规则 | `src/data/decomposeRules.json` |
| 后端 | `server/index.js` |
| 云端引擎 | `../workspace-server/server/inbox-decompose.cjs` |
| 同步 | `src/api/sync/{index,state,target}.ts` |
| 路由 | `src/app.tsx` |
| 经济公式 | `server/constants.js` / `src/lib/economy.ts` |
| 段位 | `src/lib/rank.ts` |
| streak | `src/lib/streak.ts` |
| 打包 | `scripts/electron-*.mjs` / `package.json` |

---

_本文档随代码演进维护；P0 落地后此处"当前限制"与"差距"两节应同步更新。_
