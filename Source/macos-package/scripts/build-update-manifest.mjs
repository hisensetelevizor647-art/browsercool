#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

// Usage:
//   node macos-package/scripts/build-update-manifest.mjs 1.0.7 \
//     --win Olewser-Setup-1.0.7.exe \
//     --mac-arm Olewser-macos-1.0.7-arm64.dmg \
//     --mac-x64 Olewser-macos-1.0.7-x64.dmg \
//     --out ../../siteolewer/app-update.json

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Version is required.');
  process.exit(1);
}

const version = args[0];
const options = {
  win: `Olewser-Setup-${version}.exe`,
  macArm: `Olewser-macos-${version}-arm64.dmg`,
  macX64: `Olewser-macos-${version}-x64.dmg`,
  out: '',
};

for (let i = 1; i < args.length; i += 1) {
  const key = args[i];
  const val = args[i + 1];
  if (!val) continue;
  if (key === '--win') options.win = val;
  if (key === '--mac-arm') options.macArm = val;
  if (key === '--mac-x64') options.macX64 = val;
  if (key === '--out') options.out = val;
}

const manifest = {
  version,
  publishedAt: new Date().toISOString(),
  notes: `Olewser ${version} release`,
  autoDownload: true,
  downloads: {
    win32: options.win,
    darwin: {
      arm64: options.macArm,
      x64: options.macX64,
    },
  },
};

const output = JSON.stringify(manifest, null, 2);
if (!options.out) {
  console.log(output);
  process.exit(0);
}

const outPath = path.resolve(process.cwd(), options.out);
fs.writeFileSync(outPath, output + '\n', 'utf8');
console.log(`Saved ${outPath}`);
