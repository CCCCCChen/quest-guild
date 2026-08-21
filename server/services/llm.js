/**
 * LLM 统一封装
 * 支持：火山方舟（豆包）、Ollama 本地部署
 * 统一 OpenAI 兼容格式调用
 */

// 拆解规则统一引用共享源（src/data/decomposeRules.json），与浏览器端 aiClient.ts 同源，
// 避免「服务端规则 / 浏览器端规则 / B2 注入」三处分叉。
// 注意：该 JSON 同时被 Vite 打包（浏览器端）与 Node require（服务端）引用，是唯一的拆解规则权威。
const decomposeRules = require('../../src/data/decomposeRules.json');
const SYSTEM_PROMPT = decomposeRules.systemPrompt; // @deprecated 历史内联 prompt 已上移到共享 JSON，本文件不再保留副本

async function callLLM(userPrompt) {
  const provider = process.env.LLM_PROVIDER || 'ollama';
  const apiKey = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || (provider === 'ollama' ? 'qwen2:7b' : 'doubao-pro-32k');
  const baseURL = process.env.LLM_BASE_URL || (provider === 'ollama'
    ? 'http://localhost:11434/v1'
    : 'https://ark.cn-beijing.volces.com/api/v3');

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM 调用失败 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(content);
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
      throw new Error('返回格式不对');
    }
    return parsed.subtasks;
  } catch (e) {
    // 尝试提取 JSON
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.subtasks) return parsed.subtasks;
    }
    throw new Error('LLM 返回内容解析失败: ' + content.slice(0, 200));
  }
}

/**
 * 拆解任务
 * @param {Object} task - { name, description, difficulty, type }
 * @returns {Promise<Array>} 子任务列表
 */
async function decomposeTask(task) {
  const userPrompt = `请拆解以下任务：

【任务名称】${task.name}
【任务描述】${task.description || '无'}
【任务类型】${task.type || 'daily'}
【难度等级】${task.difficulty || 'normal'}
【预估总时长参考】${task.estimatedMinutes || 30} 分钟（子任务按实际复杂度独立估算，单条 20-120 分钟，动词开头、可独立交付）

请按阶段拆解，输出纯 JSON。`;

  const subtasks = await callLLM(userPrompt);

  // 规范化字段
  return subtasks.map((st, idx) => ({
    name: String(st.name || `子任务 ${idx + 1}`).trim(),
    description: String(st.description || '').trim(),
    difficulty: ['easy', 'normal', 'hard', 'epic'].includes(st.difficulty) ? st.difficulty : 'normal',
    estimatedMinutes: parseInt(st.estimatedMinutes, 10) || 30,
    stage: parseInt(st.stage, 10) || 1,
    type: task.type === 'epic' ? 'epic' : 'daily',
  }));
}

module.exports = { decomposeTask, callLLM };
