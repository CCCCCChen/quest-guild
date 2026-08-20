// 清理 Electron 构建输出目录（Windows 防占用重试版）
// 对应原 quest-guild-electron/package.json 的 prebuild 脚本
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronDir = path.join(__dirname, '..', 'quest-guild-electron');
const releaseDir = path.join(electronDir, 'release');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function clean(maxRetries = 5) {
  if (!fs.existsSync(releaseDir)) {
    console.log('release 目录不存在，跳过清理');
    return;
  }
  for (let i = 0; i < maxRetries; i++) {
    try {
      execSync('rd /s /q release', { cwd: electronDir, stdio: 'pipe' });
      console.log('已清理 release 目录');
      return;
    } catch (e) {
      const locked = e.message.match(/cannot access the file|being used|being used by|: (.+?) /);
      const file = locked ? locked[1] || locked[0] : '';
      console.log('清理失败 (' + (i + 1) + '/' + maxRetries + ')' + (file ? ' ' + file : ''));
      if (i < maxRetries - 1) await delay(2000);
    }
  }
  console.error('FATAL: release 目录被占用，无法清理。请关闭占用进程后重试。');
  process.exit(1);
}

clean();
