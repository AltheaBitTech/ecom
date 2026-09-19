terraform {
  required_version = ">= 1.6"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.0"
    }
  }

  # Secrets end up in state. Use a remote, encrypted backend for anything beyond a solo setup, e.g.:
  # backend "s3" { ... }
}
