# Phase 0 交付清单（安全与稳定地基）

> 日期：2026-08-18 · 对应路线图 §2 Phase 0

## 本次交付

### 新增 `server/constants.js`（P0-2 集中魔法数字 + Phase 4 默认集）
- 难度白名单 `VALID_DIFFICULTIES` + `DEFAULT_DIFFICULTY='normal'`
- `DIFFICULTY_BASE_REPUTATION` / `DIFFICULTY_SKILL_POINTS`（Phase 4 定案数值）
- `IMPORTANCE_WEIGHTS` / `DEFAULT_IMPORTANCE` / `TIME_REWARD_CAP_MINUTES` / `TIME_REWARD_PER_MIN` / `PROFICIENCY_THRESHOLD`（Phase 4 定案，一次定准免返工）
- 辅助函数：
  - `normalizeDifficulty(d)` — 非法/缺失 → `normal`
  - `normalizeImportance(m)` — 非法/缺失 → `medium`
  - `computeReputation({difficulty, importance, minutes})` — 实现 `round(B×M + D)`，时长封顶、绝不返回 NaN
  - `computeSkillPoints(difficulty)`

### 改造 `server/index.js`（P0-1 校验 + P0-3 本地公式统一）
| 位置 | 改动 |
|------|------|
| 顶部 require | 引入 `normalizeDifficulty / computeReputation / computeSkillPoints` |
| `POST /api/tasks`（创建） | 难度先 `normalizeDifficulty`；声望/技能点改走 `computeReputation` / `computeSkillPoints`，消除内联魔法数字与 NaN 风险 |
| `PATCH /api/tasks/:id`（改难度） | patch 含 difficulty 时先校验 |
| `POST /api/tasks/decompose`（AI 拆解） | difficulty 走 `normalizeDifficulty` |

## 验证结果
- `node --check server/constants.js` ✅ / `node --check server/index.js` ✅
- 边界冒烟测试全过：
  - 非法难度 `'x'`、缺失 `undefined` → `'normal'`
  - `computeReputation({difficulty:'bogus'})` 返回合法整数（非 NaN）
  - 默认值 `normal` ≈ 12、`easy` ≈ 6
  - 超长时长封顶：`epic+紧急+300min` = 166（只算 60min 的 +6）
  - 查表样例 `hard+高+45min` = 45
  - 技能点 `bogus`→0、`epic`→3；重要性非法回落 `medium`

## 范围说明（重要）
- **P0-3 云端侧未在本轮回改动**：`../workspace-server/server/routes/tasks.cjs` 的 `reputation` 计算（`minutes × multiplier`）与本地公式不同，但依据 §0.2 决策 3/4（声望公式以 quest-guide 为准、本地权威、last-write-wins），Phase 2 同步会以本地值覆盖云端列。改云端有动已部署服务的风险且语义不同，故随 Phase 2 同步落地。
- 新公式当前在**创建时**用预估时长计算；Phase 4 还需：① 任务表加 `importance` 字段 + 前端表单；② 完成时改用**实际时长**重算；③ 可选周/月软上限（防自灌）。

## 已知限制 / 后续
- Phase 4 的 `importance` 字段与 UI、实际时长重算、防自灌软上限未做（属 Phase 4 范围，本轮回仅把数值与公式函数定准）。
- 下一步：Phase 1（streak 移植 + 完成庆祝），可穿插 Phase 5.5/5.6 本地快赢（健康分支 + 清垃圾项目 + 目标里程碑 + 主链修复 + AI basic 解锁）。
