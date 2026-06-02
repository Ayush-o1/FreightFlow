locals {
  workload_namespace = "${var.project_name}-${var.environment}"

  backend = {
    name     = "freightflow-backend"
    replicas = var.backend_replicas
    port     = 5001
    subnets  = var.private_subnets
  }

  frontend = {
    name     = "freightflow-frontend"
    replicas = var.frontend_replicas
    port     = 8080
    subnets  = var.private_subnets
  }
}
