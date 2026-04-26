// ============================================================
// OLEWSER BROWSER - Main Process (v2.0 - 103 Features)
// ============================================================

const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, nativeImage, screen, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const APP_ID = 'com.olewser.browser';
const APP_ICON_PNG = path.join(__dirname, 'Olewser LOGO', 'main.png');
const APP_ICON_ICO = path.join(__dirname, 'Olewser LOGO', 'main.ico');
const APP_ICON_ICNS = path.join(__dirname, 'Olewser LOGO', 'main.icns');
const APP_ICON_PATH =
  (process.platform === 'win32' && fs.existsSync(APP_ICON_ICO)) ? APP_ICON_ICO
    : (process.platform === 'darwin' && fs.existsSync(APP_ICON_ICNS)) ? APP_ICON_ICNS
      : APP_ICON_PNG;

// Load .env file (no dotenv dependency needed)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const l = line.trim();
      if (l && !l.startsWith('#') && l.includes('=')) {
        const [key, ...vals] = l.split('=');
        process.env[key.trim()] = vals.join('=').trim();
      }
    });
  }
} catch (e) { /* silent */ }

// --- Fingerprint Evasion ---
const CHROME_VERSION = '133.0.0.0';
const SPOOFED_UA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;

// Strip Electron/Olewser from the default user agent at the app level
// This is critical for Google login - Google checks the UA and blocks Electron apps
app.userAgentFallback = SPOOFED_UA;
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

// --- Globals ---
let mainWindow = null;
let windows = [];
let pendingLaunchTargets = [];

function normalizeIncomingTarget(input) {
  if (!input) return '';
  let raw = String(input).trim();
  if (!raw || raw === '.' || raw === '--') return '';
  raw = raw.replace(/^"+|"+$/g, '');
  if (!raw || raw.startsWith('--')) return '';

  const lower = raw.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('file://') ||
    lower.startsWith('olewser://')
  ) {
    return raw;
  }

  const looksLikeWindowsPath = /^[a-z]:[\\/]/i.test(raw) || raw.startsWith('\\\\');
  const looksLikeHtmlFile = lower.endsWith('.html') || lower.endsWith('.htm');
  if (!looksLikeWindowsPath && !looksLikeHtmlFile) return '';

  try {
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(raw);
    if (!fs.existsSync(resolved)) return '';
    return pathToFileURL(resolved).toString();
  } catch (_) {
    return '';
  }
}

function extractTargetsFromArgv(argv = []) {
  if (!Array.isArray(argv)) return [];
  const startIndex = process.defaultApp ? 2 : 1;
  const list = [];
  for (let i = startIndex; i < argv.length; i++) {
    const target = normalizeIncomingTarget(argv[i]);
    if (target) list.push(target);
  }
  return [...new Set(list)];
}

function queueLaunchTargets(targets = []) {
  targets.forEach((target) => {
    if (target && !pendingLaunchTargets.includes(target)) {
      pendingLaunchTargets.push(target);
    }
  });
}

function dispatchTargetToMainWindow(target) {
  if (!target || !mainWindow || mainWindow.isDestroyed()) return false;

  const currentUrl = mainWindow.webContents.getURL() || '';
  if (currentUrl.includes('/start.html')) {
    queueLaunchTargets([target]);
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    return true;
  }

  const send = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-url-in-new-tab', target);
    }
  };

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
  return true;
}

function flushPendingLaunchTargets() {
  if (!mainWindow || mainWindow.isDestroyed() || pendingLaunchTargets.length === 0) return;
  const queue = [...pendingLaunchTargets];
  pendingLaunchTargets = [];
  queue.forEach((target) => dispatchTargetToMainWindow(target));
}

function handleIncomingTargets(targets = []) {
  const cleanTargets = targets.filter(Boolean);
  if (!cleanTargets.length) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    cleanTargets.forEach((target) => dispatchTargetToMainWindow(target));
    return;
  }

  queueLaunchTargets(cleanTargets);
}

async function openSystemDefaultAppsSettings() {
  if (process.platform === 'win32') {
    await shell.openExternal('ms-settings:defaultapps');
    return { ok: true, method: 'windows-settings' };
  }

  if (process.platform === 'darwin') {
    const candidateUrls = [
      'x-apple.systempreferences:com.apple.preference.general',
      'x-apple.systempreferences:com.apple.Network-Settings.extension?DefaultBrowser',
    ];

    for (const candidate of candidateUrls) {
      try {
        await shell.openExternal(candidate);
        return { ok: true, method: 'systempreferences-url', url: candidate };
      } catch (_) {
        // Try next candidate URL.
      }
    }

    await new Promise((resolve, reject) => {
      execFile('/usr/bin/open', ['/System/Library/PreferencePanes/General.prefPane'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { ok: true, method: 'general-prefpane' };
  }

  return {
    ok: false,
    error: 'Default browser settings shortcut is not implemented for this platform.',
  };
}

function getDefaultBrowserStatus() {
  try {
    const http = !!app.isDefaultProtocolClient('http');
    const https = !!app.isDefaultProtocolClient('https');
    return { ok: true, http, https, isDefault: http && https };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Failed to query default browser status' };
  }
}

function trySetDefaultBrowser() {
  try {
    const setHttp = !!app.setAsDefaultProtocolClient('http');
    const setHttps = !!app.setAsDefaultProtocolClient('https');
    const status = getDefaultBrowserStatus();
    return {
      ok: true,
      setHttp,
      setHttps,
      http: !!status.http,
      https: !!status.https,
      isDefault: !!status.isDefault,
      needsSystemConfirmation: process.platform === 'darwin',
    };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Failed to set default browser' };
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  queueLaunchTargets(extractTargetsFromArgv(process.argv));

  app.on('second-instance', (_event, argv) => {
    handleIncomingTargets(extractTargetsFromArgv(argv));
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleIncomingTargets([normalizeIncomingTarget(url)]);
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    handleIncomingTargets([normalizeIncomingTarget(filePath)]);
  });
}

// --- Pulse Stats ---
let pulseStats = {
  adsBlocked: 0,
  trackersBlocked: 0,
  requestsTotal: 0,
  dataSavedKB: 0,
  sessionStart: Date.now()
};

// --- Data Storage ---
const DATA_DIR = () => path.join(app.getPath('userData'), 'olewser-data');

function ensureDataDir() {
  const dir = DATA_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataPath(file) {
  return path.join(ensureDataDir(), file);
}

function readJSON(file, fallback = []) {
  try {
    const p = dataPath(file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.error(`Read ${file} error:`, e); }
  return fallback;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(dataPath(file), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Write ${file} error:`, e);
  }
}

app.on('ready', async () => {

  // ============================================================
  // SETTINGS
  // ============================================================
  const DEFAULT_UPDATE_MANIFEST_URL = process.env.OLEWSER_UPDATE_MANIFEST_URL || 'https://siteolewer.netlify.app/app-update.json';

  const DEFAULT_SETTINGS = {
    language: 'sk',
    theme: 'light',
    accentColor: '#808080',
    searchEngine: 'google',
    homePage: 'olewser://newtab',
    newtabBackground: 'default',
    newtabCustomBg: '',
    fontSize: 'medium',
    density: 'comfortable',
    sidebarPosition: 'left',
    showBookmarksBar: false,
    restoreSession: false,
    smoothScroll: true,
    forceDarkMode: false,
    httpsOnly: false,
    fingerprintProtection: true,
    doNotTrack: true,
    clearOnExit: false,
    trackingProtection: 'basic',
    popupBlocking: true,
    tabCountWarning: 50,
    lowRamMode: false,
    frostEnabled: true,
    frostTimeout: 30000,
    alwaysOnTop: false,
    updateManifestUrl: DEFAULT_UPDATE_MANIFEST_URL,
    updateAutoDownload: true,
  };

  function normalizeLanguageCode(lang) {
    const raw = String(lang || '').trim().toLowerCase().replace('_', '-');
    const base = raw.split('-')[0];
    if (base === 'ua') return 'uk';
    if (base === 'uk' || base === 'ru' || base === 'en' || base === 'sk') return base;
    return DEFAULT_SETTINGS.language;
  }

  function loadSettings() {
    const merged = { ...DEFAULT_SETTINGS, ...readJSON('settings.json', {}) };
    merged.language = normalizeLanguageCode(merged.language);
    return merged;
  }

  function saveSettings(data) {
    const normalized = { ...data };
    normalized.language = normalizeLanguageCode(normalized.language);
    writeJSON('settings.json', normalized);
  }

  // ============================================================
  // APP UPDATE SERVICE
  // ============================================================
  const APP_UPDATE_CACHE_FILE = 'app-update-state.json';
  const UPDATE_STATUS = {
    IDLE: 'idle',
    CHECKING: 'checking',
    AVAILABLE: 'available',
    DOWNLOADING: 'downloading',
    READY: 'ready',
    INSTALLING: 'installing',
    UP_TO_DATE: 'up_to_date',
    ERROR: 'error',
  };

  const appUpdateState = {
    status: UPDATE_STATUS.IDLE,
    currentVersion: app.getVersion() || '0.0.0',
    latestVersion: '',
    manifestUrl: '',
    downloadUrl: '',
    notes: '',
    mandatory: false,
    autoDownload: true,
    lastCheckedAt: 0,
    downloadReceivedBytes: 0,
    downloadTotalBytes: 0,
    downloadedFilePath: '',
    downloadedVersion: '',
    error: '',
  };

  let appUpdateCheckPromise = null;

  function sanitizeVersion(rawVersion) {
    const clean = String(rawVersion || '').trim().replace(/^v/i, '');
    if (!clean) return '';
    const parts = clean.split('.').map((chunk) => {
      const num = parseInt(String(chunk).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(num) ? num : 0;
    });
    while (parts.length < 3) parts.push(0);
    return parts.slice(0, 4).join('.');
  }

  function compareSemver(versionA, versionB) {
    const parse = (raw) => sanitizeVersion(raw).split('.').map((n) => parseInt(n, 10) || 0);
    const a = parse(versionA);
    const b = parse(versionB);
    const maxLength = Math.max(a.length, b.length);
    for (let i = 0; i < maxLength; i++) {
      const ai = a[i] || 0;
      const bi = b[i] || 0;
      if (ai > bi) return 1;
      if (ai < bi) return -1;
    }
    return 0;
  }

  function getUpdateManifestUrl() {
    const settings = loadSettings();
    const fromSettings = String(settings.updateManifestUrl || '').trim();
    return fromSettings || DEFAULT_UPDATE_MANIFEST_URL;
  }

  function buildPublicUpdateState() {
    return { ...appUpdateState };
  }

  function broadcastAppUpdateState() {
    const payload = buildPublicUpdateState();
    windows.forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('app-update:state', payload);
      }
    });
  }

  function patchAppUpdateState(patch) {
    Object.assign(appUpdateState, patch || {});
    broadcastAppUpdateState();
    return buildPublicUpdateState();
  }

  function saveAppUpdateCache() {
    writeJSON(APP_UPDATE_CACHE_FILE, {
      downloadedVersion: appUpdateState.downloadedVersion,
      downloadedFilePath: appUpdateState.downloadedFilePath,
      latestVersion: appUpdateState.latestVersion,
      lastCheckedAt: appUpdateState.lastCheckedAt,
      manifestUrl: appUpdateState.manifestUrl,
    });
  }

  function loadAppUpdateCache() {
    const cache = readJSON(APP_UPDATE_CACHE_FILE, {});
    if (!cache || typeof cache !== 'object') return;

    const cachedPath = typeof cache.downloadedFilePath === 'string' ? cache.downloadedFilePath : '';
    if (cachedPath && fs.existsSync(cachedPath)) {
      appUpdateState.downloadedFilePath = cachedPath;
      appUpdateState.downloadedVersion = String(cache.downloadedVersion || '');
      appUpdateState.latestVersion = String(cache.latestVersion || appUpdateState.downloadedVersion || '');
      appUpdateState.status = UPDATE_STATUS.READY;
    }

    appUpdateState.lastCheckedAt = Number(cache.lastCheckedAt || 0);
    appUpdateState.manifestUrl = String(cache.manifestUrl || '');
  }

  function fetchTextWithRedirects(targetUrl, redirectCount = 0) {
    const MAX_REDIRECTS = 6;
    if (redirectCount > MAX_REDIRECTS) {
      return Promise.reject(new Error('Too many redirects while checking updates'));
    }

    return new Promise((resolve, reject) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(targetUrl);
      } catch (_) {
        reject(new Error('Invalid update manifest URL'));
        return;
      }

      const client = parsedUrl.protocol === 'http:' ? http : https;
      const req = client.request(parsedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': `Olewser/${app.getVersion() || '0.0.0'}`,
          'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8',
        },
      }, (res) => {
        const status = Number(res.statusCode || 0);
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          const redirected = new URL(location, parsedUrl).toString();
          res.resume();
          fetchTextWithRedirects(redirected, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (status < 200 || status >= 300) {
            reject(new Error(`Update manifest request failed (${status})`));
            return;
          }
          resolve(body);
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  async function fetchJsonWithRedirects(targetUrl) {
    const rawText = await fetchTextWithRedirects(targetUrl, 0);
    try {
      return JSON.parse(rawText);
    } catch (_) {
      throw new Error('Update manifest is not valid JSON');
    }
  }

  function resolveDownloadUrl(manifest, manifestUrl) {
    const candidates = [];
    const downloads = manifest && typeof manifest.downloads === 'object' ? manifest.downloads : null;
    const platform = process.platform;
    const arch = process.arch;

    const addCandidate = (value) => {
      if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
    };

    if (downloads) {
      const platformEntry = downloads[platform];
      if (typeof platformEntry === 'string') {
        addCandidate(platformEntry);
      } else if (platformEntry && typeof platformEntry === 'object') {
        addCandidate(platformEntry[arch]);
        addCandidate(platformEntry.url);
        addCandidate(platformEntry.default);
      }

      if (platform === 'win32') {
        addCandidate(downloads.win32);
        addCandidate(downloads.win);
        addCandidate(downloads.windows);
        if (downloads.windows && typeof downloads.windows === 'object') {
          addCandidate(downloads.windows[arch]);
          addCandidate(downloads.windows.url);
          addCandidate(downloads.windows.default);
        }
      }
    }

    addCandidate(manifest.downloadUrl);
    addCandidate(manifest.url);

    if (platform === 'win32') {
      if (manifest.windows && typeof manifest.windows === 'string') {
        addCandidate(manifest.windows);
      } else if (manifest.windows && typeof manifest.windows === 'object') {
        addCandidate(manifest.windows[arch]);
        addCandidate(manifest.windows.url);
      }
      addCandidate(manifest.exe);
    }

    for (const candidate of candidates) {
      try {
        return new URL(candidate, manifestUrl).toString();
      } catch (_) {
        // Ignore malformed candidate and continue
      }
    }
    return '';
  }

  async function checkForAppUpdate(options = {}) {
    const force = !!(options && options.force);
    if (appUpdateCheckPromise && !force) return appUpdateCheckPromise;

    const now = Date.now();
    if (!force && appUpdateState.lastCheckedAt && (now - appUpdateState.lastCheckedAt < 45000) && appUpdateState.status !== UPDATE_STATUS.ERROR) {
      return buildPublicUpdateState();
    }

    const run = (async () => {
      const manifestUrl = getUpdateManifestUrl();
      patchAppUpdateState({
        status: UPDATE_STATUS.CHECKING,
        manifestUrl,
        error: '',
      });

      try {
        const manifest = await fetchJsonWithRedirects(manifestUrl);
        const latestVersion = sanitizeVersion(manifest.version || manifest.latestVersion || manifest.appVersion);
        if (!latestVersion) {
          throw new Error('Update manifest does not contain a valid version');
        }

        const downloadUrl = resolveDownloadUrl(manifest, manifestUrl);
        const notes = String(manifest.notes || manifest.changelog || manifest.message || '').trim();
        const mandatory = !!manifest.mandatory;
        const settings = loadSettings();
        const autoDownload = typeof manifest.autoDownload === 'boolean'
          ? manifest.autoDownload
          : (settings.updateAutoDownload !== false);

        const cmp = compareSemver(latestVersion, appUpdateState.currentVersion);
        const hasCachedDownload = (
          appUpdateState.downloadedVersion === latestVersion &&
          !!appUpdateState.downloadedFilePath &&
          fs.existsSync(appUpdateState.downloadedFilePath)
        );

        if (cmp > 0) {
          if (!downloadUrl) {
            throw new Error('Manifest does not provide a download URL for this platform');
          }
          patchAppUpdateState({
            status: hasCachedDownload ? UPDATE_STATUS.READY : UPDATE_STATUS.AVAILABLE,
            latestVersion,
            downloadUrl,
            notes,
            mandatory,
            autoDownload,
            error: '',
          });
        } else {
          patchAppUpdateState({
            status: UPDATE_STATUS.UP_TO_DATE,
            latestVersion,
            downloadUrl,
            notes,
            mandatory: false,
            autoDownload,
            error: '',
            downloadReceivedBytes: 0,
            downloadTotalBytes: 0,
          });
        }

        appUpdateState.lastCheckedAt = Date.now();
        saveAppUpdateCache();
        return buildPublicUpdateState();
      } catch (err) {
        patchAppUpdateState({
          status: UPDATE_STATUS.ERROR,
          error: err && err.message ? err.message : 'Failed to check updates',
        });
        appUpdateState.lastCheckedAt = Date.now();
        saveAppUpdateCache();
        return buildPublicUpdateState();
      } finally {
        appUpdateCheckPromise = null;
      }
    })();

    appUpdateCheckPromise = run;
    return run;
  }

  function getUpdateDestinationPath(version, downloadUrl) {
    const updatesDir = path.join(app.getPath('userData'), 'updates');
    if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });

    let ext = '';
    try {
      ext = path.extname(new URL(downloadUrl).pathname || '');
    } catch (_) {
      ext = '';
    }
    if (!ext) ext = process.platform === 'win32' ? '.exe' : '.bin';
    return path.join(updatesDir, `Olewser-Setup-${version}${ext}`);
  }

  function downloadFileWithRedirects(downloadUrl, destinationPath, onProgress, redirectCount = 0) {
    const MAX_REDIRECTS = 6;
    if (redirectCount > MAX_REDIRECTS) {
      return Promise.reject(new Error('Too many redirects while downloading update'));
    }

    return new Promise((resolve, reject) => {
      let parsedUrl;
      try {
        parsedUrl = new URL(downloadUrl);
      } catch (_) {
        reject(new Error('Invalid update download URL'));
        return;
      }

      const client = parsedUrl.protocol === 'http:' ? http : https;
      const req = client.request(parsedUrl, {
        method: 'GET',
        headers: { 'User-Agent': `Olewser/${app.getVersion() || '0.0.0'}` },
      }, (res) => {
        const status = Number(res.statusCode || 0);
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          const redirected = new URL(location, parsedUrl).toString();
          res.resume();
          downloadFileWithRedirects(redirected, destinationPath, onProgress, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Update download failed (${status})`));
          return;
        }

        const totalBytes = Number(res.headers['content-length'] || 0);
        let receivedBytes = 0;
        const out = fs.createWriteStream(destinationPath);

        const cleanupFile = () => {
          try {
            if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
          } catch (_) {
            // Ignore cleanup failure
          }
        };

        out.on('error', (err) => {
          res.destroy();
          cleanupFile();
          reject(err);
        });

        res.on('error', (err) => {
          out.destroy();
          cleanupFile();
          reject(err);
        });

        res.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (typeof onProgress === 'function') onProgress(receivedBytes, totalBytes);
        });

        out.on('finish', () => {
          out.close(() => resolve({ receivedBytes, totalBytes }));
        });

        res.pipe(out);
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  async function startAppUpdateDownload() {
    if (appUpdateState.status === UPDATE_STATUS.DOWNLOADING) return buildPublicUpdateState();

    if (appUpdateState.status === UPDATE_STATUS.READY && appUpdateState.downloadedFilePath && fs.existsSync(appUpdateState.downloadedFilePath)) {
      return buildPublicUpdateState();
    }

    if (!appUpdateState.downloadUrl || !appUpdateState.latestVersion) {
      await checkForAppUpdate({ force: true });
      if (!appUpdateState.downloadUrl || !appUpdateState.latestVersion) {
        return buildPublicUpdateState();
      }
    }

    const destinationPath = getUpdateDestinationPath(appUpdateState.latestVersion, appUpdateState.downloadUrl);
    try {
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
    } catch (_) {
      // Ignore stale file cleanup failure
    }

    patchAppUpdateState({
      status: UPDATE_STATUS.DOWNLOADING,
      downloadReceivedBytes: 0,
      downloadTotalBytes: 0,
      downloadedFilePath: '',
      downloadedVersion: '',
      error: '',
    });

    let lastProgressEmit = 0;
    try {
      const result = await downloadFileWithRedirects(
        appUpdateState.downloadUrl,
        destinationPath,
        (receivedBytes, totalBytes) => {
          const now = Date.now();
          if ((now - lastProgressEmit < 120) && !(totalBytes > 0 && receivedBytes >= totalBytes)) return;
          lastProgressEmit = now;
          patchAppUpdateState({
            status: UPDATE_STATUS.DOWNLOADING,
            downloadReceivedBytes: receivedBytes,
            downloadTotalBytes: totalBytes,
          });
        }
      );

      patchAppUpdateState({
        status: UPDATE_STATUS.READY,
        downloadedFilePath: destinationPath,
        downloadedVersion: appUpdateState.latestVersion,
        downloadReceivedBytes: result.receivedBytes,
        downloadTotalBytes: result.totalBytes || result.receivedBytes,
        error: '',
      });
      saveAppUpdateCache();
      return buildPublicUpdateState();
    } catch (err) {
      patchAppUpdateState({
        status: UPDATE_STATUS.ERROR,
        error: err && err.message ? err.message : 'Failed to download update',
      });
      return buildPublicUpdateState();
    }
  }

  async function installDownloadedUpdate() {
    if (appUpdateState.status !== UPDATE_STATUS.READY) {
      return { ok: false, error: 'Update is not ready to install' };
    }

    const installerPath = String(appUpdateState.downloadedFilePath || '').trim();
    if (!installerPath || !fs.existsSync(installerPath)) {
      patchAppUpdateState({
        status: UPDATE_STATUS.AVAILABLE,
        downloadedFilePath: '',
        downloadedVersion: '',
        error: 'Downloaded installer file is missing',
      });
      saveAppUpdateCache();
      return { ok: false, error: 'Installer file not found' };
    }

    patchAppUpdateState({
      status: UPDATE_STATUS.INSTALLING,
      error: '',
    });

    const openResult = await shell.openPath(installerPath);
    if (openResult) {
      patchAppUpdateState({
        status: UPDATE_STATUS.ERROR,
        error: openResult,
      });
      return { ok: false, error: openResult };
    }

    if (process.platform === 'darwin') {
      shell.showItemInFolder(installerPath);
      patchAppUpdateState({
        status: UPDATE_STATUS.READY,
        notes: 'macOS package opened. Move Olewser to Applications, then restart the app.',
        error: '',
      });
      return { ok: true, requiresManualInstall: true };
    }

    setTimeout(() => {
      app.quit();
    }, 600);

    return { ok: true };
  }

  loadAppUpdateCache();

  // ============================================================
  // HISTORY
  // ============================================================
  function getHistory() {
    return readJSON('history.json', []);
  }

  function addHistoryEntry(entry) {
    const history = getHistory();
    history.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: entry.url,
      title: entry.title || entry.url,
      favicon: entry.favicon || '',
      timestamp: Date.now(),
    });
    // Keep last 5000 entries
    if (history.length > 5000) history.length = 5000;
    writeJSON('history.json', history);
  }

  function clearHistory() {
    writeJSON('history.json', []);
  }

  function removeHistoryEntry(id) {
    const history = getHistory();
    const filtered = history.filter(h => h.id !== id);
    writeJSON('history.json', filtered);
  }

  function searchHistory(query) {
    const history = getHistory();
    if (!query) return history.slice(0, 200);
    const q = query.toLowerCase();
    return history.filter(h =>
      h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)
    ).slice(0, 200);
  }

  // ============================================================
  // DOWNLOADS
  // ============================================================
  let downloads = [];

  function getDownloads() {
    return readJSON('downloads.json', []);
  }

  function addDownload(item) {
    const dl = getDownloads();
    dl.unshift(item);
    if (dl.length > 500) dl.length = 500;
    writeJSON('downloads.json', dl);
    return dl;
  }

  function clearDownloads() {
    writeJSON('downloads.json', []);
  }

  // ============================================================
  // BOOKMARKS
  // ============================================================
  function getBookmarks() {
    return readJSON('bookmarks.json', []);
  }

  function addBookmark(bm) {
    const bookmarks = getBookmarks();
    // Check duplicate
    if (bookmarks.some(b => b.url === bm.url)) return bookmarks;
    bookmarks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      url: bm.url,
      title: bm.title || bm.url,
      favicon: bm.favicon || '',
      folder: bm.folder || '',
      timestamp: Date.now(),
    });
    writeJSON('bookmarks.json', bookmarks);
    return bookmarks;
  }

  function removeBookmark(id) {
    let bookmarks = getBookmarks();
    bookmarks = bookmarks.filter(b => b.id !== id);
    writeJSON('bookmarks.json', bookmarks);
    return bookmarks;
  }

  // ============================================================
  // SESSIONS
  // ============================================================
  function getSessions() {
    return readJSON('sessions.json', []);
  }

  function saveSession(name, tabs) {
    const sessions = getSessions();
    sessions.unshift({
      id: Date.now().toString(36),
      name,
      tabs,
      timestamp: Date.now(),
    });
    if (sessions.length > 20) sessions.length = 20;
    writeJSON('sessions.json', sessions);
    return sessions;
  }

  function deleteSession(id) {
    let sessions = getSessions();
    sessions = sessions.filter(s => s.id !== id);
    writeJSON('sessions.json', sessions);
    return sessions;
  }

  // ============================================================
  // QUICK LINKS (newtab)
  // ============================================================
  function getQuickLinks() {
    return readJSON('quicklinks.json', [
      { url: 'https://www.google.com', title: 'Google' },
      { url: 'https://www.youtube.com', title: 'YouTube' },
      { url: 'https://github.com', title: 'GitHub' },
      { url: 'https://reddit.com', title: 'Reddit' },
      { url: 'https://twitter.com', title: 'X (Twitter)' },
      { url: 'https://telegram.org', title: 'Telegram' },
    ]);
  }

  function saveQuickLinks(links) {
    writeJSON('quicklinks.json', links);
  }

  // ============================================================
  // TOP SITES
  // ============================================================
  function getTopSites() {
    const history = getHistory();
    const counts = {};
    history.forEach(h => {
      try {
        const host = new URL(h.url).hostname;
        if (!counts[host]) counts[host] = { url: h.url, title: h.title, favicon: h.favicon, count: 0 };
        counts[host].count++;
      } catch (e) { }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 8);
  }

  // ============================================================
  // SITE PERMISSIONS
  // ============================================================
  function getSitePermissions() {
    return readJSON('permissions.json', {});
  }

  function setSitePermission(site, permission, value) {
    const perms = getSitePermissions();
    if (!perms[site]) perms[site] = {};
    perms[site][permission] = value;
    writeJSON('permissions.json', perms);
    return perms;
  }

  // ============================================================
  // NOTES
  // ============================================================
  function getNotes() {
    return readJSON('notes.json', []);
  }

  function saveNote(note) {
    const notes = getNotes();
    const existing = notes.findIndex(n => n.id === note.id);
    if (existing >= 0) {
      notes[existing] = { ...notes[existing], ...note, updatedAt: Date.now() };
    } else {
      notes.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: note.text,
        site: note.site || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    writeJSON('notes.json', notes);
    return notes;
  }

  function deleteNote(id) {
    let notes = getNotes();
    notes = notes.filter(n => n.id !== id);
    writeJSON('notes.json', notes);
    return notes;
  }

  // ============================================================
  // READING LIST
  // ============================================================
  function getReadingList() {
    return readJSON('readinglist.json', []);
  }

  function addToReadingList(item) {
    const list = getReadingList();
    if (list.some(l => l.url === item.url)) return list;
    list.unshift({
      id: Date.now().toString(36),
      url: item.url,
      title: item.title || item.url,
      favicon: item.favicon || '',
      timestamp: Date.now(),
    });
    writeJSON('readinglist.json', list);
    return list;
  }

  function removeFromReadingList(id) {
    let list = getReadingList();
    list = list.filter(l => l.id !== id);
    writeJSON('readinglist.json', list);
    return list;
  }

  // ============================================================
  // CLIPBOARD HISTORY
  // ============================================================
  let clipboardHistory = [];

  function addToClipboard(text) {
    if (!text || text.trim() === '') return;
    clipboardHistory = clipboardHistory.filter(c => c !== text);
    clipboardHistory.unshift(text);
    if (clipboardHistory.length > 10) clipboardHistory.length = 10;
  }

  // ============================================================
  // FLAGS (experimental)
  // ============================================================
  function getFlags() {
    return readJSON('flags.json', {
      splitView: true,
      readerMode: true,
      focusMode: true,
      pipMode: true,
      colorPicker: true,
      forceSmooth: true,
      tabPreview: false,
      adaptiveTitlebar: true,
      breathingTab: true,
      videoDownload: true,
    });
  }

  function saveFlags(flags) {
    writeJSON('flags.json', flags);
  }

  // ============================================================
  // USAGE STATS
  // ============================================================
  function getUsageStats() {
    return readJSON('usage.json', { sites: {}, totalTime: 0 });
  }

  function trackUsage(url, seconds) {
    try {
      const host = new URL(url).hostname;
      const stats = getUsageStats();
      if (!stats.sites[host]) stats.sites[host] = 0;
      stats.sites[host] += seconds;
      stats.totalTime += seconds;
      writeJSON('usage.json', stats);
    } catch (e) { }
  }

  // ============================================================
  // AD & TRACKER BLOCKER
  // ============================================================
  const BLOCKED_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
    'pagead2.googlesyndication.com', 'adservice.google.com',
    'connect.facebook.net', 'pixel.facebook.com', 'an.facebook.com',
    'adnxs.com', 'adsrvr.org', 'adform.net', 'adcolony.com',
    'amazon-adsystem.com', 'media.net', 'outbrain.com', 'taboola.com',
    'criteo.com', 'criteo.net', 'rubiconproject.com', 'pubmatic.com',
    'openx.net', 'casalemedia.com', 'indexww.com', 'bidswitch.net',
    'smartadserver.com', 'yieldmo.com', 'sharethrough.com', 'triplelift.com',
    'quantserve.com', 'scorecardresearch.com', 'bluekai.com',
    'exelator.com', 'demdex.net', 'krxd.net', 'liadm.com', 'tapad.com',
    'moatads.com', 'doubleverify.com', 'adsafeprotected.com',
    'serving-sys.com', 'sizmek.com', 'flashtalking.com',
    'an.yandex.ru', 'yandexadexchange.net', 'mc.yandex.ru',
    'ad.mail.ru', 'target.my.com', 'top-fwz1.mail.ru',
    // Yandex browser/pack distribution (hijacks downloads)
    'browser.yandex.ru', 'dl.browser.yandex.ru', 'downloader.yandex.ru',
    'distribution.yandex.ru', 'soft.yandex.ru', 'clck.yandex.ru',
    'yandex.ru/soft', 'redirect.appmetrica.yandex.com',
    'appmetrica.yandex.com', 'yandexmetrica.com',
    'amplitude.com', 'hotjar.com', 'fullstory.com', 'mouseflow.com',
    'luckyorange.com', 'clarity.ms', 'crazyegg.com',
    'popads.net', 'popcash.net', 'propellerads.com',
    'revcontent.com', 'mgid.com', 'addthis.com', 'sharethis.com',
    'ads.yahoo.com', 'advertising.com', 'ad.doubleclick.net',
    'newrelic.com', 'nr-data.net',
    'adroll.com', 'cdn.adroll.com', 'adroll.mgr.consensu.org',
    'zedo.com', 'adzerk.net', 'mathtag.com', 'teads.tv',
    'chartbeat.com', 'parsely.com', 'segment.com',
    'branch.io', 'adjust.com', 'appsflyer.com',
    'snapads.com', 'ads-twitter.com', 'tiktok.com/ads',
    'imrworldwide.com', '2mdn.net', 'googletagservices-cn.com',
    'adobedtm.com', 'omtrdc.net', 'everesttech.net',
    'contextweb.com', 'gumgum.com', 'moatpixel.com',
    'btloader.com', 'admarvel.com', 'adlooxtracking.com',
    'exoclick.com', 'hilltopads.net', 'trafficjunky.net'
  ];

  const TRACKER_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'connect.facebook.net',
    'pixel.facebook.com', 'mc.yandex.ru', 'quantserve.com',
    'scorecardresearch.com', 'bluekai.com', 'demdex.net', 'krxd.net',
    'hotjar.com', 'fullstory.com', 'clarity.ms', 'amplitude.com',
    'mouseflow.com', 'crazyegg.com',
    'segment.com', 'newrelic.com', 'nr-data.net', 'chartbeat.com',
    'parsely.com', 'appsflyer.com', 'branch.io', 'adjust.com'
  ];

  const AD_URL_PATTERNS = [
    /doubleclick|googlesyndication|googleadservices|googletagmanager|googletagservices/i,
    /adservice|adserver|adsystem|adnxs|adsrvr|adform|adroll|adzerk|adloox/i,
    /taboola|outbrain|revcontent|mgid|propellerads|popads|popcash|exoclick|trafficjunky/i,
    /prebid|header-bid|bidder|sponsor(ed)?|promoted|affiliate[-_/]?ad/i,
    /\/ads?[\/_.-]|[?&](ad|ads|adunit|adslot|adid|adsid|advert|banner|promo)=/i,
    /analytics|telemetry|pixel|track(er|ing)?|collect\?/i
  ];

  // Same-site ads (preroll/vast/ad endpoint on the same host) need dedicated URL checks.
  const SAME_SITE_AD_URL_PATTERNS = [
    /(?:^|[/?._-])(preroll|midroll|postroll|vast|vpaid|ads?|adunit|adslot|banner|teaser|sponsor|promoted|commercial)(?:$|[/?._-])/i,
    /[?&](preroll|midroll|postroll|vast|vpaid|ads?|adunit|adslot|adtag|ad_url|banner|teaser|promo|sponsor)=/i,
    /\/(player|video|embed)\/(ads?|vast|preroll|midroll)(?:$|[/?._-])/i
  ];
  const SAME_SITE_STREAMING_AD_URL_PATTERNS = [
    /(?:^|[/?._-])(adfox|advert|advertising|banner|teaser|popup|popunder|vast|vpaid|preroll|midroll|postroll|commercial|sponsor|promo)(?:$|[/?._-])/i,
    /[?&](adv?|advert|banner|teaser|popup|popunder|vast|vpaid|preroll|midroll|postroll|adtag|ad_url|campaign)=/i,
    /\/(ads?|adv|advert|vast|preroll|midroll|postroll|banner|teaser)(?:$|[/?._-])/i
  ];
  const AGGRESSIVE_STREAMING_HOST_PATTERNS = [
    /(^|\.)kinogo\./i,
    /(^|\.)kinokrad\./i,
    /(^|\.)rezka\./i,
    /(^|\.)hdrezka\./i,
    /(^|\.)lordfilm\./i,
    /(^|\.)filmix\./i,
    /(^|\.)gidonline\./i
  ];
  const AGGRESSIVE_STREAMING_BLOCK_PATTERNS = [
    /\/(ads?|adv|advert|reklam|banner|teaser|promo|click|redirect|popup|popunder)(?:$|[/?._-])/i,
    /[?&](ads?|adv|advert|banner|teaser|promo|popunder|redirect|adfox|adtag|vast|preroll)=/i,
    /\/(player|embed|video)\/(ads?|adv|vast|preroll|midroll)(?:$|[/?._-])/i,
    /(?:adfox|vast|vpaid|preroll|midroll|doubleclick|googlesyndication|popcash|popads)/i
  ];

  const BLOCKABLE_AD_RESOURCE_TYPES = new Set(['script', 'image', 'subframe', 'xhr', 'ping', 'media', 'font', 'stylesheet', 'fetch', 'other']);
  const SAME_SITE_AD_RESOURCE_TYPES = new Set(['script', 'subframe', 'xhr', 'media', 'fetch', 'other']);

  const ADBLOCK_NEVER_BLOCK_HOSTS = [
    'accounts.google.com',
    'accounts.youtube.com',
    'openai.com',
    'api.openai.com'
  ];

  function hostnameFromUrl(raw) {
    try { return new URL(raw).hostname || ''; } catch (_) { return ''; }
  }

  function isSameSiteOrSubdomain(host, originHost) {
    if (!host || !originHost) return false;
    return host === originHost || host.endsWith('.' + originHost) || originHost.endsWith('.' + host);
  }

  function isAggressiveStreamingHost(hostname = '') {
    const host = String(hostname || '').toLowerCase();
    return AGGRESSIVE_STREAMING_HOST_PATTERNS.some((p) => p.test(host));
  }

  function shouldBlockByHeuristic(details, urlObj) {
    if (!urlObj || !urlObj.hostname) return false;
    if (!/^https?:$/.test(urlObj.protocol)) return false;
    const resourceType = String(details.resourceType || '').toLowerCase();
    if (resourceType === 'mainframe') return false;

    if (resourceType && !BLOCKABLE_AD_RESOURCE_TYPES.has(resourceType)) return false;

    const host = urlObj.hostname;
    if (ADBLOCK_NEVER_BLOCK_HOSTS.some(d => host === d || host.endsWith('.' + d))) return false;

    const fullUrl = details.url || '';
    const initiatorHost = hostnameFromUrl(details.initiator || details.referrer || '');
    if (resourceType !== 'mainframe' && (isAggressiveStreamingHost(host) || isAggressiveStreamingHost(initiatorHost))) {
      if (AGGRESSIVE_STREAMING_BLOCK_PATTERNS.some((p) => p.test(fullUrl))) {
        return true;
      }
    }
    if (initiatorHost && isSameSiteOrSubdomain(host, initiatorHost)) {
      if (!SAME_SITE_AD_RESOURCE_TYPES.has(resourceType)) return false;
      if (SAME_SITE_AD_URL_PATTERNS.some((p) => p.test(fullUrl))) return true;
      if (isAggressiveStreamingHost(initiatorHost) || isAggressiveStreamingHost(host)) {
        return SAME_SITE_STREAMING_AD_URL_PATTERNS.some((p) => p.test(fullUrl));
      }
      return false;
    }

    return AD_URL_PATTERNS.some(p => p.test(fullUrl));
  }

  function notifyAdBlock(hostname = '') {
    pulseStats.adsBlocked++;
    pulseStats.dataSavedKB += 15;
    if (hostname && isTrackerDomain(hostname)) pulseStats.trackersBlocked++;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pulse-stats-update', { ...pulseStats });
    }
  }

  function isBlockedDomain(hostname) {
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  }

  function isTrackerDomain(hostname) {
    return TRACKER_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  }

  function setupAdBlocker() {
    // Block known Yandex pack loader file patterns
    const BLOCKED_URL_PATTERNS = [
      /yandex.*pack.*loader/i,
      /yandex.*browser.*setup/i,
      /YandexPackSetup/i,
      /yandex_pack/i,
      /\/soft\/download/i,
      /browser\.yandex.*\.exe/i,
    ];

    session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      try {
        const url = new URL(details.url);
        // Block by domain
        if (isBlockedDomain(url.hostname)) {
          notifyAdBlock(url.hostname);
          callback({ cancel: true });
          return;
        }
        // Block by URL pattern (Yandex pack loaders, etc.)
        const fullUrl = details.url;
        if (BLOCKED_URL_PATTERNS.some(p => p.test(fullUrl))) {
          notifyAdBlock(url.hostname);
          console.log('[AdBlock] Blocked Yandex pack loader:', fullUrl);
          callback({ cancel: true });
          return;
        }

        // Strong third-party ad/tracker heuristics
        if (shouldBlockByHeuristic(details, url)) {
          notifyAdBlock(url.hostname);
          callback({ cancel: true });
          return;
        }
      } catch (e) { }
      pulseStats.requestsTotal++;
      callback({});
    });
  }

  // ============================================================
  // ANTI-FINGERPRINT
  // ============================================================
  function getAntiDetectScript() {
    return `
    try {
      // Anti-detect: hide Electron/webdriver traces so Google allows login
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      // Fake chrome object to look like a real Chrome browser
      if (!window.chrome) window.chrome = {};
      if (!window.chrome.runtime) {
        window.chrome.runtime = {
          connect: function(){},
          sendMessage: function(){},
          id: undefined,
          getManifest: function() { return {}; },
          getURL: function(path) { return ''; },
          onMessage: { addListener: function(){}, removeListener: function(){} },
          onConnect: { addListener: function(){}, removeListener: function(){} }
        };
      }
      if (!window.chrome.app) {
        window.chrome.app = { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } };
      }
      if (!window.chrome.csi) window.chrome.csi = function() { return {}; };
      if (!window.chrome.loadTimes) window.chrome.loadTimes = function() { return {}; };

      // Override userAgentData to match real Chrome ${CHROME_VERSION}
      if (navigator.userAgentData) {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Chromium', version: '${CHROME_VERSION}'.split('.')[0] },
              { brand: 'Google Chrome', version: '${CHROME_VERSION}'.split('.')[0] },
              { brand: 'Not_A Brand', version: '24' }
            ],
            mobile: false,
            platform: 'Windows',
            getHighEntropyValues: function(hints) {
              return Promise.resolve({
                architecture: 'x86',
                bitness: '64',
                brands: this.brands,
                fullVersionList: [
                  { brand: 'Chromium', version: '${CHROME_VERSION}' },
                  { brand: 'Google Chrome', version: '${CHROME_VERSION}' },
                  { brand: 'Not_A Brand', version: '24.0.0.0' }
                ],
                mobile: false,
                model: '',
                platform: 'Windows',
                platformVersion: '15.0.0',
                uaFullVersion: '${CHROME_VERSION}'
              });
            }
          })
        });
      }

      // Remove Electron-specific globals
      delete window.process;
      delete window.require;
      delete window.__electron_preload;
      delete window.Buffer;

      // Patch navigator.plugins to look like Chrome
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
          ];
          plugins.length = 5;
          return plugins;
        }
      });

      // Patch navigator.languages
      Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
    } catch(e) {}
  `;
  }

  // ============================================================
  // GOOGLE LOGIN POPUP - Opens Google OAuth in a BrowserWindow
  // instead of webview to bypass Google's embedded browser block
  // ============================================================
  function isGoogleLoginUrl(url) {
    try {
      const u = new URL(url);
      return (u.hostname === 'accounts.google.com' || u.hostname === 'accounts.youtube.com') &&
        (u.pathname.includes('/signin') || u.pathname.includes('/ServiceLogin') ||
          u.pathname.includes('/o/oauth2') || u.pathname.includes('/v3/signin') ||
          u.pathname.includes('/AccountChooser') || u.pathname.includes('/AddSession') ||
          u.pathname.includes('/InteractiveLogin'));
    } catch (e) { return false; }
  }

  function openGoogleLoginPopup(url, webviewContents) {
    const loginWin = new BrowserWindow({
      width: 500,
      height: 700,
      parent: mainWindow,
      modal: true,
      show: true,
      title: 'Google Sign In',
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // Use the same session so cookies are shared with webviews
        partition: undefined,
      },
      icon: APP_ICON_PATH,
    });

    const loginIcon = nativeImage.createFromPath(APP_ICON_PATH);
    if (!loginIcon.isEmpty()) loginWin.setIcon(loginIcon);

    loginWin.setMenuBarVisibility(false);
    loginWin.webContents.setUserAgent(SPOOFED_UA);
    loginWin.loadURL(url);

    // When Google login finishes, it will redirect to the original service
    // Detect when we leave accounts.google.com = login complete
    const handleNavigation = (e, navUrl) => {
      try {
        const u = new URL(navUrl);
        // If navigated away from Google login pages, login is complete
        if (u.hostname !== 'accounts.google.com' && u.hostname !== 'accounts.youtube.com' &&
          u.hostname !== 'myaccount.google.com' && !u.hostname.endsWith('.google.com')) {
          // Login complete - redirect webview to final URL and close popup
          if (webviewContents && !webviewContents.isDestroyed()) {
            webviewContents.loadURL(navUrl);
          }
          loginWin.close();
        }
      } catch (err) { /* ignore */ }
    };

    loginWin.webContents.on('will-redirect', handleNavigation);
    loginWin.webContents.on('did-navigate', (e, navUrl) => {
      try {
        const u = new URL(navUrl);
        // If we're back on a non-Google page, login is done
        if (!u.hostname.endsWith('google.com') && !u.hostname.endsWith('youtube.com') &&
          !u.hostname.endsWith('googleapis.com') && !u.hostname.endsWith('gstatic.com')) {
          if (webviewContents && !webviewContents.isDestroyed()) {
            webviewContents.loadURL(navUrl);
          }
          loginWin.close();
        }
      } catch (err) { /* ignore */ }
    });

    // If user closes popup manually, reload webview so it reflects any login state
    loginWin.on('closed', () => {
      if (webviewContents && !webviewContents.isDestroyed()) {
        webviewContents.reload();
      }
    });
  }

  function setupAntiFingerprint() {
    const antiDetectJS = getAntiDetectScript();
    const settings = loadSettings();

    mainWindow.webContents.on('did-attach-webview', (event, wc) => {
      wc.setUserAgent(SPOOFED_UA);

      // Intercept Google login navigations - open in popup BrowserWindow
      wc.on('will-navigate', (e, url) => {
        if (isGoogleLoginUrl(url)) {
          e.preventDefault();
          openGoogleLoginPopup(url, wc);
          return;
        }
      });

      // CRITICAL: Register preload for local file:// pages (settings, newtab)
      // so they can access window.olewser API
      wc.on('will-navigate', (e, url) => {
        // Preload is already set from webview tag attributes for file:// URLs
      });

      wc.on('dom-ready', () => {
        const url = wc.getURL();

        // For local file:// pages, inject the olewser API bridge
        if (url.startsWith('file://')) {
          // Inject a bridge that forwards IPC calls through the parent window
          wc.executeJavaScript(`
          if (!window.olewser) {
            // Signal parent window to handle settings for us
            window.__isOlewserLocal = true;
          }
        `).catch(() => { });
        } else {
          // Only run anti-detect on external sites
          wc.executeJavaScript(antiDetectJS).catch(() => { });

          // Hide Yandex browser promo/pack banners
          if (url.includes('yandex.')) {
            wc.insertCSS(`
            .distr-tooltip, .softcheck, .soft-check,
            .distribution, .browser-install, .browser-download,
            .home-tabs__promo, .promo-header, .zen-promo,
            [class*="BrowserInstall"], [class*="SoftSuggest"],
            [class*="distr"], [class*="YandexSoft"],
            .popup2[data-name="distr"], .serp-header__bro,
            .bro-suggest, .bro-popup { display: none !important; }
          `).catch(() => { });
          }

          // YouTube Ad Blocker - auto-skip and speed-up ads
          if (url.includes('youtube.com')) {
            wc.insertCSS(`
            .ytp-ad-overlay-container,
            .ytp-ad-text-overlay,
            .ytp-ad-image-overlay,
            #player-ads,
            #masthead-ad,
            ytd-banner-promo-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-display-ad-renderer,
            ytd-promoted-video-renderer,
            ytd-compact-promoted-video-renderer,
            ytd-action-companion-ad-renderer,
            .ytd-mealbar-promo-renderer,
            ytd-ad-slot-renderer,
            .ytp-ad-overlay-slot,
            #offer-module { display: none !important; }
          `).catch(() => { });

            wc.executeJavaScript(`
            (function() {
              if (window.__olewserYTAdBlock) return;
              window.__olewserYTAdBlock = true;
              
              const adBlocker = setInterval(() => {
                try {
                  const video = document.querySelector('video');
                  if (!video) return;
                  
                  // Detect if ad is playing
                  const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
                  if (adShowing) {
                    // Try skip button first
                    const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button-modern');
                    if (skipBtn) {
                      skipBtn.click();
                      return;
                    }
                    // Speed up non-skippable ads + mute
                    video.playbackRate = 16;
                    video.muted = true;
                    video.currentTime = video.duration || video.currentTime + 999;
                  } else {
                    // Restore normal playback
                    if (video.playbackRate === 16) {
                      video.playbackRate = 1;
                      video.muted = false;
                    }
                  }
                  
                  // Remove overlay ads
                  document.querySelectorAll('.ytp-ad-overlay-close-button').forEach(b => b.click());
                } catch(e) {}
              }, 500);
              
              // Cleanup on navigation
              window.addEventListener('beforeunload', () => clearInterval(adBlocker));
            })();
          `).catch(() => { });
          }
          // Aggressive ad cleanup for cinema-streaming sites where ads are usually same-site.
          if (/(\.|\/\/)(rezka|hdrezka|kinogo|kinokrad|lordfilm|gidonline|filmix)\./i.test(url) || /rezka\.ag/i.test(url)) {
            wc.insertCSS(`
              .b-content__inline_item,
              .b-content__right,
              .b-side,
              .b-player__advert,
              .b-player__adv,
              .vjs-ad,
              .vpaid,
              .player-ads,
              .video-ads,
              .ad-container,
              .ad-overlay,
              .adsbox,
              .adv,
              .advert,
              [id*="adfox"],
              [class*="adfox"],
              [class*="banner"],
              [id*="banner"],
              [class*="advert"],
              [id*="advert"],
              [class*="reklam"],
              [id*="reklam"],
              [class*="teaser"],
              [id*="teaser"],
              [class*="promo"],
              [id*="promo"],
              [class*="popup"],
              [id*="popup"],
              [class*="popunder"],
              [id*="popunder"],
              [class*="preroll"],
              [id*="preroll"],
              [class*="vast"],
              [id*="vast"],
              [class*="sponsor"],
              [id*="sponsor"],
              [class*="ads"],
              [id*="ads"],
              iframe[src*="vast"],
              iframe[src*="preroll"],
              iframe[src*="/ads"],
              iframe[src*="adtag"],
              iframe[src*="adfox"],
              iframe[src*="banner"],
              iframe[src*="teaser"],
              iframe[src*="promo"],
              iframe[src*="adsystem"] {
                display: none !important;
                visibility: hidden !important;
              }
            `).catch(() => { });

            wc.executeJavaScript(`
              (function() {
                if (window.__olewserAggressiveAdSkipper) return;
                window.__olewserAggressiveAdSkipper = true;

                const adRe = /(reklam|advertisement|sponsored|promo|skip\s*ad|ad\s*\d+\s*\/\s*\d+)/i;
                const skipRe = /(skip|close\s*ad|close|dismiss|continue\s*to\s*video|skip\s*video|proceed)/i;
                const srcRe = /(adfox|doubleclick|googlesyndication|googletagmanager|taboola|outbrain|vast|vpaid|preroll|midroll|banner|promo|teaser|popunder|ads?[\/?._-])/i;
                const openRe = /(adfox|doubleclick|googlesyndication|googletagmanager|taboola|outbrain|popcash|popads|banner|promo|teaser|redirect|popup|popunder|\/ads?[\/?._-])/i;

                const nativeOpen = window.open;
                window.open = function(url, name, specs) {
                  try {
                    const targetUrl = String(url || '');
                    if (targetUrl && openRe.test(targetUrl.toLowerCase())) {
                      return null;
                    }
                  } catch (_) { }
                  return nativeOpen.apply(window, arguments);
                };

                document.addEventListener('click', (ev) => {
                  const link = ev.target && ev.target.closest ? ev.target.closest('a[href], [data-href]') : null;
                  if (!link) return;
                  const href = String((link.getAttribute('href') || link.getAttribute('data-href') || '')).toLowerCase();
                  if (href && openRe.test(href)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                  }
                }, true);

                const isVisible = (el) => {
                  if (!el || !(el instanceof Element)) return false;
                  const st = window.getComputedStyle(el);
                  if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
                  const r = el.getBoundingClientRect();
                  return r.width > 0 && r.height > 0;
                };

                const clickSkipButtons = () => {
                  const nodes = document.querySelectorAll('button, a, [role="button"], div, span');
                  for (let i = 0; i < nodes.length && i < 350; i++) {
                    const el = nodes[i];
                    const text = (el.textContent || '').trim().toLowerCase();
                    if (text && skipRe.test(text) && isVisible(el)) {
                      try { el.click(); } catch (_) { }
                    }
                  }
                };

                const removeKnownAdNodes = () => {
                  document.querySelectorAll('iframe[src], iframe[data-src], script[src], img[src], video[src], source[src], a[href]').forEach((el) => {
                    const src = ((el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('href') || '') + '').toLowerCase();
                    if (src && srcRe.test(src)) {
                      const host = el.closest('[id],[class],iframe,section,aside,div') || el;
                      if (host && host.remove) host.remove();
                    }
                  });
                };

                const cleanupOverlays = () => {
                  document.querySelectorAll('div, section, aside').forEach((el) => {
                    const cls = ((el.className || '') + '').toLowerCase();
                    const id = ((el.id || '') + '').toLowerCase();
                    if (!(cls || id)) return;
                    if (/(ad|ads|advert|reklam|banner|teaser|promo|popup|popunder|sponsor|vast|preroll|midroll|adblock|antiadblock)/i.test(cls + ' ' + id)) {
                      const rect = el.getBoundingClientRect();
                      if (rect.width > 40 && rect.height > 40) {
                        el.remove();
                      }
                    }
                  });
                };

                const detectAdState = () => {
                  const nodes = document.querySelectorAll('span, div, p, button, a');
                  for (let i = 0; i < nodes.length && i < 350; i++) {
                    const el = nodes[i];
                    const text = (el.textContent || '').trim();
                    if (text && text.length <= 80 && adRe.test(text) && isVisible(el)) {
                      return true;
                    }
                  }
                  return false;
                };

                const processVideos = (isAdState) => {
                  document.querySelectorAll('video').forEach((video) => {
                    try {
                      if (isAdState) {
                        if (!video.dataset.olewserPrevRate) {
                          video.dataset.olewserPrevRate = String(video.playbackRate || 1);
                          video.dataset.olewserPrevMuted = video.muted ? '1' : '0';
                        }
                        video.muted = true;
                        video.playbackRate = Math.max(8, video.playbackRate || 1);
                        if (Number.isFinite(video.duration) && video.duration > 0) {
                          video.currentTime = Math.max(video.currentTime, video.duration - 0.2);
                        }
                      } else if (video.dataset.olewserPrevRate) {
                        const prevRate = parseFloat(video.dataset.olewserPrevRate) || 1;
                        video.playbackRate = prevRate;
                        video.muted = video.dataset.olewserPrevMuted === '1';
                        delete video.dataset.olewserPrevRate;
                        delete video.dataset.olewserPrevMuted;
                      }
                    } catch (_) { }
                  });
                };

                const scan = () => {
                  const adState = detectAdState();
                  removeKnownAdNodes();
                  cleanupOverlays();
                  clickSkipButtons();
                  processVideos(adState);
                };

                scan();
                const timer = setInterval(scan, 900);
                window.addEventListener('beforeunload', () => clearInterval(timer));
              })();
            `).catch(() => { });
          }

          // Global ad placeholders cleanup on most websites
          wc.insertCSS(`
            .adsbygoogle,
            [id^="google_ads_iframe"],
            [id*="google_ads_iframe"],
            [class*=" ad-slot"],
            [class^="ad-slot"],
            [class*="advert"],
            [id*="advert"],
            [class*="banner-ad"],
            [id*="banner-ad"],
            [class*="banner"],
            [id*="banner"],
            [class*="sponsored"],
            [id*="sponsored"],
            [class*="preroll"],
            [id*="preroll"],
            [class*="vast"],
            [id*="vast"],
            .adsbox,
            .ad-overlay,
            [data-ad],
            [data-ads],
            [data-ad-unit],
            iframe[src*="doubleclick.net"],
            iframe[src*="googlesyndication.com"],
            iframe[src*="googletagmanager.com"],
            iframe[src*="taboola.com"],
            iframe[src*="outbrain.com"],
            iframe[src*="adservice.google.com"],
            iframe[src*="vast"],
            iframe[src*="preroll"],
            iframe[src*="/ads"],
            video[src*="preroll"],
            source[src*="preroll"] {
              display: none !important;
              visibility: hidden !important;
            }
          `).catch(() => { });

          wc.executeJavaScript(`
            (function() {
              if (window.__olewserGlobalAdCleaner) return;
              window.__olewserGlobalAdCleaner = true;
              const adSrc = /doubleclick|googlesyndication|googletagmanager|taboola|outbrain|adservice|adsystem|adnxs|criteo|vast|vpaid|preroll|midroll|adtag|ad_url|\\/ads?[\\/?._-]/i;
              const scan = () => {
                try {
                  document.querySelectorAll('iframe[src], iframe[data-src], script[src], img[src], video[src], source[src]').forEach((el) => {
                    const src = ((el.getAttribute('src') || el.getAttribute('data-src') || '') + '').toLowerCase();
                    if (src && adSrc.test(src)) {
                      const host = el.closest('[id],[class]') || el;
                      if (host) host.remove();
                    }
                  });
                } catch (_) {}
              };
              scan();
              const timer = setInterval(scan, 1500);
              window.addEventListener('beforeunload', () => clearInterval(timer));
            })();
          `).catch(() => { });
        }

        // Native dark mode signal - User wants websites to always be dark
        nativeTheme.themeSource = 'dark';

        // Smooth scroll injection
        if (settings.smoothScroll) {
          wc.insertCSS(`html { scroll-behavior: smooth !important; }`).catch(() => { });
        }
      });
    });

    // Headers: clean up Electron-specific headers but keep real Chrome headers
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/*'] }, (details, callback) => {
      const headers = { ...details.requestHeaders };
      // Remove all Electron-specific headers
      delete headers['X-Electron-Is-Dev'];
      delete headers['X-Electron'];
      // Set Chrome-like headers
      headers['User-Agent'] = SPOOFED_UA;
      headers['sec-ch-ua'] = `"Chromium";v="133", "Google Chrome";v="133", "Not_A Brand";v="24"`;
      headers['sec-ch-ua-mobile'] = '?0';
      headers['sec-ch-ua-platform'] = '"Windows"';
      headers['sec-ch-ua-full-version-list'] = `"Chromium";v="${CHROME_VERSION}", "Google Chrome";v="${CHROME_VERSION}", "Not_A Brand";v="24.0.0.0"`;
      if (settings.doNotTrack) headers['DNT'] = '1';
      callback({ requestHeaders: headers });
    });
  }

  // ============================================================
  // DOWNLOADS HANDLER
  // ============================================================
  function setupDownloads() {
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const fileName = item.getFilename();
      const totalBytes = item.getTotalBytes();
      const downloadPath = path.join(app.getPath('downloads'), fileName);

      item.setSavePath(downloadPath);

      const dlItem = {
        id: Date.now().toString(36),
        filename: fileName,
        url: item.getURL(),
        path: downloadPath,
        totalBytes,
        receivedBytes: 0,
        state: 'progressing',
        timestamp: Date.now(),
      };

      item.on('updated', (event, state) => {
        dlItem.receivedBytes = item.getReceivedBytes();
        dlItem.state = state;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', { ...dlItem });
        }
      });

      item.once('done', (event, state) => {
        dlItem.state = state;
        dlItem.receivedBytes = dlItem.totalBytes;
        addDownload(dlItem);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-complete', { ...dlItem });
          mainWindow.webContents.send('toast', {
            message: `Downloaded: ${fileName}`,
            type: 'success'
          });
        }
      });
    });
  }

  // ============================================================
  // WINDOW CREATION
  // ============================================================
  function createWindow(isIncognito = false) {
    const settings = loadSettings();
    const isMac = process.platform === 'darwin';

    session.defaultSession.setUserAgent(SPOOFED_UA);

    const win = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      frame: false,
      thickFrame: true,
      backgroundColor: isMac ? '#00000000' : '#0a0a0a',
      transparent: isMac,
      vibrancy: isMac ? 'under-window' : undefined,
      visualEffectState: isMac ? 'active' : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webSecurity: true,
      },
      show: false,
      icon: APP_ICON_PATH,
      alwaysOnTop: settings.alwaysOnTop,
    });

    const appIcon = nativeImage.createFromPath(APP_ICON_PATH);
    if (!appIcon.isEmpty()) win.setIcon(appIcon);
    if (isMac) {
      try {
        win.setVibrancy('under-window');
      } catch (_) {
        // Ignore if vibrancy is not supported by current macOS setup.
      }
    }

    // Menu + accelerators:
    // macOS gets a native app menu; Windows/Linux keep an invisible shortcut menu.
    const send = (data) => { if (win && !win.isDestroyed()) win.webContents.send('shortcut-triggered', data); };
    const sc = (accel, data, label = accel, visible = false) => ({
      label,
      accelerator: accel,
      click: () => send(data),
      visible,
    });

    const shortcutItems = [
      sc('CmdOrCtrl+T', { key: 't', ctrl: true, shift: false }, 'New Tab'),
      sc('CmdOrCtrl+W', { key: 'w', ctrl: true, shift: false }, 'Close Tab'),
      sc('CmdOrCtrl+N', { key: 'n', ctrl: true, shift: false }, 'New Window'),
      sc('CmdOrCtrl+Shift+N', { key: 'N', ctrl: true, shift: true }, 'New Incognito Window'),
      sc('CmdOrCtrl+Shift+T', { key: 'T', ctrl: true, shift: true }, 'Reopen Closed Tab'),
      sc('CmdOrCtrl+K', { key: 'k', ctrl: true, shift: false }, 'Command Palette'),
      sc('CmdOrCtrl+F', { key: 'f', ctrl: true, shift: false }, 'Find in Page'),
      sc('CmdOrCtrl+H', { key: 'h', ctrl: true, shift: false }, 'History'),
      sc('CmdOrCtrl+J', { key: 'j', ctrl: true, shift: false }, 'Downloads'),
      sc('CmdOrCtrl+L', { key: 'l', ctrl: true, shift: false }, 'Focus Address Bar'),
      sc('CmdOrCtrl+P', { key: 'p', ctrl: true, shift: false }, 'Print'),
      sc('CmdOrCtrl+R', { key: 'r', ctrl: true, shift: false }, 'Reload'),
      sc('CmdOrCtrl+=', { key: '=', ctrl: true, shift: false }, 'Zoom In'),
      sc('CmdOrCtrl+-', { key: '-', ctrl: true, shift: false }, 'Zoom Out'),
      sc('CmdOrCtrl+0', { key: '0', ctrl: true, shift: false }, 'Reset Zoom'),
      sc('CmdOrCtrl+1', { key: '1', ctrl: true, shift: false }, 'Switch to Tab 1'),
      sc('CmdOrCtrl+2', { key: '2', ctrl: true, shift: false }, 'Switch to Tab 2'),
      sc('CmdOrCtrl+3', { key: '3', ctrl: true, shift: false }, 'Switch to Tab 3'),
      sc('CmdOrCtrl+4', { key: '4', ctrl: true, shift: false }, 'Switch to Tab 4'),
      sc('CmdOrCtrl+5', { key: '5', ctrl: true, shift: false }, 'Switch to Tab 5'),
      sc('CmdOrCtrl+6', { key: '6', ctrl: true, shift: false }, 'Switch to Tab 6'),
      sc('CmdOrCtrl+7', { key: '7', ctrl: true, shift: false }, 'Switch to Tab 7'),
      sc('CmdOrCtrl+8', { key: '8', ctrl: true, shift: false }, 'Switch to Tab 8'),
      sc('CmdOrCtrl+9', { key: '9', ctrl: true, shift: false }, 'Switch to Last Tab'),
      sc('F5', { key: 'F5', ctrl: false, shift: false }, 'Reload'),
      sc('F11', { key: 'F11', ctrl: false, shift: false }, 'Fullscreen'),
      sc('F12', { key: 'F12', ctrl: false, shift: false }, 'Developer Tools'),
    ];

    if (isMac) {
      const menu = Menu.buildFromTemplate([
        {
          label: app.name || 'Olewser',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'File',
          submenu: [
            { ...shortcutItems[0], visible: true },
            { ...shortcutItems[2], visible: true },
            { ...shortcutItems[3], visible: true },
            { type: 'separator' },
            { ...shortcutItems[11], visible: true },
            { ...shortcutItems[12], visible: true },
            { ...shortcutItems[13], visible: true },
            { type: 'separator' },
            { role: 'close' },
          ],
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectAll' },
            { type: 'separator' },
            { ...shortcutItems[6], visible: true },
          ],
        },
        {
          label: 'View',
          submenu: [
            { ...shortcutItems[10], visible: true },
            { ...shortcutItems[11], visible: true },
            { ...shortcutItems[12], visible: true },
            { ...shortcutItems[13], visible: true },
            { type: 'separator' },
            { role: 'togglefullscreen' },
          ],
        },
        {
          label: 'Window',
          submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
          ],
        },
      ]);
      Menu.setApplicationMenu(menu);
    } else {
      const menu = Menu.buildFromTemplate([{
        label: 'Shortcuts',
        submenu: shortcutItems.map((item) => ({ ...item, visible: false })),
      }]);
      Menu.setApplicationMenu(menu);
    }

    const shouldOpenMainUi = pendingLaunchTargets.length > 0;
    if (isFirstRun() && !shouldOpenMainUi) {
      win.loadFile(path.join(__dirname, 'src', 'start.html'));
    } else {
      win.loadFile(path.join(__dirname, 'src', 'index.html'));
    }

    win.once('ready-to-show', () => {
      win.show();
      win.webContents.send('app-update:state', buildPublicUpdateState());
      // DevTools disabled by default as per request
      // win.webContents.openDevTools({ mode: 'detach' }); 
      if (isIncognito) {
        win.webContents.send('set-incognito', true);
      }
      if (win === mainWindow) {
        flushPendingLaunchTargets();
      }
    });

    win.on('maximize', () => {
      win.webContents.send('window-state-changed', { maximized: true });
    });
    win.on('unmaximize', () => {
      win.webContents.send('window-state-changed', { maximized: false });
    });

    win.on('enter-full-screen', () => {
      win.webContents.send('fullscreen-changed', true);
    });
    win.on('leave-full-screen', () => {
      win.webContents.send('fullscreen-changed', false);
    });

    win.on('closed', () => {
      windows = windows.filter(w => w !== win);
      if (win === mainWindow) mainWindow = null;
    });

    windows.push(win);

    if (!mainWindow) {
      mainWindow = win;
      setupAdBlocker();
      setupAntiFingerprint();
      setupDownloads();
      setupWebViewPermissions();
    }

    return win;
  }

  // ============================================================
  // WEBVIEW PERMISSIONS
  // ============================================================
  function setupWebViewPermissions() {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['clipboard-read', 'clipboard-write', 'fullscreen', 'pointerLock', 'media', 'mediaKeySystem', 'audio', 'microphone'];
      callback(allowedPermissions.includes(permission));
    });

    // Also handle permission checks (not just requests)
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      const allowedChecks = ['media', 'mediaKeySystem', 'audio', 'microphone', 'clipboard-read', 'clipboard-write'];
      return allowedChecks.includes(permission);
    });

    mainWindow.webContents.on('did-attach-webview', (event, wc) => {
      wc.setWindowOpenHandler(({ url }) => {
        // Intercept Google login popups (e.g. "Sign in with Google" buttons)
        if (isGoogleLoginUrl(url)) {
          openGoogleLoginPopup(url, wc);
          return { action: 'deny' };
        }
        mainWindow.webContents.send('open-url-in-new-tab', url);
        return { action: 'deny' };
      });

      // Right-click context menu
      wc.on('context-menu', (e, params) => {
        const menuItems = [];

        // Navigation
        if (wc.canGoBack()) menuItems.push({ label: 'Back', click: () => wc.goBack() });
        if (wc.canGoForward()) menuItems.push({ label: 'Forward', click: () => wc.goForward() });
        menuItems.push({ label: 'Reload', click: () => wc.reload() });
        menuItems.push({ type: 'separator' });

        // Text editing
        if (params.isEditable) {
          menuItems.push({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut });
          menuItems.push({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste });
        }
        if (params.selectionText) {
          menuItems.push({ label: 'Copy', role: 'copy' });
          menuItems.push({
            label: 'Translate with OleksandrAi',
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('translate-selection', params.selectionText || '');
              }
            }
          });
        }
        menuItems.push({ label: 'Select All', role: 'selectAll' });
        menuItems.push({ type: 'separator' });

        // Link
        if (params.linkURL) {
          menuItems.push({
            label: 'Open Link in New Tab',
            click: () => mainWindow.webContents.send('open-url-in-new-tab', params.linkURL)
          });
          menuItems.push({
            label: 'Open Link in New Olewser Window',
            click: () => {
              const newWin = createWindow();
              newWin.webContents.once('did-finish-load', () => {
                if (!newWin.isDestroyed()) {
                  newWin.webContents.send('open-url-in-new-tab', params.linkURL);
                }
              });
            }
          });
          menuItems.push({
            label: 'Copy Link Address',
            click: () => require('electron').clipboard.writeText(params.linkURL)
          });
          menuItems.push({ type: 'separator' });
        }

        // Image
        if (params.hasImageContents) {
          menuItems.push({
            label: 'Copy Image',
            click: () => wc.copyImageAt(params.x, params.y)
          });
          menuItems.push({
            label: 'Copy Image Address',
            click: () => require('electron').clipboard.writeText(params.srcURL)
          });
          menuItems.push({
            label: 'Save Image As...',
            click: () => {
              mainWindow.webContents.downloadURL(params.srcURL);
            }
          });
          menuItems.push({ type: 'separator' });
        }

        // Dev tools
        menuItems.push({
          label: 'Inspect Element',
          click: () => {
            // Open DevTools docked to the right side of the window
            wc.openDevTools({ mode: 'right' });
          }
        });

        const menu = Menu.buildFromTemplate(menuItems);
        menu.popup({ window: mainWindow });
      });
    });
  }

  function normalizeInstallableAppUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return '';
    try {
      const parsed = new URL(value);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:') {
        return parsed.toString();
      }
    } catch (_) {
      return '';
    }
    return '';
  }

  function sanitizeAppShortcutName(rawName) {
    const base = String(rawName || '').trim().replace(/[\u0000-\u001f]/g, '');
    const cleaned = base.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
    return (cleaned || 'Web App').slice(0, 70);
  }

  function escapePowerShellSingleQuoted(value) {
    return String(value || '').replace(/'/g, "''");
  }

  function createWindowsShortcut({ shortcutPath, targetPath, argumentsLine, iconPath, description }) {
    return new Promise((resolve, reject) => {
      const workingDirectory = path.dirname(targetPath);
      const script = [
        "$WshShell = New-Object -ComObject WScript.Shell",
        `$Shortcut = $WshShell.CreateShortcut('${escapePowerShellSingleQuoted(shortcutPath)}')`,
        `$Shortcut.TargetPath = '${escapePowerShellSingleQuoted(targetPath)}'`,
        `$Shortcut.Arguments = '${escapePowerShellSingleQuoted(argumentsLine)}'`,
        `$Shortcut.WorkingDirectory = '${escapePowerShellSingleQuoted(workingDirectory)}'`,
        `$Shortcut.IconLocation = '${escapePowerShellSingleQuoted(iconPath)},0'`,
        `$Shortcut.Description = '${escapePowerShellSingleQuoted(description)}'`,
        '$Shortcut.Save()',
      ].join('; ');

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true },
        (error) => {
          if (error) reject(error);
          else resolve(shortcutPath);
        }
      );
    });
  }

  // ============================================================
  // IPC HANDLERS
  // ============================================================

  // --- Window ---
  ipcMain.handle('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize();
  });
  ipcMain.handle('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w?.isMaximized()) w.unmaximize(); else w?.maximize();
  });
  ipcMain.handle('window:close', (e) => {
    const settings = loadSettings();
    if (settings.clearOnExit) {
      session.defaultSession.clearStorageData();
      clearHistory();
    }
    BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.handle('window:isMaximized', (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle('window:fullscreen', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    w?.setFullScreen(!w.isFullScreen());
  });
  ipcMain.handle('window:alwaysOnTop', (e, val) => {
    BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(val);
  });
  ipcMain.handle('window:new', () => {
    createWindow();
  });
  ipcMain.handle('window:newIncognito', () => {
    createWindow(true);
  });

  // --- Settings ---
  ipcMain.handle('settings:load', () => loadSettings());
  ipcMain.handle('settings:save', (_, data) => {
    const normalized = { ...data, language: normalizeLanguageCode(data && data.language) };
    saveSettings(normalized);
    // Notify ALL windows that settings changed so they can reload
    windows.forEach(w => {
      if (w && !w.isDestroyed()) {
        w.webContents.send('settings-changed', normalized);
      }
    });
    return true;
  });
  ipcMain.handle('settings:getDefault', () => DEFAULT_SETTINGS);
  ipcMain.handle('app:getPreloadPath', () => path.join(__dirname, 'preload.js'));

  // --- History ---
  ipcMain.handle('history:get', (_, query) => query ? searchHistory(query) : getHistory().slice(0, 200));
  ipcMain.handle('history:add', (_, entry) => { addHistoryEntry(entry); return true; });
  ipcMain.handle('history:clear', () => { clearHistory(); return true; });
  ipcMain.handle('history:remove', (_, id) => { removeHistoryEntry(id); return true; });
  ipcMain.handle('history:search', (_, query) => searchHistory(query));

  // --- Downloads ---
  ipcMain.handle('downloads:get', () => getDownloads());
  ipcMain.handle('downloads:clear', () => { clearDownloads(); return true; });
  ipcMain.handle('downloads:open', (_, filepath) => { shell.openPath(filepath); });
  ipcMain.handle('downloads:showInFolder', (_, filepath) => { shell.showItemInFolder(filepath); });
  ipcMain.handle('downloads:openFolder', () => { shell.openPath(app.getPath('downloads')); });

  // --- Bookmarks ---
  ipcMain.handle('bookmarks:get', () => getBookmarks());
  ipcMain.handle('bookmarks:add', (_, bm) => addBookmark(bm));
  ipcMain.handle('bookmarks:remove', (_, id) => removeBookmark(id));

  // --- Sessions ---
  ipcMain.handle('sessions:get', () => getSessions());
  ipcMain.handle('sessions:save', (_, name, tabs) => saveSession(name, tabs));
  ipcMain.handle('sessions:delete', (_, id) => deleteSession(id));

  // --- Quick Links ---
  ipcMain.handle('quicklinks:get', () => getQuickLinks());
  ipcMain.handle('quicklinks:save', (_, links) => { saveQuickLinks(links); return true; });

  // --- Top Sites ---
  ipcMain.handle('topsites:get', () => getTopSites());

  // --- Notes ---
  ipcMain.handle('notes:get', () => getNotes());
  ipcMain.handle('notes:save', (_, note) => saveNote(note));
  ipcMain.handle('notes:delete', (_, id) => deleteNote(id));

  // --- Reading List ---
  ipcMain.handle('readinglist:get', () => getReadingList());
  ipcMain.handle('readinglist:add', (_, item) => addToReadingList(item));
  ipcMain.handle('readinglist:remove', (_, id) => removeFromReadingList(id));

  // --- Clipboard ---
  ipcMain.handle('clipboard:get', () => clipboardHistory);
  ipcMain.handle('clipboard:add', (_, text) => { addToClipboard(text); return clipboardHistory; });

  // --- Permissions ---
  ipcMain.handle('permissions:get', () => getSitePermissions());
  ipcMain.handle('permissions:set', (_, site, perm, val) => setSitePermission(site, perm, val));

  // --- Flags ---
  ipcMain.handle('flags:get', () => getFlags());
  ipcMain.handle('flags:save', (_, flags) => { saveFlags(flags); return true; });

  // --- Usage Stats ---
  ipcMain.handle('usage:get', () => getUsageStats());
  ipcMain.handle('usage:track', (_, url, seconds) => { trackUsage(url, seconds); return true; });

  // --- Pulse ---
  ipcMain.handle('pulse:getStats', () => ({ ...pulseStats }));
  ipcMain.handle('pulse:resetStats', () => {
    pulseStats = { adsBlocked: 0, trackersBlocked: 0, requestsTotal: 0, dataSavedKB: 0, sessionStart: Date.now() };
    return true;
  });

  // --- Config (legacy compat) ---
  ipcMain.handle('config:load', () => loadSettings());
  ipcMain.handle('config:save', (_, data) => { saveSettings(data); return true; });

  // --- System ---
  ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));
  ipcMain.handle('pwa:install', async (_, payload) => {
    try {
      const installUrl = normalizeInstallableAppUrl(payload && payload.url);
      if (!installUrl) {
        return { success: false, error: 'Only http/https/file URLs can be installed' };
      }

      let suggestedTitle = '';
      try {
        suggestedTitle = payload && payload.title ? String(payload.title) : new URL(installUrl).hostname;
      } catch (_) {
        suggestedTitle = payload && payload.title ? String(payload.title) : 'Web App';
      }

      const appName = sanitizeAppShortcutName(suggestedTitle);
      const desktopDir = app.getPath('desktop');
      const appExe = app.getPath('exe');
      const launchArgs = `"${installUrl}"`;
      const description = `Open ${installUrl} in Olewser`;
      const lnkPath = path.join(desktopDir, `${appName} - Olewser.lnk`);

      if (process.platform === 'win32') {
        try {
          await createWindowsShortcut({
            shortcutPath: lnkPath,
            targetPath: appExe,
            argumentsLine: launchArgs,
            iconPath: APP_ICON_PATH,
            description,
          });
          return { success: true, path: lnkPath, method: 'shortcut' };
        } catch (shortcutError) {
          const urlPath = path.join(desktopDir, `${appName} - Olewser.url`);
          const content = `[InternetShortcut]\r\nURL=${installUrl}\r\nIconFile=${APP_ICON_PATH}\r\nIconIndex=0\r\n`;
          fs.writeFileSync(urlPath, content, 'utf8');
          return {
            success: true,
            path: urlPath,
            method: 'url',
            warning: shortcutError && shortcutError.message ? shortcutError.message : '',
          };
        }
      }

      const urlPath = path.join(desktopDir, `${appName} - Olewser.url`);
      const content = `[InternetShortcut]\r\nURL=${installUrl}\r\nIconFile=${APP_ICON_PATH}\r\nIconIndex=0\r\n`;
      fs.writeFileSync(urlPath, content, 'utf8');
      return { success: true, path: urlPath, method: 'url' };
    } catch (err) {
      return { success: false, error: err && err.message ? err.message : 'Failed to install app shortcut' };
    }
  });
  ipcMain.handle('app:getPath', (_, name) => app.getPath(name));
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion() || '2.0.0',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    productName: app.name || 'Olewser',
    isMac: process.platform === 'darwin',
  }));
  ipcMain.handle('app:getDefaultBrowserStatus', () => getDefaultBrowserStatus());
  ipcMain.handle('app:setDefaultBrowser', () => trySetDefaultBrowser());
  ipcMain.handle('app:openDefaultAppsSettings', () => openSystemDefaultAppsSettings());
  ipcMain.handle('app:openUserDataFolder', async () => {
    const dir = app.getPath('userData');
    const result = await shell.openPath(dir);
    if (result) return { ok: false, error: result, path: dir };
    return { ok: true, path: dir };
  });

  // --- App Updates ---
  ipcMain.handle('update:getState', () => buildPublicUpdateState());
  ipcMain.handle('update:check', (_, opts) => checkForAppUpdate({ force: !!(opts && opts.force) }));
  ipcMain.handle('update:startDownload', () => startAppUpdateDownload());
  ipcMain.handle('update:install', () => installDownloadedUpdate());

  // --- Print ---
  ipcMain.handle('page:print', (e) => {
    // We send a message to renderer to trigger print on the active webview
    e.sender.send('trigger-print');
  });

  // --- Screenshot ---
  ipcMain.handle('page:screenshot', async (e) => {
    try {
      const w = BrowserWindow.fromWebContents(e.sender);
      const image = await w.webContents.capturePage();
      const savePath = path.join(app.getPath('pictures'), `olewser-screenshot-${Date.now()}.png`);
      fs.writeFileSync(savePath, image.toPNG());
      return { success: true, path: savePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- Clear data ---
  ipcMain.handle('data:clearAll', async () => {
    await session.defaultSession.clearStorageData();
    clearHistory();
    clearDownloads();
    return true;
  });
  ipcMain.handle('data:clearCache', async () => {
    await session.defaultSession.clearCache();
    return true;
  });
  ipcMain.handle('data:clearCookies', async () => {
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    return true;
  });

  // ============================================================
  // AI AGENT - OpenAI Realtime Voice Integration
  // ============================================================

  function getOpenAIApiKey() {
    const settings = loadSettings();
    const key = settings.aiApiKey || process.env.OPENAI_API_KEY || '';
    console.log('[AI] getOpenAIApiKey:', key ? `found (${key.substring(0, 10)}...)` : 'EMPTY!');
    return key;
  }

  // Get an ephemeral token for WebRTC connection to OpenAI Realtime
  ipcMain.handle('ai:getRealtimeToken', async () => {
    console.log('[AI] getRealtimeToken called');
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      console.log('[AI] ERROR: No API key!');
      return { error: 'OpenAI API key is not configured. Add it in Settings.' };
    }

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "ash"
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/realtime/sessions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode !== 200) {
              console.log('[AI] Token error:', res.statusCode, json.error?.message);
              resolve({ error: json.error?.message || `OpenAI API error: ${res.statusCode}` });
            } else {
              console.log('[AI] Token received OK!');
              resolve({ token: json.client_secret.value });
            }
          } catch (e) {
            console.log('[AI] Parse error:', e.message, 'Raw data:', data.substring(0, 200));
            resolve({ error: 'Failed to parse OpenAI response' });
          }
        });
      });

      req.on('error', (err) => resolve({ error: err.message }));
      req.write(body);
      req.end();
    });
  });

  // AI: Send SDP offer to OpenAI Realtime API (proxied through main process to avoid CORS)
  ipcMain.handle('ai:sendSDP', async (_, { token, sdp }) => {
    console.log('[AI] sendSDP called');
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.openai.com',
        path: '/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/sdp',
          'Content-Length': Buffer.byteLength(sdp),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          console.log('[AI] SDP response:', res.statusCode);
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            resolve({ error: `SDP error: ${res.statusCode} - ${data.substring(0, 200)}` });
          } else {
            resolve({ sdp: data });
          }
        });
      });

      req.on('error', (err) => {
        console.log('[AI] SDP request error:', err.message);
        resolve({ error: err.message });
      });
      req.write(sdp);
      req.end();
    });
  });

  // ============================================================
  // GEMINI LIVE API - WebSocket-based real-time voice
  // ============================================================
  let geminiWs = null;
  let geminiSenderWindow = null;

  function getGeminiApiKey() {
    const settings = loadSettings();
    const key = settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
    console.log('[GEMINI] getGeminiApiKey:', key ? `found (${key.substring(0, 10)}...)` : 'EMPTY!');
    return key;
  }

  const GEMINI_SYSTEM_PROMPT = `You are OleksandrAi, the built-in AI assistant in the Olewser browser, created by OleksandrCorp.

Identity rules:
- If the user asks who you are, your name, or who created you, answer clearly:
  "My name is OleksandrAi. I was created by OleksandrCorp."
- Do not claim any other name or creator.

Behavior rules:
- Reply in the same language as the user (SK, UK, RU, EN).
- Default to Slovak if language is unclear.
- Be polite, clear, and concise.
- Do not use profanity, insults, or aggressive slang.
- Do not narrate internal tool usage.

Browser-action rules:
- If an action is needed (open site, search, click, type, scroll, back/forward), execute the action and then report the result.
- Do not invent URLs; use search when exact URL is unknown.`;

  const GEMINI_TOOLS = [{
    functionDeclarations: [
      { name: 'open_website', description: 'Open a website using an exact URL', parameters: { type: 'OBJECT', properties: { url: { type: 'STRING' } }, required: ['url'] } },
      { name: 'google_search', description: 'Search in Google', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
      { name: 'search_youtube', description: 'Search videos on YouTube', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } }, required: ['query'] } },
      { name: 'click_text', description: 'Click an element by visible text', parameters: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] } },
      { name: 'type_text', description: 'Type text into an input field', parameters: { type: 'OBJECT', properties: { target_text: { type: 'STRING' }, value: { type: 'STRING' } }, required: ['target_text', 'value'] } },
      { name: 'scroll', description: 'Scroll the page up or down', parameters: { type: 'OBJECT', properties: { direction: { type: 'STRING', enum: ['up', 'down'] } }, required: ['direction'] } },
      { name: 'go_back', description: 'Go back to the previous page', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'go_forward', description: 'Go forward to the next page', parameters: { type: 'OBJECT', properties: {} } },
      { name: 'describe_page', description: 'Capture a screenshot and describe what is visible on the current page', parameters: { type: 'OBJECT', properties: {} } }
    ]
  }];

  ipcMain.handle('ai:connectGemini', async (e) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) return { error: 'Gemini API key is not configured' };

    // Close existing connection
    if (geminiWs) {
      try { geminiWs.close(); } catch (e) { }
      geminiWs = null;
    }

    geminiSenderWindow = BrowserWindow.fromWebContents(e.sender);

    return new Promise((resolve) => {
      const model = 'gemini-2.5-flash-native-audio-preview-12-2025';
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

      console.log('[GEMINI] Connecting to:', model);

      const WebSocket = require('ws');
      const ws = new WebSocket(wsUrl);
      geminiWs = ws;

      let setupDone = false;

      ws.on('open', () => {
        console.log('[GEMINI] WebSocket connected, sending setup...');

        // Send initial setup message
        const setupMsg = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Charon'
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: GEMINI_SYSTEM_PROMPT }]
            },
            tools: GEMINI_TOOLS
          }
        };
        ws.send(JSON.stringify(setupMsg));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Setup complete confirmation
          if (msg.setupComplete && !setupDone) {
            setupDone = true;
            console.log('[GEMINI] Setup complete!');
            resolve({ success: true });
            return;
          }

          // Forward all messages to renderer
          if (geminiSenderWindow && !geminiSenderWindow.isDestroyed()) {
            geminiSenderWindow.webContents.send('gemini-event', msg);
          }

          // Log tool calls
          if (msg.toolCall) {
            console.log('[GEMINI] Tool call:', JSON.stringify(msg.toolCall).substring(0, 200));
          }
        } catch (e) {
          console.error('[GEMINI] Parse error:', e.message);
        }
      });

      ws.on('error', (err) => {
        console.error('[GEMINI] WS error:', err.message);
        if (!setupDone) {
          resolve({ error: err.message });
        }
        if (geminiSenderWindow && !geminiSenderWindow.isDestroyed()) {
          geminiSenderWindow.webContents.send('gemini-event', { error: err.message });
        }
      });

      ws.on('close', (code, reason) => {
        console.log('[GEMINI] WS closed:', code, reason?.toString());
        geminiWs = null;
        if (!setupDone) {
          resolve({ error: `Connection closed: ${code}` });
        }
        if (geminiSenderWindow && !geminiSenderWindow.isDestroyed()) {
          geminiSenderWindow.webContents.send('gemini-event', { connectionClosed: true });
        }
      });

      // Timeout
      setTimeout(() => {
        if (!setupDone) {
          resolve({ error: 'Connection timeout' });
          try { ws.close(); } catch (e) { }
        }
      }, 15000);
    });
  });

  // Send audio chunk to Gemini
  ipcMain.handle('ai:sendGeminiAudio', async (_, base64Audio) => {
    if (!geminiWs || geminiWs.readyState !== 1) return;
    geminiWs.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/pcm;rate=16000',
          data: base64Audio
        }]
      }
    }));
  });

  // Send image to Gemini (inline vision - no separate REST call needed!)
  ipcMain.handle('ai:sendGeminiImage', async (_, base64Image) => {
    if (!geminiWs || geminiWs.readyState !== 1) return { error: 'Not connected' };
    console.log('[GEMINI] Sending image for vision...');

    // Strip data URI prefix
    let imgData = base64Image;
    if (imgData.includes(',')) imgData = imgData.split(',')[1];

    geminiWs.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'image/png',
          data: imgData
        }]
      }
    }));
    return { success: true };
  });

  // Send tool response back to Gemini
  ipcMain.handle('ai:sendGeminiToolResponse', async (_, { functionResponses }) => {
    if (!geminiWs || geminiWs.readyState !== 1) return;
    console.log('[GEMINI] Sending tool response');
    geminiWs.send(JSON.stringify({
      toolResponse: { functionResponses }
    }));
  });

  // Disconnect Gemini
  ipcMain.handle('ai:disconnectGemini', async () => {
    console.log('[GEMINI] Disconnecting...');
    if (geminiWs) {
      try { geminiWs.close(); } catch (e) { }
      geminiWs = null;
    }
    geminiSenderWindow = null;
    return { success: true };
  });

  // Get current AI provider setting
  ipcMain.handle('ai:getProvider', async () => {
    const settings = loadSettings();
    return settings.aiProvider || 'gemini'; // default to gemini for testing
  });

  // AI: Describe screenshot via GPT-4o REST API (Realtime API doesn't support images)
  ipcMain.handle('ai:describeScreen', async (_, base64Image) => {
    console.log('[AI] describeScreen called');
    const apiKey = getOpenAIApiKey();
    if (!apiKey) return { error: 'No API key' };

    return new Promise((resolve) => {
      // Strip data URI prefix if present
      let imgData = base64Image;
      if (imgData.includes(',')) imgData = imgData.split(',')[1];

      const body = JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe in detail everything visible on this browser screenshot. Include website name, headings, titles, button labels, and key UI elements. Respond clearly in the user language.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imgData}`, detail: 'auto' } }
          ]
        }],
        max_tokens: 500
      });

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode !== 200) {
              console.log('[AI] describeScreen error:', res.statusCode);
              resolve({ error: json.error?.message || `Error: ${res.statusCode}` });
            } else {
              const text = json.choices?.[0]?.message?.content || 'Could not generate description';
              console.log('[AI] describeScreen result:', text.substring(0, 80));
              resolve({ description: text });
            }
          } catch (e) {
            resolve({ error: 'Parse error' });
          }
        });
      });

      req.on('error', (err) => resolve({ error: err.message }));
      req.write(body);
      req.end();
    });
  });

  // AI: Capture active webview screenshot
  ipcMain.handle('ai:captureTab', async (e) => {
    try {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (!w) return { error: 'No window' };

      const allWC = require('electron').webContents.getAllWebContents();
      const webviews = allWC.filter(wc => wc.getType() === 'webview' && !wc.isDestroyed());

      for (const wc of webviews) {
        try {
          const image = await wc.capturePage();
          const base64 = image.toPNG().toString('base64');
          if (base64.length > 100) return { base64 };
        } catch (e) { /* skip */ }
      }

      const image = await w.webContents.capturePage();
      return { base64: image.toPNG().toString('base64') };
    } catch (err) {
      return { error: err.message };
    }
  });

  // AI Agent: Execute action on active webview
  ipcMain.handle('ai:executeAction', async (e, action) => {
    try {
      const allWC = require('electron').webContents.getAllWebContents();
      const webviews = allWC.filter(wc => wc.getType() === 'webview' && !wc.isDestroyed());
      if (!webviews.length) return { error: 'No active webview' };
      const wc = webviews[0];

      switch (action.type) {
        case 'click': {
          const x = Math.round(action.x);
          const y = Math.round(action.y);
          wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
          await new Promise(r => setTimeout(r, 50));
          wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
          return { success: true, action: `clicked at (${x}, ${y})` };
        }
        case 'type': {
          const text = action.text || '';
          for (const char of text) {
            wc.sendInputEvent({ type: 'char', keyCode: char });
            await new Promise(r => setTimeout(r, 20));
          }
          return { success: true, action: `typed text` };
        }
        case 'keyPress': {
          const key = action.key;
          wc.sendInputEvent({ type: 'keyDown', keyCode: key });
          await new Promise(r => setTimeout(r, 30));
          wc.sendInputEvent({ type: 'keyUp', keyCode: key });
          return { success: true, action: `pressed ${key}` };
        }
        case 'scroll': {
          const deltaY = action.direction === 'up' ? 500 : -500;
          wc.sendInputEvent({ type: 'mouseWheel', x: 400, y: 400, deltaX: 0, deltaY });
          return { success: true, action: `scrolled ${action.direction}` };
        }
        case 'navigate': {
          wc.loadURL(action.url);
          return { success: true, action: `navigating to ${action.url}` };
        }
        case 'goBack': {
          if (wc.canGoBack()) wc.goBack();
          return { success: true, action: 'went back' };
        }
        case 'executeJS': {
          const result = await wc.executeJavaScript(action.code);
          return { success: true, result: String(result).substring(0, 500) };
        }
        default:
          return { error: `Unknown action type: ${action.type}` };
      }
    } catch (err) {
      return { error: err.message };
    }
  });

  // AI Agent: Get page info
  ipcMain.handle('ai:getPageInfo', async (e) => {
    try {
      const allWC = require('electron').webContents.getAllWebContents();
      const webviews = allWC.filter(wc => wc.getType() === 'webview' && !wc.isDestroyed());
      if (!webviews.length) return { error: 'No active webview' };

      const wc = webviews[0];
      const url = wc.getURL();
      const title = wc.getTitle();
      const text = await wc.executeJavaScript(`
      (function() {
        const sel = window.getSelection()?.toString();
        if (sel && sel.length > 10) return sel.substring(0, 10000);
        return document.body?.innerText?.replace(/\\s+/g, ' ').substring(0, 10000) || '';
      })()
    `);
      return { url, title, text };
    } catch (err) {
      return { error: err.message };
    }

  });

  // AI Agent: Enhanced screenshot with dimensions
  ipcMain.handle('ai:captureWithInfo', async (e) => {
    try {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (!w) return { error: 'No window' };

      const allWC = require('electron').webContents.getAllWebContents();
      const webviews = allWC.filter(wc => wc.getType() === 'webview' && !wc.isDestroyed());

      for (const wc of webviews) {
        try {
          const image = await wc.capturePage();
          const size = image.getSize();
          const base64 = image.toJPEG(60).toString('base64');
          if (base64.length > 100) {
            return {
              base64,
              width: size.width,
              height: size.height,
              url: wc.getURL(),
              title: wc.getTitle(),
              mimeType: 'image/jpeg',
            };
          }
        } catch (e) { /* skip */ }
      }

      const image = await w.webContents.capturePage();
      const size = image.getSize();
      return {
        base64: image.toJPEG(60).toString('base64'),
        width: size.width,
        height: size.height,
        url: 'browser-ui',
        title: 'Olewser',
        mimeType: 'image/jpeg',
      };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ============================================================
  // AI AGENT - Chat, TTS, Voice
  // ============================================================

  const MAUZER_SYSTEM_PROMPT = `You are OleksandrAi, the built-in AI assistant in the Olewser browser, created by OleksandrCorp.

Identity rules:
- If the user asks who you are, your name, or who created you, answer clearly:
  "My name is OleksandrAi. I was created by OleksandrCorp."
- Do not claim any other name or creator.

Behavior rules:
- Reply in the same language as the user (SK, UK, RU, EN).
- Default to Slovak if language is unclear.
- Be polite, clear, and concise.
- Do not use profanity, insults, or aggressive slang.
- Do not narrate internal tool usage.

Browser-action rules:
- If an action is needed (open site, search, click, type, scroll, back/forward), execute the action and then report the result.
- Do not invent URLs; use search when exact URL is unknown.`;

  function httpsPost(hostname, path, headers, body) {
    return new Promise((resolve, reject) => {
      const bodyBuf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      const req = https.request(
        { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length, ...headers } },
        (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
            catch (e) { resolve({ status: res.statusCode, data }); }
          });
        }
      );
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });
  }

  // ai:chat - Sends messages to AI using the MAUZER persona
  ipcMain.handle('ai:chat', async (_, messages) => {
    try {
      const settings = loadSettings();
      const openaiKey = settings.aiApiKey || process.env.OPENAI_API_KEY || '';
      const geminiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
      const pollinationsKey = process.env.POLLINATIONS_API_KEY || '';

      // Build message array with MAUZER system prompt
      const apiMessages = [
        { role: 'system', content: MAUZER_SYSTEM_PROMPT },
        ...(messages || [])
      ];

      // Try Pollinations first (free, no key required)
      try {
        const result = await httpsPost(
          'gen.pollinations.ai',
          '/v1/chat/completions',
          { 'Authorization': `Bearer ${pollinationsKey}` },
          { model: 'openai', messages: apiMessages, stream: false }
        );
        if (result.status === 200 && result.data?.choices?.[0]?.message?.content) {
          return { text: result.data.choices[0].message.content, tool_calls: [] };
        }
      } catch (e) { /* fall through */ }

      // Fallback: OpenAI if key is configured
      if (openaiKey) {
        const result = await httpsPost(
          'api.openai.com',
          '/v1/chat/completions',
          { 'Authorization': `Bearer ${openaiKey}` },
          { model: 'gpt-4o', messages: apiMessages, max_tokens: 512, temperature: 0.8 }
        );
        if (result.status === 200 && result.data?.choices?.[0]?.message?.content) {
          return { text: result.data.choices[0].message.content, tool_calls: [] };
        }
        return { text: result.data?.error?.message || 'OpenAI error', tool_calls: [] };
      }

      // Fallback: Gemini if key is configured
      if (geminiKey) {
        const prompt = apiMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
        const result = await httpsPost(
          'generativelanguage.googleapis.com',
          `/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {},
          { contents: [{ parts: [{ text: prompt }] }] }
        );
        const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { text, tool_calls: [] };
      }

      return { text: 'No API key configured. Add one in Settings.', tool_calls: [] };
    } catch (err) {
      console.error('[AI:CHAT ERROR]', err.message);
      return { text: `Error: ${err.message}`, tool_calls: [] };
    }
  });

  // ai:speak - Text-to-speech via msedge-tts
  ipcMain.handle('ai:speak', async (_, text) => {
    try {
      const { MsEdgeTTS, OUTPUT_FORMAT: OF } = require('msedge-tts');
      const tts = new MsEdgeTTS();
      const settings = loadSettings();
      const lang = settings.language || 'sk';

      // Pick voice based on language
      const voiceMap = {
        'ru': 'ru-RU-DmitryNeural',
        'uk': 'uk-UA-OstapNeural',
        'sk': 'sk-SK-LukasNeural',
        'en': 'en-US-AndrewNeural',
      };
      const voice = voiceMap[lang] || 'sk-SK-LukasNeural';

      await tts.setMetadata(voice, OF.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const tmpPath = path.join(app.getPath('temp'), `mauzer-tts-${Date.now()}.mp3`);

      await new Promise((resolve, reject) => {
        const readable = tts.toStream(text.substring(0, 1000));
        const chunks = [];
        readable.on('data', d => chunks.push(d));
        readable.on('end', () => {
          fs.writeFileSync(tmpPath, Buffer.concat(chunks));
          resolve();
        });
        readable.on('error', reject);
      });

      // Read and return base64
      const audioData = fs.readFileSync(tmpPath).toString('base64');
      try { fs.unlinkSync(tmpPath); } catch (e) { }
      return { audio: audioData, format: 'mp3' };
    } catch (err) {
      console.error('[AI:SPEAK ERROR]', err.message);
      return { error: err.message };
    }
  });

  // ai:voiceChat - STT + AI chat + TTS pipeline
  ipcMain.handle('ai:voiceChat', async (_, audioBase64, messages, isAgent) => {
    try {
      const settings = loadSettings();
      const openaiKey = settings.aiApiKey || process.env.OPENAI_API_KEY || '';

      // STT via OpenAI Whisper
      let transcript = '';
      if (openaiKey && audioBase64) {
        // Convert base64 audio to buffer and send to Whisper
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        // Use form-data approach via https
        const boundary = '----OlewserBoundary' + Date.now();
        const formParts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1`,
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`,
        ];
        const bodyStart = Buffer.from(formParts.join('\r\n') + '\r\n');
        const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
        const fullBody = Buffer.concat([bodyStart, audioBuffer, bodyEnd]);

        const sttResult = await new Promise((resolve) => {
          const req = https.request({
            hostname: 'api.openai.com',
            path: '/v1/audio/transcriptions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiKey}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': fullBody.length,
            }
          }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({}); } });
          });
          req.on('error', () => resolve({}));
          req.write(fullBody);
          req.end();
        });
        transcript = sttResult.text || '';
      }

      if (!transcript) return { error: 'Could not transcribe audio' };

      // Get AI response
      const chatMessages = [...(messages || []), { role: 'user', content: transcript }];

      // Use the ai:chat handler logic inline
      const chatResult = await ipcMain.listeners('ai:chat')[0](null, chatMessages);
      // Actually invoke directly
      const aiMessages = [{ role: 'system', content: MAUZER_SYSTEM_PROMPT }, ...chatMessages];
      const pollinationsKey = process.env.POLLINATIONS_API_KEY || '';
      let aiText = '';
      try {
        const r = await httpsPost('gen.pollinations.ai', '/v1/chat/completions',
          { 'Authorization': `Bearer ${pollinationsKey}` },
          { model: 'openai', messages: aiMessages, stream: false });
        aiText = r.data?.choices?.[0]?.message?.content || '';
      } catch (e) { }

      if (!aiText && openaiKey) {
        const r = await httpsPost('api.openai.com', '/v1/chat/completions',
          { 'Authorization': `Bearer ${openaiKey}` },
          { model: 'gpt-4o', messages: aiMessages, max_tokens: 512 });
        aiText = r.data?.choices?.[0]?.message?.content || '';
      }

      return { transcript, text: aiText || 'No response received.', tool_calls: [] };
    } catch (err) {
      console.error('[AI:VOICECHAT ERROR]', err.message);
      return { error: err.message };
    }
  });

  // ai:testKey - Test an API key
  ipcMain.handle('ai:testKey', async (_, apiKey) => {
    try {
      const result = await httpsPost(
        'api.openai.com',
        '/v1/models',
        { 'Authorization': `Bearer ${apiKey}` },
        null
      );
      // GET request workaround
      const ok = await new Promise((resolve) => {
        const req = https.request({
          hostname: 'api.openai.com',
          path: '/v1/models',
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` }
        }, (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve(res.statusCode === 200));
        });
        req.on('error', () => resolve(false));
        req.end();
      });
      return { valid: ok };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  });

  // ============================================================
  // BROWSER DATA IMPORT
  // ============================================================
  const IMPORT_MARKER = path.join(app.getPath('userData'), '.olewser-imported');

  function isFirstRun() {
    return !fs.existsSync(IMPORT_MARKER);
  }

  function getBrowserPaths() {
    const localAppData = process.env.LOCALAPPDATA || '';
    return {
      chrome: {
        base: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default'),
        bookmarks: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks'),
        history: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'History'),
      },
      yandex: {
        base: path.join(localAppData, 'Yandex', 'YandexBrowser', 'User Data', 'Default'),
        bookmarks: path.join(localAppData, 'Yandex', 'YandexBrowser', 'User Data', 'Default', 'Bookmarks'),
        history: path.join(localAppData, 'Yandex', 'YandexBrowser', 'User Data', 'Default', 'History'),
      }
    };
  }

  // Detect installed browsers
  ipcMain.handle('import:detect', async () => {
    const paths = getBrowserPaths();
    const result = {};
    for (const [id, p] of Object.entries(paths)) {
      result[id] = { exists: fs.existsSync(p.base) };
    }
    return result;
  });

  // Import bookmarks
  ipcMain.handle('import:bookmarks', async (_, browser) => {
    const paths = getBrowserPaths();
    const bp = paths[browser];
    if (!bp || !fs.existsSync(bp.bookmarks)) return { count: 0 };

    try {
      const raw = fs.readFileSync(bp.bookmarks, 'utf-8');
      const data = JSON.parse(raw);
      const bookmarks = [];

      function extractBookmarks(node) {
        if (!node) return;
        if (node.type === 'url') {
          bookmarks.push({ title: node.name || '', url: node.url || '' });
        }
        if (node.children) {
          node.children.forEach(extractBookmarks);
        }
      }

      if (data.roots) {
        Object.values(data.roots).forEach(extractBookmarks);
      }

      // Save to Olewser bookmarks
      const dataDir = DATA_DIR();
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const olewserBookmarks = path.join(dataDir, 'bookmarks.json');
      let existing = [];
      if (fs.existsSync(olewserBookmarks)) {
        try { existing = JSON.parse(fs.readFileSync(olewserBookmarks, 'utf-8')); } catch (e) { }
      }
      const merged = [...existing, ...bookmarks];
      fs.writeFileSync(olewserBookmarks, JSON.stringify(merged, null, 2));

      return { count: bookmarks.length };
    } catch (e) {
      console.error('[IMPORT] Bookmarks error:', e.message);
      return { count: 0 };
    }
  });

  // Import history
  ipcMain.handle('import:history', async (_, browser) => {
    const paths = getBrowserPaths();
    const bp = paths[browser];
    if (!bp || !fs.existsSync(bp.history)) return { count: 0 };

    try {
      // Copy history db to temp (it may be locked by the source browser)
      const tmpPath = path.join(app.getPath('temp'), `olewser-import-history-${Date.now()}.db`);
      fs.copyFileSync(bp.history, tmpPath);

      // Try to read with better-sqlite3, fallback to basic approach
      let historyItems = [];
      try {
        const Database = require('better-sqlite3');
        const db = new Database(tmpPath, { readonly: true, fileMustExist: true });
        const rows = db.prepare('SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 5000').all();
        db.close();

        historyItems = rows.map(r => ({
          url: r.url,
          title: r.title || '',
          timestamp: Math.floor(r.last_visit_time / 1000000 - 11644473600) * 1000 // Chrome timestamp to JS
        }));
      } catch (sqliteErr) {
        console.log('[IMPORT] SQLite not available, skipping history:', sqliteErr.message);
        // Clean up
        try { fs.unlinkSync(tmpPath); } catch (e) { }
        return { count: 0 };
      }

      // Clean up temp file
      try { fs.unlinkSync(tmpPath); } catch (e) { }

      // Save to Olewser history
      const dataDir = DATA_DIR();
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const olewserHistory = path.join(dataDir, 'history.json');
      let existing = [];
      if (fs.existsSync(olewserHistory)) {
        try { existing = JSON.parse(fs.readFileSync(olewserHistory, 'utf-8')); } catch (e) { }
      }
      const merged = [...historyItems, ...existing];
      fs.writeFileSync(olewserHistory, JSON.stringify(merged, null, 2));

      return { count: historyItems.length };
    } catch (e) {
      console.error('[IMPORT] History error:', e.message);
      return { count: 0 };
    }
  });

  // Mark import as done
  ipcMain.handle('import:done', async () => {
    fs.writeFileSync(IMPORT_MARKER, new Date().toISOString());
    return true;
  });

  // Close import window
  ipcMain.on('import:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
  });

  ipcMain.on('import:minimize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.minimize();
  });

  function createImportWindow() {
    return new Promise((resolve) => {
      const importWin = new BrowserWindow({
        width: 600,
        height: 480,
        frame: false,
        resizable: false,
        backgroundColor: '#0a0a0a',
        center: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: false,
          contextIsolation: true,
        },
        icon: APP_ICON_PATH,
      });

      const importIcon = nativeImage.createFromPath(APP_ICON_PATH);
      if (!importIcon.isEmpty()) importWin.setIcon(importIcon);

      importWin.loadFile(path.join(__dirname, 'src', 'import.html'));
      importWin.once('ready-to-show', () => importWin.show());
      importWin.on('closed', () => resolve());
    });
  }

  const scheduleAutoUpdateCheck = async (force = false) => {
    try {
      const status = await checkForAppUpdate({ force });
      if (status.status === UPDATE_STATUS.AVAILABLE && status.autoDownload) {
        startAppUpdateDownload().catch(() => { });
      }
    } catch (_) {
      // Silent background checker
    }
  };

  setTimeout(() => { scheduleAutoUpdateCheck(true); }, 5000);
  setInterval(() => { scheduleAutoUpdateCheck(true); }, 6 * 60 * 60 * 1000);

  // ============================================================
  app.name = 'Olewser';
  app.setAppUserModelId(APP_ID);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Security
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    if (contents.getType() !== 'webview') {
      if (!navigationUrl.startsWith('file://')) {
        event.preventDefault();
      }
    }
  });
});
