'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const pkg = require(path.join(rootDir, 'package.json'));

const expectedInstallerName = `Olewser-Setup-${pkg.version}.exe`;
const expectedInstallerPath = path.join(distDir, expectedInstallerName);

function findNewestSetupExecutable() {
  if (!fs.existsSync(distDir)) return '';
  const candidates = fs.readdirSync(distDir)
    .filter((name) => /^Olewser-Setup-.*\.exe$/i.test(name) && !/\.blockmap$/i.test(name))
    .map((name) => {
      const fullPath = path.join(distDir, name);
      const stat = fs.statSync(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates.length ? candidates[0].fullPath : '';
}

function ensureUpdateSetupBinary() {
  const sourceInstallerPath = fs.existsSync(expectedInstallerPath)
    ? expectedInstallerPath
    : findNewestSetupExecutable();

  if (!sourceInstallerPath || !fs.existsSync(sourceInstallerPath)) {
    throw new Error(`NSIS installer not found in ${distDir}`);
  }

  const updateSetupPath = path.join(distDir, 'updatesetup.exe');
  fs.copyFileSync(sourceInstallerPath, updateSetupPath);
  console.log(`[create-update-setup] Copied ${path.basename(sourceInstallerPath)} -> ${path.basename(updateSetupPath)}`);

  const sourceBlockmapPath = `${sourceInstallerPath}.blockmap`;
  const updateBlockmapPath = `${updateSetupPath}.blockmap`;
  if (fs.existsSync(sourceBlockmapPath)) {
    fs.copyFileSync(sourceBlockmapPath, updateBlockmapPath);
    console.log(`[create-update-setup] Copied ${path.basename(sourceBlockmapPath)} -> ${path.basename(updateBlockmapPath)}`);
  }
}

ensureUpdateSetupBinary();
