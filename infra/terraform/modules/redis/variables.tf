variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "private_subnets" {
  type = list(object({
    name = string
    cidr = string
    tier = string
  }))
}

variable "node_type" {
  type = string
}
