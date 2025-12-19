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

# Ensure binary exists
if [[ ! -f "${EXE}" ]]; then
	echo "Building portable binary..."
	wails build -trimpath -webview2 embed -ldflags "-s -w" -platform windows/amd64
fi

STAGE="build/portable"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"

# Always clean up the staging directory on exit (success or failure)
trap 'rm -rf "${STAGE}"' EXIT

cp "${EXE}" "${STAGE}/refleks.exe"
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

# Normalize timestamps for reproducibility
# We set the file dates to the last git commit time (or a fixed date if not in git).
# This ensures that the zip file checksum remains the same regardless of when the build runs,
# as long as the source code (commit) hasn't changed.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    TIMESTAMP=$(git log -1 --format=%cd --date=format:%Y%m%d%H%M)
else
    TIMESTAMP="202001010000"
fi
find "${STAGE}" -exec touch -t "${TIMESTAMP}" {} +

# Zip portable package
mkdir -p "${OUTDIR}"
(
	cd "${STAGE}" && zip -9 -r -X ../bin/refleks-"${V}"-windows-amd64-portable.zip . >/dev/null
)

ZIP="${OUTDIR}/refleks-${V}-windows-amd64-portable.zip"
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
if [[ -f "${INST}" ]]; then
	sha256sum "${INST}" >> "${SUMS}"
fi
sha256sum "${ZIP}" >> "${SUMS}"
echo "Wrote checksums to ${SUMS}"
