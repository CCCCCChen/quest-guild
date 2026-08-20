# Quest Guild 数据上云方案 — B+ 延迟同步

> 日期：2026-08-18
> 基于：合并版 v1.0 的方案 B（仅同步悬赏/史诗），补入用户提出的**数据分级 + 延迟同步 + 精简后端 + 算力估算**思路。
> 结论先行：**B+ 是 B 的进化版——不新增容器、不新增进程、不新增域名，只在现有 workspace-server 上加一个 `/sync` 端点和两列，内存增量 < 5MB。**

---

## 1. 为什么不是 B，也不是 C

| 维度 | B（原方案） | **B+（本方案）** | C（独立云） |
|------|------------|-----------------|------------|
| 同步时机 | 手动迁移脚本（一次性） | **关闭时推送 + 手动触发** | 实时双向 |
| 云端改动 | 补 2 列 + `/sync` 端点 | 同左 + `qg_meta` + 同步队列 | 整个后端 docker 化 + 新域名 |
| 新增容器 | 0 | **0** | 1 |
| 新增进程 | 0 | **0** | 1 (Node.js) |
| 内存增量 | ~2MB | **~2–5MB** | ~45–65MB |
| 手机端完整体验 | ✗（仅看悬赏） | ✗（仅看悬赏 + 声望/streak） | ✓ |
| 适用场景 | 一次性搬数据 | **长期低频同步、算力敏感** | 想要全云 |

**B+ 的核心洞察**：你的数据根本不需要实时同步。quest-guild 是单人桌面应用，"关闭时推送"足以覆盖 99% 的场景——你做完任务关电脑，数据就上云了；下次在手机上看工作台，就能看到最新状态。

---

## 2. 数据分级：四层分类

### Tier 1 — Hot（核心循环 · 关闭时推送）

| 实体 | 交互频率 | 云端用途 | 同步策略 |
|------|---------|---------|---------|
| `tasks`（daily + epic） | 每日多次创建/完成/删除 | 工作台日程统筹卡片展示 | before-quit flush + 手动触发 |
| `meta: reputation` | 每次完成任务变更 | 工作台显示声望 | 随 task 一起推送 |
| `meta: skill_points` | hard/epic 完成时变更 | 工作台显示技能点 | 随 task 一起推送 |
| `meta: streak` | 每日重置/累加 | 工作台显示连续天数 | 随 task 一起推送 |
| `meta: todayReputation` | 每次完成任务变更 | 工作台显示今日声望 | 随 task 一起推送 |

**为什么这些必须上云**：工作台的"日程统筹"模块需要展示你的任务完成情况和声望趋势。这是唯一有跨设备查看需求的数据层。

### Tier 2 — Warm（历史记录 · 批量同步 · 可选）

| 实体 | 交互频率 | 云端用途 | 同步策略 |
|------|---------|---------|---------|
| `focus_logs` | 每次完成追踪任务产生一条 | 声望趋势图/统计 | 手动触发批量推送 |
| `redemptions` | 每次商店兑换产生一条 | 兑换历史 | 手动触发批量推送 |

**为什么是"可选"**：这些数据对"跨设备查看"的即时性要求不高。如果你只想在手机上看"今天做了什么任务、得了多少声望"，Tier 1 就够了。Tier 2 的价值在于长期统计趋势。

### Tier 3 — Cold（本地配置 · 不上云）

| 实体 | 交互频率 | 为什么不上云 |
|------|---------|-------------|
| `skills`（技能树） | 极少变更（解锁/强化时） | 结构性配置，非交易数据。换设备时可 JSON 导出/导入 |
| `shop_items`（商店目录） | 极少变更（偶尔新增/删除） | 同上 |
| `goals`（目标） | 偶尔创建/修改 | 规划数据，本地查看为主 |
| `projects`（项目） | 偶尔创建/修改 | 同上 |
| `reflections`（复盘） | 偶尔创建 | 个人反思，可导出 |

**为什么不上云**：这些数据的特点是"写了就基本不动"。它们不是你每天交互的核心循环，上云的收益（跨设备查看）远小于成本（新增表/路由/同步逻辑）。如果将来确实需要，可以用"一键导出 JSON → 手动上传到微盘/网盘 → 新设备导入"的方式解决。

### Tier 0 — Ephemeral（永不同步）

| 实体 | 为什么 |
|------|--------|
| `active_track`（计时器状态） | 纯实时状态（正在计时/暂停/累计秒数），同步它没有意义——关闭应用时计时自然暂停，下次打开恢复 |

---

## 3. 同步机制设计

### 3.1 触发时机

```
┌─────────────────────────────────────────────────┐
│  触发方式 1：Electron before-quit 事件            │
│  ─ 用户关闭应用时，检查是否有未同步的变更          │
│  ─ 有 → POST /api/tasks/sync（阻塞 quit 直到完成）│
│  ─ 失败 → 变更队列持久化到本地，下次启动时重试     │
├─────────────────────────────────────────────────┤
│  触发方式 2：手动"同步"按钮                        │
│  ─ 用户点击 → 全量 diff 同步（对比 lastSyncAt）    │
│  ─ 适合：长时间不关应用、想确认数据已上云           │
├─────────────────────────────────────────────────┤
│  触发方式 3：无                                    │
│  ─ 不做定时轮询，不浪费 CPU/网络                   │
│  ─ 单人应用不需要实时性                            │
└─────────────────────────────────────────────────┘
```

### 3.2 同步队列（本地）

quest-guide 前端维护一个轻量的"脏数据标记"：

```typescript
// 本地 localStorage 中
interface SyncState {
  lastSyncAt: number;        // 上次成功同步的时间戳
  dirtyTaskIds: string[];    // 有变更但未同步的 task id
  metaDirty: boolean;        // meta 是否有变更
}
```

每次本地 CRUD 操作时：
- 创建/更新/删除 task → `dirtyTaskIds.push(id)`
- 完成任务（声望/技能点变更）→ `metaDirty = true` + `dirtyTaskIds.push(id)`

### 3.3 同步载荷

```json
POST /api/tasks/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "lastSyncAt": 1723891200000,
  "tasks": [
    {
      "id": "qg_dy_xxx",
      "title": "完成项目文档",
      "type": "daily",
      "difficulty": "normal",
      "status": "completed",
      "estimatedMinutes": 30,
      "actualMinutes": 25,
      "completedDate": "2026-08-18",
      "reputation": 16,
      "rewardSkillPoints": 0,
      "source": "qg",
      "createdAt": "2026-08-18T10:00:00Z",
      "updatedAt": "2026-08-18T10:25:00Z"
    }
  ],
  "meta": {
    "reputation": 350,
    "skillPoints": 8,
    "streak": 5,
    "todayReputation": 45
  },
  "focusLogs": [
    {
      "id": "qg_fl_xxx",
      "taskId": "qg_dy_xxx",
      "date": "2026-08-18",
      "durationMinutes": 25,
      "completedAt": 1723891500000
    }
  ],
  "deletedTaskIds": ["qg_dy_yyy"]
}
```

### 3.4 服务端处理

```javascript
// workspace-server/server/routes/tasks.cjs 新增
router.post('/sync', (req, res) => {
  const db = getDatabase();
  const { tasks, meta, focusLogs, deletedTaskIds, lastSyncAt } = req.body;
  const now = new Date().toISOString();

  const upsertTask = db.prepare(`
    INSERT INTO workspace_tasks (id, title, type, difficulty, status, ...)
    VALUES (@id, @title, @type, @difficulty, @status, ...)
    ON CONFLICT(id) DO UPDATE SET
      title=@title, status=@status, reputation=@reputation,
      completed_date=@completedDate, updated_at=@now
    WHERE source = 'qg'
  `);

  const tx = db.transaction(() => {
    // 1. upsert tasks (仅 source='qg' 的行)
    for (const t of tasks) upsertTask.run({ ...t, now });

    // 2. 删除已删除的
    if (deletedTaskIds?.length) {
      const del = db.prepare("DELETE FROM workspace_tasks WHERE id = ? AND source = 'qg'");
      for (const id of deletedTaskIds) del.run(id);
    }

    // 3. 更新 qg_meta
    if (meta) {
      db.prepare(`
        INSERT INTO workspace_settings (key, value, updated_at)
        VALUES ('qg_meta', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?
      `).run(JSON.stringify(meta), now, now);
    }
  });

  tx();
  res.json({ success: true, synced: tasks.length, serverTime: Date.now() });
});
```

### 3.5 冲突策略

**本地为权威源，last-write-wins。**

理由：quest-guild 是单人桌面应用，云端数据是"镜像"不是"主库"。不存在多端同时编辑同一任务的场景。如果将来工作台也能编辑任务（双向同步），再引入 `updatedAt` 对比 + 冲突提示。

---

## 4. 服务器算力估算

### 4.1 当前服务器状态

```
[VM-24-14-opencloudos]
├─ Docker
│   ├─ workspace-server 容器
│   │   ├─ Node.js Express (1 进程)
│   │   │   ├─ RSS: ~40–60MB
│   │   │   ├─ CPU idle: ~0.1%
│   │   │   └─ 路由: 17 个 router 模块
│   │   └─ SQLite (budget.db + WAL)
│   │       ├─ 磁盘: ~2–5MB
│   │       └─ 内存: ~5–10MB (page cache)
│   └─ certbot 容器
│       ├─ RSS: ~5–10MB
│       └─ 每 12h 检查一次证书
├─ Nginx (反代)
│   └─ RSS: ~5–10MB
└─ 总内存占用: ~60–90MB
```

### 4.2 B+ 方案增量

| 项目 | 增量 | 说明 |
|------|------|------|
| 新增进程 | **0** | 同一个 Node.js 进程，多一个 route handler |
| 内存 (RSS) | **+2–5MB** | route 代码 + 请求解析 + SQLite prepared statements |
| 磁盘 (DB) | **+50–200KB** | 假设 200–500 条 task 行，每行 ~200–400 bytes |
| CPU (idle) | **+0%** | 无定时轮询，不增加 idle 负载 |
| CPU (peak) | **~1–2% / <100ms** | 每次 sync 请求处理（SQLite upsert 事务） |
| 网络 | **~2–20KB/次** | 每次同步的 JSON 载荷 |
| 新增域名 | **0** | 复用 life.hchch.tech |
| 新增证书 | **0** | 复用现有泛域名证书 |

**同步频率估算**：假设每天关应用 2–3 次，每次同步 5–20 条变更 → 每天 3 次 HTTP 请求，总数据量 < 100KB/天。对服务器来说几乎无感。

### 4.3 对比：C 方案（独立容器）增量

| 项目 | 增量 | 说明 |
|------|------|------|
| 新增进程 | **1** | 第二个 Node.js + Express |
| 内存 (RSS) | **+45–65MB** | 新容器 Node.js + better-sqlite3 + 代码 |
| 磁盘 (DB) | **+1–3MB** | 独立 quest-guild.db |
| CPU (idle) | **+0.1–0.2%** | 第二个常驻进程 |
| 新增域名 | **1** | quest.hchch.tech |
| 新增证书 | **1** | 需配置 certbot（hook 可复用） |
| 维护成本 | **中** | 两个容器要分别更新/备份/监控 |

### 4.4 结论

**B+ 的资源代价几乎为零。** 你现有的 VM 完全无压力。即使未来 task 数据增长到几千条，SQLite 的 upsert 性能仍然是亚毫秒级的，不会成为瓶颈。

真正消耗算力的不是"存了多少数据"，而是"跑了多少常驻进程"。B+ 不新增进程，这是它比 C 方案省的根本原因。

---

## 5. "优化后版本"上云的含义

你说"最终上云的数据应该是 quest-guild 优化好后的版本"，这意味着：

1. **Phase 0 先做完**：难度校验（杜绝 NaN）、声望公式统一。上云的数据不能带 bug。
2. **Phase 1 streak 先移植**：本地补上连续天数 + 今日声望。这些值随 task 一起同步到云端，工作台就能展示完整的游戏化进度。
3. **字段映射后**：`name → title`、`rewardReputation → reputation`、`qg_` 前缀。映射在同步载荷组装时完成，云端不需要知道 quest-guide 的原始字段名。

**上云的是"结果"不是"过程"**：云端存的是已完成/已创建的任务快照 + 声望/streak 元数据。quest-guild 的游戏逻辑（完成结算、技能解锁、商店兑换）仍在本地执行，云端只是"看板"。

---

## 6. 与合并版排期的关系

B+ 不改变合并版的 Phase 0–6 排期，而是细化了 Phase 2 的同步策略：

| 原合并版 Phase 2 | B+ 细化 |
|------------------|---------|
| 2.1 补列 `description` / `source` / `reward_skill_points` | 不变 |
| 2.2 新增 `POST /api/tasks/sync` | **升级为 batch upsert + meta + focusLogs** |
| 2.3 统一公式落云端 | 不变 |
| 2.4 迁移脚本（一次性） | **改为同步队列 + before-quit 推送** |
| 2.5 工作台展示 | **补 streak / todayReputation 展示** |
| — | **新增：qg_meta 写入 workspace_settings** |
| — | **新增：focus_logs 可选同步** |

Phase 6（C 方案独立上云）的触发条件不变：当你想要手机端完整公会体验时，再走 C。B+ 到 C 的迁移路径是平滑的——同步队列和载荷格式可以直接复用。

---

## 10. 留独立服务口子（架构缝）

方向已定：**现在走 B+（复用 workspace-server），但把"同步"抽象成可替换接口，使未来拆独立服务（方案 C）时只新增一个实现类 + 改一行配置，不动任何业务逻辑。**

### 10.1 SyncTarget 抽象

quest-guide 新增 `src/api/sync/target.ts`：

```typescript
export interface SyncPayload {
  lastSyncAt: number;
  tasks: QgTaskSnapshot[];
  meta: QgMeta;
  focusLogs?: QgFocusLog[];
  deletedTaskIds?: string[];
}
export interface SyncResult { success: boolean; serverTime: number; synced: number; }
export interface SyncTarget {
  push(payload: SyncPayload): Promise<SyncResult>;
  // 未来可选：pull(since: number): Promise<Snapshot>;
}
// 实现 A（当前 B+）：走 workspace-server 的 /api/tasks/sync
export class WorkspaceServerTarget implements SyncTarget { /* POST life.hchch.tech */ }
// 实现 B（未来 C）：走独立 quest.hchch.tech，仅占位
export class QuestServiceTarget implements SyncTarget { /* TODO */ }
```

### 10.2 一行配置切换

```typescript
// src/api/sync/index.ts
const target = (SYNC_TARGET === 'quest-service')
  ? new QuestServiceTarget()
  : new WorkspaceServerTarget();
```

`SYNC_TARGET` 来自环境变量 / 设置页，默认 `'workspace'`。

### 10.3 为什么这是"口子"而非"过度设计"

- 接口极小（仅 `push` + 稳定的载荷契约），不是重型抽象；
- 数据已用 `source='qg'` + `qg_` 前缀隔离，未来抽出 qg 行即独立成库；
- `/api/tasks/sync` 应写成自包含模块（独立 router + 独立表 schema），届时整段搬到新 Express 应用即可；
- 业务代码只依赖 `SyncTarget` 接口，不感知后端是 workspace-server 还是独立服务。

### 10.4 与阶段推进图的关系

架构缝在 **Phase 2** 一并落地（字段对齐时建抽象），**Phase 6** 用 `WorkspaceServerTarget` 接通 B+；未来 **Phase 7（可选）** 只需实现 `QuestServiceTarget` 并翻转配置，即升级为方案 C，无需重写同步逻辑。详见分阶段任务推进图。

---

## 7. 前端改动清单（quest-guide 侧）

| 改动 | 文件 | 复杂度 |
|------|------|--------|
| 同步队列（dirtyTaskIds + metaDirty + lastSyncAt） | `src/api/client.ts` 或新 `src/api/sync.ts` | 低 |
| `before-quit` hook → flush 同步队列 | `quest-guild-electron/main.ts` | 低 |
| "同步"按钮 UI | `src/components/Topbar.tsx` 或设置页 | 低 |
| 组装同步载荷（字段映射 + `qg_` 前缀） | `src/api/sync.ts` | 低 |
| 同步状态指示器（上次同步时间 / 待同步条数） | Topbar 或设置页 | 低 |

### 后端改动清单（workspace-server 侧）

| 改动 | 文件 | 复杂度 |
|------|------|--------|
| `workspace_tasks` 补列 `source` / `description` / `reward_skill_points` | `server/db.cjs` | 低 |
| `POST /api/tasks/sync` 端点 | `server/routes/tasks.cjs` | 低 |
| `qg_meta` 存入 `workspace_settings` | 复用现有 settings 表 | 无 |
| 工作台前端展示 qg 任务 + streak | `public/index.html` | 低 |

---

## 8. 风险与限制

| 风险 | 等级 | 缓解 |
|------|------|------|
| before-quit 同步失败（网络问题） | 低 | 队列持久化到 localStorage，下次启动自动重试 |
| 工作台与本地声望不一致 | 低 | 本地是权威源，工作台标注"最后同步时间" |
| 大量历史数据首次同步 | 低 | 首次可走手动全量导出/导入，之后只同步增量 |
| focus_logs 表云端不存在 | 低 | Tier 2 可选，先不做；做的话新建 `workspace_focus_logs` 表 |
| 双向同步（工作台编辑回写本地） | 中 | B+ 阶段不做，工作台 qg 任务只读；Phase 6 再考虑 |

---

## 9. 最终建议

1. **先做 Phase 0 + Phase 1**（难度校验、公式统一、streak 移植）——这是上云的前提。
2. **Phase 2 用 B+ 策略**（同步队列 + before-quit 推送 + 手动触发），不走一次性迁移脚本。
3. **Tier 2（focus_logs / redemptions）作为 Phase 2 的可选项**，先跑通 Tier 1 再说。
4. **Tier 3 永不上云**（或仅支持手动 JSON 导出/导入）。
5. **C 方案（独立容器）留到"想要手机端完整公会"时再启动**，那时 B+ 的同步逻辑可以直接复用。

*B+ = 用最小的云端代价，换取"关闭应用即上云"的跨设备体验。*
