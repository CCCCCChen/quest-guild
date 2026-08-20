# Phase 1 交付清单 — streak 移植 + 完成庆祝

> 依赖：Phase 0（已交付）。范围：路线图第 82–89 行「第一轮优化最高杠杆项」。
> 验收标准：本地出现 streak 与今日声望；完成任务有动画。

## 交付物

| # | 文件 | 改动 |
|---|------|------|
| P1-1 | `src/lib/streak.ts`（新建） | `computeStreak` / `computeTodayReputation`，**忠实移植**云端 `workspace-server/public/index.html` `renderReputation`（1504–1522 行）已验证算法。差异：云端任务用 `completedDate`(ISO 字符串)，本地用 `completedAt`(毫秒时间戳)，统一转本地日期后回退。今天允许未完成而不中断、上限 365 天。 |
| P1-1 | `src/hooks/useTasks.ts` | 暴露 `streak` / `todayReputation`（useMemo）；`completeTask` 派发 `window` 事件 `quest:celebrate`（与 `sound.ts` 解耦，任何入口完成都触发）。 |
| P1-1 | `src/components/Topbar.tsx` | 顶部状态栏新增「🔥 连续天数」「✨ 今日声望」两块（与既有 法力水晶/公会声望/今日专注 并列）。 |
| P1-2 | `src/components/CelebrationLayer.tsx`（新建） | 全局覆盖层（fixed inset-0, z-100, pointer-events-none）。监听 `quest:celebrate`：confetti 30 粒子爆发（金/紫/蓝/绿/红）+ 奖励卡牌 3D 翻面（显示 +声望 / +能力点）。framer-motion 驱动。 |
| P1-2 | `src/components/Layout.tsx` | 挂载 `<CelebrationLayer />`（全局，任何路由/悬浮态均覆盖）。 |

## 验证结果（已自动执行）

- ✅ **TypeScript typecheck**：`tsc -p tsconfig.app.json` 通过（exit 0）
- ✅ **streak 算法单测**：8/8 边界用例通过
  - today-only=1 / yesterday+today=2 / 连续3天=3 / gap-breaks(今天+前天, 昨天缺)=1 / only-yesterday(今天未做不中断)=1 / stale-only(断2天)=0 / 无完成=0 / pending 不算=0
- ✅ **生产构建**：`vite build` 通过（3187 模块 transformed）。
  - ⚠️ 注意：默认 `dist` 输出因本机环境 `safe-delete`（回收站）在清理旧 `dist/assets` 时失败，与代码无关；验证时改用临时 `--outDir` 绕过。

## 怎么验证（本地 dev，手动）

```bash
# 终端 1：启动后端 API（端口 3001）
node server/index.js
#   终端应显示：悬赏任务公会后端已启动: http://localhost:3001

# 终端 2：启动前端（端口 5173）
npm run dev
#   打开 http://localhost:5173
```

1. **状态栏**：顶部应出现「🔥 连续天数」「✨ 今日声望」。预设任务无 `completedAt`，初始均为 0。
2. **完成庆祝 + 今日声望**：
   - 进入「今日任务」→ 点「注意力任务」卡片（或把「待激活悬赏」设为追踪/注意力后完成）→ 弹窗点「确认完成」。
   - 预期：屏幕中央 confetti 爆发 + 奖励卡牌翻面（+N 声望 / 若有 +能力点），伴随完成音效；
     顶部「今日声望」+N、「连续天数」变为 1。
3. **多日连续（streak>1）**（可选，演示用）：
   - 当前只有今天完成时 streak=1。要验证 streak=2，需昨天也有一条完成记录。
   - 安全做法：先备份 `server/quest-guild.db`，再用任意 SQLite 工具把**一条已有任务**的 `status` 改 `completed`、`completedAt` 改为「昨天 0 点时间戳」；刷新前端即见「连续天数」=2（今天再完成一次后）。
   - 或运行一条一次性脚本（better-sqlite3 同驱动）将一条 pending 任务标为昨天完成，重启后端+刷新前端。
   - ⚠️ 演示后若想复原，从备份恢复 db 即可；勿在生产库随意改 completedAt。

## 已知债务（非 Phase 1 阻塞，已记入项目记忆）

- `src/hooks/useTasks.ts` 里的 `calcReputation`（新建任务乐观显示用的奖励预览）仍用**旧公式** `base + floor(min/10)*2`，与 Phase 0 在 `server/constants.js` 定的 `round(B×M + D)` 不一致。仅影响「新建任务时前端即时显示的数值」；服务端以 `constants.js` 为准，刷新后对齐。待 **Phase 4** 引入 `importance` 字段/UI 时一并统一（届时前端 `calcReputation` 改为调用与 constants 同源的公式）。

## 下一步建议

- **Phase 4 经济重构**（数值已拍板定准）：加 `importance` 字段/UI + 完成时按实际时长重算 + 防自灌软上限，并顺手修上面的前端 `calcReputation` 债务。
- 或 **Phase 5.6 前端**：目标页汇总+逾期高亮、项目进度由子任务自动汇总、新建任务 `goalId/projectId` 必填其一（硬校验须前后端联动，勿单独加后端 400 守卫）。
- 或 **Phase 2/6**（B+ 同步到 workspace-server），届时一并落实 P0-3 云端公式对齐。
