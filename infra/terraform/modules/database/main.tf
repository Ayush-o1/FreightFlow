locals {
  mongodb = {
    name        = "${var.project_name}-${var.environment}-mongodb"
    engine      = "mongodb"
    storage_gb  = var.mongodb_storage_gb
    subnet_tier = "private"
    subnets     = var.private_subnets
  }
}
