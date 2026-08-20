/**
 * 浏览器控制台一键导入种子任务（示例任务）
 * ----------------------------------------------------------------------------
 * 用法：
 *   1. 打开 App 页面（需处于开发模式：npm run dev，localhost:5173 之类），按 F12 → Console
 *   2. 整段粘贴运行。默认 APPLY=false 先「预览」将要导入的任务
 *   3. 确认无误后，把顶部 const APPLY = false 改成 true，再跑一次即真正写入
 *
 * 说明：
 *   - 种子数据来自 /src/data/sampleTasks.ts 的 SAMPLE_TASKS（开发/个人/每日悬赏三类）
 *   - 按任务 id 去重：已存在的不会重复导入
 *   - 写入 __quest_guild_tasks 后，刷新页面即可见；随后点「同步」即可推到云端
 *   - 生产版（life.hchch.tech）无法动态加载源码，请改用「悬赏池」顶部「导入示例任务」按钮
 */
const APPLY = false;
const STORAGE_KEY = '__quest_guild_tasks';

(async () => {
  let SAMPLE_TASKS = [];
  try {
    const mod = await import('/src/data/sampleTasks.ts');
    SAMPLE_TASKS = mod.SAMPLE_TASKS || [];
  } catch (e) {
    console.error('⚠️ 无法加载种子数据（需 dev 模式）。请改用「悬赏池」顶部「导入示例任务」按钮。', e);
    return;
  }

  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const existingIds = new Set(existing.map((t) => t.id));
  const toAdd = SAMPLE_TASKS.filter((t) => !existingIds.has(t.id));

  console.log(`📦 现有任务 ${existing.length} 条，种子 ${SAMPLE_TASKS.length} 条，将新增 ${toAdd.length} 条`);

  if (!APPLY) {
    console.log('（预览）将导入：');
    toAdd.forEach((t) => console.log(`   • ${t.name}  [${t.type}/${t.difficulty}]  标签:${t.tags?.join(',') || '无'}`));
    console.log('确认无误 → 把顶部 const APPLY = false 改为 true 再运行一次。');
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...toAdd]));
  console.log(`✅ 已导入 ${toAdd.length} 条种子任务，刷新页面即可见；建议随后点「同步」推到云端。`);
})();
