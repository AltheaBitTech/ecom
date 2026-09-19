variable "name" {
  description = "Vercel project name."
  type        = string
}

variable "github_repo" {
  type = string
}

variable "production_branch" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  description = "Non-secret env vars (readable in the Vercel dashboard)."
  type        = map(string)
  default     = {}
}
