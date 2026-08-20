// AI 拆解配置读写层
// 配置仅存于本地存储（localStorage / Electron store），不会上传到任何服务端。
import { store } from '@/lib/storage';

const AI_CONFIG_KEY = '__quest_guild_ai_config';

export interface IAiConfig {
  /** OpenAI 兼容接口的 API Key（仅本地保存） */
  apiKey: string;
  /** OpenAI 兼容接口 Base URL，默认官方 */
  baseUrl: string;
  /** 模型名 */
  model: string;
}

const DEFAULT_CONFIG: IAiConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

export function loadAiConfig(): IAiConfig {
  try {
    const raw = store.getItem(AI_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<IAiConfig>;
    return {
      apiKey: parsed.apiKey ?? '',
      baseUrl: parsed.baseUrl?.trim() || DEFAULT_CONFIG.baseUrl,
      model: parsed.model?.trim() || DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveAiConfig(cfg: IAiConfig): void {
  try {
    store.setItem(AI_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function isAiConfigured(): boolean {
  return loadAiConfig().apiKey.trim().length > 0;
}
