#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups/mongodb}"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
ARCHIVE_PATH="${BACKUP_DIR}/freightflow-mongodb-${TIMESTAMP}.archive.gz"

if [ -z "${MONGODB_URI:-}" ]; then
  echo "MONGODB_URI is required." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

mongodump \
  --uri="${MONGODB_URI}" \
  --archive="${ARCHIVE_PATH}" \
  --gzip

echo "MongoDB backup written to ${ARCHIVE_PATH}"
