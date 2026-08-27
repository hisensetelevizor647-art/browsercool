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
- `scripts/generate-logo-assets.ps1` -> rebuild app/logo assets from a single brand mark
- `scripts/build-update-manifest.mjs` -> generate cross-platform update manifest with macOS targets
- `scripts/notarize.js` -> Apple notarization step (runs only when Apple credentials are provided)

## Brand icon source (single logo for all platforms)
- Canonical brand mark: `Source/Olewser LOGO/brand-mark-source.png`
- Generated app icon targets:
  - `Source/Olewser LOGO/main-1024.png`
  - `Source/Olewser LOGO/main.png`
  - `Source/Olewser LOGO/main.icns`
  - `Source/Olewser LOGO/main.ico`
- Generated in-app logos:
  - `Source/Olewser LOGO/7.png`
  - `Source/Olewser LOGO/20.png`

To regenerate from the current brand source:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File Source/macos-package/scripts/generate-logo-assets.ps1
```

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

## GitHub Actions security behavior
- Workflow: `.github/workflows/build-macos.yml`
- For trusted macOS installs (no Gatekeeper warnings), provide these repository secrets:
  - `CSC_LINK`
  - `CSC_KEY_PASSWORD`
  - `APPLE_API_KEY`
  - `APPLE_API_KEY_ID`
  - `APPLE_API_ISSUER`
  - optional `APPLE_TEAM_ID`
- If secrets are missing, workflow creates an unsigned fallback build and warns that macOS security prompts can appear.

## Apple icon + visual compliance notes
- Use a square **1024x1024** source PNG for app icon generation.
- Build final icon as `.icns` (required for macOS app bundles).
- Keep clean silhouette and sufficient contrast for light/dark backgrounds.
- Liquid-glass style in app UI is enabled only on macOS runtime (`platform === darwin`).
- Finder integration is handled by system open/reveal flows for downloaded updates and app folder access.
- Default browser flow tries direct registration first, then opens macOS system settings for confirmation.

## Update manifest format (for siteolewser)
Use platform-specific downloads so mac users get mac packages:

```json
{
  "version": "1.0.8",
  "downloads": {
    "win32": "updatesetup.exe",
    "darwin": {
      "arm64": "Olewser-macos-1.0.8-arm64.dmg",
      "x64": "Olewser-macos-1.0.8-x64.dmg"
    }
  }
}
```

`build-macos.yml` also generates this file automatically as `Source/dist-macos/app-update.json` and uploads it as a CI artifact.

## Official references
- Apple Human Interface Guidelines (App Icons): https://developer.apple.com/design/human-interface-guidelines/app-icons
- Electron BrowserWindow vibrancy: https://www.electronjs.org/docs/latest/api/browser-window
- electron-builder mac configuration: https://www.electron.build/mac

