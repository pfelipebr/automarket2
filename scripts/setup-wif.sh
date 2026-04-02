#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# setup-wif.sh — One-time setup: Workload Identity Federation for GitHub Actions
#
# Run this ONCE locally with a GCP account that has Owner or IAM Admin role.
# After running, add the printed values as GitHub repository secrets.
#
# Usage:
#   chmod +x scripts/setup-wif.sh
#   ./scripts/setup-wif.sh <GITHUB_ORG_OR_USER> <GITHUB_REPO>
#
# Example:
#   ./scripts/setup-wif.sh pfelipebr AutoMarket
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GITHUB_ORG="${1:?Usage: $0 <github-org> <github-repo>}"
GITHUB_REPO="${2:?Usage: $0 <github-org> <github-repo>}"

PROJECT_ID="automarket-93369"
REGION="us-central1"
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
SA_NAME="github-actions"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== AutoMarket — Workload Identity Federation Setup ==="
echo "Project : ${PROJECT_ID}"
echo "Repo    : ${GITHUB_ORG}/${GITHUB_REPO}"
echo ""

# ── 1. Enable required APIs ───────────────────────────────────────────────────
echo "[1/6] Enabling required APIs..."
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  artifactregistry.googleapis.com \
  container.googleapis.com \
  --project="${PROJECT_ID}"

echo "      Waiting 15s for API activation to propagate..."
sleep 15

# ── 2. Create Workload Identity Pool ─────────────────────────────────────────
echo "[2/6] Creating Workload Identity Pool..."
if gcloud iam workload-identity-pools describe "${POOL_NAME}" \
     --project="${PROJECT_ID}" --location="global" &>/dev/null; then
  echo "      Pool '${POOL_NAME}' already exists — skipping."
else
  gcloud iam workload-identity-pools create "${POOL_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --display-name="GitHub Actions Pool"
  echo "      Pool created."
fi

# ── 3. Create OIDC Provider ───────────────────────────────────────────────────
echo "[3/6] Creating OIDC Provider..."
if gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
     --project="${PROJECT_ID}" --location="global" \
     --workload-identity-pool="${POOL_NAME}" &>/dev/null; then
  echo "      Provider '${PROVIDER_NAME}' already exists — skipping."
else
  # Note: --attribute-condition restricts which tokens the provider accepts.
  # We use a broad org-level condition here; the real per-repo security is
  # enforced by the IAM binding in step 6 (principalSet scoped to the repo).
  gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
    --project="${PROJECT_ID}" \
    --location="global" \
    --workload-identity-pool="${POOL_NAME}" \
    --display-name="GitHub provider" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
    --attribute-condition="attribute.repository.startsWith(\"${GITHUB_ORG}/\")" \
    --issuer-uri="https://token.actions.githubusercontent.com"
  echo "      Provider created."
fi

# ── 4. Create Service Account ─────────────────────────────────────────────────
echo "[4/6] Creating Service Account..."
if gcloud iam service-accounts describe "${SA_EMAIL}" \
     --project="${PROJECT_ID}" &>/dev/null; then
  echo "      Service account '${SA_EMAIL}' already exists — skipping."
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT_ID}" \
    --display-name="GitHub Actions Deployer"
  echo "      Service account created. Waiting 10s for propagation..."
  sleep 10
fi

# Verify SA exists before proceeding
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "ERROR: Service account '${SA_EMAIL}' could not be created or found."
  echo "       Check that your account has 'roles/iam.serviceAccountAdmin' on project ${PROJECT_ID}."
  exit 1
fi
echo "      Service account verified."

# ── 5. Grant IAM roles to the Service Account ─────────────────────────────────
echo "[5/6] Granting IAM roles..."

echo "      Granting artifactregistry.writer..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --condition=None

echo "      Granting container.developer..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/container.developer" \
  --condition=None

# ── 6. Allow GitHub repo to impersonate the Service Account ──────────────────
echo "[6/6] Binding Workload Identity to Service Account..."

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_NAME}"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}"

# ── Print GitHub Secrets ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Setup complete! Add these secrets to your GitHub repository:"
echo "  Settings → Secrets and variables → Actions → New repository secret"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  WIF_PROVIDER          = ${PROVIDER_RESOURCE}"
echo "  WIF_SERVICE_ACCOUNT   = ${SA_EMAIL}"
echo "  GCP_PROJECT_ID        = ${PROJECT_ID}"
echo "  GCP_REGION            = ${REGION}"
echo "  GKE_CLUSTER_NAME      = automarket"
echo "  ARTIFACT_REGISTRY     = ${REGION}-docker.pkg.dev/${PROJECT_ID}/automarket"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Done! No service account key was created. Credentials are short-lived."
