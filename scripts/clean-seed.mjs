#!/usr/bin/env node

/**
 * clean-seed.mjs — 对已构建的 builtin-vocab.json 应用可背性清洗
 *
 * 复用 build-seed.mjs 的 isStudyable（唯一真源），剔除专有名词/缩写/词组等噪音，
 * 重新按 level→freq 排序并重排 id/order，写回 scripts/ 与 minimemo/public/。
 *
 * 用法：node scripts/clean-seed.mjs
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isStudyable } from './build-seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SRC = join(__dirname, 'builtin-vocab.json');
const STATS = join(__dirname, 'builtin-vocab-stats.json');
const PUBLIC = join(ROOT, 'minimemo', 'public', 'builtin-vocab.json');

const LEVELS = { gk: 1, cet4: 2, cet6: 3, ielts: 4 };

async function main() {
  const raw = JSON.parse(await readFile(SRC, 'utf-8'));
  const before = raw.length;

  const kept = raw.filter((w) => isStudyable(w.word, w.cn));

  // 重新排序：level 升序，再按词频（越小越常见）
  kept.sort((a, b) => {
    const la = LEVELS[a.level] || 99;
    const lb = LEVELS[b.level] || 99;
    if (la !== lb) return la - lb;
    return (a.freq || 999999) - (b.freq || 999999);
  });
  kept.forEach((w, i) => {
    w.id = i + 1;
    w.order = i + 1;
  });

  const byLevel = {};
  for (const w of kept) byLevel[w.level] = (byLevel[w.level] || 0) + 1;

  const json = JSON.stringify(kept);
  await writeFile(SRC, json, 'utf-8');
  if (existsSync(dirname(PUBLIC))) await writeFile(PUBLIC, json, 'utf-8');

  await writeFile(
    STATS,
    JSON.stringify(
      {
        total: kept.length,
        byLevel,
        includedTags: ['gk', 'cet4', 'cet6', 'ielts'],
        extraTags: [],
        generatedAt: new Date().toISOString(),
        fileSizeEstimate: Buffer.byteLength(json, 'utf-8'),
        cleaned: true,
        removed: before - kept.length,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`✅  清洗完成: ${before} → ${kept.length}（剔除 ${before - kept.length}）`);
  console.log('   分级累计基数:', JSON.stringify(byLevel));
  console.log(`   写入: ${SRC}`);
  console.log(`   写入: ${PUBLIC}`);
}

main().catch((err) => {
  console.error('❌  清洗失败:', err);
  process.exit(1);
});
