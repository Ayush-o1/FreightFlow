#!/usr/bin/env sh
set -eu

if [ -z "${MONGODB_URI:-}" ]; then
  echo "MONGODB_URI is required." >&2
  exit 1
fi

if [ -z "${BACKUP_ARCHIVE:-}" ]; then
  echo "BACKUP_ARCHIVE is required." >&2
  exit 1
fi

if [ ! -f "${BACKUP_ARCHIVE}" ]; then
  echo "Backup archive not found: ${BACKUP_ARCHIVE}" >&2
  exit 1
fi

mongorestore \
  --uri="${MONGODB_URI}" \
  --archive="${BACKUP_ARCHIVE}" \
  --gzip \
  --drop

echo "MongoDB restore completed from ${BACKUP_ARCHIVE}"
