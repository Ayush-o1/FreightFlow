# FreightFlow Deployment

## Docker

```bash
docker build -t freightflow/backend:local .
docker build -t freightflow/frontend:local ./client
docker compose up --build
```

The frontend container serves the Vite production build with Nginx on port
`8080` and proxies `/api` and `/socket.io` to the backend.

## Production Compose

```bash
BACKEND_IMAGE=ghcr.io/ayush-o1/freightflow-backend:<sha> \
FRONTEND_IMAGE=ghcr.io/ayush-o1/freightflow-frontend:<sha> \
MONGODB_URI="mongodb://..." \
REDIS_URL="redis://redis:6379" \
JWT_SECRET="..." \
JWT_REFRESH_SECRET="..." \
CLIENT_URL="https://freightflow.example.com" \
docker compose -f docker-compose.prod.yml up -d
```

## Kubernetes

1. Replace values in `k8s/secrets.template.yaml`.
2. Update image tags in `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml`.
3. Update host/TLS values in `k8s/ingress.yaml`.
4. Validate and apply:

```bash
kubectl kustomize k8s > /tmp/freightflow-k8s.yaml
kubectl apply -k k8s
```

## Terraform

```bash
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

The base Terraform module is provider-neutral. Use
`infra/terraform/environments/aws/aws.example.tfvars` as the AWS starting point
for VPC, EKS/ECS, MongoDB Atlas or tested DocumentDB, ElastiCache Redis, ingress,
TLS, and observability services.
