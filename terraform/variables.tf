variable "vercel_team" {
  description = "Vercel team slug or ID. Null deploys under the token owner's personal account."
  type        = string
  default     = null
}

variable "project_prefix" {
  description = "Prefix for Vercel project names: <prefix>-backend and <prefix>-frontend."
  type        = string
  default     = "ecom"
}

variable "github_repo" {
  description = "GitHub repository (owner/name) both projects deploy from."
  type        = string
  default     = "AltheaBitTech/ecom"
}

variable "production_branch" {
  type    = string
  default = "main"
}

variable "region" {
  description = "Vercel function region. bom1 = Mumbai; pick the one closest to your database."
  type        = string
  default     = "bom1"
}

variable "backend_url" {
  description = "Public backend URL. Null uses https://<prefix>-backend.vercel.app. Set when using a custom domain."
  type        = string
  default     = null
}

variable "frontend_url" {
  description = "Public frontend URL. Null uses https://<prefix>-frontend.vercel.app. Set when using a custom domain."
  type        = string
  default     = null
}

variable "store_name" {
  description = "Value for the frontend's NEXT_PUBLIC_STORE_NAME."
  type        = string
  default     = ""
}

# --- Backend secrets (required at boot; see backend/src/common/config/env.validation.ts) ---

variable "database_url" {
  description = "Pooled DB connection string used by the running app."
  type        = string
  sensitive   = true
}

variable "direct_url" {
  description = "Direct DB connection string used only by `prisma migrate deploy`."
  type        = string
  sensitive   = true
}

variable "jwt_access_secret" {
  description = "32+ chars. openssl rand -base64 48"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret" {
  description = "32+ chars, different from jwt_access_secret."
  type        = string
  sensitive   = true
}

variable "platform_jwt_secret" {
  description = "32+ chars, for platform super-admin auth."
  type        = string
  sensitive   = true
}

variable "extra_secrets" {
  description = "Optional backend secrets, keyed by env var name (RAZORPAY_*, RESEND_*, TWILIO_*, *_CLIENT_ID/SECRET, ...)."
  type        = map(string)
  default     = {}
  sensitive   = true
}
