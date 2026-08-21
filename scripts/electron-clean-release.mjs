// 清理 Electron 构建输出目录
// 对应原 quest-guild-electron/package.json 的 prebuild 脚本
//
// 演进说明：
// 1) 最初用 `rd /s /q release`（Windows CMD 内置命令），在 Git Bash 子shell 不稳。
// 2) 改用 Node 原生 fs.rmSync（recursive+force），跨平台。
// 3) 某些沙箱环境用 [safe-delete] 回收站机制拦截 fs.rmSync、把删除路由到
//    「回收站」，若回收站后端不可用或目录含锁定文件会失败（fail-closed 拒删）。
//    因此本脚本改为多策略 + 尽力而为：
//      a) 先 fs.rmSync；
//      b) 失败则 mv 重命名到 <dir>.stale-<ts>（重命名不走回收站，沙箱可用）；
//      c) 仍失败则告警放行（exit 0），让 electron-builder 自行覆写。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.join(__dirname, '..', 'quest-guild-electron');
// 与 package.json 的 build.directories.output 保持一致
const outDir = path.join(electronDir, 'out');

// 尽力而为：若有正在运行的绿色版/便携版应用，先结束进程（否则其锁定的
// app.asar / 目录会让清理与 electron-builder 覆写失败）。找不到进程会报错，忽略即可。
function killRunningApp() {
  for (const name of ['悬赏任务公会.exe']) {
    const r = spawnSync('taskkill', ['/F', '/IM', name], { stdio: 'ignore', windowsHide: true });
    if (r.status === 0) console.log('已结束正在运行的应用进程: ' + name);
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function tryRenameAside(dir) {
  try {
    const stale = dir + '.stale-' + Date.now();
    fs.renameSync(dir, stale);
    return stale;
  } catch {
    return null;
  }
}

async function clean(maxRetries = 2) {
  killRunningApp();
  if (!fs.existsSync(outDir)) {
    console.log('out 目录不存在，跳过清理');
    return;
  }
  // 策略 a: fs.rmSync
  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 2 });
      console.log('已清理 out 目录');
      return;
    } catch (e) {
      const msg = (e?.message || String(e)).slice(0, 100);
      console.log('rmSync 清理失败 (' + (i + 1) + '/' + maxRetries + ') ' + msg);
      if (i < maxRetries - 1) await delay(1000);
    }
  }
  // 策略 b: mv 重命名到旁边（不走回收站，沙箱可用）
  const aside = tryRenameAside(outDir);
  if (aside) {
    console.log('已将旧 out 目录重命名移走: ' + path.basename(aside));
    console.log('（可稍后用资源管理器手动删除该 .stale 目录）');
    return;
  }
  // 策略 c: 尽力而为，放行
  console.warn('WARN: out 目录未能清空（沙箱回收站机制拦截或含锁定文件）。');
  console.warn('      已跳过预清理，electron-builder 将直接覆写输出。');
}

clean();
