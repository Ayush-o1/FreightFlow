# FreightFlow Baseline Performance Report

Baseline target for Phase 7 validation:

| Scenario | Target p95 | Failure Rate |
|---|---:|---:|
| Auth | < 750 ms | < 5% |
| Shipments | < 1000 ms | < 5% |
| Admin dashboard | < 1000 ms | < 5% |
| Socket ingress | < 1000 ms | < 10% |

Record each production baseline run with:

- Date and commit SHA
- Environment and replica counts
- MongoDB and Redis tier
- k6 command and options
- p50, p95, p99 latency
- failure rate
- observed bottlenecks and follow-up action
