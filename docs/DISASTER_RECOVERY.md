# FreightFlow Disaster Recovery

## Targets

| Target | Value |
|---|---:|
| RPO | 15 minutes |
| RTO | 60 minutes |

## Backup

```bash
MONGODB_URI="mongodb://..." BACKUP_DIR="./backups/mongodb" ./scripts/backup/mongo-backup.sh
```

For production, schedule backups at least every 15 minutes or enable managed
continuous backups.

## Restore

```bash
MONGODB_URI="mongodb://..." \
BACKUP_ARCHIVE="./backups/mongodb/freightflow-mongodb-YYYYMMDDTHHMMSSZ.archive.gz" \
./scripts/backup/mongo-restore.sh
```

## Procedure

1. Stop write traffic by scaling backend replicas to zero or enabling ingress maintenance mode.
2. Restore MongoDB from the chosen backup.
3. Start Redis from a clean healthy instance unless an AOF snapshot is verified.
4. Scale backend replicas back up.
5. Verify `/api/ready`, `/api/metrics`, login, shipment list, queue backlog, and Socket.IO room join.
6. Review audit logs and outbox recovery logs for delayed side effects.

## Notes

Redis is treated as recoverable infrastructure. BullMQ delayed/pending jobs can
be regenerated from durable `OutboxEvent` records where shipment side effects are
involved. MongoDB remains the system of record.
