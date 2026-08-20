# quest-guild「目标 / 项目 / 能力树」评估与默认初值（v2 · 基于真实 db）

> 数据源：`E:\PersonalFiles\Coding\quest-guide\server\quest-guild.db`（实时数据，含 `-wal`）。
> 读取时间：2026-08-18。
> **重要更正**：前版（v1）基于 `src/data/preset.ts` 推演，误判"目标无预设、能力树双 schema"。线上实际数据与此不同——本文以真实 db 为准重写。

---

## §0 真实数据快照（2026-08-18）

| 表 | 行数 | 关键事实 |
|----|------|---------|
| goals | **7** | 7 条均为你亲手撰写，含「为什么重要 + 成功标准」，全部 `status=active` |
| projects | **1** | 仅 1 条测试垃圾 `{name:"123", goalId:null, progress:0}` |
| skills | **75** | 单一 `cap-*` 树（非双 schema）；已解锁路径 = 前端工程师 + 元认知 + 部分系统设计 |
| tasks | **13** | **全部 `goalId=null`、`projectId=null`** → 主链断裂 |
| meta | 3 | `skill_points=3`、`reputation=211` |

> `sk_*` 7 分类树（`skills/questguild-capability-init/`）仅存在于代码预设里，**线上 db 未加载**——所以实际无双 schema 冲突，但它是孤儿，应清理。

---

## §1 合理性评估

### 1.1 目标 Goals（7 条）—— ✅ 写得好，⚠️ 但全是长期 + 主链断

你写的 7 条目标质量很高（都带"为什么重要 + 成功标准"，第 7 条还配了权重表）：

| # | 目标 | 截止（约） | 期限 | 评价 |
|---|------|-----------|------|------|
| 1 | 建立 AI 核心能力 | 2031 | 5 年 | 方向清晰，但**能力树上 AI 全 locked**（见 §1.3） |
| 2 | 强化 CS/软件工程 | 2029 | 3 年 | 好 |
| 3 | 数学能力建设 | 2029 | 3 年 | 好 |
| 4 | 产品创造能力 | 2031 | 5 年 | 好 |
| 5 | 金融与财富能力 | 2031 | 5 年 | 好 |
| 6 | 健康与长期续航 | 2037 | 10 年 | 好，但**能力树无健康分支**（见 §1.3） |
| 7 | 个人成长系统建设 | 2028 | 2 年 | 好，含权重表 |

**问题**：
1. **全是 3–10 年长期目标，无短期里程碑锚点**。学习规划铁律：没有季度/月度可验证节点，长期目标会一直"悬着"，无法驱动每周行动。
2. **目标与任务完全脱节**：13 个 task 的 `goalId` 全是 `null`。目标成了"墙上的标语"，不产生每日待办。
3. 截止日跨度大但无分解——`updatedAt` 仅第 7 条有过更新，其余自创建后未动。

### 1.2 项目 Projects（1 条）—— ❌ 等于缺失

- 唯一一条是测试残留 `"123"`：`goalId=null`、`description=""`、`capabilityIds=[]`、`progress=0`。
- **项目层完全未被使用**。而项目本应是"目标 → 任务"的中间聚合层（一个目标拆成几个项目，一个项目挂若干任务）。
- `progress` 是手填整数，没有从子任务完成度自动汇总——即使有真项目，进度也是"假进度"。

### 1.3 能力树 Skills（75 节点 cap-* 树）—— ✅ 设计合理，⚠️ 两处结构性缺口

结构健康：`skill-root` → 4 个一级域（元/创造/系统/影响）→ 12 个二级子域 → ~58 个三级叶。已解锁路径真实反映了你的画像（前端工程师 + 元认知 + 部分系统设计，`cap-creation-tech-frontend` 还是 `enhanced` L2）。

**缺口 A：完全没有「健康/健身」分支。**
- 你的头号日常活跃域是**居家减脂训练**（记忆里有固定训练节律 + 减脂页记录），且 goal #6 就叫"健康与长期续航"。
- 能力树里却一个健康节点都没有 → 健身类任务 `relatedSkillId` 无处挂靠，等于每次手动造节点。**这是最大结构性缺口。**

**缺口 B：AI 分支全 locked，却是你的 #1 目标（权重 35%）。**
- goal #1 把 AI 定为最高优先级，但 `cap-creation-ai` 及其 6 个子节点全部 `locked`（0 经验）。
- 目标与能力树之间没有任何"我已开始投入 AI"的承接信号。

**澄清**：`sk_*` 7 分类树**不在线上使用**，只是代码里的孤儿预设——可删，避免未来同步时把两套树都推上云。

### 1.4 关键判定（效率视角）

> **目标 → 项目 → 任务 主链是断的。** 目标写得再好，只要任务不回链、项目层空置，它就无法驱动日常执行——这正是"容易迷茫、容易中断"（你 goal #7 自述的最大问题）的系统层根源。
> 此外 **goal #1（AI）与 goal #6（健康）在能力树上均无承接**，是最该优先补的两块。

---

## §2 推荐默认初值

### 2.1 目标：保留 7 条 + 补「90 天里程碑」

不替换你写好的 7 条（它们是对的），而是给每条加一个 **2026-11-16 前可达成的、可验证**的里程碑，把长期目标钉到周节奏上。

| 目标 | 90 天里程碑（截止 2026-11-16） | 可验证标准 |
|------|-------------------------------|-----------|
| 建立 AI 核心能力 | 完成 1 个真实 LLM/RAG 小项目并跑通 | 有 repo + 可访问 demo 链接 |
| 强化 CS/SE | 产 1 份架构评审文档 + 修 3 个真实工程 bug | 有 PR/commit 记录 |
| 数学能力建设 | 学完 1 门线性代数应用课 | 产出 ≥5 篇学习笔记链接 |
| 产品创造能力 | 完成 1 个用户可试用产品原型 | 有可访问原型链接 |
| 金融与财富能力 | ledgerBook 月度报表自动化 | 能一键生成月报 |
| 健康与长期续航 | 连续 8 周完成训练节律（二/三/四 + 睡前微习惯） | 减脂页体脂记录 ≥8 次 |
| 个人成长系统建设 | quest-guild 完成 Phase 0–2（难度校验+streak+字段对齐） | 代码合并记录 |

> 这些里程碑建议作为 goal 的 `description` 追加一节「### 90 天里程碑」，或单独存一张 `goal_milestones` 表。时间锚点 + 可验证标准，是让目标真正产生行动力的前提。

### 2.2 能力树：补健康分支 + 接通 AI 首节点

**A. 新增「健康与体能」一级分支（12 节点）** —— 直接对齐 goal #6 与你的头号日常活动。节点清单与坐标见 §3 SQL。

**B. 打通 AI 承接** —— 把 `cap-creation-ai` 与首叶 `cap-creation-ai-basic` 置为 `unlocked`，让 goal #1 在能力树上"有起点"。（可选，若你想保持"靠刷任务解锁"的纯粹感可不做。）

**默认解锁集合建议**（贴合真实画像）：

| 节点 | 默认状态 | 理由 |
|------|---------|------|
| `cap-health`（新增） | unlocked | goal #6 + 头号日常 |
| `cap-health-*` 子/叶 | locked（除你已做的可后续解锁） | 靠健身任务刷出 |
| `cap-creation-ai` / `cap-creation-ai-basic` | unlocked（可选桥接） | 承接 goal #1 |
| 现有已解锁路径 | 保持不变 | 真实画像，无需动 |

### 2.3 项目：每个长期目标配 1 个承接项目（示例种子）

把空置的项目层补成"目标的下沉容器"。示例（非强制，可按实际调整）：

| projectId | goalId | name | capabilityIds |
|-----------|--------|------|---------------|
| proj-ai | g_ms8bzb2n_kkn1 | AI 实战项目 | cap-creation-ai |
| proj-se | g_ms8c0rmq_khxx | 工程能力沉淀 | cap-system-design, cap-creation-tech-backend |
| proj-math | g_ms8c2atj_xnkp | 数学应用学习 | cap-meta-learning-deep |
| proj-product | g_ms8c3e5j_vnn3 | 产品原型 | cap-creation-product |
| proj-wealth | g_ms8c4kk8_0ksk | 记账月报自动化 | cap-system-data-analysis |
| proj-health | g_ms8c61jb_dobf | 居家训练执行 | cap-health-strength, cap-health-body |
| proj-system | g_ms8c8udk_f3eq | quest-guild 升级 | cap-meta-self-focus |

### 2.4 主链修复规则（让默认初值真正生效）

1. **任务关联必填其一**：新建任务时 `goalId`/`projectId` 至少填一个，断掉"游离任务"。
2. **项目进度可自动汇总**：`progress` 保留手动覆盖，但默认由 `status='completed'` 子任务占比推算。
3. **目标页加汇总**：显示「下属项目 N · 任务 M · 进度 X%」，截止日逾期红字高亮。
4. **种子注入时机**：DB 空时写入；之后完全用户自治（与现有任务种子机制一致）。

---

## §3 可直接执行的 SQL（落库即用）

> ⚠️ 执行前请备份 `quest-guild.db`（连同 `-wal`/`-shm`）。以下语句向现有库**追加**健康分支并可选桥接 AI，不删除任何已有数据。

```sql
-- ===== A. 新增「健康与体能」一级分支（12 节点）=====
-- 一级域
INSERT INTO skills (id,name,description,category,parentId,level,status,x,y,icon,requiredSkillPoints,unlockedAt,proficiencyLevel,experience,lastImprovedAt)
VALUES ('cap-health','健康与体能','支撑 10 年持续积累的身体底盘：精力、体能、体态、作息、减脂。','健康与体能','skill-root',1,'unlocked',250,400,NULL,1,(strftime('%s','now')*1000),1,120,(strftime('%s','now')*1000));

-- 二级子域（locked）
INSERT INTO skills (id,name,description,category,parentId,level,status,x,y,icon,requiredSkillPoints,unlockedAt,proficiencyLevel,experience,lastImprovedAt)
VALUES
 ('cap-health-strength','力量训练','背/腿/核心力量，居家渐进式。','健康与体能','cap-health',2,'locked',250,250,NULL,2,NULL,0,0,NULL),
 ('cap-health-cardio','心肺有氧','有氧基础与心肺耐力。','健康与体能','cap-health',2,'locked',250,350,NULL,2,NULL,0,0,NULL),
 ('cap-health-body','体态矫正','骨盆前倾矫正、背部强化、核心稳定。','健康与体能','cap-health',2,'locked',250,450,NULL,2,NULL,0,0,NULL),
 ('cap-health-sleep','作息与恢复','规律作息、睡眠质量、训练恢复。','健康与体能','cap-health',2,'locked',250,550,NULL,2,NULL,0,0,NULL),
 ('cap-health-nutrition','饮食与减脂','居家渐进式减脂：热量管理 + Keep/帕梅拉。','健康与体能','cap-health',2,'locked',250,650,NULL,2,NULL,0,0,NULL);

-- 三级叶（locked）
INSERT INTO skills (id,name,description,category,parentId,level,status,x,y,icon,requiredSkillPoints,unlockedAt,proficiencyLevel,experience,lastImprovedAt)
VALUES
 ('cap-health-strength-core','核心训练','平板/死虫/臀桥等核心稳定。','健康与体能','cap-health-strength',3,'locked',150,230,NULL,3,NULL,0,0,NULL),
 ('cap-health-cardio-base','有氧基础','快走/慢跑/跳绳等有氧。','健康与体能','cap-health-cardio',3,'locked',150,330,NULL,3,NULL,0,0,NULL),
 ('cap-health-body-back','背部强化','针对背弱的后链训练。','健康与体能','cap-health-body',3,'locked',150,430,NULL,3,NULL,0,0,NULL),
 ('cap-health-body-apt','骨盆前倾矫正','放松髋屈/强化臀腹，改善 APT。','健康与体能','cap-health-body',3,'locked',150,470,NULL,3,NULL,0,0,NULL),
 ('cap-health-sleep-regular','规律作息','固定入睡/起床窗口。','健康与体能','cap-health-sleep',3,'locked',150,530,NULL,3,NULL,0,0,NULL),
 ('cap-health-nutrition-cut','居家减脂执行','Keep 免费 + 帕梅拉，按周节律推进。','健康与体能','cap-health-nutrition',3,'locked',150,630,NULL,3,NULL,0,0,NULL);

-- ===== B. 可选：打通 AI 承接（goal #1 桥接）=====
UPDATE skills SET status='unlocked', proficiencyLevel=1, experience=120,
       unlockedAt=(strftime('%s','now')*1000), lastImprovedAt=(strftime('%s','now')*1000)
WHERE id IN ('cap-creation-ai','cap-creation-ai-basic');

-- ===== C. 可选：清掉测试垃圾项目 =====
-- DELETE FROM projects WHERE name='123' AND goalId IS NULL;
```

---

## §4 与升级排期的关系

- 本文默认初值属 **Phase 5（迁移/初始化）** 范畴，但**不依赖上云**——纯本地种子，可在 Phase 0 之前就落地，让应用打开即有"锚点"。
- **能力树补健康分支 + 清理 `sk_*` 孤儿**是 Phase 2 字段对齐的前置清理项（否则同步时会把无用树推上云）。
- **目标补里程碑 + 主链修复**可与 Phase 4 经济重构同期做，让"完成重要任务"同时推进目标进度，形成激励闭环（呼应合并版 §6 效率激励优化）。
- 项目层补种子建议在 Phase 1（streak 移植）之后做，先把"每日坚持"钩子接上，再补结构。

> 下一步建议：先确认是否执行 §3 的 SQL（补健康分支 + 清垃圾项目），这是改动最小、收益最高的一步；AI 桥接看你是否想保留"纯靠任务解锁"的纯粹感。
