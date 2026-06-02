# FreightFlow Terraform Foundation

This directory is the provider-neutral Terraform foundation for Phase 7. The
root module models the infrastructure contract FreightFlow needs:

- VPC/networking
- Compute placement for backend and frontend workloads
- MongoDB database capacity placeholder
- Redis cache/queue/socket placeholder

The base module intentionally avoids hard-binding to a single cloud provider.
Provider-specific overlays can consume the same variables and outputs when AWS,
Azure, or GCP resources are selected.

## Validate

```bash
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

## AWS Deployment Path

Use `environments/aws/aws.example.tfvars` as the starting point, then map the
logical modules to:

- VPC, public/private subnets, route tables, NAT gateways, security groups
- EKS or ECS/Fargate for the backend and frontend containers
- MongoDB Atlas peering/private endpoint, or DocumentDB only after compatibility testing
- ElastiCache Redis for BullMQ, rate limits, cache, and Socket.IO adapter
- ALB or NGINX ingress with TLS from ACM
- CloudWatch logs plus Prometheus/OpenTelemetry collector integration

Keep secrets in AWS Secrets Manager or External Secrets Operator. Do not place
real JWT secrets, MongoDB credentials, or Redis credentials in `.tfvars`.
