# Quest Guild 现有代码系统性分析

> 分析对象：`quest-guide`（本地应用，含 Web 前端 / Electron 壳 / 可选后端）
> 分析视角：产品使用、架构设计、模块耦合、业务逻辑、可维护性
> 依据：实际代码（server/index.js、src/api/*、src/app.tsx、quest-guild-electron/main.js、悬赏任务.md 规格书 V3.0）
> 日期：2026-08-18
> 配套文档：
> - [quest-guild 游戏化评估](./quest-guild-游戏化评估.md)（从玩家体验角度补充"为什么这些 bug 致命"，与本文第 6 节风险表互证）
> - [quest-guild 升级方案 1.0](./quest-guild-升级方案-1.0.md)（日程统筹 ↔ 日常悬赏对齐与云端同步）

---

## 0. 系统总览

```
quest-guide/
├── src/                      # React 19 + TS + Vite 前端（10 个页面 + FloatingWidget）
│   ├── api/                  # client.ts（双路代理）+ tasks/skills/shop/goals/... 分模块 API
│   ├── pages/                # Today/Goals/Projects/QuestPool/SkillTree/Shop/Stats/Settings...
│   └── hooks/                # useTasks/useSkills/useShop/useStats/useSettings/useFloatingMode
├── server/                   # Express 4 + better-sqlite3 单文件后端（index.js, ~975 行）
├── quest-guild-electron/      # Electron 壳：main.js 起本地 server 子进程 + IPC 代理 + 加密存储
└── shared/capabilities/      # 占位目录（仅 README，未实际接线）
```

三层（Web / Electron / 后端）并存，Electron 直接内嵌并启动后端子进程。

---

## 1. 产品使用角度

**现状**
- 定位清晰：Dark Fantasy RPG 风格的游戏化目标管理，核心是「每日悬赏 + 史诗/Boss + 技能树 + 商店」闭环。
- 入口丰富：主窗口、独立悬浮窗（收起/展开）、系统托盘；悬浮窗可拖拽、位置/透明度可配。
- 离线可用：纯 localStorage 模式可独立运行；Electron 端加密存储。
- 功能完整度：规格书 V3.0 列出 9 大模块、30+ API 端点、SVG 技能树、echarts 统计、AI 任务拆解。

**优点**
- 游戏化反馈强（粒子爆裂、声望结算、Boss 血量条），抗拖延驱动力足。
- 桌面优先体验好（悬浮窗/托盘），契合"随时记一笔悬赏"的场景。

**问题与风险**
1. **移动端缺失**：仅 Web 响应式，无独立移动端；悬浮窗/托盘为桌面专有。与已上云的 `life.hchch.tech` 工作台形成体验断层（手机上看得到工作台，看不到公会）。
2. **AI 拆解强依赖 LLM**：`/api/tasks/decompose` 需 OpenAI 兼容接口；离线/无 key 时该功能直接不可用，且失败仅报错无降级。
3. **数据入口分裂**：localStorage 与后端两套存储并存，用户可能分不清"我现在的数据在哪"，且两端数据会漂移（见 §3、§4）。

**改进建议**
- 短期：把"每日悬赏"对齐进云端工作台（见升级方案 1.0），让手机端至少能看/勾日常悬赏。
- 中期：AI 拆解加本地降级（无 LLM 时不显示按钮或给模板拆分）。

---

## 2. 架构设计角度

**现状**
- 前端：React + Vite + Tailwind v4 + shadcn/ui + Radix + echarts + framer-motion，react-router 多页。
- 后端：Express 单文件，better-sqlite3（WAL），RESTful。
- Electron：主进程 `spawn` 后端子进程（同机 `localhost:3001`），渲染进程经 `api:proxy` IPC 转发 `/api/*`；另用 `electron-store` 加密 JSON 作"加密本地存储"。

**优点**
- 前后端分离清晰（标准 Web 架构），后端可独立运行/测试。
- `client.ts` 抽象干净：Electron→IPC、浏览器→fetch 双路自动切换。
- 分模块 API（`tasks.ts`/`skills.ts`/...）比把全部请求塞进一个文件好。

**问题与风险**
1. **后端是单文件 975 行巨石**（`server/index.js`）：所有路由、建表、迁移、业务逻辑全在一个文件。相较之下 workspace-server 已按 `routes/*.cjs` 拆分，quest-guide 后端**反向退化**为单体。
2. **Electron 内嵌后端造成"两套后端代码"**：根 `server/` 与 `quest-guild-electron/server/` 两处存在，`ensureLocalServer`（`main.js:71-89`）优先用 `__dirname/server/index.js`。两处易漂移、难同步。
3. **无 schema 版本管理**：建表后靠一堆 `try { ALTER TABLE ... } catch {}`（`index.js:160-182`）增量补列，无迁移框架、无版本号，回滚/多环境一致性无保障。
4. **CORS 全开 + 无鉴权**：`app.use(cors())`（`index.js:31`）任意来源可读写全部数据 —— 若日后后端上云（方案 C）会直接暴露。
5. **配置用自定义 .env 解析**（`index.js:8-25`）而非 `dotenv`：能力够用但偏离生态惯例，且与 Electron 注入 `PORT` 的方式不一致。

**改进建议**
- 后端按实体拆 route 文件（参考 workspace-server 模式），`index.js` 只做装配。
- 引入轻量迁移（如 `better-sqlite3` + 自建 `schema_version` 表，或 `node-pg-migrate` 思路的 sqlite 版）。
- 内嵌后端改为"引用根 server/"，删除 `quest-guild-electron/server` 副本。
- 若上云：加 Bearer 鉴权（同 workspace-server 的 P0 方案）。

---

## 3. 模块耦合角度

**现状**
- 前端：Page 依赖 Hook，Hook 依赖 `api/*`，`api/*` 依赖 `client.ts`。链路清晰。
- 后端：单文件内所有实体耦合（tasks/skills/shop/goals/projects/reflections 互为引用，如 `complete()` 跨表改 skills/meta）。
- 存储：前端 Hook 层"基于 localStorage 封装"，但后端存在 → **同一份业务数据有两套读写实现**。

**问题与风险**
1. **双存储耦合是最大隐患**：`useTasks` 等 Hook 以 localStorage 为默认读写；而 `client.ts` 在 Electron 下走 IPC→后端 SQLite。意味着 **Web 浏览器直连后端**与 **Electron 走加密 store+后端** 两条链路，localStorage 与 SQLite 可能各自为政，用户切换环境数据对不上。
2. **`bootstrap` / `skills/import` 是覆盖式写**（`index.js:777-802` `DELETE FROM skills` 再插），若前端误调会清空用户数据，且和"增量"语义冲突。
3. **`shared/capabilities` 是空壳**：`tasks.capabilityIds` 在表里存了，但能力系统（预设框架、解锁）README 明确"占位未接线" → 采了数据却无消费方，是死字段。
4. **前端类型与后端无契约**：`IQuestTask`（`@/types/quest`）由前端自行定义，后端返回结构是隐式约定，任一侧改字段即静默错位。

**改进建议**
- 明确"唯一写入源"：要么纯前端 localStorage（后端仅备份），要么纯后端（前端无本地副本），消除双写。对齐云端时建议**后端为唯一源**。
- 给 `capabilityIds` 要么接上能力系统，要么在 1.0 对齐中只映射首个到 `ability_category`，避免空数据。
- 引入前后端共享的类型/契约（如 zod schema 服务端校验 + 前端复用）。

---

## 4. 业务逻辑角度

**现状**
- 声望结算：`complete()`（`index.js:313-375`）统一处理：追踪任务结算专注时长→focus_logs、更新状态、史诗子任务进度、加声望、加技能点。
- 注意力/法力：`/api/tasks/:id/attention` 校验 `isAttention` 数量 ≤ `manaMax`（settings）。
- 商店：兑换扣声望、记录 redemptions。

**问题与风险**
1. **结算公式两处不一致（对齐关键冲突）**：
   - quest-guide：`reward = {5/10/25/80}[diff] + floor(min/10)*2`（`index.js:236`）
   - workspace-server：`rep = max(10, round(min×{0.5/1/2/3}[diff]))`（`tasks.cjs:97-100`）
   两公式对"普通/10分钟"给出 12 vs 10，差异虽小但**跨系统对账会错位**，必须在 1.0 统一（升级方案已定用 quest-guide 公式）。
2. **缺少输入校验导致 NaN 风险**：`index.js:236` 若 `data.difficulty` 非法（如空串/拼写错），`[data.difficulty]` 为 `undefined`，`undefined + 数字 = NaN`；`data.estimatedMinutes` 缺失则 `NaN/10 = NaN`。入库后声望为 NaN，前端 `parseInt` 又可能得 `NaN`。**应加 `if (!map[data.difficulty]) return 400` 校验**。
3. **业务规则散落在 HTTP handler**：`complete()` 既是路由又是"完成领域逻辑"，无 service 层，无法单测、无法复用（如定时任务自动完成）。
4. **`active_track` 单例（id=1）**：全局唯一追踪任务，隐含"单用户"假设。若未来多用户/多端并发，会互相覆盖（与"上云多端"目标冲突）。
5. **`reputation`/`skill_points` 存 `meta` 表为字符串**：每次 `parseInt` 读写，类型易错且无事务保护（并发 +1 可能丢）。

**改进建议**
- 抽出 `services/questLogic.js`：`calcReputation()`、`completeTask()`、`checkEpicProgress()`，handler 只做 IO。
- 所有写入口加 zod/手动校验，difficulty 非法即 400。
- `meta` 数值改独立计数器表或带事务的 `UPDATE ... + ?` 自增，避免读-改-写竞态。
- 多端前先给 `active_track`、声望加 `userId` 维度（即便 1.0 单用户，也预留列）。

---

## 5. 可维护性角度

**现状**
- 前端工程化较好：TS、eslint、precommit hook、组件分层（pages/components/ui）。
- 后端几乎零工程化：无测试、无 lint、无类型、无迁移、无日志框架（仅 `console.error`）。
- 文档齐全：README / AGENTS.md / 悬赏任务.md（as-built 规格书）质量高。

**问题与风险**
1. **后端无测试**：30+ 端点、含结算/进度等复杂逻辑，全靠手动验证，回归风险高。
2. **魔法数字与字符串硬编码**：难度→声望映射 `{easy:5,...}`、manaMax 上限、默认技能点 `3`/声望 `100`（`index.js:186-187`）散落，无集中常量。
3. **隐式数据契约**：前端 `@/types/quest` 与后端返回靠默契，改动无编译期保护。
4. **`genId` 用 `Date.now()+random`**（`index.js:198`）：极低概率碰撞，并发写（如批量导入）可能冲突。
5. **规格书与代码可能漂移**：规格书标注"艾宾浩斯回顾 ❌ 未实现""capabilities 占位"，说明文档诚实，但 still 需人工核对 as-built vs as-coded。
6. **Electron 与 Web 共享同一前端但两套存储语义**：新人易踩"为什么我浏览器加的任务桌面端看不到"。

**改进建议**
- 后端补最小测试（vitest + supertest 跑 `complete()`/`redeem()` 等关键路径），不必全量。
- 集中常量到 `server/constants.js`（难度系数、默认 meta）。
- `genId` 改用 `crypto.randomUUID()` 或纳秒时间戳，消除碰撞。
- 用 `shared/types` 生成前后端共享契约（zod → TS）。

---

## 6. 风险汇总与优先级

| 风险 | 维度 | 严重度 | 建议时机 |
|------|------|--------|----------|
| 双存储数据漂移 | 耦合/产品 | 高 | 对齐时定为"后端唯一源" |
| 结算公式两处不一致 | 业务 | 高 | 1.0 必改（已定） |
| 后端无校验→NaN | 业务/健壮 | 中 | 上云前 |
| 后端单文件巨石 | 架构/维护 | 中 | 上云迁移时顺带拆分 |
| CORS 全开无鉴权 | 安全 | 中 | 后端上云（方案 C）时 |
| 无测试/魔法数字 | 维护 | 中 | 持续 |
| capabilities 空壳字段 | 耦合 | 低 | 1.0 只映射不迁移 |
| Electron 双份后端 | 架构 | 低 | 清理副本 |

---

## 7. 结论

quest-guide 是一套**产品完成度高、前端工程化好、但后端工程化薄弱**的系统。其最强资产是游戏化设计与桌面悬浮体验，最弱处是**单文件后端、双存储耦合、无测试与契约**。

对齐「日程统筹 ↔ 日常悬赏」的 1.0 路径应当：
1. 以**后端为唯一数据源**，消除 localStorage 漂移；
2. **统一声望公式**到 quest-guide 侧；
3. 仅迁移"每日悬赏 + 史诗待办"结构（带 `qg_` 前缀），不搬技能/商店等富交互；
4. 顺手补 `difficulty` 校验、集中常量，为后续上云（方案 C）铺路。

详见配套文档 `quest-guild-升级方案-1.0.md`。
