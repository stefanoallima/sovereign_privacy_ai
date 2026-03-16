# macOS Code Signing & Notarization

Without code signing, macOS Gatekeeper blocks the app with "App is damaged and can't be opened"
because downloaded `.dmg` files carry a quarantine attribute that requires a trusted signature.

## What you need

- An Apple Developer Program membership ($99/year) at [developer.apple.com](https://developer.apple.com)
- A **Developer ID Application** certificate (not App Store — Sovereign AI is distributed outside the Mac App Store)

## One-time setup

### 1. Export the certificate as a .p12 file

In **Keychain Access** on your Mac:

1. Expand **My Certificates** → find *Developer ID Application: Your Name (TEAMID)*
2. Right-click → **Export** → choose `.p12` format → set a strong password
3. Base64-encode it for use in GitHub Secrets:
   ```bash
   base64 -i certificate.p12 | pbcopy   # copies to clipboard
   ```

### 2. Create an app-specific password for notarization

1. Sign in at [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security** → **App-Specific Passwords**
2. Generate a password labelled e.g. `sovereign-ai-notarize`

### 3. Add secrets to the GitHub repository

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` file (from step 1) |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Full identity string, e.g. `Developer ID Application: Jane Smith (AB12CD34EF)` |
| `APPLE_ID` | Your Apple ID email, e.g. `jane@example.com` |
| `APPLE_PASSWORD` | App-specific password from step 2 |
| `APPLE_TEAM_ID` | 10-character team ID, e.g. `AB12CD34EF` |

### 4. Push a tag — the workflow does the rest

`tauri-apps/tauri-action` automatically:
1. Imports the certificate into a temporary keychain
2. Signs the `.app` bundle with Hardened Runtime + the entitlements in `entitlements.plist`
3. Submits to Apple's notarization service and staples the ticket to the `.dmg`

## Testing locally (without paid membership)

You can bypass Gatekeeper **on your own machine only** with:

```bash
xattr -cr /Applications/Sovereign\ AI.app
```

This removes the quarantine attribute. It does not help end-users who download the release.

## What's configured in the repo

| File | Purpose |
|---|---|
| `apps/desktop/src-tauri/entitlements.plist` | Hardened Runtime entitlements (network client, no JIT) |
| `apps/desktop/src-tauri/tauri.macos.conf.json` | Tells Tauri to use the entitlements + enable Hardened Runtime |
| `.github/workflows/release.yml` | Passes signing secrets to `tauri-action`; picks correct ORT arch per target |
