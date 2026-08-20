# Quest Guild 升级方案 1.0 — 日程统筹 ↔ 日常悬赏活动对齐

> 版本：1.0 · 日期：2026-08-18
> 范围：仅第一点（日程统筹与日常悬赏活动对齐）+ 云端同步操作流程 + 数据集中存放可行性评估。
> 暂缓（不在本方案）：quest-guild 后端整体上云迁移、quest-guild 应用逻辑问题修复。
> 配套文档：
> - [quest-guild 游戏化评估](./quest-guild-游戏化评估.md)（界面吸引力 + 奖励机制 + 优先级，本文 §4 指出 streak 应优先于悬赏字段对齐）
> - [quest-guild 代码系统性分析](./quest-guild-代码分析.md)（五维度架构审计，与本文 §2 风险互证）

---

## 1. 背景与目标

- **现状**：
  - `workspace-server`（已部署于 `life.hchch.tech`，Docker 化，Bearer 鉴权已就位）内置「日程统筹」模块，本质是一套**轻量游戏化待办**（声望结算、`今日/累计/连续天数`、难度、能力分类、循环）。
  - `quest-guide`（本地）是一套**完整游戏化公会系统**，其中「每日悬赏」(DailyTask) 是核心日常循环，另含史诗/Boss、注意力/法力、追踪专注、技能树、商店、目标、复盘等。
- **目标**：将 `日程统筹` 模块**对齐**到 quest-guild 的「日常悬赏活动」模型，并把本地 quest-guild 的悬赏数据**同步上云**，使其在工作台可被查看/延续。
- **非目标**：quest-guild 全部后端上云、技能树/商店等富交互上云、应用 bug 修复 —— 见第 6 节。

---

## 2. 现状对比

| 维度 | workspace-server · 日程统筹 | quest-guide · 每日悬赏 |
|------|------------------------------|------------------------|
| 任务字段 | title, type, difficulty, status, parent_id, stage, ability_category/sub, estimated_minutes, due_date, recurrence_type/param, reputation | name, description, type, difficulty, estimatedMinutes, rewardReputation, rewardSkillPoints, status, parentId, stage, bossName/Progress, isTracking, isAttention, tags, capabilityIds, createdAt, completedAt |
| 完成结算 | `max(10, round(min×{0.5/1/2/3}))` | `{5/10/25/80}[diff] + floor(min/10)*2` |
| 史诗/Boss | 仅 parent_id+stage（无 Boss 进度条） | 完整树 + bossName + bossProgress |
| 注意力/法力 | 无 | 有（manaMax 限制并行注意力任务） |
| 追踪专注 | 无 | 有（active_track + focus_logs） |
| 声望持久化 | 由每任务 reputation 累计（前端算） | `meta.reputation` 服务端累加 |
| 技能点/商店 | 无（仅"奖励"文本） | 有（skill_points + shop + redemptions） |

**结论**：日程统筹 ≈ 每日悬赏的「字段子集 + 简化结算」。对齐主要是**补全字段 + 统一结算公式 + 打通同步**。

---

## 3. 对齐设计（日程统筹 ↔ 日常悬赏）

### 3.1 字段映射

| quest-guide (本地) | workspace-server (云端) | 处理 |
|--------------------|--------------------------|------|
| `id` (t_/dy_) | `id` (task-) | 迁移时用 `qg_` 前缀重映射，避免与现有 `task-` 冲突 |
| `name` | `title` | 重命名 |
| `description` | （缺） | **方案 1.0：新增 `description` 列**（可选，不强制） |
| `type` (daily/epic) | `type` | 一致；云端已支持 epic |
| `difficulty` | `difficulty` | 一致（easy/normal/hard/epic） |
| `estimatedMinutes` | `estimated_minutes` | 一致 |
| `rewardReputation` | `reputation` | **统一公式**（见 3.3） |
| `status` (pending/active/completed) | `status` (pending/completed) | quest-guide 的 `active` 中间态 → 映射为 `pending`（云端不引入 active） |
| `parentId` / `stage` | `parent_id` / `stage` | 一致 |
| `bossName` / `bossProgress` | （缺） | 史诗专属；**1.0 暂不同步**（仅同步待办结构） |
| `isTracking` / `isAttention` | （缺） | 专注/注意力；暂缓 |
| `tags` / `capabilityIds` | `ability_category` / `ability_sub` | 仅映射首个 capability 到 ability 字段 |
| `createdAt` / `completedAt` | `created_at` / `completed_date` | 一致 |

### 3.2 行为对齐

- **完成结算**：云端沿用 `PUT /api/tasks/:id` 的 completed→reputation 逻辑，但**改用 quest-guild 公式**（见 3.3），保证两处一致。
- **难度系数**：双方 difficulty 枚举一致，无需转换。
- **循环任务**：云端已有 `recurrence_type/param`，quest-guide 每日悬赏默认 `none`（循环由本地生成），迁移时置 `none`。
- **展示**：工作台「日程统筹」卡片渲染补 `description`（有则显、无则隐），其余复用现有 meta 行。

### 3.3 统一声望公式（推荐）

```js
// 以 quest-guild 公式为准（更贴合游戏化设计）
function calcReputation(difficulty, estimatedMinutes) {
  const base = { easy: 5, normal: 10, hard: 25, epic: 80 }[difficulty] ?? 10;
  const timeBonus = Math.floor((estimatedMinutes || 0) / 10) * 2;
  return base + timeBonus;
}
```

---

## 4. 云端同步操作流程（具体步骤）

### 4.1 数据流

```
[本地] quest-guide
   ├─ 浏览器: localStorage(__quest_guild_tasks)
   ├─ Electron: electron-store 加密 JSON  ─┐
   └─ 本地后端: server/quest-guild.db  ───┤
                                           │  ① 导出 JSON
                                           ▼
                              ② 字段映射 + id 重映射(qg_前缀)
                                           │
                                           ▼
[云端] workspace-server  /api/tasks/sync  (批量 upsert by id)
                                           │
                                           ▼
                              ③ 强刷工作台 → 日程统筹显示同步数据
```

### 4.2 前置：云端扩展（必做）

在 `workspace-server/server/db.cjs` 的 `workspace_tasks` 建表语句补列：
```sql
ALTER TABLE workspace_tasks ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE workspace_tasks ADD COLUMN source TEXT DEFAULT 'local';  -- 'qg' 标记来源
-- reputation 列已存在；如需保留原 rewardSkillPoints 可加：
ALTER TABLE workspace_tasks ADD COLUMN reward_skill_points INTEGER DEFAULT 0;
```
新增批量端点 `server/routes/tasks.cjs`：
```js
// POST /api/tasks/sync  body: { tasks: [...] }  按 id upsert
router.post('/sync', (req, res) => {
  const db = getDatabase();
  const tx = db.transaction(list => {
    for (const t of list) {
      db.prepare(`INSERT INTO workspace_tasks (id,title,...,source,updated_at)
        VALUES (@id,@title,...,@source,@updated_at)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title, ...`).run(t);
    }
  });
  tx(req.body.tasks || []);
  res.json({ success: true, count: (req.body.tasks||[]).length });
});
```

### 4.3 迁移脚本（一次性，本地运行）

```js
// migrate-qg-to-cloud.mjs —— 运行于本地，读取 quest-guild.db 推送到云端
import Database from 'better-sqlite3';
const db = new Database('server/quest-guild.db');
const rows = db.prepare("SELECT * FROM tasks WHERE type='daily' OR type='epic'").all();
const token = process.env.API_TOKEN; // workspace-server 的 Bearer
const mapped = rows.map(r => ({
  id: 'qg_' + r.id,
  title: r.name,
  description: r.description || '',
  type: r.type,
  difficulty: r.difficulty,
  status: r.status === 'active' ? 'pending' : r.status,
  parentId: r.parentId ? 'qg_' + r.parentId : null,
  stage: r.stage || 1,
  estimatedMinutes: r.estimatedMinutes,
  dueDate: r.completedAt ? new Date(r.completedAt).toISOString().slice(0,10) : null,
  reputation: r.rewardReputation,
  source: 'qg'
}));
await fetch('https://life.hchch.tech/api/tasks/sync', {
  method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
  body: JSON.stringify({ tasks: mapped })
});
```

### 4.4 增量同步策略（1.0 之后）

- **单向（推荐起点）**：本地 quest-guild 为**写入主**，定期（手动/定时）跑 4.3 脚本推云；云端工作台**只读展示**。
- **双向（远期）**：工作台也允许勾选完成 → 完成后回写本地 `completedAt` + 触发 quest-guild 声望结算（需 quest-guild 后端也在云或被桌面端消费）。复杂度高，1.0 不做。

### 4.5 验证

```bash
# 云端条数核对
curl -s -H "Authorization: Bearer $API_TOKEN" https://life.hchch.tech/api/tasks | python -c "import sys,json;d=json.load(sys.stdin);print('total',len(d['data']),'qg',len([x for x in d['data'] if x.get('source')=='qg']))"
# 强刷工作台 → 日程统筹应出现 qg_ 前缀任务，声望/难度正确
```

---

## 5. 数据集中存放评估（可行性 + 优劣）

| 方案 | 描述 | 可行性 | 优点 | 劣势 |
|------|------|--------|------|------|
| **A 全集中** | skills/shop/goals/reflections/projects 也上云，工作台承载全部 | 低 | 单一数据源、跨端强一致、备份集中一处 | workspace-server 单文件 HTML 难以承载技能树 SVG/商店/统计等富交互；后端需大改；工作量巨大 |
| **B 仅同步日程统筹/悬赏** | 只把「每日悬赏 + 史诗待办」对齐进云端 Tasks | **高** | 改动小、契合"对齐"目标、风险低、可立即落地 | 技能/商店/目标仍在本地，数据两处（但本就是 quest-guild 的核心资产，留本地合理） |
| **C 双轨独立云** | quest-guild 后端独立上云（如 `quest.hchch.tech`），工作台只做对齐 | 中 | 各自独立演进、不污染工作台、近端架构清晰 | 需再维护一个 Docker 服务 + 域名 + 备份 |

**推荐：1.0 采用方案 B**，远期按需演进到 C（若想要全云）或 A（若接受重写工作台为富应用）。

**集中存放的核心风险**：
1. **单文件 HTML 的天花板**：workspace-server 是 vanilla JS 单文件，塞入技能树/商店等交互会失控 → 这是 A 不可行的主要约束。
2. **结算一致性**：quest-guild 的声望/技能点在服务端 `meta` 累加；若只同步待办而不同步 `meta`，云端声望会与本地割裂 → B 方案下云端声望仅反映"从同步起的新完成"，旧声望不迁移（可接受，因展示为主）。
3. **ID 命名空间**：必须加 `qg_` 前缀，否则与工作台原生 `task-` 冲突、互相覆盖。

---

## 6. 实施路线图

| 阶段 | 内容 | 状态 |
|------|------|------|
| 1.0-1 | 云端 `workspace_tasks` 补列 + `/api/tasks/sync` 端点 | 待做 |
| 1.0-2 | 字段映射 + id 重映射脚本（4.3） | 待做 |
| 1.0-3 | 统一声望公式（3.3）落云端 | 待做 |
| 1.0-4 | 跑迁移 + 验证 | 待做 |
| 1.0-5 | 工作台展示补 `description` | 待做 |

**暂缓（后续单独排期）**：
- quest-guild 后端整体上云（方案 C）
- quest-guild 应用逻辑 bug 修复（见代码分析文档）
- 双向增量同步、技能/商店上云（方案 A）

---

## 7. 与既有工作台的衔接

- 日程统筹模块（`public/index.html` 的 `Tasks` 对象）已通过 `ApiClient` 走 `window.location.origin`，天然对接云端，无需改调用方式。
- 新增 `source='qg'` 的数据在 `Tasks.render` 中无需特殊处理（字段兼容），仅在需要时加"来源"角标。
- 鉴权：云端已启用 Bearer，迁移脚本与工作台均带 token，无需额外改造。
