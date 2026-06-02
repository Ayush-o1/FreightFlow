module "network" {
  source = "./modules/network"

  project_name         = var.project_name
  environment          = var.environment
  region               = var.region
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "compute" {
  source = "./modules/compute"

  project_name      = var.project_name
  environment       = var.environment
  backend_replicas  = var.backend_replicas
  frontend_replicas = var.frontend_replicas
  private_subnets   = module.network.private_subnets
}

module "database" {
  source = "./modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnets    = module.network.private_subnets
  mongodb_storage_gb = var.mongodb_storage_gb
}

module "redis" {
  source = "./modules/redis"

  project_name    = var.project_name
  environment     = var.environment
  private_subnets = module.network.private_subnets
  node_type       = var.redis_node_type
}
