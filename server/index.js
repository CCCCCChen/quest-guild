const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { decomposeTask } = require('./services/llm');
const {
  normalizeDifficulty,
  normalizeImportance,
  computeReputation,
  computeSkillPoints,
  PROFICIENCY_THRESHOLD,
  getWeekStartISO,
  awardWithWeeklySoftCap,
} = require('./constants');

// 加载 .env（不依赖额外包）
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 数据库初始化
// Phase 5 asar 修复：打包后 __dirname 落在 app.asar（只读），db 必须写到可写目录。
// Electron 主进程在打包模式下通过 QUEST_GUILD_USER_DATA 注入 app.getPath('userData')；
// 开发模式不注入该变量，db 仍留在 __dirname（quest-guide/server），行为与历史一致。
const DB_DIR = process.env.QUEST_GUILD_USER_DATA
  ? path.join(process.env.QUEST_GUILD_USER_DATA, 'db')
  : __dirname;
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
// 注：DB_DIR 在打包模式下为 `<userData>/db`，故本文件最终位于 `<userData>/db/quest-guild.db`（P0-2 去三级同名嵌套）。
const db = new Database(path.join(DB_DIR, 'quest-guild.db'));
db.pragma('journal_mode = WAL');

// ========== 建表 ==========
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    estimatedMinutes INTEGER NOT NULL,
    actualMinutes INTEGER DEFAULT 0,
    relatedSkillId TEXT,
    goalId TEXT,
    projectId TEXT,
    capabilityIds TEXT DEFAULT '[]',
    bossName TEXT,
    bossProgress INTEGER DEFAULT 0,
    parentId TEXT,
    stage INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    isTracking INTEGER DEFAULT 0,
    isAttention INTEGER DEFAULT 0,
    rewardReputation INTEGER NOT NULL,
    rewardSkillPoints INTEGER NOT NULL,
    createdAt INTEGER NOT NULL,
    completedAt INTEGER,
    source TEXT DEFAULT 'user',
    tags TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS active_track (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    taskId TEXT,
    accumulatedSeconds INTEGER DEFAULT 0,
    lastStartTime INTEGER,
    isRunning INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS focus_logs (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    date TEXT NOT NULL,
    durationMinutes INTEGER NOT NULL,
    completedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL,
    parentId TEXT,
    level INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'locked',
    x REAL NOT NULL,
    y REAL NOT NULL,
    icon TEXT,
    requiredSkillPoints INTEGER NOT NULL,
    unlockedAt INTEGER,
    proficiencyLevel INTEGER DEFAULT 0,
    experience INTEGER DEFAULT 0,
    lastImprovedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cost INTEGER NOT NULL,
    icon TEXT NOT NULL,
    color TEXT,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'user',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY,
    itemId TEXT NOT NULL,
    itemName TEXT NOT NULL,
    cost INTEGER NOT NULL,
    redeemedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    deadline INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    goalId TEXT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    capabilityIds TEXT DEFAULT '[]',
    progress INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reflections (
    id TEXT PRIMARY KEY,
    taskId TEXT NOT NULL,
    expectedResult TEXT DEFAULT '',
    actualResult TEXT DEFAULT '',
    lessonLearned TEXT DEFAULT '',
    nextAction TEXT DEFAULT '',
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ========== 数据迁移 ==========
// 给旧表补 stage 字段
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN stage INTEGER DEFAULT 1').run();
} catch (e) { /* 已存在则忽略 */ }

try {
  db.prepare('ALTER TABLE tasks ADD COLUMN goalId TEXT').run();
} catch (e) { /* ignore */ }
try {
  db.prepare('ALTER TABLE tasks ADD COLUMN projectId TEXT').run();
} catch (e) { /* ignore */ }
try {
  db.prepare("ALTER TABLE tasks ADD COLUMN capabilityIds TEXT DEFAULT '[]'").run();
} catch (e) { /* ignore */ }

try {
  db.prepare("ALTER TABLE tasks ADD COLUMN importance TEXT DEFAULT 'medium'").run();
} catch (e) { /* ignore */ }

try {
  db.prepare('ALTER TABLE skills ADD COLUMN proficiencyLevel INTEGER DEFAULT 0').run();
} catch (e) { /* ignore */ }
try {
  db.prepare('ALTER TABLE skills ADD COLUMN experience INTEGER DEFAULT 0').run();
} catch (e) { /* ignore */ }
try {
  db.prepare('ALTER TABLE skills ADD COLUMN lastImprovedAt INTEGER').run();
} catch (e) { /* ignore */ }

// 初始化默认数据
const initMeta = db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)');
initMeta.run('skill_points', '3');
initMeta.run('reputation', '100');
initMeta.run('normal_proficiency', '0');
initMeta.run('settings', JSON.stringify({
  manaMax: 5,
  resetTime: '06:00',
  soundEnabled: true,
  floatingPosition: { x: -24, y: -24 },
  floatingOpacity: 0.8,
  floatingCollapseDelay: 1000
}));

// ========== 工具函数 ==========
function genId(prefix = 't') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function rowToTask(row) {
  if (!row) return null;
  return {
    ...row,
    isTracking: !!row.isTracking,
    isAttention: !!row.isAttention,
    tags: row.tags ? JSON.parse(row.tags) : [],
    capabilityIds: row.capabilityIds ? JSON.parse(row.capabilityIds) : [],
  };
}

function taskToRow(task) {
  return {
    ...task,
    isTracking: task.isTracking ? 1 : 0,
    isAttention: task.isAttention ? 1 : 0,
    tags: JSON.stringify(task.tags || []),
    goalId: task.goalId || null,
    projectId: task.projectId || null,
    capabilityIds: JSON.stringify(task.capabilityIds || []),
  };
}

// ========== 任务 API ==========

// 获取所有任务
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
  res.json(rows.map(rowToTask));
});

// 新增任务
app.post('/api/tasks', (req, res) => {
  const data = req.body;
  const difficulty = normalizeDifficulty(data.difficulty);
  const importance = normalizeImportance(data.importance);
  const rewardReputation = computeReputation({ difficulty, importance, minutes: data.estimatedMinutes });
  const rewardSkillPoints = computeSkillPoints(difficulty);

  const newTask = {
    id: data.id || genId(data.type === 'epic' ? 'ep' : 'dy'),
    name: data.name,
    description: data.description || '',
    type: data.type,
    difficulty,
    importance,
    estimatedMinutes: data.estimatedMinutes,
    actualMinutes: 0,
    relatedSkillId: data.relatedSkillId || null,
    goalId: data.goalId || null,
    projectId: data.projectId || null,
    capabilityIds: Array.isArray(data.capabilityIds)
      ? data.capabilityIds
      : data.relatedSkillId ? [data.relatedSkillId] : [],
    bossName: data.bossName || null,
    bossProgress: 0,
    parentId: data.parentId || null,
    stage: data.stage || 1,
    status: 'pending',
    isTracking: false,
    isAttention: false,
    rewardReputation,
    rewardSkillPoints,
    createdAt: Date.now(),
    source: 'user',
    tags: data.tags || [],
  };

  const row = taskToRow(newTask);
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`).run(...Object.values(row));

  res.json(newTask);
});

// 更新任务
app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const patch = req.body;
  if (patch.difficulty !== undefined) patch.difficulty = normalizeDifficulty(patch.difficulty);

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '任务不存在' });

  const updated = { ...rowToTask(existing), ...patch };
  const row = taskToRow(updated);

  // 动态构建 SET 子句
  const fields = Object.keys(patch).filter(k => k !== 'id');
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => row[f]);

  db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, id);

  const result = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(rowToTask(result));
});

// 删除任务
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  // 同时删除子任务
  db.prepare('DELETE FROM tasks WHERE id = ? OR parentId = ?').run(id, id);

  // 如果是追踪任务，清除追踪
  const track = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  if (track && track.taskId === id) {
    db.prepare('UPDATE active_track SET taskId = NULL, accumulatedSeconds = 0, isRunning = 0, lastStartTime = NULL WHERE id = 1').run();
  }

  res.json({ success: true });
});

// 完成任务（带业务逻辑）
app.post('/api/tasks/:id/complete', (req, res) => {
  const { id } = req.params;
  const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!taskRow) return res.status(404).json({ error: '任务不存在' });

  const task = rowToTask(taskRow);
  let actualSeconds = 0;

  // 如果是追踪任务，结算时间并记录日志
  if (task.isTracking) {
    const track = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
    if (track) {
      actualSeconds = track.accumulatedSeconds || 0;
      if (track.isRunning && track.lastStartTime) {
        actualSeconds += Math.floor((Date.now() - track.lastStartTime) / 1000);
      }

      const logId = genId('fl');
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('INSERT INTO focus_logs (id, taskId, date, durationMinutes, completedAt) VALUES (?, ?, ?, ?, ?)')
        .run(logId, id, today, Math.max(1, Math.round(actualSeconds / 60)), Date.now());
    }

    // 清除追踪
    db.prepare('UPDATE active_track SET taskId = NULL, accumulatedSeconds = 0, isRunning = 0, lastStartTime = NULL WHERE id = 1').run();
  }

  const actualMinutes = actualSeconds > 0 ? Math.round(actualSeconds / 60) : task.actualMinutes;

  // Phase 4：按实际时长 + 重要性重算奖励（创建期值仅为预览）
  const importance = normalizeImportance(task.importance);
  const finalReputation = computeReputation({ difficulty: task.difficulty, importance, minutes: actualMinutes });
  const finalSkillPoints = computeSkillPoints(task.difficulty);

  // 防自灌：本周软上限（超出部分收益递减为 50%）
  const weekStart = getWeekStartISO();
  const weekRepRow = db.prepare(
    "SELECT COALESCE(SUM(rewardReputation), 0) AS s FROM tasks WHERE status = 'completed' AND completedAt >= ? AND completedAt < ? AND id != ?"
  ).get(weekStart, Date.now(), id);
  const currentWeekRep = weekRepRow ? weekRepRow.s : 0;
  const awardedReputation = awardWithWeeklySoftCap(currentWeekRep, finalReputation);

  // 更新任务状态与重算后的奖励
  db.prepare(`UPDATE tasks SET status = 'completed', isTracking = 0, isAttention = 0, actualMinutes = ?, bossProgress = ?, rewardReputation = ?, rewardSkillPoints = ?, completedAt = ? WHERE id = ?`)
    .run(actualMinutes, task.type === 'epic' ? 100 : task.bossProgress, awardedReputation, finalSkillPoints, Date.now(), id);

  // 史诗任务：检查子任务进度
  if (task.parentId) {
    const siblings = db.prepare("SELECT * FROM tasks WHERE parentId = ? AND id != ?").all(task.parentId, id);
    const allDone = siblings.every(s => s.status === 'completed');
    if (allDone) {
      db.prepare("UPDATE tasks SET status = 'completed', bossProgress = 100, completedAt = ? WHERE id = ?")
        .run(Date.now(), task.parentId);
    } else {
      const total = siblings.length + 1;
      const done = siblings.filter(s => s.status === 'completed').length + 1;
      const progress = Math.round((done / total) * 100);
      db.prepare('UPDATE tasks SET bossProgress = ? WHERE id = ?').run(progress, task.parentId);
    }
  }

  // 增加声望（使用防自灌后的实际授予值）
  const repRow = db.prepare("SELECT value FROM meta WHERE key = 'reputation'").get();
  const currentRep = parseInt(repRow.value, 10);
  db.prepare("UPDATE meta SET value = ? WHERE key = 'reputation'").run(String(currentRep + awardedReputation));

  // 增加技能点
  if (finalSkillPoints > 0) {
    const spRow = db.prepare("SELECT value FROM meta WHERE key = 'skill_points'").get();
    const currentSp = parseInt(spRow.value, 10);
    db.prepare("UPDATE meta SET value = ? WHERE key = 'skill_points'").run(String(currentSp + finalSkillPoints));
  }

  // Phase 4：normal 熟练度进度，满阈值解锁下一个 locked 技能节点
  if (task.difficulty === 'normal') {
    const profRow = db.prepare("SELECT value FROM meta WHERE key = 'normal_proficiency'").get() || { value: '0' };
    let prof = parseInt(profRow.value, 10) || 0;
    prof += 1;
    let unlockedNodeId = null;
    if (prof >= PROFICIENCY_THRESHOLD) {
      prof = prof - PROFICIENCY_THRESHOLD;
      const node = db.prepare("SELECT * FROM skills WHERE status = 'locked' ORDER BY level ASC, requiredSkillPoints ASC, id ASC LIMIT 1").get();
      if (node) {
        db.prepare("UPDATE skills SET status = 'unlocked', unlockedAt = ? WHERE id = ?").run(Date.now(), node.id);
        unlockedNodeId = node.id;
      }
    }
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('normal_proficiency', ?)").run(String(prof));
  }

  const result = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(rowToTask(result));
});

// ========== AI 任务拆解 ==========
app.post('/api/tasks/decompose', async (req, res) => {
  const { name, description, difficulty, type, estimatedMinutes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '任务名称不能为空' });
  }
  try {
    const subtasks = await decomposeTask({
      name: name.trim(),
      description: description || '',
      difficulty: normalizeDifficulty(difficulty),
      type: type || 'daily',
      estimatedMinutes,
    });
    res.json({ subtasks });
  } catch (e) {
    console.error('[decompose] error:', e.message);
    res.status(500).json({ error: e.message || 'AI 拆解失败' });
  }
});

// ========== 追踪任务 API ==========

app.get('/api/active-track', (req, res) => {
  const row = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO active_track (id, taskId, accumulatedSeconds, isRunning) VALUES (1, NULL, 0, 0)').run();
    return res.json(null);
  }
  if (!row.taskId) return res.json(null);
  res.json({
    taskId: row.taskId,
    accumulatedSeconds: row.accumulatedSeconds,
    lastStartTime: row.lastStartTime || undefined,
    isRunning: !!row.isRunning,
  });
});

app.post('/api/active-track', (req, res) => {
  const { taskId } = req.body;

  // 先把所有任务的 isTracking 取消
  db.prepare('UPDATE tasks SET isTracking = 0').run();

  if (!taskId) {
    // 暂停并保存，然后清空
    const track = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
    if (track && track.isRunning && track.lastStartTime) {
      const elapsed = Math.floor((Date.now() - track.lastStartTime) / 1000);
      db.prepare('UPDATE active_track SET accumulatedSeconds = accumulatedSeconds + ?, isRunning = 0, lastStartTime = NULL WHERE id = 1')
        .run(elapsed);
    }
    db.prepare('UPDATE active_track SET taskId = NULL WHERE id = 1').run();
    return res.json(null);
  }

  const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!taskRow) return res.status(404).json({ error: '任务不存在' });

  // 从注意力列表移除
  db.prepare('UPDATE tasks SET isAttention = 0, isTracking = 1, status = ? WHERE id = ?').run('active', taskId);

  // 计算已有累计时间
  const existing = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  let accumulatedSeconds = 0;
  if (existing && existing.taskId === taskId) {
    accumulatedSeconds = existing.accumulatedSeconds;
    if (existing.isRunning && existing.lastStartTime) {
      accumulatedSeconds += Math.floor((Date.now() - existing.lastStartTime) / 1000);
    }
  }

  db.prepare('INSERT OR REPLACE INTO active_track (id, taskId, accumulatedSeconds, isRunning, lastStartTime) VALUES (1, ?, ?, 0, NULL)')
    .run(taskId, accumulatedSeconds);

  const result = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  res.json({
    taskId: result.taskId,
    accumulatedSeconds: result.accumulatedSeconds,
    lastStartTime: result.lastStartTime || undefined,
    isRunning: !!result.isRunning,
  });
});

app.post('/api/active-track/start', (req, res) => {
  const track = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  if (!track || !track.taskId) return res.status(400).json({ error: '没有追踪任务' });
  if (track.isRunning) return res.json({ ok: true });

  db.prepare('UPDATE active_track SET isRunning = 1, lastStartTime = ? WHERE id = 1').run(Date.now());
  res.json({ ok: true });
});

app.post('/api/active-track/pause', (req, res) => {
  const track = db.prepare('SELECT * FROM active_track WHERE id = 1').get();
  if (!track || !track.isRunning) return res.json({ ok: true });

  const elapsed = Math.floor((Date.now() - (track.lastStartTime || Date.now())) / 1000);
  db.prepare('UPDATE active_track SET accumulatedSeconds = accumulatedSeconds + ?, isRunning = 0, lastStartTime = NULL WHERE id = 1')
    .run(elapsed);
  res.json({ ok: true });
});

// ========== 注意力任务 API ==========
app.post('/api/tasks/:id/attention', (req, res) => {
  const { id } = req.params;
  const { maxAttention } = req.body;

  const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!taskRow) return res.status(404).json({ error: '任务不存在' });
  if (taskRow.isTracking) return res.status(400).json({ error: '追踪任务不能同时作为注意力任务' });

  const currentCount = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE isAttention = 1 AND status != 'completed'").get().cnt;
  if (currentCount >= maxAttention) {
    return res.status(400).json({ error: `法力水晶不足！最多激活 ${maxAttention} 个注意力任务` });
  }

  db.prepare("UPDATE tasks SET isAttention = 1, status = 'active' WHERE id = ?").run(id);
  const result = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(rowToTask(result));
});

app.delete('/api/tasks/:id/attention', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE tasks SET isAttention = 0 WHERE id = ?').run(id);
  res.json({ success: true });
});

// ========== 专注日志 API ==========
app.get('/api/focus-logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM focus_logs ORDER BY completedAt DESC').all();
  res.json(rows);
});

// ========== 设置 API ==========
app.get('/api/settings', (req, res) => {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'settings'").get();
  res.json(JSON.parse(row.value));
});

app.patch('/api/settings', (req, res) => {
  const patch = req.body;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'settings'").get();
  const current = JSON.parse(row.value);
  const next = { ...current, ...patch };
  db.prepare("UPDATE meta SET value = ? WHERE key = 'settings'").run(JSON.stringify(next));
  res.json(next);
});

app.get('/api/goals', (req, res) => {
  const rows = db.prepare('SELECT * FROM goals ORDER BY createdAt DESC').all();
  res.json(rows);
});

app.post('/api/goals', (req, res) => {
  const data = req.body;
  if (!data?.name) return res.status(400).json({ error: 'name 必填' });
  const now = Date.now();
  const goal = {
    id: genId('g'),
    name: data.name,
    description: data.description || '',
    deadline: data.deadline || null,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };
  const keys = Object.keys(goal);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO goals (${keys.join(', ')}) VALUES (${placeholders})`).run(...Object.values(goal));
  res.json(goal);
});

app.put('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const fields = ['name', 'description', 'deadline', 'status'];
  const updates = ['updatedAt = ?'];
  const values = [Date.now()];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  values.push(id);
  const result = db.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: '目标不存在' });
  const row = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
  res.json(row);
});

app.delete('/api/goals/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM goals WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: '目标不存在' });
  res.json({ success: true });
});

function rowToProject(row) {
  if (!row) return null;
  return {
    ...row,
    capabilityIds: row.capabilityIds ? JSON.parse(row.capabilityIds) : [],
  };
}

function projectToRow(project) {
  return {
    ...project,
    goalId: project.goalId || null,
    capabilityIds: JSON.stringify(project.capabilityIds || []),
  };
}

app.get('/api/projects', (req, res) => {
  const { goalId } = req.query;
  const rows = goalId
    ? db.prepare('SELECT * FROM projects WHERE goalId = ? ORDER BY createdAt DESC').all(String(goalId))
    : db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all();
  res.json(rows.map(rowToProject));
});

app.post('/api/projects', (req, res) => {
  const data = req.body;
  if (!data?.name) return res.status(400).json({ error: 'name 必填' });
  const now = Date.now();
  const project = {
    id: genId('p'),
    goalId: data.goalId || null,
    name: data.name,
    description: data.description || '',
    capabilityIds: data.capabilityIds || [],
    progress: data.progress ?? 0,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };
  const row = projectToRow(project);
  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO projects (${keys.join(', ')}) VALUES (${placeholders})`).run(...Object.values(row));
  res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const fields = ['goalId', 'name', 'description', 'capabilityIds', 'progress', 'status'];
  const updates = ['updatedAt = ?'];
  const values = [Date.now()];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      if (f === 'capabilityIds') values.push(JSON.stringify(req.body[f] || []));
      else if (f === 'goalId') values.push(req.body[f] || null);
      else values.push(req.body[f]);
    }
  }
  values.push(id);
  const result = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: '项目不存在' });
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.json(rowToProject(row));
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: '项目不存在' });
  res.json({ success: true });
});

app.get('/api/reflections', (req, res) => {
  const { taskId } = req.query;
  const rows = taskId
    ? db.prepare('SELECT * FROM reflections WHERE taskId = ? ORDER BY createdAt DESC').all(String(taskId))
    : db.prepare('SELECT * FROM reflections ORDER BY createdAt DESC').all();
  res.json(rows);
});

app.post('/api/reflections', (req, res) => {
  const data = req.body;
  if (!data?.taskId) return res.status(400).json({ error: 'taskId 必填' });
  const reflection = {
    id: genId('r'),
    taskId: data.taskId,
    expectedResult: data.expectedResult || '',
    actualResult: data.actualResult || '',
    lessonLearned: data.lessonLearned || '',
    nextAction: data.nextAction || '',
    createdAt: Date.now(),
  };
  const keys = Object.keys(reflection);
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO reflections (${keys.join(', ')}) VALUES (${placeholders})`).run(...Object.values(reflection));
  res.json(reflection);
});

app.put('/api/reflections/:id', (req, res) => {
  const { id } = req.params;
  const fields = ['taskId', 'expectedResult', 'actualResult', 'lessonLearned', 'nextAction'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: '无更新字段' });
  values.push(id);
  const result = db.prepare(`UPDATE reflections SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: '复盘不存在' });
  const row = db.prepare('SELECT * FROM reflections WHERE id = ?').get(id);
  res.json(row);
});

app.delete('/api/reflections/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM reflections WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: '复盘不存在' });
  res.json({ success: true });
});

// ========== 技能 API ==========
app.get('/api/skills', (req, res) => {
  const rows = db.prepare('SELECT * FROM skills ORDER BY category, level').all();
  res.json(rows);
});

app.post('/api/skills/batch-init', (req, res) => {
  const skills = req.body;
  const insert = db.prepare(`INSERT OR IGNORE INTO skills
    (id, name, description, category, parentId, level, status, x, y, icon, requiredSkillPoints, unlockedAt, proficiencyLevel, experience, lastImprovedAt)
    VALUES (@id, @name, @description, @category, @parentId, @level, @status, @x, @y, @icon, @requiredSkillPoints, @unlockedAt, @proficiencyLevel, @experience, @lastImprovedAt)`);

  const tx = db.transaction((list) => {
    for (const s of list) {
      insert.run({
        ...s,
        parentId: s.parentId || null,
        icon: s.icon || null,
        unlockedAt: s.unlockedAt || null,
        proficiencyLevel: s.proficiencyLevel || 0,
        experience: s.experience || 0,
        lastImprovedAt: s.lastImprovedAt || null,
      });
    }
  });
  tx(skills);
  res.json({ success: true, count: skills.length });
});

// 新增单个技能
app.post('/api/skills', (req, res) => {
  const { id, name, description, category, parentId, level, x, y, icon, requiredSkillPoints, status, proficiencyLevel, experience, lastImprovedAt } = req.body;
  if (!id || !name || !category) {
    return res.status(400).json({ error: 'id, name, category 必填' });
  }
  try {
    db.prepare(`INSERT INTO skills
      (id, name, description, category, parentId, level, status, x, y, icon, requiredSkillPoints, unlockedAt, proficiencyLevel, experience, lastImprovedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, name, description || '', category, parentId || null, level || 1, status || 'locked',
      x || 0, y || 0, icon || null, requiredSkillPoints || 1, null,
      proficiencyLevel || 0, experience || 0, lastImprovedAt || null
    );
    res.json({ success: true, id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 更新技能
app.put('/api/skills/:id', (req, res) => {
  const { id } = req.params;
  const fields = ['name', 'description', 'category', 'parentId', 'level', 'status', 'x', 'y', 'icon', 'requiredSkillPoints', 'proficiencyLevel', 'experience', 'lastImprovedAt'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: '无更新字段' });
  values.push(id);
  const result = db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  if (result.changes === 0) return res.status(404).json({ error: '技能不存在' });
  res.json({ success: true });
});

// 删除技能
app.delete('/api/skills/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: '技能不存在' });
  res.json({ success: true });
});

// 批量导入（覆盖式：先清空再插入）
app.post('/api/skills/import', (req, res) => {
  const skills = req.body;
  if (!Array.isArray(skills)) return res.status(400).json({ error: '需要数组格式' });

  const insert = db.prepare(`INSERT OR REPLACE INTO skills
    (id, name, description, category, parentId, level, status, x, y, icon, requiredSkillPoints, unlockedAt, proficiencyLevel, experience, lastImprovedAt)
    VALUES (@id, @name, @description, @category, @parentId, @level, @status, @x, @y, @icon, @requiredSkillPoints, @unlockedAt, @proficiencyLevel, @experience, @lastImprovedAt)`);

  const tx = db.transaction((list) => {
    db.prepare('DELETE FROM skills').run();
    for (const s of list) {
      insert.run({
        ...s,
        parentId: s.parentId || null,
        icon: s.icon || null,
        status: s.status || 'locked',
        unlockedAt: s.unlockedAt || null,
        proficiencyLevel: s.proficiencyLevel || 0,
        experience: s.experience || 0,
        lastImprovedAt: s.lastImprovedAt || null,
      });
    }
  });
  tx(skills);
  res.json({ success: true, count: skills.length });
});

app.get('/api/skill-points', (req, res) => {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'skill_points'").get();
  res.json(parseInt(row.value, 10));
});

app.post('/api/skills/:id/unlock', (req, res) => {
  const { id } = req.params;
  const node = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
  if (!node) return res.status(404).json({ error: '技能不存在' });
  if (node.status !== 'locked') return res.status(400).json({ error: '已解锁' });

  const spRow = db.prepare("SELECT value FROM meta WHERE key = 'skill_points'").get();
  const sp = parseInt(spRow.value, 10);
  if (sp < node.requiredSkillPoints) return res.status(400).json({ error: '技能点不足' });

  // 检查父节点
  if (node.parentId) {
    const parent = db.prepare('SELECT * FROM skills WHERE id = ?').get(node.parentId);
    if (!parent || parent.status === 'locked') return res.status(400).json({ error: '父技能未解锁' });
  }

  db.prepare("UPDATE skills SET status = 'unlocked', unlockedAt = ? WHERE id = ?").run(Date.now(), id);
  db.prepare("UPDATE meta SET value = ? WHERE key = 'skill_points'").run(String(sp - node.requiredSkillPoints));

  res.json({ success: true });
});

app.post('/api/skills/:id/enhance', (req, res) => {
  const { id } = req.params;
  const node = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
  if (!node) return res.status(404).json({ error: '技能不存在' });
  if (node.status !== 'unlocked') return res.status(400).json({ error: '只能强化已解锁技能' });

  const enhanceCost = Math.ceil(node.requiredSkillPoints * 1.5);
  const spRow = db.prepare("SELECT value FROM meta WHERE key = 'skill_points'").get();
  const sp = parseInt(spRow.value, 10);
  if (sp < enhanceCost) return res.status(400).json({ error: '技能点不足' });

  db.prepare("UPDATE skills SET status = 'enhanced' WHERE id = ?").run(id);
  db.prepare("UPDATE meta SET value = ? WHERE key = 'skill_points'").run(String(sp - enhanceCost));

  res.json({ success: true });
});

// ========== 商店 API ==========
app.get('/api/shop/items', (req, res) => {
  const rows = db.prepare('SELECT * FROM shop_items ORDER BY createdAt ASC').all();
  res.json(rows);
});

app.post('/api/shop/items', (req, res) => {
  const item = req.body;
  const newItem = {
    ...item,
    id: `shop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    source: 'user',
  };
  db.prepare('INSERT INTO shop_items (id, name, cost, icon, color, description, source, createdAt) VALUES (@id, @name, @cost, @icon, @color, @description, @source, @createdAt)')
    .run({ ...newItem, color: newItem.color || null, description: newItem.description || null });
  res.json(newItem);
});

app.delete('/api/shop/items/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: '商品不存在' });
  if (item.source === 'mock') return res.status(400).json({ error: '预设商品不可删除' });
  db.prepare('DELETE FROM shop_items WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get('/api/shop/reputation', (req, res) => {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'reputation'").get();
  res.json(parseInt(row.value, 10));
});

app.post('/api/shop/reputation', (req, res) => {
  const { amount } = req.body;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'reputation'").get();
  const current = parseInt(row.value, 10);
  const next = Math.max(0, current + amount);
  db.prepare("UPDATE meta SET value = ? WHERE key = 'reputation'").run(String(next));
  res.json(next);
});

app.get('/api/shop/redemptions', (req, res) => {
  const rows = db.prepare('SELECT * FROM redemptions ORDER BY redeemedAt DESC').all();
  res.json(rows);
});

app.post('/api/shop/redeem/:itemId', (req, res) => {
  const { itemId } = req.params;
  const item = db.prepare('SELECT * FROM shop_items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: '商品不存在' });

  const repRow = db.prepare("SELECT value FROM meta WHERE key = 'reputation'").get();
  const current = parseInt(repRow.value, 10);
  if (current < item.cost) return res.status(400).json({ error: '声望不足' });

  db.prepare("UPDATE meta SET value = ? WHERE key = 'reputation'").run(String(current - item.cost));

  const redemption = {
    id: `red_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    redeemedAt: Date.now(),
  };
  db.prepare('INSERT INTO redemptions (id, itemId, itemName, cost, redeemedAt) VALUES (@id, @itemId, @itemName, @cost, @redeemedAt)')
    .run(redemption);

  res.json(redemption);
});

// ========== 批量初始化预设数据（首次启动） ==========
app.post('/api/bootstrap', (req, res) => {
  const { tasks, skills, shopItems } = req.body;

  const taskCount = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get().cnt;
  if (taskCount === 0 && tasks && tasks.length) {
    const insert = db.prepare(`INSERT INTO tasks 
      (id, name, description, type, difficulty, estimatedMinutes, actualMinutes, relatedSkillId, bossName, bossProgress, parentId, status, isTracking, isAttention, rewardReputation, rewardSkillPoints, createdAt, completedAt, source, tags)
      VALUES (@id, @name, @description, @type, @difficulty, @estimatedMinutes, @actualMinutes, @relatedSkillId, @bossName, @bossProgress, @parentId, @status, @isTracking, @isAttention, @rewardReputation, @rewardSkillPoints, @createdAt, @completedAt, @source, @tags)`);
    const tx = db.transaction((list) => {
      for (const t of list) {
        insert.run(taskToRow(t));
      }
    });
    tx(tasks);
  }

  const skillCount = db.prepare('SELECT COUNT(*) as cnt FROM skills').get().cnt;
  if (skillCount === 0 && skills && skills.length) {
    const insert = db.prepare(`INSERT OR IGNORE INTO skills 
      (id, name, description, category, parentId, level, status, x, y, icon, requiredSkillPoints, unlockedAt)
      VALUES (@id, @name, @description, @category, @parentId, @level, @status, @x, @y, @icon, @requiredSkillPoints, @unlockedAt)`);
    const tx = db.transaction((list) => {
      for (const s of list) {
        insert.run({
          ...s,
          parentId: s.parentId || null,
          icon: s.icon || null,
          unlockedAt: s.unlockedAt || null,
        });
      }
    });
    tx(skills);
  }

  const shopCount = db.prepare('SELECT COUNT(*) as cnt FROM shop_items').get().cnt;
  if (shopCount === 0 && shopItems && shopItems.length) {
    const insert = db.prepare('INSERT INTO shop_items (id, name, cost, icon, color, description, source, createdAt) VALUES (@id, @name, @cost, @icon, @color, @description, @source, @createdAt)');
    const tx = db.transaction((list) => {
      for (const i of list) {
        insert.run({ ...i, color: i.color || null, description: i.description || null });
      }
    });
    tx(shopItems);
  }

  res.json({ success: true });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.listen(PORT, () => {
  console.log(`悬赏任务公会后端已启动: http://localhost:${PORT}`);
});
