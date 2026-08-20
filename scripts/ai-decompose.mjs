// ai-decompose.mjs —— 用 OpenAI 兼容 LLM 把一个目标拆成「史诗任务 + 子任务 + 每日悬赏」，
// 输出 generated-tasks.json，可选经同步端点上云（之后在 App 点「同步」即可拉进本地库）。
//
// 用法：
//   node scripts/ai-decompose.mjs --goal "建立减脂健身主线"
//   node scripts/ai-decompose.mjs --file goal.txt --model gpt-4o-mini
//
// 环境变量（读 .env 或系统环境变量）：
//   AI_API_KEY    必填，LLM API Key
//   AI_BASE_URL   可选，默认 https://api.openai.com/v1
//   AI_MODEL      可选，默认 gpt-4o-mini
//
// ⚠️ 上云请勿再用本脚本：--push 已废弃。请改用 App 内「AI 拆解」草稿箱
//    （悬赏池 → 史诗任务 → 「AI 拆解」），拆解结果先进草稿箱，确认后才加入任务并上云，
//    不会污染主任务列表、也不会绕过同步对账删除。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---- 极简 .env 加载（避免引入 dotenv 依赖） ----
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  try {
    const txt = readFileSync(envPath, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* 无 .env 则用系统环境变量 */ }
}
loadEnv();

// ---- 参数解析 ----
function parseArgs(argv) {
  const args = { goal: '', file: '', model: '', push: false, out: 'generated-tasks.json' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--goal') args.goal = argv[++i] ?? '';
    else if (a === '--file') args.file = argv[++i] ?? '';
    else if (a === '--model') args.model = argv[++i] ?? '';
    else if (a === '--out') args.out = argv[++i] ?? 'generated-tasks.json';
    else if (a === '--push') args.push = true;
  }
  return args;
}

// ---- 声望/能力点（与 App 公式对齐：round(B*M)，M 取中等 1.2） ----
const B = { easy: 5, normal: 10, hard: 25, epic: 80 };
const SK = { easy: 0, normal: 0, hard: 1, epic: 3 };
function reward(difficulty) {
  return Math.round((B[difficulty] ?? 10) * 1.2);
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const SYSTEM_PROMPT = `你是「悬赏任务公会」的任务拆解官。把用户的目标拆成游戏化任务，严格只输出 JSON：
{
  "epics": [
    {"name": "史诗任务名", "description": "一句话目标", "difficulty": "easy|normal|hard|epic", "estimatedMinutes": 数字,
     "subtasks": [{"name":"子任务名","description":"","difficulty":"easy|normal|hard|epic","estimatedMinutes":数字}]}
  ],
  "dailies": [
    {"name":"每日悬赏名","description":"","difficulty":"easy|normal|hard|epic","estimatedMinutes":数字}
  ]
}
要求：3-6 个史诗任务（含子任务），4-8 个每日悬赏；难度分布合理；中文输出。不要输出 JSON 以外的任何内容。`;

async function callLLM({ apiKey, baseUrl, model, goal }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: goal },
      ],
      temperature: 0.7,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`LLM 调用失败 HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return JSON.parse(content);
}

// 把 LLM 结果映射成同步端点接受的 QgTaskSnapshot 列表
function toSnapshots(parsed) {
  const now = new Date().toISOString();
  const out = [];
  for (const ep of parsed.epics ?? []) {
    const epId = genId('ep');
    out.push({
      id: epId, title: ep.name, type: 'epic', difficulty: ep.difficulty || 'hard',
      status: 'pending', description: ep.description || '', source: 'qg',
      rewardSkillPoints: SK[ep.difficulty] ?? 0, estimatedMinutes: ep.estimatedMinutes || 240,
      dueDate: null, completedDate: null, reputation: reward(ep.difficulty),
      parentId: null, stage: 1, createdAt: now, updatedAt: now,
    });
    let stage = 1;
    for (const sub of ep.subtasks ?? []) {
      out.push({
        id: genId('ep'), title: sub.name, type: 'epic', difficulty: sub.difficulty || 'normal',
        status: 'pending', description: sub.description || '', source: 'qg',
        rewardSkillPoints: SK[sub.difficulty] ?? 0, estimatedMinutes: sub.estimatedMinutes || 60,
        dueDate: null, completedDate: null, reputation: reward(sub.difficulty),
        parentId: epId, stage: stage++, createdAt: now, updatedAt: now,
      });
    }
  }
  for (const d of parsed.dailies ?? []) {
    out.push({
      id: genId('dy'), title: d.name, type: 'daily', difficulty: d.difficulty || 'easy',
      status: 'pending', description: d.description || '', source: 'qg',
      rewardSkillPoints: SK[d.difficulty] ?? 0, estimatedMinutes: d.estimatedMinutes || 15,
      dueDate: null, completedDate: null, reputation: reward(d.difficulty),
      parentId: null, stage: 0, createdAt: now, updatedAt: now,
    });
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  let goal = args.goal;
  if (!goal && args.file) goal = readFileSync(resolve(ROOT, args.file), 'utf8').trim();
  if (!goal) {
    console.error('用法: node scripts/ai-decompose.mjs --goal "你的目标" [--file goal.txt] [--model gpt-4o-mini] [--push]');
    process.exit(1);
  }
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.error('❌ 缺少 AI_API_KEY（在 .env 或环境变量中设置）');
    process.exit(1);
  }
  const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = args.model || process.env.AI_MODEL || 'gpt-4o-mini';

  console.log(`🤖 调用 ${model} @ ${baseUrl} 拆解目标：「${goal}」`);
  const parsed = await callLLM({ apiKey, baseUrl, model, goal });
  const tasks = toSnapshots(parsed);
  const outPath = resolve(ROOT, args.out);
  writeFileSync(outPath, JSON.stringify(tasks, null, 2), 'utf8');
  console.log(`✅ 已生成 ${tasks.length} 个任务 → ${outPath}`);

  if (args.push) {
    // 已废弃：--push 会绕过 App 内草稿箱、直接以 source='qg' 写入主列表并上云，可能污染正式任务。
    console.error('⚠️  --push 已废弃，已停止直推云端。');
    console.error('    请改用 App（悬赏池 → 史诗任务 → 「AI 拆解」）的草稿模式：');
    console.error('    拆解结果先进草稿箱，调整确认后才加入任务并上云，安全不污染。');
  } else {
    console.log('💡 想把这些任务上云？请用 App 内「AI 草稿箱」（更安全，不污染主列表）。');
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
