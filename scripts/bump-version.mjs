// 版本号递增脚本（方案 1：npm version + git tag）
// 用法:
//   node scripts/bump-version.mjs [patch|minor|major] [--dry]
//   npm run version:patch    # 0.1.0 → 0.1.1
//   npm run version:minor    # 0.1.0 → 0.2.0
//   npm run version:major    # 0.1.0 → 1.0.0
// 效果: 更新 package.json/package-lock.json → git commit "chore: release vX.Y.Z" → git tag vX.Y.Z
// 之后运行打包: npm run electron:build:win64
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const rawType = (process.argv[2] || 'patch').replace(/^--/, '');
const dry = process.argv.includes('--dry');

if (!['patch', 'minor', 'major'].includes(rawType)) {
  console.error('用法: node scripts/bump-version.mjs [patch|minor|major] [--dry]');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const [maj, min, patch] = pkg.version.split('.').map(Number);
const next =
  rawType === 'major'
    ? `${maj + 1}.0.0`
    : rawType === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${patch + 1}`;

console.log(`当前版本 ${pkg.version}  →  ${rawType}: ${next}`);
if (dry) {
  console.log('[dry-run] 未执行任何修改。真实执行将: 改 package.json + commit + tag v' + next);
  process.exit(0);
}

// npm version 会触发 preversion/version 生命周期与 pre-commit hook（lint），失败则中止
const r = spawnSync('npm', ['version', rawType, '-m', 'chore: release v%s'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});
if (r.status !== 0) {
  console.error('npm version 失败，版本号未变更。');
  process.exit(r.status ?? 1);
}
console.log(`\n✅ 已升版并打 tag v${next}。接下来打包: npm run electron:build:win64`);
