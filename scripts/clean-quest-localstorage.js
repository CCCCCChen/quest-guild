/*
 * Quest 本地任务清理脚本（浏览器控制台版）
 * --------------------------------------------------------------------------
 * 背景：用 ai-decompose.mjs / import-tasks.mjs 的 --push 生成的任务会进入
 *       quest 的浏览器 localStorage（__quest_guild_tasks），并随同步推到云端。
 *       它们不是“临时缓存”，是真实持久化的任务，不删就一直存在。
 *
 * 重要：只删 localStorage 不够——必须同时把 id 写进同步状态的 deletedTaskIds，
 *       否则云端那行还在，下次同步的“对账删除”会把它们又拉回来（删了又出现）。
 *       本脚本两种都处理了。
 *
 * 用法：
 *   1. 浏览器打开 quest（npm run dev 默认 http://localhost:5173）
 *   2. F12 → Console（控制台）
 *   3. 把本文件全部内容粘贴进去回车（默认 DRY RUN，只列出、不删除）
 *   4. 看下方清单，把要删的任务 id 填到 TARGET_IDS，或写 MATCH_NAME_RE 名称正则
 *   5. 把 APPLY 改为 true，再粘贴执行一次 → 真正删除 + 标记云端删除
 *   6. 刷新页面 → 在 App 里点「同步」，让删除传播到云端 workspace
 * --------------------------------------------------------------------------
 */
(function () {
  if (typeof localStorage === 'undefined') {
    console.error('❌ 此脚本需在浏览器 localStorage 环境运行：打开 quest 页面后按 F12 粘贴。');
    return;
  }

  // ===================== 配置区（按需修改） =====================
  const APPLY = false;            // ← 改成 true 才真正删除（默认只预览）
  const TARGET_IDS = [];          // ← 精确 id 列表，例如 ['ep_xxx','dy_yyy']
  const MATCH_NAME_RE = null;     // ← 名称正则，例如 /单元测试|打包|修复已知问题/ ；不需要留 null
  // ============================================================

  const TASKS_KEY = '__quest_guild_tasks';
  const SYNC_KEY = '__quest_guild_sync_v1';

  function read(key, fallback) {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : fallback;
    } catch (e) {
      console.warn('读取', key, '失败：', e);
      return fallback;
    }
  }
  function write(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  const tasks = read(TASKS_KEY, []);
  if (!Array.isArray(tasks)) {
    console.error('任务数据异常，不是数组：', tasks);
    return;
  }

  // ---- 列出全部，便于判断 ----
  console.log(
    '%c===== Quest 本地任务清单（共 ' + tasks.length + ' 条）=====',
    'color:#36f;font-weight:bold'
  );
  const bySource = {};
  tasks.forEach((t, i) => {
    const s = t.source || '(undefined)';
    bySource[s] = (bySource[s] || 0) + 1;
    console.log(
      String(i).padStart(2, ' '), '|',
      String(t.id || '?').padEnd(24), '|',
      String(t.source || '(undef)').padEnd(10), '|',
      String(t.type || '?').padEnd(5), '|',
      String(t.status || '?').padEnd(9), '|',
      t.name || '(无名称)'
    );
  });
  console.log('按 source 分布：', bySource);

  function isTarget(t) {
    if (TARGET_IDS.length && TARGET_IDS.includes(t.id)) return true;
    if (MATCH_NAME_RE && t.name && new RegExp(MATCH_NAME_RE).test(t.name)) return true;
    return false;
  }

  const targets = tasks.filter(isTarget);
  console.log('%c匹配到 ' + targets.length + ' 条待删任务：', 'color:#f60');
  targets.forEach((t) => console.log('  -', t.id, '|', t.name));

  if (!APPLY) {
    console.log(
      '%c【DRY RUN】未执行删除。确认无误后，把 APPLY 改为 true 再运行一次。',
      'color:#888'
    );
    return;
  }

  // ---- 真正删除 + 标记云端删除 ----
  const targetIds = new Set(targets.map((t) => t.id));
  const remaining = tasks.filter((t) => !targetIds.has(t.id));
  write(TASKS_KEY, remaining);

  const sync = read(SYNC_KEY, { deletedTaskIds: [] });
  sync.deletedTaskIds = Array.isArray(sync.deletedTaskIds) ? sync.deletedTaskIds : [];
  for (const id of targetIds) {
    if (!sync.deletedTaskIds.includes(id)) sync.deletedTaskIds.push(id);
  }
  write(SYNC_KEY, sync);

  console.log(
    '%c✅ 已删除 ' + targetIds.size + ' 条本地任务，并标记云端删除。',
    'color:#0a0;font-weight:bold'
  );
  console.log('下一步：刷新页面 → 在 App 里点「同步」，让云端 workspace 也清理掉这些 source=qg 任务。');
})();
