// Electron 渲染进程构建：把前端打包进 quest-guild-electron/renderer/app
// 必须在项目根目录运行 vite，以便读取根 .env（含 VITE_SYNC_TOKEN 等）与 vite.config.ts。
// 注意：VITE_* 变量在编译期嵌入，Electron 运行时无法再读 .env，故构建时必须已配置好 .env。
//
// 为什么先移走旧产物（2026-08-21）：
//   IDE/杀软可能锁住 renderer/app 里的文件，vite 的 --emptyOutDir 清空输出目录时会被
//   safe-delete 回收站机制拦截（报 “Error during a trash operation”）。
//   解法：构建前用 rename 把旧 app 目录整体挪到 app.stale-<ts> —— 同卷 rename 只改父目录项，
//   不经过回收站、也不要求内部文件可写，即使文件被 IDE 锁定通常也能成功；
//   vite 面对“不存在的输出目录”只会 mkdir，全程不触发删除，彻底绕开 safe-delete。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'quest-guild-electron', 'renderer', 'app');

// 1) rename aside 旧产物
if (fs.existsSync(OUT_DIR)) {
  const stale = OUT_DIR + '.stale-' + Date.now();
  try {
    fs.renameSync(OUT_DIR, stale);
    console.log('已移走旧 renderer 产物: ' + path.basename(stale));
    console.log('（确认无需保留后，可用资源管理器手动删除该 .stale 目录）');
  } catch {
    console.warn('WARN: renderer/app 未能移走（可能被 IDE 锁定），交由 vite 尝试覆写。');
  }
}

// 2) vite build（node 直跑 vite cli，避免 npx+shell 的 DEP0190 告警）
const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteCli, 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
