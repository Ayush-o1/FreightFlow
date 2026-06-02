locals {
  name = "${var.project_name}-${var.environment}"

  public_subnets = [
    for index, cidr in var.public_subnet_cidrs : {
      name = "${local.name}-public-${index + 1}"
      cidr = cidr
      tier = "public"
    }
  ]

  private_subnets = [
    for index, cidr in var.private_subnet_cidrs : {
      name = "${local.name}-private-${index + 1}"
      cidr = cidr
      tier = "private"
    }
  ]
}
