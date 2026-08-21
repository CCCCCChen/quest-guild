// Electron 打包重试脚本（对应原 quest-guild-electron/package.json 的 retry-build）
// 调用根 node_modules 里的 electron-builder，从仓库根目录运行（读取根 package.json 的 build 配置）
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const electronDir = path.join(rootDir, 'quest-guild-electron');
const eb = path.join(rootDir, 'node_modules', '.bin', 'electron-builder.cmd');
const args = process.argv.slice(2);

for (let i = 0; i < 3; i++) {
  const r = spawnSync(eb, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    // 用 -fresh 缓存：原 .electron-cache 里 nsis-3.0.4.1 下载破损且环境禁止 rename 修复；
    // fresh 缓存已手工补齐完整 nsis-3.0.4.1 + nsis-resources-3.4.1（Electron 二进制仍在原缓存，见 build.electronDownload.cache）
    env: { ...process.env, ELECTRON_BUILDER_CACHE: path.join(electronDir, '.electron-cache-fresh') },
  });
  if (r.status === 0) process.exit(0);
  console.log('尝试 ' + (i + 1) + ' 失败，' + (i < 2 ? '3秒后重试...' : '已达最大重试次数'));
  if (i < 2) {
    // 跨平台同步等待（避免依赖 CMD 的 `timeout /t` 或 Linux 的 `timeout`）
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
}
process.exit(1);
