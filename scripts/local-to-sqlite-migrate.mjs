#!/usr/bin/env node
/**
 * P0-3 · localStorage / 备份导出 → SQLite 迁移脚本
 *
 * 从「设置 → 手动导出」或备份快照产出的 JSON（KV 结构，键如 `__quest_guild_tasks`）读取，
 * 写入本地 SQLite（server/index.js 同款 schema）。用于把浏览器试用版数据迁到安装版 Electron。
 *
 * 用法：
 *   node scripts/local-to-sqlite-migrate.mjs <input.json> [--db <path>] [--dry] [--skip-existing] [--help]
 *
 *   <input.json>   导出/备份 JSON 路径（必填）
 *   --db <path>    SQLite 文件路径（默认：与 server/index.js 同款解析逻辑）
 *   --dry          只报告将要写入的行数与冲突项，不落库
 *   --skip-existing  遇到 id 已存在的行跳过（默认：覆盖，INSERT OR REPLACE）
 *
 * 验收：迁移后 SQLite 里 tasks/goals/projects/skills/settings 行数与源 JSON 一致；
 *       冲突（目标库已存在同 id）会被统计并列出。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 参数解析 ----------
const argv = process.argv.slice(2);
const flags = { dry: false, skipExisting: false, db: null, input: null };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry') flags.dry = true;
  else if (a === '--skip-existing') flags.skipExisting = true;
  else if (a === '--help' || a === '-h') {
    console.log('用法: node scripts/local-to-sqlite-migrate.mjs <input.json> [--db <path>] [--dry] [--skip-existing]');
    process.exit(0);
  } else if (a === '--db') flags.db = argv[++i];
  else if (!flags.input) flags.input = a;
}
if (!flags.input) {
  console.error('✗ 缺少输入 JSON 路径。用法见 --help');
  process.exit(1);
}
if (!existsSync(flags.input)) {
  console.error(`✗ 输入文件不存在: ${flags.input}`);
  process.exit(1);
}

// ---------- 解析 better-sqlite3（server 自带原生模块，从其目录 require 最稳）----------
import { createRequire } from 'node:module';
function loadBetterSqlite3() {
  // server 自带 better-sqlite3；从 server 目录 require 可命中其 node_modules
  const requireFromServer = createRequire(path.join(__dirname, '..', 'server', 'package.json'));
  try {
    return requireFromServer('better-sqlite3');
  } catch {
    // 回退：项目根 node_modules
    const requireFromRoot = createRequire(path.join(__dirname, '..', 'package.json'));
    return requireFromRoot('better-sqlite3');
  }
}

// ---------- 解析 DB 路径（与 server/index.js 同款）----------
function resolveDbPath() {
  if (flags.db) return path.resolve(flags.db);
  const DB_DIR = process.env.QUEST_GUILD_USER_DATA
    ? path.join(process.env.QUEST_GUILD_USER_DATA, 'db')
    : path.join(__dirname, '..', 'server'); // 开发模式回退：server/index.js 同目录
  return path.join(DB_DIR, 'quest-guild.db');
}

// ---------- 工具函数 ----------
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const asArray = (v) => (Array.isArray(v) ? v : []);

// 兼容两种导出形态：
//  A) 备份快照：{ [key]: "JSON字符串" }
//  B) 美化导出：{ [key]: 对象/数组 }
function readKV(input) {
  const raw = JSON.parse(readFileSync(input, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      try { out[k] = JSON.parse(v); } catch { out[k] = v; }
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------- 行映射 ----------
function toTaskRow(t) {
  return {
    id: t.id, name: t.name, description: t.description ?? '', type: t.type,
    difficulty: t.difficulty, importance: t.importance ?? 'medium',
    estimatedMinutes: num(t.estimatedMinutes, 0), actualMinutes: num(t.actualMinutes, 0),
    relatedSkillId: t.relatedSkillId ?? null, goalId: t.goalId ?? null, projectId: t.projectId ?? null,
    capabilityIds: JSON.stringify(t.capabilityIds ?? []), bossName: t.bossName ?? null,
    bossProgress: num(t.bossProgress, 0), parentId: t.parentId ?? null, stage: num(t.stage, 1),
    status: t.status ?? 'pending', isTracking: t.isTracking ? 1 : 0, isAttention: t.isAttention ? 1 : 0,
    rewardReputation: num(t.rewardReputation, 0), rewardSkillPoints: num(t.rewardSkillPoints, 0),
    createdAt: num(t.createdAt, Date.now()), completedAt: t.completedAt ?? null,
    source: t.source ?? 'user', tags: JSON.stringify(t.tags ?? []),
  };
}
function toSkillRow(s) {
  return {
    id: s.id, name: s.name, description: s.description ?? '', category: s.category,
    parentId: s.parentId ?? null, level: num(s.level, 1), status: s.status ?? 'locked',
    x: num(s.x, 0), y: num(s.y, 0), icon: s.icon ?? null, requiredSkillPoints: num(s.requiredSkillPoints, 0),
    unlockedAt: s.unlockedAt ?? null, proficiencyLevel: num(s.proficiencyLevel, 0),
    experience: num(s.experience, 0), lastImprovedAt: s.lastImprovedAt ?? null,
  };
}
function toGoalRow(g) {
  return {
    id: g.id, name: g.name, description: g.description ?? '', deadline: g.deadline ?? null,
    status: g.status ?? 'active', createdAt: num(g.createdAt, Date.now()), updatedAt: num(g.updatedAt, Date.now()),
  };
}
function toProjectRow(p) {
  return {
    id: p.id, goalId: p.goalId ?? null, name: p.name, description: p.description ?? '',
    capabilityIds: JSON.stringify(p.capabilityIds ?? []), progress: num(p.progress, 0),
    status: p.status ?? 'active', createdAt: num(p.createdAt, Date.now()), updatedAt: num(p.updatedAt, Date.now()),
  };
}
function toReflectionRow(r) {
  return {
    id: r.id, taskId: r.taskId, expectedResult: r.expectedResult ?? '', actualResult: r.actualResult ?? '',
    lessonLearned: r.lessonLearned ?? '', nextAction: r.nextAction ?? '', createdAt: num(r.createdAt, Date.now()),
  };
}
function toShopRow(s) {
  return {
    id: s.id, name: s.name, cost: num(s.cost, 0), icon: s.icon, color: s.color ?? null,
    description: s.description ?? '', source: s.source ?? 'user', createdAt: num(s.createdAt, Date.now()),
  };
}
function toRedemptionRow(r) {
  return { id: r.id, itemId: r.itemId, itemName: r.itemName, cost: num(r.cost, 0), redeemedAt: num(r.redeemedAt, Date.now()) };
}

// ---------- 建表（与 server/index.js 同源，保证可独立 bootstrap）----------
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', type TEXT NOT NULL,
  difficulty TEXT NOT NULL, estimatedMinutes INTEGER NOT NULL, actualMinutes INTEGER DEFAULT 0,
  relatedSkillId TEXT, goalId TEXT, projectId TEXT, capabilityIds TEXT DEFAULT '[]', bossName TEXT,
  bossProgress INTEGER DEFAULT 0, parentId TEXT, stage INTEGER DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending',
  isTracking INTEGER DEFAULT 0, isAttention INTEGER DEFAULT 0, rewardReputation INTEGER NOT NULL,
  rewardSkillPoints INTEGER NOT NULL, createdAt INTEGER NOT NULL, completedAt INTEGER, source TEXT DEFAULT 'user',
  tags TEXT DEFAULT '[]', importance TEXT DEFAULT 'medium'
);
CREATE TABLE IF NOT EXISTS active_track (
  id INTEGER PRIMARY KEY CHECK (id = 1), taskId TEXT, accumulatedSeconds INTEGER DEFAULT 0,
  lastStartTime INTEGER, isRunning INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS focus_logs (
  id TEXT PRIMARY KEY, taskId TEXT NOT NULL, date TEXT NOT NULL, durationMinutes INTEGER NOT NULL, completedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', category TEXT NOT NULL, parentId TEXT,
  level INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'locked', x REAL NOT NULL, y REAL NOT NULL, icon TEXT,
  requiredSkillPoints INTEGER NOT NULL, unlockedAt INTEGER, proficiencyLevel INTEGER DEFAULT 0,
  experience INTEGER DEFAULT 0, lastImprovedAt INTEGER
);
CREATE TABLE IF NOT EXISTS shop_items (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, cost INTEGER NOT NULL, icon TEXT NOT NULL, color TEXT,
  description TEXT, source TEXT NOT NULL DEFAULT 'user', createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY, itemId TEXT NOT NULL, itemName TEXT NOT NULL, cost INTEGER NOT NULL, redeemedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', deadline INTEGER,
  status TEXT NOT NULL DEFAULT 'active', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, goalId TEXT, name TEXT NOT NULL, description TEXT DEFAULT '',
  capabilityIds TEXT DEFAULT '[]', progress INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
  createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY, taskId TEXT NOT NULL, expectedResult TEXT DEFAULT '', actualResult TEXT DEFAULT '',
  lessonLearned TEXT DEFAULT '', nextAction TEXT DEFAULT '', createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

// ---------- 主流程 ----------
async function main() {
  const Database = await loadBetterSqlite3();
  const dbPath = resolveDbPath();
  console.log(`目标 SQLite: ${dbPath}`);
  if (flags.dry) console.log('模式: DRY-RUN（不落库）\n');

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);

  const kv = readKV(flags.input);
  const report = [];
  const conflicts = [];

  // 通用 upsert：返回 { inserted, conflict }
  function upsert(table, row, idKey) {
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const exists = db.prepare(`SELECT 1 FROM ${table} WHERE ${idKey} = ?`).get(row[idKey]);
    if (exists) {
      conflicts.push(`${table}#${row[idKey]}`);
      if (flags.skipExisting) return { inserted: 0, conflict: 1 };
    }
    if (flags.dry) return { inserted: 0, conflict: exists ? 1 : 0 };
    db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
      .run(...Object.values(row));
    return { inserted: 1, conflict: exists ? 1 : 0 };
  }

  function migrateArray(key, table, mapper, idKey) {
    const arr = asArray(kv[key]);
    let ins = 0, con = 0;
    for (const item of arr) {
      const r = upsert(table, mapper(item), idKey);
      ins += r.inserted; con += r.conflict;
    }
    report.push({ table, source: key, count: arr.length, inserted: ins, conflicts: con });
  }

  migrateArray('__quest_guild_tasks', 'tasks', toTaskRow, 'id');
  migrateArray('__quest_guild_skills', 'skills', toSkillRow, 'id');
  migrateArray('__quest_guild_goals', 'goals', toGoalRow, 'id');
  migrateArray('__quest_guild_projects', 'projects', toProjectRow, 'id');
  migrateArray('__quest_guild_reflections', 'reflections', toReflectionRow, 'id');
  migrateArray('__quest_guild_shop_items', 'shop_items', toShopRow, 'id');
  migrateArray('__quest_guild_redemptions', 'redemptions', toRedemptionRow, 'id');
  migrateArray('__quest_guild_focus_log', 'focus_logs', (f) => ({
    id: f.id, taskId: f.taskId, date: f.date, durationMinutes: num(f.durationMinutes, 0), completedAt: num(f.completedAt, Date.now()),
  }), 'id');

  // active_track：单例行 id=1
  if (kv['__quest_guild_active_track']) {
    const o = typeof kv['__quest_guild_active_track'] === 'string'
      ? JSON.parse(kv['__quest_guild_active_track']) : kv['__quest_guild_active_track'];
    const row = { id: 1, taskId: o.taskId ?? null, accumulatedSeconds: num(o.accumulatedSeconds, 0),
      lastStartTime: o.lastStartTime ?? null, isRunning: o.isRunning ? 1 : 0 };
    if (!flags.skipExisting && !flags.dry) {
      db.prepare(`INSERT OR REPLACE INTO active_track (id, taskId, accumulatedSeconds, lastStartTime, isRunning) VALUES (@id, @taskId, @accumulatedSeconds, @lastStartTime, @isRunning)`).run(row);
    }
    report.push({ table: 'active_track', source: '__quest_guild_active_track', count: 1, inserted: flags.skipExisting ? 0 : 1, conflicts: 0 });
  }

  // meta：settings / reputation / skill_points / normal_proficiency
  const metaMap = {
    '__quest_guild_settings': 'settings',
    '__quest_guild_reputation': 'reputation',
    '__quest_guild_skill_points': 'skill_points',
    '__quest_guild_normal_proficiency': 'normal_proficiency',
  };
  for (const [srcKey, metaKey] of Object.entries(metaMap)) {
    if (kv[srcKey] === undefined) continue;
    let val = kv[srcKey];
    if (typeof val !== 'string') val = JSON.stringify(val);
    if (!flags.skipExisting && !flags.dry) {
      db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run(metaKey, val);
    }
    report.push({ table: 'meta', source: srcKey, count: 1, inserted: flags.skipExisting ? 0 : 1, conflicts: 0, metaKey });
  }

  db.close();

  // ---------- 输出报告 ----------
  console.log('迁移报告:');
  console.log('  源文件:', flags.input);
  console.log('  目标库:', dbPath);
  console.log('');
  console.log('  table'.padEnd(16), 'source'.padEnd(30), 'count'.padStart(7), 'written'.padStart(8), 'conflict'.padStart(9));
  for (const r of report) {
    const src = r.metaKey ? `${r.source} → ${r.metaKey}` : r.source;
    console.log('  ' + r.table.padEnd(14), src.padEnd(30), String(r.count).padStart(7), String(r.inserted).padStart(8), String(r.conflicts).padStart(9));
  }
  console.log('');
  if (conflicts.length) {
    console.log(`⚠ 共 ${conflicts.length} 条 id 冲突（目标库已存在，已${flags.skipExisting ? '跳过' : '覆盖'}）:`);
    conflicts.slice(0, 20).forEach((c) => console.log('   - ' + c));
    if (conflicts.length > 20) console.log(`   ... 其余 ${conflicts.length - 20} 条略`);
  } else {
    console.log('✓ 无 id 冲突');
  }
  if (flags.dry) console.log('\n[DRY-RUN] 未对数据库做任何写入。');
  else console.log('\n✓ 迁移完成。');
}

main().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
