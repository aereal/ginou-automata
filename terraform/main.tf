provider "google" {
  credentials = base64decode(var.base64encoded_google_service_account)
  project     = "ginou-automata"
  region      = "asia-northeast1"
  zone        = "asia-northeast1-a"
}

variable "base64encoded_google_service_account" {
  type        = string
  sensitive   = true
  description = "Base64-encoded Google Service Account key to run Terraform"
}

resource "google_service_account" "cloud_run_runner" {
  account_id   = "cloud-run-runner"
  display_name = "cloud-run-runner"
}
