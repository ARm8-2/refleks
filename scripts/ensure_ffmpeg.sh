#!/usr/bin/env bash
# Downloads a static FFmpeg binary for Windows and places it where the build
# pipeline expects it (portable & NSIS installer).
set -euo pipefail

FFMPEG_URL="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"

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

TEMP_ZIP="$(mktemp)"
${DOWNLOADER} "${TEMP_ZIP}" "${FFMPEG_URL}"

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
echo "To update to a newer version, run this script again."
