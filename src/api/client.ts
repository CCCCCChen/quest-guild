/**
 * 方案A：本地纯前端模式（无本地 HTTP server）。
 *
 * 保留 api 对象仅为兼容历史导入签名；所有业务 api 模块已改为本地持久化适配器，
 * 不再经由 HTTP。任何误用本对象的调用都会得到明确的「本地模式无服务」错误，
 * 而不是静默失败或连接拒绝。
 */

function unavailable<T>(path: string, method: string): Promise<T> {
  return Promise.reject(new Error(`[本地模式] 无 HTTP 服务：${method} ${path}`));
}

export const api = {
  get: <T>(path: string) => unavailable<T>(path, 'GET'),
  post: <T>(path: string, _body?: unknown) => unavailable<T>(path, 'POST'),
  put: <T>(path: string, _body?: unknown) => unavailable<T>(path, 'PUT'),
  patch: <T>(path: string, _body?: unknown) => unavailable<T>(path, 'PATCH'),
  delete: <T>(path: string) => unavailable<T>(path, 'DELETE'),
};

export default api;
