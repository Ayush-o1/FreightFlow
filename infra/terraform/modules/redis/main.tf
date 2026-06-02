locals {
  redis = {
    name        = "${var.project_name}-${var.environment}-redis"
    engine      = "redis"
    node_type   = var.node_type
    subnet_tier = "private"
    subnets     = var.private_subnets
  }
}
