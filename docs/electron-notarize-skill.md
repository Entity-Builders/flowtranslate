# Electron macOS Notarization Skill

This document explains how the macOS notarization process is set up for this project using `electron-builder` and `@electron/notarize`.

## Overview

macOS apps distributed outside the App Store must be **notarized** by Apple to run on user machines without security warnings. This process involves:

1.  **Signing**: Standard code signing with a Developer ID Certificate.
2.  **Notarizing**: Uploading the signed app to Apple for automated malware scanning.
3.  **Stapling**: Attaching the notarization ticket to the app.

## Prerequisites

- **Apple Developer Account** (Enrollment required ~$99/year).
- **Certificates**: "Developer ID Application" certificate installed in Keychain.
- **App-Specific Password**: Generated at appleid.apple.com for CI/CD usage.

## Configuration Files

### 1. `package.json`

The build configuration must include the `afterSign` hook and correct IDs.

```json
"build": {
  "appId": "com.your-domain.app-name",
  "mac": {
    "identity": "YOUR_DEVELOPER_ID_HASH", // Optional if only one cert exists
    "hardenedRuntime": true, // REQUIRED for notarization
    "gatekeeperAssess": false,
    "entitlements": "release/entitlements.mac.plist",
    "entitlementsInherit": "release/entitlements.mac.plist"
  },
  "afterSign": "scripts/notarize.js"
}
```

### 2. `scripts/notarize.js`

This script runs automatically after signing.

```javascript
import { notarize } from '@electron/notarize';
import path from 'path';
import process from 'process'; // Essential for ESM

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;

  // Verify credentials exist
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('Skipping notarization: Credentials missing');
    return;
  }

  return await notarize({
    appPath: path.resolve(appOutDir, `${appName}.app`),
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
}
```

### 3. Environment Variables (`.env`)

These must be present in the build environment (local or CI/CD).

```bash
APPLE_ID=your-email@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

## Troubleshooting

- **`process is not defined`**: Ensure `import process from 'process'` is present in `notarize.js`.
- **Notarization Failed**: Check the log output for the specific Apple error UUID.
- **"Unidentified Developer"**: Verify `hardenedRuntime` is `true` and entitlements are correct.
