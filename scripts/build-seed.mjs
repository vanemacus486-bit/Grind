#!/usr/bin/env node

/**
 * build-seed.mjs — 构建期脚本：从 ECDICT 提取分级词库种子
 *
 * 用法：
 *   node scripts/build-seed.mjs                # 自动下载+处理，输出到当前目录
 *   node scripts/build-seed.mjs --input ec.csv # 从本地 CSV 读
 *   node scripts/build-seed.mjs --output out/  # 指定输出目录
 *   node scripts/build-seed.mjs --include toefl,ky  # 额外包含托福/考研
 *
 * 输出：
 *   builtin-vocab.json  — 精简 seed（供运行时导入）
 *   builtin-vocab-stats.json — 统计信息
 */

import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { createInterface } from 'readline';
import { get } from 'https';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── 配置 ────────────────────────────────────────────────────────────────────
const ECDICT_URLS = [
  'https://ghproxy.net/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
  'https://ghproxy.com/https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
  'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv',
];
const DEFAULT_OUTPUT = join(ROOT, 'scripts');

const LEVELS = {
  gk: 1,
  cet4: 2,
  cet6: 3,
  ielts: 4,
  // 可选包含
  toefl: 3,
  ky: 3,
};

const LEVEL_NAMES = ['', 'gk', 'cet4', 'cet6', 'ielts'];

// ─── CLI 解析 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let inputPath = null;
let outputDir = DEFAULT_OUTPUT;
let extraTags = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && i + 1 < args.length) {
    inputPath = args[++i];
  } else if (args[i] === '--output' && i + 1 < args.length) {
    outputDir = args[++i];
  } else if (args[i] === '--include' && i + 1 < args.length) {
    extraTags = args[++i].split(',').map((t) => t.trim()).filter(Boolean);
  } else if (args[i] === '--help') {
    console.log(`
用法: node build-seed.mjs [选项]

选项:
  --input <path>    本地 ecdict.csv 路径（省略则自动下载）
  --output <dir>    输出目录（默认 scripts/）
  --include <tags>  额外包含的标签，逗号分隔（如 toefl,ky）
  --help            显示此帮助
`);
    process.exit(0);
  }
}

const INCLUDE_TAGS = new Set(['gk', 'cet4', 'cet6', 'ielts', ...extraTags]);
const HEADER = ['word', 'phonetic', 'definition', 'translation', 'pos',
  'collins', 'oxford', 'tag', 'bnc', 'frq', 'exchange', 'detail', 'audio'];

// ─── 可背性过滤 ──────────────────────────────────────────────────────────────
/**
 * 判断一个词是否值得纳入背诵词库（过滤专有名词等噪音）
 * 规则（被 clean-seed.mjs 复用，是清洗的唯一真源）：
 *   - 必须有中文释义
 *   - 至少 2 个字符
 *   - 首字母大写一律剔除：专有名词/缩写/月份/星期/国名（如 England、TV、April）
 *   - 仅保留纯字母与连字符；含空格/数字/标点的词组、缩写剔除
 */
export function isStudyable(word, cn) {
  if (!word) return false;
  if (!cn || !cn.trim()) return false;
  if (word.length <= 1) return false;
  if (/^[A-Z]/.test(word)) return false;
  if (/[^a-zA-Z-]/.test(word)) return false;
  return true;
}

// ─── 下载 ────────────────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.tmp' + Date.now();
    console.log(`⬇️   下载 ${url} ...`);
    const file = createWriteStream(tmpPath);
    let timedOut = false;
    let lastChunkTime = Date.now();

    const req = get(url, (res) => {
      if (res.statusCode >= 400) {
        file.close();
        unlink(tmpPath).catch(() => {});
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastPct = -1;
      lastChunkTime = Date.now();

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        lastChunkTime = Date.now();
        if (total) {
          const pct = Math.round((downloaded / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) {
            console.log(`     ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
            lastPct = pct;
          }
        }
      });

      res.pipe(file);
      file.on('finish', async () => {
        file.close();
        if (timedOut) return;
        // 重命名临时文件为目标文件
        try {
          await (await import('fs/promises')).rename(tmpPath, destPath);
        } catch (e) {
          reject(e);
          return;
        }
        console.log(`✅   下载完成: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
        resolve();
      });
    });
    req.on('error', (err) => {
      if (timedOut) return;
      timedOut = true;
      unlink(tmpPath).catch(() => {});
      reject(err);
    });
    // 超时检测：每 15 秒检查是否有新数据，无则超时
    const timeoutInterval = setInterval(() => {
      if (timedOut) { clearInterval(timeoutInterval); return; }
      if (Date.now() - lastChunkTime > 60000) {
        timedOut = true;
        clearInterval(timeoutInterval);
        req.destroy();
        unlink(tmpPath).catch(() => {});
        reject(new Error('下载超时（60 秒无数据）'));
      }
    }, 15000);
    file.on('close', () => clearInterval(timeoutInterval));
  });
}

async function downloadWithFallback(destPath) {
  const errors = [];
  for (const url of ECDICT_URLS) {
    try {
      await downloadFile(url, destPath);
      return;
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
      console.log(`⚠️   失败: ${err.message}`);
      // 继续尝试下一个源
    }
  }
  throw new Error(`所有下载源均失败:\n  ${errors.join('\n  ')}`);
}

// ─── CSV 解析行 ──────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── 清理释义 ────────────────────────────────────────────────────────────────
function cleanTranslation(raw) {
  if (!raw) return '';
  // 常见分解符号：\n 分多条
  let parts = raw.split(/\\n/).filter(Boolean);
  if (parts.length === 0) return '';
  // 取前 2 条
  parts = parts.slice(0, 2);
  return parts
    .map((p) =>
      p
        .replace(/^[❶❷❸❹❺❻❼❽❾❿①②③④⑤⑥⑦⑧⑨⑩]+\s*/, '')
        .replace(/^[；;]\s*/, '')
        .trim()
    )
    .filter(Boolean)
    .join('；');
}

// ─── 解析 exchange 字段 → forms[] ────────────────────────────────────────────
function parseExchange(raw) {
  if (!raw) return undefined;
  // 格式: "d:did,d:done,d:doing,d:does" 或 "p:过去式,d:过去分词"
  const forms = [];
  const parts = raw.split(',');
  for (const part of parts) {
    const m = part.match(/^[a-z]+:(.+)$/);
    if (m) forms.push(m[1].trim());
  }
  return forms.length > 0 ? [...new Set(forms)] : undefined;
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = inputPath || join(outputDir, 'ecdict.csv');

  if (!existsSync(csvPath)) {
    if (!inputPath) {
      console.log('⚠️   未指定本地文件，尝试下载 ECDICT...');
      await downloadWithFallback(csvPath);
    } else {
      console.error(`❌   文件不存在: ${csvPath}`);
      process.exit(1);
    }
  } else {
    console.log(`📄  使用本地文件: ${csvPath}`);
  }

  const stats = { total: 0, filtered: 0, deduped: 0, byLevel: {} };
  const wordsMap = new Map(); // word -> WordSeed

  // 包含标签匹配：一行 tag 含我们关注的任一标签即入选
  console.log('🔍  筛选行...');

  const rl = createInterface({
    input: (await import('fs')).createReadStream(csvPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue; // 跳过表头

    stats.total++;

    const cols = parseCSVLine(line);
    if (cols.length < 8) continue;

    const word = cols[0];
    const tag = cols[7] || '';

    // 检查标签
    const rawTags = tag.split(/\s+/).filter(Boolean);
    const matchedTags = rawTags.filter((t) => INCLUDE_TAGS.has(t));
    if (matchedTags.length === 0) continue;

    // 可背性过滤：剔除专有名词/缩写/词组等噪音
    const cn = cleanTranslation(cols[3]);
    if (!isStudyable(word, cn)) continue;

    // 去重
    if (wordsMap.has(word)) {
      const existing = wordsMap.get(word);
      // 合并标签
      for (const t of matchedTags) {
        if (!existing.tags.includes(t)) existing.tags.push(t);
      }
      // 重新计算 level
      existing.level = LEVEL_NAMES[Math.min(...existing.tags.map((t) => LEVELS[t] || 99))];
      stats.deduped++;
      continue;
    }

    // 计算 level
    const tagLevels = matchedTags.map((t) => LEVELS[t] || 99);
    const minLevel = Math.min(...tagLevels);
    const level = LEVEL_NAMES[minLevel];

    // 解析频率
    const frq = parseInt(cols[9], 10);
    const bnc = parseInt(cols[8], 10);
    const freq = !isNaN(frq) && frq > 0 ? frq : (!isNaN(bnc) && bnc > 0 ? bnc : 999999);

    // 柯林斯星级
    const collinsVal = parseInt(cols[5], 10);
    const collins = !isNaN(collinsVal) && collinsVal > 0 ? collinsVal : undefined;

    // 牛津核心
    const oxfordVal = parseInt(cols[6], 10);
    const oxford = oxfordVal === 1 ? 1 : undefined;

    const entry = {
      id: 0, // 运行时分配
      word,
      phonetic: cols[1] || undefined,
      cn,
      en: cols[2] || undefined,
      level,
      tags: matchedTags,
      freq,
      collins,
      oxford,
      forms: parseExchange(cols[10]),
      order: 0, // 下面计算
    };

    wordsMap.set(word, entry);
    stats.filtered++;

    if (stats.filtered % 1000 === 0) {
      process.stdout.write(`\r     已筛选 ${stats.filtered} 词...`);
    }
  }

  console.log(`\n✅  筛选完成: 共 ${stats.filtered} 个唯一词`);

  // ─── 算 order 并排序 ────────────────────────────────────────────────────
  console.log('📊  计算排序...');
  const words = Array.from(wordsMap.values());

  words.sort((a, b) => {
    const la = LEVELS[a.level] || 99;
    const lb = LEVELS[b.level] || 99;
    if (la !== lb) return la - lb;
    return a.freq - b.freq;
  });

  words.forEach((w, i) => {
    w.id = i + 1;
    w.order = i + 1;
  });

  // ─── 按 level 分组统计 ──────────────────────────────────────────────────
  const byLevel = {};
  for (const w of words) {
    if (!byLevel[w.level]) byLevel[w.level] = 0;
    byLevel[w.level]++;
  }

  // ─── 输出 ─────────────────────────────────────────────────────────────────
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const seedPath = join(outputDir, 'builtin-vocab.json');
  const statsPath = join(outputDir, 'builtin-vocab-stats.json');

  console.log(`💾  写入 seed (${words.length} 词)...`);
  await writeFile(seedPath, JSON.stringify(words), 'utf-8');

  const finalStats = {
    total: words.length,
    byLevel,
    includedTags: [...INCLUDE_TAGS],
    extraTags,
    generatedAt: new Date().toISOString(),
    fileSizeEstimate: Buffer.byteLength(JSON.stringify(words), 'utf-8'),
  };
  await writeFile(statsPath, JSON.stringify(finalStats, null, 2), 'utf-8');

  // ─── 打印摘要 ──────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('📋  分级词库构建完成！');
  console.log(`   总词数: ${words.length}`);
  for (const [lv, count] of Object.entries(byLevel)) {
    console.log(`   ${lv}: ${count} 词`);
  }
  const fileSizeMB = (finalStats.fileSizeEstimate / 1024 / 1024).toFixed(2);
  console.log(`   文件: ${seedPath}`);
  console.log(`   大小: ~${fileSizeMB} MB`);
  console.log('═══════════════════════════════════════\n');

  // 清理下载的临时文件（如果下载了）
  if (!inputPath && csvPath === join(outputDir, 'ecdict.csv')) {
    console.log('🧹  清理临时 CSV...');
    await unlink(csvPath).catch(() => {});
  }
}

// 仅在被直接执行时运行（被 import 时不触发下载）
if (import.meta.url === `file://${process.argv[1]}` ||
    fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('❌  构建失败:', err);
    process.exit(1);
  });
}
