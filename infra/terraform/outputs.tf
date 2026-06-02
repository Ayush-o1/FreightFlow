output "network_plan" {
  description = "Logical network foundation for provider-specific implementation."
  value       = module.network.plan
}

output "compute_plan" {
  description = "Logical compute foundation for backend/frontend workloads."
  value       = module.compute.plan
}

output "database_plan" {
  description = "Logical MongoDB foundation."
  value       = module.database.plan
}

output "redis_plan" {
  description = "Logical Redis foundation."
  value       = module.redis.plan
}
