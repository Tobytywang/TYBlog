#!/usr/bin/env node

/**
 * 历史体积体检
 *
 * pre-commit 钩子只能拦住「即将进库」的大文件，拦不住已经进去的，也拦不住
 * 「当时觉得没问题、后来才发现」的文件。这个脚本扫全部历史，把最大的文件列出来。
 *
 * 用法：npm run audit
 * 退出码：有文件超过阈值时为 1（可当 CI 检查用）
 */

const { execFileSync } = require('child_process');

const LIMIT_MB = 2;
const LIMIT = LIMIT_MB * 1024 * 1024;
const TOP = 10;

// rev-list 每行是「<sha> <path>」，正好可以整行喂给 cat-file 的 %(rest)
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], {
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
const top = blobs.sort((a, b) => b.size - a.size).slice(0, TOP);
const oversized = blobs.filter(b => b.size > LIMIT);

const mb = n => (n / 1048576).toFixed(2).padStart(7);
console.log(`\n历史中最大的 ${top.length} 个文件（共 ${blobs.length} 个 blob，合计 ${mb(total)} MB）\n`);
top.forEach(b => console.log(`  ${mb(b.size)} MB  ${b.path || '(无路径)'}`));

if (oversized.length === 0) {
  console.log(`\n✅ 没有超过 ${LIMIT_MB} MB 的文件。\n`);
  process.exit(0);
}

console.log(`\n⚠️  ${oversized.length} 个文件超过 ${LIMIT_MB} MB，全新 clone 会重复下载它们：`);
oversized.forEach(b => console.log(`   ${mb(b.size)} MB  ${b.path}`));
console.log('\n   清理只能重写历史（filter-branch / git-filter-repo），并需协调所有副本。\n');
process.exit(1);
