locals {
  # Derived from names, not module outputs, so backend and frontend can reference each other
  # without a dependency cycle.
  backend_url  = coalesce(var.backend_url, "https://${var.project_prefix}-backend.vercel.app")
  frontend_url = coalesce(var.frontend_url, "https://${var.project_prefix}-frontend.vercel.app")
}

module "backend" {
  source = "./modules/backend"

  name              = "${var.project_prefix}-backend"
  github_repo       = var.github_repo
  production_branch = var.production_branch
  region            = var.region

  environment = {
    NODE_ENV        = "production"
    COOKIE_SECURE   = "true"
    CORS_ORIGINS    = local.frontend_url
    FRONTEND_URL    = local.frontend_url
    BACKEND_URL     = local.backend_url
    JWT_ACCESS_TTL  = "15m"
    JWT_REFRESH_TTL = "30d"
  }

  secrets = merge(var.extra_secrets, {
    DATABASE_URL        = var.database_url
    DIRECT_URL          = var.direct_url
    JWT_ACCESS_SECRET   = var.jwt_access_secret
    JWT_REFRESH_SECRET  = var.jwt_refresh_secret
    PLATFORM_JWT_SECRET = var.platform_jwt_secret
  })
}

module "frontend" {
  source = "./modules/frontend"

  name              = "${var.project_prefix}-frontend"
  github_repo       = var.github_repo
  production_branch = var.production_branch
  region            = var.region

  # NEXT_PUBLIC_* is public by design (inlined into the browser bundle) — never put secrets here.
  environment = {
    NEXT_PUBLIC_API_URL    = local.backend_url
    NEXT_PUBLIC_STORE_NAME = var.store_name
  }
}
