# Auth: export VERCEL_API_TOKEN (never put the token in a .tf/.tfvars file).
provider "vercel" {
  team = var.vercel_team
}
