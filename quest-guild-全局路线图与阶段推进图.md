# Quest Guild 全局路线图与阶段推进图（整合版 · v2.0）

> 日期：2026-08-18 · 整合自：升级方案 1.0、代码系统性分析、游戏化评估、升级总览合并版、数据上云 B+ 延迟同步、默认目标与能力树初值（均 2026-08-18）。
> **本文是「单一可信源」**——新对话只需读这一份 + `quest-guild.db` 现状，即可从 Phase 0 直接开工。配套原文见各分文档，深挖时回查。
> 状态坐标：所有云端前置（workspace-server Bearer 鉴权、#59/#64/#60 已验证）已完成；quest-guild 仍纯本地、待第一轮优化。

---

## §0 上下文记忆（新对话必读）

### 0.1 三个系统的关系

| 系统 | 形态 | 状态 | 角色 |
|------|------|------|------|
| **workspace-server** | Express + 单文件 `public/index.html`，Docker 部署 `life.hchch.tech`，Bearer 鉴权已就位 | 已上云运行中 | 集成式生活工作台（记账/日程/健身/书影音/方向语），含「日程统筹」模块 |
| **ledgerBook** | Electron 桌面记账 | 已连云端 | 独立记账端，云模式走 `life.hchch.tech`（带 Bearer） |
| **quest-guide** | Electron 桌面游戏化公会（React+TS 前端 / `server/index.js` 975 行 Express 单文件 / SQLite `quest-guild.db`） | 纯本地 | 完整 RPG 式目标管理（悬赏/史诗/Boss/技能树/商店/目标/复盘） |

### 0.2 已确认的决策（拍板项，勿再议）

1. **数据上云用 B+（延迟同步）**：不新增容器/进程/域名，复用 workspace-server + `/api/tasks/sync` + `qg_meta`，内存增量 <5MB。
2. **预留方案 C 架构缝**：Phase 2 抽象 `SyncTarget` 接口（`WorkspaceServerTarget` 现用 + `QuestServiceTarget` 占位），未来翻一行 `SYNC_TARGET` 配置即升级为独立服务。
3. **声望公式以 quest-guide 为准**，并引入「重要性权重 + 时长封顶」效率修正（见 §4）。
4. **后端为唯一数据源**（消除双存储漂移）；同步本地权威、last-write-wins。
5. **不收紧 CORS，用 Bearer 网关**（保护 `file://` 的 ledgerBook）。
6. **streak 移植优先于字段对齐**（云端已有、本地缺失，最高杠杆）。
7. **上云的是"优化后结果"（任务快照+声望/streak 元数据），游戏逻辑仍在本地执行。**

### 0.3 真实数据现状（来自 `server/quest-guild.db`，2026-08-18）

| 表 | 行数 | 关键事实 |
|----|------|---------|
| goals | 7 | 用户亲手撰写，含 why+success criteria，全 active；**但全是 3–10 年长期、无短期里程碑、13 个 task 的 goalId 全 null（主链断）** |
| projects | 1 | 测试垃圾 `"123"`，goalId=null → **项目层空置** |
| skills | 75 | **单一 `cap-*` 树（无双 schema 冲突）**；已解锁=前端+元认知+部分系统设计；**缺口：无健康分支、AI 分支全 locked** |
| tasks | 13 | **全部 goalId/projectId=null**（游离任务） |
| meta | 3 | skill_points=3、reputation=211 |

> ⚠️ `sk_*` 7 分类树仅代码孤儿（`skills/questguild-capability-init/`），**未入库**，应清理，避免同步时推上云。
> ⚠️ Electron 版种子源在 `server/`（/api/bootstrap 写 db），**不读 `src/data/preset.ts`**；安装版有 asar 只读隐患（db 应改到 `userData`）。

---

## §1 数据架构决策（A / B / C → B+ 定案）

| 维度 | A 全集中 | B 仅同步悬赏 | **B+ 延迟同步（定案）** | C 双轨独立云 |
|------|---------|-------------|------------------------|-------------|
| 同步时机 | — | 一次性脚本 | **关闭时推送 + 手动触发** | 实时双向 |
| 新增进程 | — | 0 | **0** | 1 |
| 内存增量 | — | ~2MB | **+2–5MB** | +45–65MB |
| 新域名 | — | 0 | **0** | quest.hchch.tech |
| 手机端完整体验 | 需重写工作台 | ✗ | ✗（仅看悬赏+声望/streak） | ✓ |
| 适用 | 不推荐 | 一次性搬 | **长期低频、算力敏感** | 想要全云时 |

**演进路径**：`B+（现在）→ C（想要全云时）→ [极端] A（仅当决定重写工作台）`。

**数据分四层**（决定什么上云）：
- **Tier 1 Hot**（关闭时推送）：tasks + meta(声望/技能点/streak/todayReputation)
- **Tier 2 Warm**（手动批量，可选）：focus_logs、redemptions
- **Tier 3 Cold**（永不上云，可 JSON 导出导入）：skills、shop_items、goals、projects、reflections
- **Tier 0 Ephemeral**（永不同步）：active_track 计时器

**算力估算**：每天 2–3 次同步，<100KB/天，CPU peak ~1–2%/<100ms。B+ 代价近乎零。

---

## §2 各阶段任务推进图（Phase 0 – 7）

> 每阶段含：目标 / 具体任务 / 涉及文件 / 复杂度 / 依赖 / 验收。复杂度：低/中/高。
> **第一轮优化 = Phase 0 + Phase 1**（地基 + 最高杠杆 streak）。

### Phase 0 — 安全与稳定地基（前置必做）
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| P0-1 | **难度校验**（非法 → 默认 normal 或 400），杜绝 NaN 经济崩 | `server/index.js` `complete()`/创建任务 | 低 |
| P0-2 | 集中魔法数字常量（`server/constants.js`：难度系数、默认 meta） | `server/index.js` | 低 |
| P0-3 | **统一声望公式**到 quest-guide 侧（本地+云端两处一致） | `server/index.js` + `workspace-server/server/routes/tasks.cjs` | 低 |

- **依赖**：无，可立即开工。
- **验收**：无法构造 NaN；两处公式返回值一致。

### Phase 1 — streak 移植 + 完成庆祝（最高杠杆）
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| P1-1 | 本地端 `连续天数` + `今日声望` UI（**复用云端 workspace-server 已验证逻辑**） | `src/components/*`、`server/index.js` meta 累加 | 中 |
| P1-2 | 完成瞬间视觉庆祝（confetti/粒子 + 卡牌翻面，复用现有 sound.ts/动画基建） | `src/components/FloatingTodayPage.tsx` + 动画 | 中 |

- **依赖**：Phase 0（公式/常量就绪）。
- **验收**：本地出现 streak 与今日声望；完成有动画。
- **为何先于对齐**：同时修掉游戏化评估的 UI 连击缺失 + 奖励缺复利，且复用云端代码，成本最低收益最高。

### Phase 2 — 字段对齐 + B+ 同步构建 + 架构缝（方案 B+）
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| 2.1 | `workspace_tasks` 补列 `description` / `source` / `reward_skill_points` | `workspace-server/server/db.cjs` | 低 |
| 2.2 | 新增 `POST /api/tasks/sync`（batch upsert by id + meta + focusLogs，Bearer） | `workspace-server/server/routes/tasks.cjs` | 低 |
| 2.3 | `qg_meta` 存入 `workspace_settings`（复用现有表） | 同上 | 无 |
| 2.4 | 前端同步队列（`dirtyTaskIds` + `metaDirty` + `lastSyncAt`）+ `before-quit` flush + 手动按钮 | `src/api/sync.ts`、`quest-guild-electron/main.ts` | 低 |
| 2.5 | 同步状态指示器（上次同步时间 / 待同步条数） | Topbar/设置页 | 低 |
| 2.6 | **架构缝**：`SyncTarget` 接口 + `WorkspaceServerTarget`（现用）+ `QuestServiceTarget`（占位）+ 一行 `SYNC_TARGET` 切换 | `src/api/sync/target.ts`、`src/api/sync/index.ts` | 低 |
| 2.7 | 工作台展示 qg 任务 + streak / todayReputation | `workspace-server/public/index.html` | 低 |

- **依赖**：Phase 0、Phase 1。
- **验收**：`curl` 核对 `qg_` 条数；强刷工作台出现同步任务、声望/难度/streak 正确；B+ 接通即 Phase 6 验收。
- **冲突策略**：本地权威、last-write-wins（单人应用无多端同编场景）。

### Phase 3 — 交互爽点（吸引力杠杆）
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| 3.1 | 玩家等级 / 经验条（里程碑时刻） | `server/index.js` meta + `src/components` | 中 |
| 3.2 | 数字框架（rank/段位赋予意义，如"今天 50 算好/差"） | 前端展示层 | 低 |

- **依赖**：Phase 1（streak 已建立）。

### Phase 4 — 经济重构（效率激励核心）
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| 4.1 | normal 给少量技能点（easy 0/normal 1/hard 2/epic 4 `[待拍板]`）；日常 normal 走「熟练度」进度（每完成 1 normal +1，满 10 解锁 1 普通节点） | `server/index.js` | 低 |
| 4.2 | 时长奖励封顶 `min(60, minutes) × 0.1`（最多 +6），替代无上限 `floor(min/10)*2` | `server/index.js` | 低 |
| 4.3 | **声望引入「重要性权重」** `M∈{低1.0/中1.2/高1.6/紧急2.0}`，公式 `声望 = round(B × M + 时长奖励)`（详见 §4） | `server/index.js` + 前端任务表单加「重要性」字段 | 中 |
| 4.4 | **声望防自灌（意义守恒）**：仅真实完成计入；时长封顶解刷分；可选周/月软上限 | `server/index.js` | 低 |

- **依赖**：Phase 0（常量集中后易改）；4.3 需前端「重要性」字段。
- **验收**：「紧急+hard」得分显著高于「低+easy 磨 3 小时」；激励方向纠正为「做重要的事」。

### Phase 5 — 资源定性 + 主链修复 + 默认初值
| 项 | 改动 | 文件 | 复杂度 |
|----|------|------|--------|
| 5.1 | 法力水晶：真再生资源 **或** 改名"专注槽"（消除假资源错配） | `server/index.js` + 前端 | 中 |
| 5.2 | 双存储定性：明确"后端唯一源"，消除 localStorage 漂移 | 前端 Hook 层 | 中 |
| 5.3 | `capabilities` 空壳：接上能力系统 **或** 停止采集 | `shared/capabilities` | 低 |
| 5.4 | 清理 Electron 双份后端副本 + 修 asar 只读隐患（db 改 `userData`） | `main.js`/`server/index.js`/`package.json` | 低 |
| 5.5 | **能力树补健康分支 + 清理 `sk_*` 孤儿**（见 §5 SQL） | `server/index.js` bootstrap / SQL | 低 |
| 5.6 | **目标补里程碑 + 主链修复**：project 种子、task 关联必填其一、项目进度由子任务汇总、目标页显示汇总+逾期高亮 | 前端 + `server` | 中 |

- **依赖**：Phase 2（已定后端唯一源）。
- **注**：5.5/5.6 是**纯本地种子**，可早于上云、甚至在 Phase 0 之前落地（给应用一个"锚点"），属高收益快赢。

### Phase 6 — B+ 同步接通验收（即 Phase 2 的 live 验证）
- Phase 2 已构建 B+ 同步；本阶段为**长期运行验收**：关闭应用→数据上云→手机端工作台可见最新状态；观察同步队列重试、工作台与本地声望标注"最后同步时间"。
- **依赖**：Phase 2。

### Phase 7（远期·可选）— 方案 C 独立服务
| 项 | 改动 | 复杂度 |
|----|------|--------|
| 7.1 | quest-guide 后端 docker 化 + Bearer（复用 P0）+ 域名 `quest.hchch.tech` + 证书 hook 复用 | 中 |
| 7.2 | 后端按实体拆 route（消 975 行巨石） | 中 |
| 7.3 | schema 版本/迁移表 | 中 |
| 7.4 | 最小测试（vitest + supertest 跑 `complete()`/`redeem()`） | 中 |
| 7.5 | 实现 `QuestServiceTarget` + 翻 `SYNC_TARGET='quest-service'` → 即升级为 C，同步逻辑零重写 | 低 |

- **触发条件**：想手机端用完整公会、或决定全云时启动。

---

## §3 阶段依赖与推进顺序（一句话）

```
Phase0(地基) ─→ Phase1(streak+庆祝) ─┐
                                      ├─→ Phase2(B+构建+架构缝) ─→ Phase6(接通验收)
Phase5.5/5.6(默认初值/主链,可提前) ─┘        │
                                              ├─→ Phase3(爽点)
                                              ├─→ Phase4(经济重构)
                                              └─→ Phase5(资源定性+清理)
Phase7(C 独立服务,远期可选)
```
**第一轮优化建议顺序**：Phase 0 → Phase 1 →（穿插）Phase 5.5/5.6 本地初值快赢。

---

## §4 效率激励优化：声望快速评估（落 Phase 4）

**固定输入**：难度 `B={5,10,25,80}`；重要性 `M={低1.0/中1.2/高1.6/紧急2.0}`；时长奖励 `D=min(minutes,60)×0.1`（≤+6）。

**公式**：`声望 = round(B × M + D)`

**快速查表**（未含时长；实际声望 = 查表值 + D≤6）：

| 难度 ＼ 重要性 | 低 ×1.0 | 中 ×1.2 | 高 ×1.6 | 紧急 ×2.0 |
|---------------|--------|--------|--------|-----------|
| easy 5 | 5 | 6 | 8 | 10 |
| normal 10 | 10 | 12 | 16 | 20 |
| hard 25 | 25 | 30 | 40 | 50 |
| epic 80 | 80 | 96 | 128 | 160 |

**示例**：「紧急+hard+45min」≈50+4.5=**55**；「低+easy+磨3h」=5+6=**11** → 激励方向纠正为做重要的事。
**技能点**：`{easy:0,normal:0,hard:1,epic:3}`，normal 用户走熟练度进度避免停滞。

---

## §5 默认目标与能力树初值（落 Phase 5，可提前快赢）

**数据纠正**：线上 db 已非「目标无预设 / 能力树双 schema」——goals 已有 7 条精写内容、skills 是单一 `cap-*` 树（75 节点）。

**关键整改（SQL 落库即用，向现有库追加，不删数据）**：
1. **补「健康与体能」一级分支（12 节点）**——对齐 goal #6 + 头号日常（居家减脂）。
2. **可选桥接 AI**：`cap-creation-ai`/`cap-creation-ai-basic` 置 unlocked，承接 goal #1（权重 35%）。
3. **清测试垃圾项目**：`DELETE FROM projects WHERE name='123' AND goalId IS NULL;`
4. **清理 `sk_*` 孤儿树**（代码层，避免上云推无用数据）。
5. **目标补 90 天里程碑**（截止 2026-11-16，可验证标准见分文档 §2.1）。
6. **主链修复**：task 关联必填 goalId/projectId 其一；project 进度由子任务汇总；目标页显示汇总+逾期高亮。

> 完整 SQL 与节点清单见 `quest-guild-默认目标与能力树初始值.md` §3。

---

## §6 待拍板项（新对话开工前请确认）

- [ ] **Phase 4 数值**：重要性系数 `M`、时长封顶、技能点/熟练度阈值（参考 §4 默认集）
- [ ] **Phase 3 是否做玩家等级**（中工作量，吸引力杠杆）
- [ ] **AI 桥接是否执行**（保留"纯靠任务解锁"的纯粹感 vs 让 goal #1 在树上"有起点"）
- [ ] **法力水晶定性方向**（真再生 vs 改名专注槽）
- [ ] **Electron 安装版 asar 只读修复**是否随 Phase 5 一并做

---

## §7 新对话「第一轮优化」开工清单（直接可执行）

**目标**：完成 Phase 0 + Phase 1（地基 + streak），并可选穿插 Phase 5.5/5.6 本地初值快赢。

1. **Phase 0 代码**：读 `server/index.js`，定位 `complete()` 与任务创建处的 difficulty 取值 → 加校验（非法→normal）+ 抽 `constants.js` + 统一声望公式。
2. **Phase 1 streak**：读云端 `workspace-server` 的连续天数/今日声望逻辑 → 在本地 `server/index.js` meta 累加 + `src/components` 加 UI；完成动画复用 `sound.ts`/现有动画基建。
3. **（可选快赢）Phase 5.5**：执行 `quest-guild-默认目标与能力树初始值.md` §3 的 SQL 补健康分支 + 清垃圾项目（先备份 `quest-guild.db` 连同 `-wal`/`-shm`）。
4. **验证**：本地 dev 跑通，确认无 NaN、streak 显示、完成有庆祝。

**涉及核心文件**：`E:\PersonalFiles\Coding\quest-guide\server\index.js`、`src\components\*`、`src\api\*`、`quest-guild-electron\main.ts`、`package.json`。

---

*整合版 v2.0 · 单一可信源。分文档：`quest-guild-升级方案-1.0.md` / `quest-guild-代码分析.md` / `quest-guild-游戏化评估.md` / `quest-guild-升级总览-合并版.md` / `quest-guild-数据上云-B+延迟同步.md` / `quest-guild-默认目标与能力树初始值.md`（均位于 `E:\PersonalFiles\Coding\quest-guide\`）。*
