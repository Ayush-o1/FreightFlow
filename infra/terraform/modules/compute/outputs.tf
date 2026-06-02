output "plan" {
  value = {
    namespace = local.workload_namespace
    backend   = local.backend
    frontend  = local.frontend
  }
}
