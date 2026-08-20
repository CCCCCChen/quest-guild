# Phase 4 经济重构 — 交付清单

> 日期：2026-08-18 | 负责人：WorkBuddy | 状态：✅ 已完成并验证

## 目标（决策 1 已拍板）
把 Phase 0 定准的经济数值**真正落地**：启用重要性权重 M、时长封顶、`hard:1/epic:3` 技能点、防自灌软上限，并消除 Phase 1 遗留的 `useTasks.calcReputation` 旧公式债务。

## 交付物

### 后端 `server/index.js` + `server/constants.js`
- [x] **`importance` 列幂等迁移**：`tasks` 表加 `importance TEXT DEFAULT 'medium'`，放在既有 migration 段（**不在** `db.exec` schema 模板内，避免 `//` 注释被当 SQL 报错）。
- [x] **创建端点接纳 importance**：落库并参与声望公式。
- [x] **完成端点重算**（核心改动）：用 `actualMinutes` + M 权重重算 `rewardReputation/rewardSkillPoints` 并落库，替换创建期估算值。
- [x] **防自灌软上限**：`constants.js` 新增 `awardWithWeeklySoftCap(weeklyRep, gain)`——周一起点 `getWeekStartISO`，cap=800，超出部分收益 ×50%（封顶 `urgent` 也难刷穿）。
- [x] **normal 熟练度**：normal 完成 +1 `meta.normal_proficiency`，满阈值(10)解锁下一 locked 技能节点并重置；技能点仅 `hard:1/epic:3` 直接给。

### 前端
- [x] `src/types/quest.ts`：新增 `TaskImportance = 'low'|'medium'|'high'|'urgent'`。
- [x] `src/api/tasks.ts`：create 负载接纳 `importance`。
- [x] `src/lib/economy.ts`（新建）：`calcTaskRewards` 镜像 `server/constants.js`，单一可信源。
- [x] `src/hooks/useTasks.ts`：**删除旧 `calcReputation/calcSkillPoints` 债务**，改用 `economy.ts`；`completeTask` 用实际时长本地重算奖励，展示与后端一致。
- [x] `src/pages/QuestPool/QuestPoolPage.tsx`：主表单加「重要性」选择器（zod 枚举 + Select + 默认值 medium）。
- [x] `src/components/FloatingWidget.tsx` / `src/pages/Today/TodayPage.tsx`：快加默认 `importance: 'medium'`。

## 验证结果
| 项 | 结果 |
|---|---|
| `node --check` 服务端 | ✅ |
| 服务端经济单测（M 权重/时长封顶 `min(60)×0.1`/软上限/技能点/周一起点） | ✅ 全过 |
| **端到端集成**（起 server，建 importance=high vs medium 任务、完成重算） | ✅ 全过（high→46 vs medium→36；完成按实际时长=40） |
| `tsc -p tsconfig.app.json` typecheck | ✅ |
| `vite build` 生产构建 | ✅（exit 0，仅 chunk 体积警告，与代码无关） |

## 已知限制 / 划界
- **软上限防自灌是"软"约束**（×50% 而非硬封顶），目的防激增而非完全禁止——符合拍板"防自灌"语义；硬风控留作后续观察。
- 集成测试后已还原 `.db`（备份 `server/backups/phase4-test/quest-guild.db.pre`）；旧 WAL/SHM 文件仍被一个**预存在**的 server 进程锁定、无害，下次启动迁移幂等重应用。
- 未动 P0-3 云端公式（随 Phase 2 同步）；未做 Phase 3B/5.6 前端/法力水晶改名/上云。

## 下一步候选
Phase 3B（等级数字框架）／Phase 5.6（前端主链修复）／决策 4（法力水晶改名）／Phase 2（上云同步）。
