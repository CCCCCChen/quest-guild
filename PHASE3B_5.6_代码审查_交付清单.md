# Phase 3B + 决策4 + Phase 5.6 + 代码审查 — 交付清单

> 日期：2026-08-18 | 负责人：WorkBuddy | 状态：✅ 已完成并验证

## 一、功能交付

### 决策4：法力水晶 → 专注槽（语义诚实改名）
- 全局 7 文件 12 处文案改名：Topbar / FloatingWidget / Settings / ProjectDetailPage / TodayPage / QuestPoolPage / useTasks。
- 含 toast 自然化（"法力水晶不足"→"专注槽已满"）、设置项（"专注槽上限/设置"）。
- 内部代码标识 `manaMax`/`activeAttentionTasks` 等保留（仅改 UI 语义，不动 storage schema）。

### Phase 3B：段位数字框架（决策 2 方案 B）
- 新建 `src/lib/rank.ts`：`RANK_TIERS`（6 段位：初心者→学徒→好手→专家→大师→传奇勇者，基于总声望门槛）+ `computeRank`（返回段位/下一段位/进度）。
- `Topbar` 新增「段位」状态块，跟随 `useShop.reputation` 联动，hover 显示"距下一段位还差 N 声望"。**不做升级曲线**（避免等级通胀失去目标感）。

### Phase 5.6：前端主链修复
- **侦察关键结论**：代码比路线图**超前**——项目进度自动汇总（ProjectsPage）、主创建表单 `goalId/projectId` 关联 Select + `onSubmit` 透传 + `projectOptions` 按目标过滤联动，**早已实现**，无需改动。
- 本轮补齐的真实缺口：
  - `IGoal` 补 `milestone`/`milestoneDeadline` 字段（修 Phase 5.5 给 DB 加列却没同步前端的类型断层）。
  - `GoalsPage`：目标汇总（该目标下项目数 + 任务完成进度条）、`deadline` **逾期高亮**（过期 Badge 变 destructive 红）、里程碑展示、表单可维护里程碑。
  - `useGoals.addGoal` payload 类型改为 `Partial<IGoal> & { name }`（typecheck 抓到 milestone 不被允许，已修）。

## 二、代码审查与优化（用户要求）

### 已修复（4 项）
1. **ProjectsPage 进度重复计算**：两个 IIFE 重复算同一完成率 → 抽 `projectProgress` useMemo 复用（消除重复、提升可读性）。
2. **重复 `formatDate`/`formatDateTime`**：`GoalsPage`、`ReflectionsPage` 各本地定义了一份，与 `utils.ts` 公共版重复 → 删除本地版，统一 import 公共版；公共版改为支持可选参数（`undefined`→`''`）以兼容调用点。
3. **死导出**：`economy.ts` 的 `IMORTANCE_LABELS` 全仓无人 import → 删除（避免误导）。
4. **类型断层**：`useGoals.addGoal` payload 缺 `milestone` → 改为 `Partial<IGoal> & { name }`，与 Phase 5.5 DB 列对齐。

### 配置建议
- `tsconfig.app.json` 中 `noUnusedLocals` / `noUnusedParameters` 当前为 **false** → 建议改 `true`，让 tsc 自动捕获未用 import/变量，防止死代码积累。

### 可选进一步优化（非阻塞，留待后续）
- 生产包单 chunk 2MB+（gzip 657KB）：用动态 `import()` 做路由级代码分割；vite 已提示。
- `sk_*` 孤儿树清理（路线图 Wave 2 前置，上云前清，避免推无用数据）。
- 各页面相似表单模式（react-hook-form + zod + shadcn）可考虑抽公共字段组件，属大重构，收益中风险高，建议按需。

## 三、验证
| 项 | 结果 |
|---|---|
| `tsc -p tsconfig.app.json` typecheck | ✅ exit 0 |
| `vite build` 生产构建 | ✅ exit 0（仅 chunk 体积警告，与改动无关） |

## 四、下一步
- **Phase 2/6** 上云同步（含 P0-3 云端公式对齐，依赖本地模型已锁死）。
- **Phase 5** Electron asar 只读修复（db 迁 userData）。
- sk_* 孤儿树清理（上云前置）。
