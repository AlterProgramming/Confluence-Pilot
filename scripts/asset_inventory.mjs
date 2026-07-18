import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, 'public', 'assets');
const OUT = path.join(ROOT, 'validation', 'perf', 'asset-inventory.json');

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walk(full));
    } else if (stat.isFile()) {
      entries.push({
        path: path.relative(ROOT, full).replaceAll(path.sep, '/'),
        extension: path.extname(name).toLowerCase() || '(none)',
        bytes: stat.size,
      });
    }
  }
  return entries;
}

function mb(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

const files = walk(ASSET_ROOT);
const byExtension = Object.values(files.reduce((acc, file) => {
  acc[file.extension] ??= { extension: file.extension, count: 0, bytes: 0, mb: 0 };
  acc[file.extension].count += 1;
  acc[file.extension].bytes += file.bytes;
  acc[file.extension].mb = mb(acc[file.extension].bytes);
  return acc;
}, {})).sort((left, right) => right.bytes - left.bytes);

const report = {
  generatedAt: new Date().toISOString(),
  root: 'public/assets',
  total: {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  },
  byExtension,
  largest: files
    .slice()
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 30)
    .map((file) => ({ ...file, mb: mb(file.bytes) })),
};
report.total.mb = mb(report.total.bytes);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(`assets: ${report.total.count} files, ${report.total.mb} MB`);
for (const group of byExtension) {
  console.log(`${group.extension.padEnd(8)} ${String(group.count).padStart(4)} files ${String(group.mb).padStart(8)} MB`);
}
console.log(`wrote ${path.relative(ROOT, OUT).replaceAll(path.sep, '/')}`);
