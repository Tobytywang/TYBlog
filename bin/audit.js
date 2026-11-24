#!/usr/bin/env node

/**
 * 体积体检
 *
 * pre-commit 钩子只能拦住「即将进库」的大文件，拦不住已经进去的，也拦不住
 * 「当时觉得没问题、后来才发现」的文件。这个脚本负责后者。
 *
 * 两种模式：
 *   npm run audit                    扫全部历史（本地体检，也能当 CI 用）
 *   node bin/audit.js --range A..B   只看 A..B 之间的新增对象（CI 查本次改动）
 *
 * 阈值只在这个文件里定义一次，钩子里的默认值走 git config 覆盖，不在这里重复。
 *
 * 退出码：有文件超过阈值时为 1
 */

const { execFileSync } = require('child_process');

const LIMIT_MB = 2;
const LIMIT = LIMIT_MB * 1024 * 1024;
const TOP = 10;

// --range A..B / --range=A..B：范围模式，只查这段提交新增的对象
const rangeIdx = process.argv.indexOf('--range');
const rangeArg = process.argv.find(a => a.startsWith('--range='));
const range = rangeArg
  ? rangeArg.slice('--range='.length)
  : rangeIdx > -1
    ? process.argv[rangeIdx + 1]
    : null;

if (rangeIdx > -1 && !range) {
  console.error('用法：node bin/audit.js --range <A..B>');
  process.exit(2);
}

// rev-list 每行是「<sha> <path>」，正好可以整行喂给 cat-file 的 %(rest)
const objects = execFileSync('git', ['rev-list', '--objects', range || '--all'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});

const checked = execFileSync(
  'git',
  ['cat-file', '--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)'],
  { input: objects, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);

// 同一个 blob 可能以多个路径出现在多个提交里，按 objectname 去重才是真实占用
const seen = new Map();
for (const line of checked.split('\n')) {
  const [type, sha, size, ...rest] = line.split(' ');
  if (type !== 'blob') continue;
  if (seen.has(sha)) continue;
  seen.set(sha, { sha, size: Number(size), path: rest.join(' ') });
}

const blobs = [...seen.values()];
const total = blobs.reduce((sum, b) => sum + b.size, 0);

// 同一路径的多个版本是不同 blob，报告时按路径归并、取最大那份，
// 否则一个被反复修改的小文件会刷满整张列表
const byPath = new Map();
for (const b of blobs) {
  const key = b.path || '(无路径)';
  const cur = byPath.get(key);
  if (!cur || b.size > cur.size) byPath.set(key, b);
}
const files = [...byPath.values()];

const top = files.sort((a, b) => b.size - a.size).slice(0, TOP);
const oversized = files.filter(b => b.size > LIMIT);

const mb = n => (n / 1048576).toFixed(2).padStart(7);
const mbv = n => (n / 1048576).toFixed(2);
const scope = range ? `范围 ${range} 新增的` : '历史中的';
console.log(`\n${scope}最大 ${top.length} 个文件（共 ${blobs.length} 个 blob，合计 ${mb(total)} MB）\n`);
top.forEach(b => console.log(`  ${mb(b.size)} MB  ${b.path || '(无路径)'}`));

// ── 仓库体积结构 ────────────────────────────────
// 单文件阈值只能指出「某一个大文件」，看不出「历史总量比现在多出多少」。
// 后者才是决定要不要重写历史的依据：已删除文件的 blob 仍被每个旧 commit 的树
// 引用，因此每次 clone 都要下载——它们不在 HEAD 里，却一直在传输清单里。
function headFootprint() {
  let out;
  try {
    out = execFileSync('git', ['ls-tree', '-r', '-l', 'HEAD'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (err) {
    return null;
  }
  let bytes = 0;
  let count = 0;
  for (const line of out.split('\n')) {
    if (!line) continue;
    // 格式：<mode> blob <sha> <size>\t<path>；tree 条目的 size 是 "-"，跳过
    const [, type, , size] = line.split(/\s+/);
    if (type !== 'blob') continue;
    bytes += Number(size) || 0;
    count++;
  }
  return { bytes, count };
}

// 范围模式只关心本次新增，不做全量结构对比
const head = range ? null : headFootprint();
if (head) {
  const baggage = total - head.bytes;
  const pct = total ? Math.round((baggage / total) * 100) : 0;
  console.log('\n—— 仓库体积结构 ——');
  console.log(`   HEAD 应占    ${mbv(head.bytes)} MB  (${head.count} 个文件)`);
  console.log(`   历史总计     ${mbv(total)} MB  (${blobs.length} 个 blob)`);
  console.log(`   历史包袱     ${mbv(baggage)} MB  (${pct}%)`);
  console.log('   包袱 = 已删除或已改写的旧版本，clone 时照旧下载；');
  console.log('   超过 HEAD 的 3 倍时，清它的收益才抵得上一次历史重写的风险。');
}

if (oversized.length === 0) {
  console.log(`\n✅ 没有超过 ${LIMIT_MB} MB 的文件。\n`);
  process.exit(0);
}

console.log(`\n⚠️  ${oversized.length} 个文件超过 ${LIMIT_MB} MB，${range ? '合并后会永远留在历史里' : '全新 clone 会重复下载它们'}：`);
oversized.forEach(b => console.log(`   ${mb(b.size)} MB  ${b.path}`));
console.log('\n   清理只能重写历史（filter-branch / git-filter-repo），并需协调所有副本。\n');
process.exit(1);
