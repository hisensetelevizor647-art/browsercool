'use strict';

const fs = require('fs');
const path = require('path');

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir, packager } = context || {};
  if (electronPlatformName !== 'darwin') return;

  const productFilename = packager && packager.appInfo ? packager.appInfo.productFilename : 'Olewser';
  const appBundleId = packager && packager.appInfo && packager.appInfo.id
    ? packager.appInfo.id
    : (process.env.APP_BUNDLE_ID || 'com.olewser.browser.macos');
  const appPath = path.join(appOutDir, `${productFilename}.app`);

  if (!fs.existsSync(appPath)) {
    console.log(`[notarize] App not found at ${appPath}, skip.`);
    return;
  }

  let notarize;
  try {
    ({ notarize } = require('@electron/notarize'));
  } catch (_) {
    console.log('[notarize] @electron/notarize is not installed, skip.');
    return;
  }

  const useApiKey = !!(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);
  const useAppleId = !!(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID);

  if (!useApiKey && !useAppleId) {
    console.log('[notarize] Apple credentials are missing, skip notarization.');
    return;
  }

  console.log(`[notarize] Notarizing ${appPath}`);

  if (useApiKey) {
    await notarize({
      appPath,
      appBundleId,
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
      teamId: process.env.APPLE_TEAM_ID || undefined,
    });
    return;
  }

  await notarize({
    appPath,
    appBundleId,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
