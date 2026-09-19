output "backend" {
  value = {
    project_id = module.backend.project_id
    url        = local.backend_url
  }
}

output "frontend" {
  value = {
    project_id = module.frontend.project_id
    url        = local.frontend_url
  }
}
