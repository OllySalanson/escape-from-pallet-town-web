#!/usr/bin/env bash
# Playwright's Chromium wants three system libraries this box does not have, and
# nobody here has root. This unpacks them into a directory of your choosing and
# prints the path to hand to the driver:
#
#   export EPTW_CHROME_LIBS="$(tools/playtest/ensure-libs.sh "$SCRATCH/chrome-libs")"
#
# It is a no-op once the directory is filled, so it is safe to run every session.
set -euo pipefail

target="${1:?usage: ensure-libs.sh <scratch directory>}"
libs="$target/usr/lib/x86_64-linux-gnu"

if [ ! -e "$libs/libnss3.so" ]; then
  mkdir -p "$target/debs"
  (cd "$target/debs" && apt-get download libnss3 libnspr4 libasound2t64 >/dev/null)
  for deb in "$target"/debs/*.deb; do
    dpkg-deb -x "$deb" "$target"
  done
fi

echo "$libs"
