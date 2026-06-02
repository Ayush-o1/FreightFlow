# FreightFlow MongoDB Backup And Restore

## Backup

```bash
MONGODB_URI="mongodb://..." BACKUP_DIR="./backups/mongodb" ./scripts/backup/mongo-backup.sh
```

## Restore

```bash
MONGODB_URI="mongodb://..." BACKUP_ARCHIVE="./backups/mongodb/freightflow-mongodb-YYYYMMDDTHHMMSSZ.archive.gz" ./scripts/backup/mongo-restore.sh
```

## RPO / RTO

- Target RPO: 15 minutes for production by scheduling backups at least every 15 minutes or using managed continuous backups.
- Target RTO: 60 minutes for single-region restore, assuming a warm Kubernetes/Compose environment and available backup artifact.

## Disaster Recovery Notes

1. Stop write traffic by scaling backend replicas to zero or putting ingress in maintenance mode.
2. Restore MongoDB from the selected archive.
3. Start Redis from a clean instance unless an AOF snapshot is known to be healthy.
4. Start backend replicas and verify `/api/ready`.
5. Run a smoke test for auth, shipment read, queue processing, and Socket.IO room join.
