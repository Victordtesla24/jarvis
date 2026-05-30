// electron-builder afterSign hook — notarize the macOS .app (SC8).
//
// When an Apple Developer ID is configured (APPLE_ID +
// APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID in the environment) the signed,
// hardened-runtime .app is submitted to Apple's notary service and stapled.
//
// Without those credentials — e.g. local or CI builds on a box with no
// Developer ID — notarization is skipped with a warning and the .app is still
// produced, running locally unsigned (per the PRD constraint). This keeps
// `npm run dist` working everywhere instead of hard-failing on missing secrets.
'use strict';

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn(
      'Skipping notarization: set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and ' +
        'APPLE_TEAM_ID to notarize. The .app will run locally unsigned.',
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  await notarize({
    appBundleId: 'com.jarvis.dashboard',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
};
