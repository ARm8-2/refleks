#!/usr/bin/env bash
# Downloads a static FFmpeg binary for Windows and places it where the build
# pipeline expects it (portable & NSIS installer).
set -euo pipefail

# Pinned build so every release (and every local rebuild) bundles the exact
# same binary, which keeps the portable ZIP checksum reproducible. BtbN keeps
# month-end autobuilds long term, unlike the rolling "latest" release.
# To update: pick a month-end autobuild release, then update both values below
# (the digest is listed on the release page or via the GitHub API).
FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-31-13-27/ffmpeg-n9.0.1-11-ge47273f4d9-win64-gpl-9.0.zip"
FFMPEG_SHA256="ec9db2cda1f5894ab95446076ad8bf49379db4b53c02e778ad3b49adf91fec83"

DEST="build/bin/ffmpeg.exe"

# Skip if already present
if [[ -f "${DEST}" ]]; then
    echo "ffmpeg.exe already installed, skipping."
    exit 0
fi

echo "Downloading FFmpeg for Windows..."
echo "  URL: ${FFMPEG_URL}"
mkdir -p "${DEST%/*}"

if command -v curl &>/dev/null; then
    DOWNLOADER="curl -L# -o"
elif command -v wget &>/dev/null; then
    DOWNLOADER="wget -q --show-progress -O"
else
    echo "ERROR: Neither curl nor wget found. Install one to download ffmpeg." >&2
    exit 1
fi

if command -v sha256sum &>/dev/null; then
    SHA256="sha256sum"
elif command -v shasum &>/dev/null; then
    SHA256="shasum -a 256"
else
    echo "ERROR: Neither sha256sum nor shasum found. Cannot verify the download." >&2
    exit 1
fi

TEMP_ZIP="$(mktemp)"
${DOWNLOADER} "${TEMP_ZIP}" "${FFMPEG_URL}"

ACTUAL_SHA256="$(${SHA256} "${TEMP_ZIP}" | cut -d' ' -f1)"
if [[ "${ACTUAL_SHA256}" != "${FFMPEG_SHA256}" ]]; then
    echo "ERROR: FFmpeg archive checksum mismatch." >&2
    echo "  expected: ${FFMPEG_SHA256}" >&2
    echo "  actual:   ${ACTUAL_SHA256}" >&2
    rm -f "${TEMP_ZIP}"
    exit 1
fi
echo "Checksum verified."

echo "Extracting ffmpeg.exe..."
TMPDIR="$(mktemp -d)"

if command -v 7z &>/dev/null; then
    7z x -y -o"${TMPDIR}" "${TEMP_ZIP}" >/dev/null 2>&1
elif command -v unzip &>/dev/null; then
    unzip -q -o "${TEMP_ZIP}" -d "${TMPDIR}"
else
    echo "ERROR: Neither 7z nor unzip found. Cannot extract the archive." >&2
    rm -f "${TEMP_ZIP}"
    rmdir "${TMPDIR}" 2>/dev/null || true
    exit 1
fi

FFMPEG_EXE=$(find "${TMPDIR}" -name "ffmpeg.exe" -type f | head -n1)
if [[ -z "${FFMPEG_EXE}" ]]; then
    echo "ERROR: ffmpeg.exe not found in the downloaded archive." >&2
    rm -rf "${TMPDIR}" "${TEMP_ZIP}"
    exit 1
fi

cp "${FFMPEG_EXE}" "${DEST}"
rm -rf "${TMPDIR}" "${TEMP_ZIP}"

echo ""
echo "ffmpeg.exe installed:"
echo "  ${DEST} ($(du -h "${DEST}" | cut -f1))"
echo ""
echo "To update to a newer version, change FFMPEG_URL and FFMPEG_SHA256, delete"
echo "${DEST} and run this script again."
