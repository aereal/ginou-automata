terraform {
  required_providers {
    google = {
      source = "hashicorp/google"
    }
    github = {
      source = "integrations/github"
    }
  }
}

provider "google" {
  credentials = base64decode(var.base64encoded_google_service_account)
  project     = "ginou-automata"
  region      = "asia-northeast1"
  zone        = "asia-northeast1-a"
}

provider "github" {
  token = var.github_pat
}

variable "base64encoded_google_service_account" {
  type        = string
  sensitive   = true
  description = "Base64-encoded Google Service Account key to run Terraform"
}

variable "github_pat" {
  type      = string
  sensitive = true
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

resource "google_service_account" "github_actions_runner" {
  account_id   = "github-actions-runner"
  display_name = "github-actions-runner"
}

resource "google_project_iam_member" "github_actions_runner_storage_admin" {
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.github_actions_runner.email}"
}

resource "google_service_account_key" "github_actions_runner" {
  service_account_id = google_service_account.github_actions_runner.id
}

data "github_repository" "app" {
  full_name = "aereal/ginou-automata"
}

resource "github_actions_secret" "google_service_account_key" {
  secret_name     = "base64_encoded_google_service_account_key"
  repository      = data.github_repository.app.name
  plaintext_value = google_service_account_key.github_actions_runner.private_key
}
