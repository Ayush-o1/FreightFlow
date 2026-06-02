variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "backend_replicas" {
  type = number
}

variable "frontend_replicas" {
  type = number
}

variable "private_subnets" {
  type = list(object({
    name = string
    cidr = string
    tier = string
  }))
}
