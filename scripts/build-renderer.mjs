// Electron 渲染进程构建：把前端打包进 quest-guild-electron/renderer/app
// 必须在项目根目录运行 vite，以便读取根 .env（含 VITE_SYNC_TOKEN 等）与 vite.config.ts。
// 注意：VITE_* 变量在编译期嵌入，Electron 运行时无法再读 .env，故构建时必须已配置好 .env。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'quest-guild-electron', 'renderer', 'app');

const child = spawn('npx', ['vite', 'build', '--outDir', OUT_DIR, '--emptyOutDir'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));
