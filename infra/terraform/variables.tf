variable "project_name" {
  description = "Project name used for infrastructure naming."
  type        = string
  default     = "freightflow"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "production"
}

variable "region" {
  description = "Target cloud region for provider-specific overlays."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR range for the application network."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs for ingress/load balancers."
  type        = list(string)
  default     = ["10.40.0.0/24", "10.40.1.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs for app compute and data services."
  type        = list(string)
  default     = ["10.40.10.0/24", "10.40.11.0/24"]
}

variable "backend_replicas" {
  description = "Desired backend replica count."
  type        = number
  default     = 2
}

variable "frontend_replicas" {
  description = "Desired frontend replica count."
  type        = number
  default     = 2
}

variable "mongodb_storage_gb" {
  description = "MongoDB storage allocation."
  type        = number
  default     = 50
}

variable "redis_node_type" {
  description = "Logical Redis capacity tier."
  type        = string
  default     = "small"
}
