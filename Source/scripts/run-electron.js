'use strict';

const { spawn } = require('child_process');
const path = require('path');

let electronBinary;
try {
  electronBinary = require('electron');
} catch (err) {
  console.error('[run-electron] Failed to resolve electron binary:', err && err.message ? err.message : err);
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const appRoot = path.resolve(__dirname, '..');
const extraArgs = process.argv.slice(2);

const child = spawn(electronBinary, [appRoot, ...extraArgs], {
  stdio: 'inherit',
  env,
  cwd: appRoot,
});

child.on('error', (err) => {
  console.error('[run-electron] Electron process failed to start:', err && err.message ? err.message : err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(typeof code === 'number' ? code : 0);
});
