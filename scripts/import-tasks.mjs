// import-tasks.mjs —— 从本地 JSON 快速导入任务，校验后可选经同步端点上云。
// 适合把 AI 生成的、或手动整理的的任务清单批量塞进悬赏公会。
//
// 用法：
//   node scripts/import-tasks.mjs --file tasks.json
//   node scripts/import-tasks.mjs --file tasks.json --push
//
// 输入 JSON 形如（简化字段会自动补全）：
// [
//   {"name":"建立减脂健身主线","type":"epic","difficulty":"epic","estimatedMinutes":1200,
//    "subtasks":[{"name":"周二训练","difficulty":"hard","estimatedMinutes":60}]},
//   {"name":"今晚背部训练","difficulty":"normal","estimatedMinutes":50}
// ]
// 也支持直接是 QgTaskSnapshot 数组（含 id/title/type/...）。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv() {
  try {
    const txt = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* 忽略 */ }
}
loadEnv();

function parseArgs(argv) {
  const args = { file: '', push: false, out: 'imported-tasks.json' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file') args.file = argv[++i] ?? '';
    else if (argv[i] === '--push') args.push = true;
    else if (argv[i] === '--out') args.out = argv[++i] ?? 'imported-tasks.json';
  }
  return args;
}

const DIFF = ['easy', 'normal', 'hard', 'epic'];
const B = { easy: 5, normal: 10, hard: 25, epic: 80 };
const SK = { easy: 0, normal: 0, hard: 1, epic: 3 };
function reward(d) { return Math.round((B[d] ?? 10) * 1.2); }
function normDiff(d) { return DIFF.includes(d) ? d : 'normal'; }
function genId(p) { return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }

// 把单个简化任务（可带 subtasks）展开成 QgTaskSnapshot 列表
function expand(task, parentId = null) {
  const now = new Date().toISOString();
  const id = task.id || genId(task.type === 'epic' ? 'ep' : 'dy');
  const isFull = !!task.title; // 已经是 QgTaskSnapshot 形态
  const snap = {
    id,
    title: isFull ? task.title : task.name,
    type: task.type === 'epic' ? 'epic' : 'daily',
    difficulty: normDiff(task.difficulty),
    status: task.status || 'pending',
    description: task.description || '',
    source: 'qg',
    rewardSkillPoints: SK[normDiff(task.difficulty)] ?? 0,
    estimatedMinutes: task.estimatedMinutes ?? 30,
    dueDate: null,
    completedDate: task.completedDate || null,
    reputation: reward(normDiff(task.difficulty)),
    parentId: parentId || task.parentId || null,
    stage: task.stage ?? (task.type === 'epic' && !parentId ? 1 : 0),
    createdAt: task.createdAt || now,
    updatedAt: now,
  };
  const out = [snap];
  if (Array.isArray(task.subtasks)) {
    for (const sub of task.subtasks) out.push(...expand({ ...sub, type: 'epic' }, id));
  }
  return out;
}

function toSnapshots(input) {
  if (!Array.isArray(input)) throw new Error('JSON 顶层必须是任务数组');
  const out = [];
  for (const t of input) out.push(...expand(t));
  return out;
}

async function pushToCloud(tasks) {
  const url = (process.env.VITE_SYNC_URL || 'https://life.hchch.tech') + '/api/tasks/sync';
  const token = process.env.VITE_SYNC_TOKEN || '';
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ lastSyncAt: 0, tasks, deletedTaskIds: [], meta: { reputation: 0, skillPoints: 0, streak: 0, todayReputation: 0 } }),
  });
  if (!resp.ok) throw new Error(`推送云端失败 HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.file) {
    console.error('用法: node scripts/import-tasks.mjs --file tasks.json [--push]');
    process.exit(1);
  }
  const input = JSON.parse(readFileSync(resolve(ROOT, args.file), 'utf8'));
  const tasks = toSnapshots(input);
  const outPath = resolve(ROOT, args.out);
  writeFileSync(outPath, JSON.stringify(tasks, null, 2), 'utf8');
  console.log(`✅ 已解析 ${tasks.length} 个任务 → ${outPath}`);

  if (args.push) {
    const r = await pushToCloud(tasks);
    console.log(`☁️ 已推送至云端（serverTime=${r.serverTime}），在 App 点「同步」即可拉进本地库`);
  } else {
    console.log('💡 加 --push 可经同步端点上云（之后在 App 点「同步」拉取）');
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
