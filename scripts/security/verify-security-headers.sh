#!/usr/bin/env sh
set -eu

TARGET_URL="${TARGET_URL:-http://localhost:5001/api/live}"
REQUIRED_HEADERS="
X-DNS-Prefetch-Control
X-Frame-Options
X-Content-Type-Options
Referrer-Policy
Content-Security-Policy
"

headers="$(mktemp)"
trap 'rm -f "${headers}"' EXIT

curl -fsS -D "${headers}" -o /dev/null "${TARGET_URL}"

missing=0
for header in ${REQUIRED_HEADERS}; do
  if ! grep -qi "^${header}:" "${headers}"; then
    echo "Missing security header: ${header}" >&2
    missing=1
  fi
done

if [ "${missing}" -ne 0 ]; then
  exit 1
fi

echo "Security headers verified for ${TARGET_URL}"
