# 本轮工作总结（2026-08-20）

## 完成的三件事

### 1. 定位 + 修复 workspace「待办任务」重复/残留 bug
- **根因**：workspace `public/index.html` 的「日程统筹」→「待办任务」列表调 `getTasks({status:'pending'})` **不带 source 过滤**，导致 quest 同步上来的 `source='qg'` 任务同时出现在「待办任务」和「悬赏任务」两个列表。Overview 统计同理混入。
- **修复**：`Tasks.load` + `Overview.load` 加 `.filter(t => t.source !== 'qg')`。quest 任务只归「悬赏任务」专区，工作台原生任务归「待办任务」。即使删除尚未传播到云端，「待办任务」也不再显示 quest 任务。

### 2. 补平 Q1 最后一个同步差额
`importance`/`actualMinutes` 此前不在同步快照中，现已全链路补齐：
| 层 | 文件 | 改动 |
|---|---|---|
| 云端 DB | `server/db.cjs` | `migrateWorkspaceTasksForQuestSync` 加 `importance TEXT` + `actual_minutes INTEGER` 列迁移 |
| 云端 API | `server/routes/tasks.cjs` | `/sync` INSERT + ON CONFLICT UPDATE + `mapTask` 回传新列 |
| quest 类型 | `src/api/sync/types.ts` | `QgTaskSnapshot` 加 `importance?`/`actualMinutes?` |
| quest 推送 | `src/api/sync/index.ts` | `mapTask` 发送 `importance`/`actualMinutes` |
| quest 合并 | `src/hooks/useTasks.ts` | `mergeRemoteTasks` 两分支均映射新字段 |

端到端测试 10/10 通过。

### 3. 梳理「还有什么未完成的」
- ✅ 已完成：待办过滤、Q1 差额（importance/actualMinutes）、双向 LWW + 墓碑 + 快照对账删除。
- ⏭️ 未进同步：`tags`/`goalId`/`projectId`（workspace 无对应概念，留 JSON blob 或后续处理）。
- ⏭️ 待部署：workspace-server 改动需重新 build+启动 docker 才生效。

## 验证
- `tsc --noEmit` EXIT=0
- `node --check` 云端语法通过
- `vite build` 全绿（767ms）
- 端到端测试 10/10（迁移→存入→回传→更新→对账删除）

## 用户需要做的
1. **重新 build + 启动 docker**（让 workspace-server 改动生效：待办过滤 + Q1 列 + 对账删除）。
2. quest 前端 `npm run dev` 已生效，无需额外操作。
3. 如果之前有"复活"的任务，重新部署后再删一次 + 同步即可永久消失。
