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

variable "cloud_run_endpoint" {
  type = string
}

data "google_project" "current" {}

resource "google_secret_manager_secret" "ginou_login_id" {
  replication {
    automatic = true
  }
  secret_id = "GINOU_LOGIN_ID"
}

resource "google_secret_manager_secret" "ginou_login_password" {
  replication {
    automatic = true
  }
  secret_id = "GINOU_LOGIN_PASSWORD"
}

resource "google_secret_manager_secret" "ginou_yoyaku_url" {
  replication {
    automatic = true
  }
  secret_id = "GINOU_YOYAKU_URL"
}

resource "google_service_account" "cloud_run_runner" {
  account_id   = "cloud-run-runner"
  display_name = "cloud-run-runner"
}

resource "google_project_iam_member" "cloud_run_runner_invoker" {
  role   = "roles/run.invoker"
  member = "serviceAccount:${google_service_account.cloud_run_runner.email}"
}

locals {
  cloud_run_runner_access_secrets = [google_secret_manager_secret.ginou_login_id, google_secret_manager_secret.ginou_login_password, google_secret_manager_secret.ginou_yoyaku_url]
}

resource "google_project_iam_member" "cloud_run_runner_secret_accessor" {
  role   = "roles/secretmanager.secretAccessor"
  member = "serviceAccount:${google_service_account.cloud_run_runner.email}"
}

resource "google_service_account" "github_actions_runner" {
  account_id   = "github-actions-runner"
  display_name = "github-actions-runner"
}

resource "google_project_iam_member" "github_actions_runner_storage_admin" {
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.github_actions_runner.email}"
}

resource "google_project_iam_member" "github_actions_runner_run_admin" {
  role   = "roles/run.admin"
  member = "serviceAccount:${google_service_account.github_actions_runner.email}"
}

resource "google_project_iam_member" "github_actions_runner_sa_actor" {
  role   = "roles/iam.serviceAccountUser"
  member = "serviceAccount:${google_service_account.github_actions_runner.email}"
}

resource "google_service_account_key" "github_actions_runner" {
  service_account_id = google_service_account.github_actions_runner.id
}

resource "google_project_iam_member" "pubsub_sa_token_creator" {
  role   = "roles/iam.serviceAccountTokenCreator"
  member = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic" "invoker" {
  name = "invoker"
}

resource "google_pubsub_subscription" "invoker" {
  name  = "invoker-run-subscription"
  topic = google_pubsub_topic.invoker.name
  push_config {
    push_endpoint = var.cloud_run_endpoint
    oidc_token {
      service_account_email = google_service_account.cloud_run_runner.email
    }
  }
}

resource "google_cloud_scheduler_job" "invoker" {
  name      = "app_invoker"
  time_zone = "Asia/Tokyo"
  schedule  = "0 * * * *"
  pubsub_target {
    topic_name = google_pubsub_topic.invoker.id
    data = base64encode(jsonencode({
      via = "pubsub"
    }))
  }
  depends_on = [
    google_app_engine_application.default
  ]
}

resource "google_app_engine_application" "default" {
  project     = data.google_project.current.name
  location_id = "asia-northeast1"
}

data "github_repository" "app" {
  full_name = "aereal/ginou-automata"
}

resource "github_actions_secret" "google_service_account_key" {
  secret_name     = "base64_encoded_google_service_account_key"
  repository      = data.github_repository.app.name
  plaintext_value = google_service_account_key.github_actions_runner.private_key
}
