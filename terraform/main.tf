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

resource "google_project_iam_member" "cloud_run_runner_invoker" {
  role   = "roles/run.invoker"
  member = "serviceAccount:${google_service_account.cloud_run_runner.email}"
}

resource "google_project_iam_member" "cloud_run_runner_secret_accessor" {
  role   = "roles/secretmanager.secretAccessor"
  member = "serviceAccount:${google_service_account.cloud_run_runner.email}"
  condition {
    title      = "allow_access_to_ginou-related_secrets"
    expression = "resource.name.startsWith(\"GINOU_\")"
  }
}
