// 浏览器端 AI 拆解客户端。
//
// P0-E 改造：优先调用 workspace-server 统一拆解端点 `POST /api/ai/decompose`
// （服务端持 LLM 密钥，前端只传 Bearer VITE_SYNC_TOKEN），失败/未配置时回退到
// 浏览器直连 LLM（OpenAI 兼容 /chat/completions，密钥存本地 aiConfig）。
//
// 两条路径都产出 `Omit<IAiSubtaskDraft,'id'>[]`，含 7+1 多维字段。
import type { TaskDifficulty, TaskImportance, LifeDomain, ContentType, ExecutionContext, IRecurrenceRule } from '@/types/quest';
import { loadAiConfig } from './aiConfig';
import type { IAiSubtaskDraft } from './aiDraft';
import { getEstimationMultiplier } from './feedback';
import { store } from '@/lib/storage';
import decomposeRules from '@/data/decomposeRules.json';

const VALID_DIFFICULTIES: TaskDifficulty[] = ['easy', 'normal', 'hard', 'epic'];
const VALID_IMPORTANCE: TaskImportance[] = ['low', 'medium', 'high', 'urgent'];
const VALID_LIFEDOMAIN: LifeDomain[] = ['work', 'parttime', 'growth', 'health'];
const VALID_CONTENT: ContentType[] = ['coding', 'writing', 'research', 'communication', 'design', 'mechanical', 'learning', 'errand'];
const VALID_EXECUTION: ExecutionContext[] = ['commute', 'snippet', 'focus', 'lowEnergy'];
const VALID_RECURRENCE: IRecurrenceRule['type'][] = ['none', 'daily', 'weekly', 'monthly', 'custom'];

/** 未配置密钥时抛出，含引导文案（仅浏览器回退路径用到） */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('尚未配置 AI 拆解密钥，请到「公会设置 → AI 拆解配置」填写 API Key；或配置云端同步后由服务端代理拆解');
    this.name = 'AiNotConfiguredError';
  }
}

function clampMinutes(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.min(9999, Math.max(20, Math.round(n)));
}

function pickEnum<T extends string>(v: unknown, set: T[], fallback: T | undefined): T | undefined {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return set.includes(s as T) ? (s as T) : fallback;
}

function pickArray<T extends string>(v: unknown, set: T[]): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => (typeof x === 'string' ? x.toLowerCase() : '')).filter((x) => set.includes(x as T)) as T[];
  return out.length ? out : undefined;
}

function coerceRecurrence(v: unknown): IRecurrenceRule | undefined {
  if (v && typeof v === 'object' && 'type' in (v as object)) {
    const t = pickEnum((v as any).type, VALID_RECURRENCE, 'none');
    return { type: t ?? 'none' };
  }
  const t = pickEnum(v, VALID_RECURRENCE, undefined);
  return t ? { type: t } : undefined;
}

type RawSubtask = Record<string, unknown>;

// 把任意来源（云端或浏览器直连）的原始 subtask 压成 IAiSubtaskDraft（去掉 id）
function toDraft(s: RawSubtask): Omit<IAiSubtaskDraft, 'id'> {
  const name = typeof s.name === 'string' ? s.name.trim().slice(0, 50) : '';
  return {
    name: name || '未命名子任务',
    description: typeof s.description === 'string' ? s.description.slice(0, 200) : '',
    difficulty: (pickEnum(s.difficulty, VALID_DIFFICULTIES, 'normal') ?? 'normal') as TaskDifficulty,
    estimatedMinutes: clampMinutes(s.estimatedMinutes),
    stage: typeof s.stage === 'number' ? s.stage : 1,
    importance: pickEnum(s.importance, VALID_IMPORTANCE, undefined),
    lifeDomain: pickArray(s.lifeDomain, VALID_LIFEDOMAIN),
    contentType: pickEnum(s.contentType, VALID_CONTENT, undefined),
    executionContext: pickArray(s.executionContext, VALID_EXECUTION),
    recurrence: coerceRecurrence(s.recurrence),
    capabilityIds: Array.isArray(s.capabilityIds) ? (s.capabilityIds.filter((x) => typeof x === 'string') as string[]) : undefined,
    howToHint: typeof s.howToHint === 'string' ? s.howToHint.slice(0, 300) : undefined,
    deadline: typeof s.deadline === 'number' ? s.deadline : undefined,
    startDate: typeof s.startDate === 'number' ? s.startDate : undefined,
    reminderAt: typeof s.reminderAt === 'number' ? s.reminderAt : undefined,
    kind: s.kind === 'decision' ? 'decision' : undefined,
  };
}

// P1-C：读取用户维护的预估校正乘数表（来自设置，不依赖 React 组件）
function readEstimationProfile(): Record<string, number> | undefined {
  try {
    const raw = store.getItem('__quest_guild_settings');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { estimationProfile?: Record<string, number> };
    return parsed.estimationProfile;
  } catch {
    return undefined;
  }
}

// P2-A1：客户端权威 schema —— 合并默认 dimensionVocab 与用户自定义 lifeDomain，
// 连同 difficultyTimeMatrix 一并发给云端（ai.cjs 以请求携带的 schema 为准，
// 因此改 decomposeRules.json / 加自定义领域无需重新部署服务端）。
// 安全：仅作为「枚举数据」放进请求体，服务端会再做结构校验与长度封顶。
export interface AiSchemaPayload {
  dimensionVocab: Record<string, string[]>;
  difficultyTimeMatrix: Record<string, number>;
}

function buildAiSchema(): AiSchemaPayload {
  const base = decomposeRules.constraints?.dimensionVocab ?? {};
  const vocab: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(base)) {
    vocab[k] = Array.isArray(v) ? [...v] : [];
  }
  // 注入用户自定义 lifeDomain（去重、小写、限长）
  try {
    const raw = store.getItem('__quest_guild_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { customLifeDomains?: string[] };
      const customs = (parsed.customLifeDomains || [])
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => x && !vocab.lifeDomain.includes(x))
        .slice(0, 50);
      vocab.lifeDomain = [...vocab.lifeDomain, ...customs];
    }
  } catch {
    /* ignore */
  }
  const matrix = decomposeRules.constraints?.difficultyTimeMatrix ?? {};
  return { dimensionVocab: vocab, difficultyTimeMatrix: matrix };
}

// P1-C：AI 拆解返回的预估耗时，按 contentType:difficulty 的乘数校正（初值 1.0 不改动）
// 仅在 AI 预估路径生效，不覆盖用户手动输入。
function applyEstimationProfile(drafts: Omit<IAiSubtaskDraft, 'id'>[]): Omit<IAiSubtaskDraft, 'id'>[] {
  const profile = readEstimationProfile();
  if (!profile) return drafts;
  return drafts.map((d) => {
    const m = getEstimationMultiplier(profile, d.contentType, d.difficulty);
    if (m === 1) return d;
    return { ...d, estimatedMinutes: Math.max(20, Math.round(d.estimatedMinutes * m)) };
  });
}

export interface DecomposeParams {
  name: string;
  description?: string;
  difficulty?: TaskDifficulty | string;
  estimatedMinutes?: number;
}

/**
 * 调 AI 拆解。优先走云端统一端点；失败则回退浏览器直连。
 * 返回可编辑的草稿子任务数组（不直接写入任务列表）。
 */
export async function callDecomposeLLM(params: DecomposeParams): Promise<Omit<IAiSubtaskDraft, 'id'>[]> {
  // 1) 优先：云端 workspace-server 统一拆解端点
  try {
    const url = (import.meta.env.VITE_SYNC_URL || 'https://life.hchch.tech').replace(/\/+$/, '');
    const token = import.meta.env.VITE_SYNC_TOKEN || '';
    if (token) {
      const resp = await fetch(`${url}/api/ai/decompose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: params.name,
          description: params.description,
          difficulty: params.difficulty,
          estimatedMinutes: params.estimatedMinutes,
          // P2-A1：客户端权威 schema（枚举数据，服务端校验后采用）
          dimensionVocab: buildAiSchema().dimensionVocab,
          difficultyTimeMatrix: buildAiSchema().difficultyTimeMatrix,
        }),
      });
      if (resp.ok) {
        const j = await resp.json().catch(() => null);
        const subs = j?.data?.subtasks;
        if (Array.isArray(subs) && subs.length) {
          return applyEstimationProfile(subs.map(toDraft));
        }
      }
      // 5xx / 业务错误 → 回退浏览器；4xx（如 401/403）也回退
    }
  } catch {
    /* 云端不可达，走回退 */
  }

  // 2) 回退：浏览器直连 LLM（与之前行为一致，但解析 7+1 字段）
  return callDecomposeLLMlocal(params);
}

// 浏览器直连（原 callDecomposeLLM 逻辑，保留为兜底）
async function callDecomposeLLMlocal(params: DecomposeParams): Promise<Omit<IAiSubtaskDraft, 'id'>[]> {
  const cfg = loadAiConfig();
  if (!cfg.apiKey.trim()) {
    throw new AiNotConfiguredError();
  }

  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const userPrompt =
    `请拆解这个史诗任务：\n` +
    `名称：${params.name}\n` +
    (params.description ? `描述：${params.description}\n` : '') +
    (params.difficulty ? `整体难度：${params.difficulty}\n` : '') +
    (params.estimatedMinutes ? `预估总时长：${params.estimatedMinutes} 分钟（子任务按实际复杂度独立估算，单条 20-120 分钟）\n` : '') +
    `\n请按阶段（stage）拆解，子任务以动词开头、可独立交付，输出纯 JSON。`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: decomposeRules.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });
  } catch (err) {
    throw new Error(
      `无法连接 AI 服务（请检查 Base URL 与网络/CORS 设置）：${String(err)}`,
    );
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    if (resp.status === 401) {
      throw new Error('AI 服务鉴权失败，请检查 API Key 是否正确');
    }
    if (resp.status === 404) {
      throw new Error('AI 服务地址无效（404），请检查 Base URL 是否指向 OpenAI 兼容接口');
    }
    throw new Error(`AI 拆解失败 HTTP ${resp.status}：${body.slice(0, 200)}`);
  }

  const data = await resp.json().catch(() => null);
  const content: string = data?.choices?.[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('AI 返回内容不是合法 JSON，请重试或调整提示');
  }

  const raw = (parsed as { subtasks?: unknown })?.subtasks;
  if (!Array.isArray(raw)) {
    throw new Error('AI 返回结构异常（缺少 subtasks 数组）');
  }

  const minMinutes = decomposeRules.constraints?.minMinutes ?? 20;
  const out: Omit<IAiSubtaskDraft, 'id'>[] = [];
  for (const s of raw as Array<Record<string, unknown>>) {
    if (!s || typeof s.name !== 'string') continue;
    const minutes = Number(s.estimatedMinutes);
    out.push(toDraft({
      ...s,
      // 兜底：浏览器路径若模型没给 estimatedMinutes，用约束下限
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : minMinutes,
    }));
  }
  return applyEstimationProfile(out);
}
