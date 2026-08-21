// 浏览器端 LLM 拆解客户端（OpenAI 兼容 /chat/completions）
// 复用 scripts/ai-decompose.mjs 的拆解思路，但改为「给一个史诗任务拆子任务」单次调用，
// 返回可编辑的草稿子任务数组（不直接写入任务列表）。
import type { TaskDifficulty } from '@/types/quest';
import { loadAiConfig } from './aiConfig';
import type { IAiSubtaskDraft } from './aiDraft';
import decomposeRules from '@/data/decomposeRules.json';

// 拆解规则统一引用共享源（src/data/decomposeRules.json），与服务端 server/services/llm.js 同源，
// 避免「服务端规则 / 浏览器端规则 / B2 注入」三处分叉。
const SYSTEM_PROMPT = decomposeRules.systemPrompt;

const VALID_DIFFICULTIES: TaskDifficulty[] = ['easy', 'normal', 'hard', 'epic'];

/** 未配置密钥时抛出，含引导文案 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('尚未配置 AI 拆解密钥，请到「公会设置 → AI 拆解配置」填写 API Key');
    this.name = 'AiNotConfiguredError';
  }
}

export async function callDecomposeLLM(params: {
  name: string;
  description?: string;
  difficulty?: TaskDifficulty | string;
  estimatedMinutes?: number;
}): Promise<Omit<IAiSubtaskDraft, 'id'>[]> {
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
          { role: 'system', content: SYSTEM_PROMPT },
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

  const out: Omit<IAiSubtaskDraft, 'id'>[] = [];
  for (const s of raw as Array<Record<string, unknown>>) {
    if (!s || typeof s.name !== 'string') continue;
    const difficulty = (VALID_DIFFICULTIES as string[]).includes(s.difficulty as string)
      ? (s.difficulty as TaskDifficulty)
      : 'normal';
    const minutes = Number(s.estimatedMinutes);
    // 钳制到共享约束：单任务至少 minMinutes（20）分钟，上限 9999
    const minMinutes = decomposeRules.constraints?.minMinutes ?? 20;
    out.push({
      name: String(s.name).trim().slice(0, 50) || '未命名子任务',
      description: typeof s.description === 'string' ? s.description.slice(0, 200) : '',
      difficulty,
      estimatedMinutes: Math.min(9999, Math.max(minMinutes, Number.isFinite(minutes) ? minutes : 30)),
      stage: typeof s.stage === 'number' ? s.stage : 1,
    });
  }
  return out;
}
