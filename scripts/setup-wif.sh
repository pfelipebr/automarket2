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
  --project="${PROJECT_ID}" --quiet

# ── 2. Create Workload Identity Pool ─────────────────────────────────────────
echo "[2/6] Creating Workload Identity Pool..."
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool" \
  --quiet 2>/dev/null || echo "  Pool already exists — skipping."

# ── 3. Create OIDC Provider ───────────────────────────────────────────────────
echo "[3/6] Creating OIDC Provider..."
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --quiet 2>/dev/null || echo "  Provider already exists — skipping."

# ── 4. Create Service Account ─────────────────────────────────────────────────
echo "[4/6] Creating Service Account..."
gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Deployer" \
  --quiet 2>/dev/null || echo "  Service account already exists — skipping."

# ── 5. Grant IAM roles to the Service Account ─────────────────────────────────
echo "[5/6] Granting IAM roles..."

# Push images to Artifact Registry
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --quiet

# Get GKE credentials + deploy (kubectl set image / rollout)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/container.developer" \
  --quiet

# ── 6. Allow GitHub repo to impersonate the Service Account ──────────────────
echo "[6/6] Binding Workload Identity to Service Account..."

PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
POOL_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}"
PROVIDER_RESOURCE="${POOL_RESOURCE}/providers/${PROVIDER_NAME}"

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --quiet

# ── Print GitHub Secrets ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Add the following secrets to your GitHub repository:"
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
