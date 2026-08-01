#!/usr/bin/env bash
set -euo pipefail

# Derive version from wails.json without requiring jq
V=$(sed -nE 's/.*"productVersion"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' wails.json | head -n1)
if [[ -z "${V}" ]]; then
    echo "Failed to detect productVersion from wails.json" >&2
    exit 1
fi

OUTDIR="build/bin"
EXE="${OUTDIR}/refleks.exe"
FFMPEG="${OUTDIR}/ffmpeg.exe"

# Check required tools
command -v zip >/dev/null 2>&1 || { echo "ERROR: 'zip' is required but not installed." >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "ERROR: 'sha256sum' is required but not installed." >&2; exit 1; }

# Build binary if missing (standalone convenience)
if [[ ! -f "${EXE}" ]]; then
    echo "Building binary..."
    wails build -trimpath -webview2 embed -ldflags "-s -w" -platform windows/amd64
fi

# Ensure ffmpeg is available for bundling (downloads if not present)
if [[ ! -f "${FFMPEG}" ]]; then
    echo "ffmpeg.exe not found, running ensure_ffmpeg.sh..."
    bash scripts/ensure_ffmpeg.sh
fi

STAGE="${OUTDIR}/.portable"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"

# Always clean up the staging directory on exit (success or failure)
trap 'rm -rf "${STAGE}"' EXIT

cp "${EXE}" "${STAGE}/refleks.exe"
[[ -f "${FFMPEG}" ]] && cp "${FFMPEG}" "${STAGE}/ffmpeg.exe"
[[ -f LICENSE ]] && cp LICENSE "${STAGE}/"

# README for the portable build
cat > "${STAGE}/README-portable.txt" << 'EOF'
RefleK's (portable build)

This ZIP contains the Windows portable build. Extract anywhere and run refleks.exe.

Notes:
- If Microsoft WebView2 Runtime is not installed, please install it for the UI to work:
    https://developer.microsoft.com/en-us/microsoft-edge/webview2/
- Portable builds do not create Start menu entries or handle uninstall.
- For most users, the Installer is recommended.

License: see LICENSE in this archive.
EOF

# Normalize timestamps for reproducible builds
TIMESTAMP="202001010000"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git log -1 --format=%H >/dev/null 2>&1; then
    TIMESTAMP=$(git log -1 --format=%cd --date=format:%Y%m%d%H%M 2>/dev/null)
fi
find "${STAGE}" -exec touch -t "${TIMESTAMP}" {} + 2>/dev/null || true

# Zip portable package (fast compression to avoid timeout on large ffmpeg binary)
ZIP="$(pwd)/${OUTDIR}/refleks-${V}-windows-amd64-portable.zip"
(
    cd "${STAGE}" && zip -1 -r -X "${ZIP}" . >/dev/null
)

if [[ -f "${ZIP}" ]]; then
    echo "Created ${ZIP}"
else
    echo "Failed to create ${ZIP}" >&2
    exit 1
fi

# Checksums
INST="${OUTDIR}/refleks-${V}-windows-amd64-installer.exe"
SUMS="${OUTDIR}/refleks-${V}-checksums.txt"
rm -f "${SUMS}"
[[ -f "${INST}" ]] && sha256sum "${INST}" >> "${SUMS}"
sha256sum "${ZIP}" >> "${SUMS}"
echo "Wrote checksums to ${SUMS}"
