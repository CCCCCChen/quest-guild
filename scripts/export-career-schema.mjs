#!/usr/bin/env node
/**
 * P0-5 · 从 src/data/career-plan-v1.zod.ts 用 zod v4 的 z.toJSONSchema 导出
 * public/schemas/career-plan-v1.schema.json（构建期产物，作为导入校验器 & 专家模板依据）。
 *
 * 用法：node scripts/export-career-schema.mjs
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const z = require('zod');

const SRC = path.join(__dirname, '..', 'src', 'data', 'career-plan-v1.zod.ts');
const OUT_DIR = path.join(__dirname, '..', 'public', 'schemas');
const OUT_FILE = path.join(OUT_DIR, 'career-plan-v1.schema.json');

async function main() {
  // 1) 用 esbuild 把 .zod.ts 转成临时 ESM（zod 标记为 external，运行时从根 node_modules 解析）
  const result = await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    external: ['zod'],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;

  // 2) 转译结果写成临时 ESM 并 import（写在 scripts/ 内，使 'zod' 外部依赖可向上解析到根 node_modules；用完即删）
  const tmpPath = path.join(__dirname, 'career-plan-schema-tmp.mjs');
  writeFileSync(tmpPath, code, 'utf8');
  const fileUrl = 'file://' + tmpPath.split(path.sep).join('/');
  const mod = await import(fileUrl);
  const { careerPlanV1Schema } = mod;
  try { unlinkSync(tmpPath); } catch { /* Windows 偶发占用，忽略；下次运行覆盖 */ }

  // 3) 生成 JSON Schema
  const jsonSchema = z.toJSONSchema(careerPlanV1Schema, { target: 'draft-7', io: 'input' });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(jsonSchema, null, 2) + '\n', 'utf8');
  console.log(`✓ 已导出 JSON Schema → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('导出 schema 失败:', err);
  process.exit(1);
});
