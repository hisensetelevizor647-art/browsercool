# macOS Package Workspace

This folder contains everything needed to build and maintain the **macOS-specific Olewser release**.

## Separate macOS identity
- Bundle ID: `com.olewser.browser.macos`
- Build output folder: `Source/dist-macos/`
- Default artifact names: `Olewser-macos-${version}-arm64.dmg` and `Olewser-macos-${version}-x64.dmg`

## What this folder controls
- `electron-builder.mac.yml` -> dedicated macOS build config
- `entitlements.mac.plist` and `entitlements.mac.inherit.plist` -> signing/runtime permissions
- `scripts/make-icns.sh` -> generate `main.icns` from a 1024x1024 PNG
- `scripts/build-update-manifest.mjs` -> generate cross-platform update manifest with macOS targets
- `scripts/notarize.js` -> Apple notarization step (runs only when Apple credentials are provided)

## Build command
Run from `Source/`:

```bash
npm run build:macos
```

## Notarization (recommended for Gatekeeper trust)
Set one of these credential sets before build:

1. API key mode:
`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` (optionally `APPLE_TEAM_ID`)
2. Apple ID mode:
`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

If credentials are missing, build still works but notarization is skipped.

## Apple icon + visual compliance notes
- Use a square **1024x1024** source PNG for app icon generation.
- Build final icon as `.icns` (required for macOS app bundles).
- Keep clean silhouette and sufficient contrast for light/dark backgrounds.
- Liquid-glass style in app UI is enabled only on macOS runtime (`platform === darwin`).
- Finder integration is handled by system open/reveal flows for downloaded updates and app folder access.
- Default browser flow tries direct registration first, then opens macOS system settings for confirmation.

## Update manifest format (for siteolewer)
Use platform-specific downloads so mac users get mac packages:

```json
{
  "version": "1.0.7",
  "downloads": {
    "win32": "Olewser-Setup-1.0.7.exe",
    "darwin": {
      "arm64": "Olewser-macos-1.0.7-arm64.dmg",
      "x64": "Olewser-macos-1.0.7-x64.dmg"
    }
  }
}
```

## Official references
- Apple Human Interface Guidelines (App Icons): https://developer.apple.com/design/human-interface-guidelines/app-icons
- Electron BrowserWindow vibrancy: https://www.electronjs.org/docs/latest/api/browser-window
- electron-builder mac configuration: https://www.electron.build/mac

