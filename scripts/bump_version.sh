#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 [<semver>]" >&2; exit 1; }

V="${1:-}"

# If no version argument, prompt interactively
if [[ -z "${V}" ]]; then
  echo "Current version: $(grep -oP 'AppVersion\s*=\s*"\K[^"]+' internal/constants/version.go)"
  read -r -p "Enter new semantic version (x.y.z): " V
fi

if [[ -z "${V}" ]]; then
  echo "Version unchanged (current: $(grep -oP 'AppVersion\s*=\s*"\K[^"]+' internal/constants/version.go))"
  exit 0
fi

if ! [[ "${V}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Invalid version: ${V} (expected MAJOR.MINOR.PATCH)" >&2
  exit 1
fi

# Update Go constant
sed -i -E "s/(AppVersion[[:space:]]*=[[:space:]]*\")([^\"]+)(\")/\1${V}\3/" internal/constants/version.go

# Update Wails productVersion
sed -i -E "s/(\"productVersion\"[[:space:]]*:[[:space:]]*\")([^\"]+)(\")/\1${V}\3/" wails.json

echo "Bumped to ${V}"
