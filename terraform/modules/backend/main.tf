# NestJS API. backend/vercel.json routes every request to api/index.ts (@vercel/node), and
# backend's `postinstall` runs `prisma generate`, so no build/install overrides are needed.
resource "vercel_project" "this" {
  name                       = var.name
  root_directory             = "backend"
  serverless_function_region = var.region

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = var.production_branch
  }
}

resource "vercel_project_environment_variables" "this" {
  project_id = vercel_project.this.id

  variables = concat(
    [for k, v in var.environment : { key = k, value = v, target = ["production", "preview"], sensitive = false }],
    [for k, v in var.secrets : { key = k, value = v, target = ["production", "preview"], sensitive = true }],
  )
}
