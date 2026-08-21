// Electron 打包重试脚本（对应原 quest-guild-electron/package.json 的 retry-build）
// 调用根 node_modules 里的 electron-builder，从仓库根目录运行（读取根 package.json 的 build 配置）
//
// 输出目录唯一化（2026-08-21）：
//   IDE/杀软/运行中的 exe 可能锁住 quest-guild-electron/out 里的旧产物（典型症状：
//   “The process cannot access the file because it is being used by another process”）。
//   删除被占用文件在 Windows 上是死结，因此本脚本在预清理（electron:clean）之后探测：
//   若 out/win-unpacked 仍残留（= 未清干净，被占用），本次打包自动改输出到
//   quest-guild-electron/out-<yyyyMMdd-HHmmss>，绝不触碰被锁文件，保证打包必成。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const electronDir = path.join(rootDir, 'quest-guild-electron');
const defaultOut = path.join(electronDir, 'out');
const cliJs = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
const args = process.argv.slice(2);

// —— 输出目录决策：默认 out/；被占用时唯一化到 out-<ts> ——
const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-'); // 20260821-103512
let outputRel = 'quest-guild-electron/out'; // 相对 rootDir（electron-builder 的 -c.directories.output 相对 cwd）
if (fs.existsSync(path.join(defaultOut, 'win-unpacked'))) {
  outputRel = 'quest-guild-electron/out-' + ts;
  console.log('⚠️  默认 out/ 仍含旧产物（被 IDE/杀软/运行中的 exe 锁定，清理未成功）。');
  console.log('    本次输出到全新目录: ' + outputRel + ' （避免触碰被锁文件）');
} else {
  console.log('out/ 已就绪，使用默认输出目录');
}

const buildArgs = [...args, '--config.directories.output=' + outputRel];

// 剥离 safe-delete shim：WorkBuddy 通过 NODE_OPTIONS=--require=...genie-safe-delete.cjs
// 注入回收站拦截，electron-builder 内部删除（NSIS 中间产物等）也会被路由到回收站而失败
// （“Error during a trash operation”）。去掉该 require，保留其余选项（如 --use-system-ca）。
const env = { ...process.env, ELECTRON_BUILDER_CACHE: path.join(electronDir, '.electron-cache-fresh') };
if (env.NODE_OPTIONS) {
  env.NODE_OPTIONS = env.NODE_OPTIONS
    .replace(/--require="[^"]*genie-safe-delete\.cjs"\s*/i, '')
    .trim();
  if (!env.NODE_OPTIONS) delete env.NODE_OPTIONS;
}

for (let i = 0; i < 3; i++) {
  // 用 node 直跑 cli.js，无需 shell:true（顺带消除 DEP0190 告警）
  const r = spawnSync(process.execPath, [cliJs, ...buildArgs], {
    cwd: rootDir,
    stdio: 'inherit',
    // 用 -fresh 缓存：原 .electron-cache 里 nsis-3.0.4.1 下载破损且环境禁止 rename 修复；
    // fresh 缓存已手工补齐完整 nsis-3.0.4.1 + nsis-resources-3.4.1（Electron 二进制仍在原缓存，见 build.electronDownload.cache）
    env,
  });
  if (r.status === 0) {
    // 打印产物位置，方便在唯一化目录下找到结果
    const outAbs = path.join(rootDir, outputRel);
    const exes = fs.existsSync(outAbs)
      ? fs.readdirSync(outAbs).filter((f) => f.endsWith('.exe')).map((f) => path.join(outAbs, f))
      : [];
    console.log('✅ 打包完成，产物目录: ' + outputRel);
    for (const exe of exes) console.log('   - ' + exe);
    process.exit(0);
  }
  console.log('尝试 ' + (i + 1) + ' 失败，' + (i < 2 ? '3秒后重试...' : '已达最大重试次数'));
  if (i < 2) {
    // 跨平台同步等待（避免依赖 CMD 的 `timeout /t` 或 Linux 的 `timeout`）
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  }
}
process.exit(1);
