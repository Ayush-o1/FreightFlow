output "private_subnets" {
  value = local.private_subnets
}

output "plan" {
  value = {
    name            = local.name
    region          = var.region
    vpc_cidr        = var.vpc_cidr
    public_subnets  = local.public_subnets
    private_subnets = local.private_subnets
  }
}
