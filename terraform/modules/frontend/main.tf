# Next.js storefront/admin. Vercel detects pnpm from frontend/package.json's packageManager.
resource "vercel_project" "this" {
  name                       = var.name
  framework                  = "nextjs"
  root_directory             = "frontend"
  serverless_function_region = var.region

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }
}

resource "vercel_project_environment_variables" "this" {
  project_id = vercel_project.this.id

  variables = [
    for k, v in var.environment : { key = k, value = v, target = ["production", "preview"], sensitive = false }
  ]
}
