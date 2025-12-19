#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 <semver>" >&2; exit 1; }

V=${1:-}
if [[ -z "${V}" ]]; then usage; fi

if ! [[ "${V}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: ${V} (expected MAJOR.MINOR.PATCH)" >&2
  exit 1
fi

# Update Go constant
sed -i -E "s/(AppVersion[[:space:]]*=[[:space:]]*\")([^\"]+)(\")/\1${V}\3/" internal/constants/version.go

# Update Wails productVersion
sed -i -E "s/(\"productVersion\"[[:space:]]*:[[:space:]]*\")([^\"]+)(\")/\1${V}\3/" wails.json

echo "Bumped to ${V}"
