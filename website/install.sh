#!/bin/bash
# Sovereign AI — macOS installer
#
#   curl -fsSL https://sovereign-ai-app.netlify.app/install.sh | bash
#
# Downloads the latest release for this Mac's chip from GitHub, verifies its
# SHA-256 against the digest GitHub publishes for the asset and checks the code
# signature, then installs it to /Applications.
#
# Why a script: the app is not notarized by Apple, so a DMG downloaded in a
# browser is quarantined and Gatekeeper blocks the first launch. Files fetched
# with curl are not quarantined, so the installed app opens directly. In-app
# updates also download outside the browser and are not affected.
set -euo pipefail

REPO="stefanoallima/sovereign_privacy_ai"
APP_NAME="Sovereign AI.app"
INSTALL_DIR="${INSTALL_DIR:-/Applications}"

say()  { printf '\033[1m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "this installer is for macOS. Windows builds: https://github.com/$REPO/releases/latest"

case "$(uname -m)" in
  arm64)  ARCH="aarch64"; LABEL="Apple Silicon" ;;
  x86_64) ARCH="x64";     LABEL="Intel" ;;
  *)      fail "unsupported CPU: $(uname -m)" ;;
esac
ASSET="Sovereign.AI_${ARCH}.app.tar.gz"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say "Looking up the latest release for $LABEL Macs"
curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" -o "$TMP/release.json" \
  || fail "could not reach GitHub"

# Parse with the JavaScript engine built into macOS (no python/jq needed).
read -r TAG URL DIGEST < <(osascript -l JavaScript - "$TMP/release.json" "$ASSET" <<'JXA'
function run(argv) {
  ObjC.import('Foundation');
  const raw = $.NSString.stringWithContentsOfFileEncodingError(argv[0], $.NSUTF8StringEncoding, null).js;
  const rel = JSON.parse(raw);
  const a = (rel.assets || []).find(x => x.name === argv[1]);
  if (!a) return "";
  return [rel.tag_name, a.browser_download_url, (a.digest || "").replace(/^sha256:/, "")].join(" ");
}
JXA
) || true
[ -n "${URL:-}" ] || fail "release asset $ASSET not found"
[ -n "${DIGEST:-}" ] || fail "GitHub did not publish a checksum for $ASSET; refusing to install unverified"

say "Downloading Sovereign AI $TAG"
curl -fL --progress-bar "$URL" -o "$TMP/$ASSET"

say "Verifying checksum"
ACTUAL="$(shasum -a 256 "$TMP/$ASSET" | awk '{print $1}')"
[ "$ACTUAL" = "$DIGEST" ] || fail "checksum mismatch (expected $DIGEST, got $ACTUAL)"

tar -xzf "$TMP/$ASSET" -C "$TMP"
[ -d "$TMP/$APP_NAME" ] || fail "archive did not contain $APP_NAME"

say "Verifying code signature"
codesign --verify --deep --strict "$TMP/$APP_NAME" 2>/dev/null || fail "code signature is invalid"

if pgrep -xq ailocalmind; then
  fail "Sovereign AI is running — quit it and run the installer again"
fi

say "Installing to $INSTALL_DIR"
SUDO=""
[ -w "$INSTALL_DIR" ] || SUDO="sudo"
$SUDO rm -rf "$INSTALL_DIR/$APP_NAME"
$SUDO ditto "$TMP/$APP_NAME" "$INSTALL_DIR/$APP_NAME"

say "Sovereign AI $TAG installed. Open it from Launchpad, or run: open -a \"Sovereign AI\""
