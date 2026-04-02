#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  AutoMarket — Script de Deploy para kind (Kubernetes local)
#  Uso: ./deploy.sh [--skip-build] [--skip-ingress]
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Cores para output ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ️  $*${NC}"; }
success() { echo -e "${GREEN}✅ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $*${NC}"; }
error()   { echo -e "${RED}❌ $*${NC}"; exit 1; }
step()    { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

# ── Flags ──────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_INGRESS=false
for arg in "$@"; do
  case $arg in
    --skip-build)   SKIP_BUILD=true ;;
    --skip-ingress) SKIP_INGRESS=true ;;
  esac
done

# ── Verificar pré-requisitos ───────────────────────────────────────────────────
step "Verificando pré-requisitos"

command -v docker  &>/dev/null || error "docker não encontrado. Instale o Docker Desktop."
command -v kubectl &>/dev/null || error "kubectl não encontrado. Instale com: brew install kubectl"
command -v kind    &>/dev/null || warn  "kind não encontrado no PATH (ok se o cluster já existe)"

# Verificar que o kubectl consegue conectar ao cluster
kubectl cluster-info &>/dev/null || error "Kubectl não consegue conectar ao cluster. Verifique seu kubeconfig."
success "Cluster acessível"

# Pegar o nome do contexto atual
CURRENT_CONTEXT=$(kubectl config current-context)
info "Contexto atual: ${CURRENT_CONTEXT}"

# Aviso se não parecer ser um cluster kind
if [[ "$CURRENT_CONTEXT" != kind-* ]]; then
  warn "O contexto atual ('$CURRENT_CONTEXT') não parece ser um cluster kind."
  read -p "  Continuar mesmo assim? (s/N) " -r REPLY
  [[ "$REPLY" =~ ^[Ss]$ ]] || exit 0
fi

# ── Build das imagens Docker ───────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  step "Buildando imagens Docker"

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Frontend — usa placeholder se não houver package.json (código real ausente)
  if [ -f "$SCRIPT_DIR/frontend/package.json" ]; then
    info "Código React encontrado. Buildando automarket-frontend:latest..."
    docker build -t automarket-frontend:latest \
      -f "$SCRIPT_DIR/frontend/Dockerfile" "$SCRIPT_DIR/frontend/"
  else
    warn "frontend/package.json não encontrado — usando imagem placeholder"
    docker build -t automarket-frontend:latest \
      -f "$SCRIPT_DIR/frontend/Dockerfile.placeholder" "$SCRIPT_DIR/frontend/"
  fi
  success "Frontend buildado"

  # Backend — usa placeholder se não houver package.json (código real ausente)
  if [ -f "$SCRIPT_DIR/backend/package.json" ]; then
    info "Código Fastify encontrado. Buildando automarket-backend:latest..."
    docker build -t automarket-backend:latest \
      -f "$SCRIPT_DIR/backend/Dockerfile" "$SCRIPT_DIR/backend/"
  else
    warn "backend/package.json não encontrado — usando servidor placeholder"
    docker build -t automarket-backend:latest \
      -f "$SCRIPT_DIR/backend/Dockerfile.placeholder" "$SCRIPT_DIR/backend/"
  fi
  success "Backend buildado"

  # Carregar as imagens no cluster kind
  # kind não usa o Docker daemon do host — as imagens precisam ser transferidas
  KIND_CLUSTER=$(kubectl config current-context | sed 's/kind-//')
  info "Carregando imagens no cluster kind '${KIND_CLUSTER}'..."

  load_image() {
    local img=$1
    if docker image inspect "$img" &>/dev/null; then
      kind load docker-image "$img" --name "$KIND_CLUSTER" \
        && success "$img carregada no kind" \
        || error "Falha ao carregar $img no kind. Verifique se o cluster '$KIND_CLUSTER' existe com: kind get clusters"
    else
      error "Imagem $img não encontrada no Docker local. O build falhou silenciosamente."
    fi
  }

  load_image "automarket-frontend:latest"
  load_image "automarket-backend:latest"
else
  warn "Build de imagens pulado (--skip-build)"
fi

# ── Instalar NGINX Ingress Controller ─────────────────────────────────────────
INGRESS_OK=false
if [ "$SKIP_INGRESS" = false ]; then
  step "Instalando NGINX Ingress Controller (versão para kind)"

  if kubectl get deployment ingress-nginx-controller -n ingress-nginx &>/dev/null; then
    success "NGINX Ingress Controller já está instalado"
    INGRESS_OK=true
  else
    info "Aplicando manifest do Ingress Controller para kind..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/kind/deploy.yaml

    info "Aguardando Ingress Controller ficar pronto (pode levar ~90s)..."
    if kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=90s 2>/dev/null; then
      success "Ingress Controller pronto"
      INGRESS_OK=true
    else
      warn "Ingress Controller não ficou pronto a tempo."
      warn "Isso é comum em clusters kind criados sem extraPortMappings."
      warn "O deploy vai continuar — acesso via port-forward direto nos serviços."
      echo ""
      echo -e "  ${YELLOW}Status atual do pod:${NC}"
      kubectl get pods -n ingress-nginx 2>/dev/null || true
      echo ""
    fi
  fi
else
  warn "Instalação do Ingress Controller pulada (--skip-ingress)"
fi

# ── Criar Namespace ────────────────────────────────────────────────────────────
step "Criando namespace"

kubectl apply -f k8s/namespace.yaml
success "Namespace 'automarket' criado"

# ── Criar Secrets ──────────────────────────────────────────────────────────────
step "Configurando Secrets"

if kubectl get secret automarket-secrets -n automarket &>/dev/null; then
  warn "Secret 'automarket-secrets' já existe — mantendo valores atuais"
  info "  Para recriar: kubectl delete secret automarket-secrets -n automarket"
else
  # Gera senhas aleatórias automaticamente para o ambiente local
  PG_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)
  MINIO_SECRET=$(openssl rand -hex 16)

  kubectl create secret generic automarket-secrets \
    --namespace automarket \
    --from-literal=DATABASE_URL="postgresql://automarket:${PG_PASSWORD}@postgres-svc:5432/automarket" \
    --from-literal=REDIS_URL="redis://redis-svc:6379" \
    --from-literal=JWT_SECRET="${JWT_SECRET}" \
    --from-literal=POSTGRES_PASSWORD="${PG_PASSWORD}" \
    --from-literal=MINIO_ACCESS_KEY="automarket-admin" \
    --from-literal=MINIO_SECRET_KEY="${MINIO_SECRET}" \
    --from-literal=SMTP_DSN=""

  success "Secrets criados com senhas geradas automaticamente"
  echo ""
  echo -e "  ${YELLOW}Salve estas credenciais em local seguro:${NC}"
  echo "  POSTGRES_PASSWORD : ${PG_PASSWORD}"
  echo "  JWT_SECRET        : ${JWT_SECRET}"
  echo "  MINIO_ACCESS_KEY  : automarket-admin"
  echo "  MINIO_SECRET_KEY  : ${MINIO_SECRET}"
  echo ""
fi

# ── Aplicar ConfigMap ──────────────────────────────────────────────────────────
step "Aplicando ConfigMap"
kubectl apply -f k8s/configmap.yaml
success "ConfigMap aplicado"

# ── Deploy do PostgreSQL ───────────────────────────────────────────────────────
step "Deploy do PostgreSQL"

kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/service.yaml
kubectl apply -f k8s/postgres/statefulset.yaml

info "Aguardando PostgreSQL ficar pronto..."
kubectl wait --namespace automarket \
  --for=condition=ready pod \
  --selector=app=postgres \
  --timeout=120s
success "PostgreSQL pronto"

# ── Deploy do Redis ────────────────────────────────────────────────────────────
step "Deploy do Redis"
kubectl apply -f k8s/redis/deployment.yaml

kubectl wait --namespace automarket \
  --for=condition=ready pod \
  --selector=app=redis \
  --timeout=60s
success "Redis pronto"

# ── Deploy do MinIO ────────────────────────────────────────────────────────────
step "Deploy do MinIO"

kubectl apply -f k8s/minio/pvc.yaml
kubectl apply -f k8s/minio/deployment.yaml

info "Aguardando MinIO ficar pronto..."
kubectl wait --namespace automarket \
  --for=condition=ready pod \
  --selector=app=minio \
  --timeout=120s
success "MinIO pronto"

# Criar o bucket de imagens no MinIO
info "Criando bucket 'automarket-images' no MinIO..."
MINIO_POD=$(kubectl get pod -n automarket -l app=minio -o jsonpath='{.items[0].metadata.name}')
MINIO_ACCESS=$(kubectl get secret automarket-secrets -n automarket -o jsonpath='{.data.MINIO_ACCESS_KEY}' | base64 -d)
MINIO_SECRET_VAL=$(kubectl get secret automarket-secrets -n automarket -o jsonpath='{.data.MINIO_SECRET_KEY}' | base64 -d)

kubectl exec -n automarket "$MINIO_POD" -- sh -c "
  mc alias set local http://localhost:9000 '${MINIO_ACCESS}' '${MINIO_SECRET_VAL}' 2>/dev/null || true
  mc mb local/automarket-images --ignore-existing 2>/dev/null || true
  mc anonymous set public local/automarket-images 2>/dev/null || true
" 2>/dev/null && success "Bucket criado" || warn "Não foi possível criar o bucket automaticamente. Crie manualmente via console: http://localhost:9001"

# ── Deploy do Backend ──────────────────────────────────────────────────────────
step "Deploy do Backend"
kubectl apply -f k8s/backend/deployment.yaml

info "Aguardando Backend ficar pronto..."
if ! kubectl wait --namespace automarket \
  --for=condition=available deployment/backend \
  --timeout=120s 2>/dev/null; then
  warn "Backend não ficou pronto no tempo esperado. Diagnóstico:"
  echo ""
  kubectl get pods -n automarket -l app=backend
  echo ""
  BACKEND_POD=$(kubectl get pod -n automarket -l app=backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  if [ -n "$BACKEND_POD" ]; then
    echo -e "  ${YELLOW}Últimas linhas de log:${NC}"
    kubectl logs -n automarket "$BACKEND_POD" --tail=20 2>/dev/null || \
      kubectl describe pod -n automarket "$BACKEND_POD" | tail -20
  fi
  echo ""
  error "Corrija o erro acima e rode: kubectl rollout restart deployment/backend -n automarket"
fi
success "Backend pronto"

# ── Deploy do Frontend ─────────────────────────────────────────────────────────
step "Deploy do Frontend"
kubectl apply -f k8s/frontend/deployment.yaml

if ! kubectl wait --namespace automarket \
  --for=condition=available deployment/frontend \
  --timeout=60s 2>/dev/null; then
  warn "Frontend não ficou pronto. Diagnóstico:"
  kubectl get pods -n automarket -l app=frontend
  FRONTEND_POD=$(kubectl get pod -n automarket -l app=frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  [ -n "$FRONTEND_POD" ] && kubectl logs -n automarket "$FRONTEND_POD" --tail=20 2>/dev/null || true
  error "Corrija o erro acima e rode: kubectl rollout restart deployment/frontend -n automarket"
fi
success "Frontend pronto"

# ── Aplicar Ingress ────────────────────────────────────────────────────────────
step "Configurando Ingress"

# O webhook de validação do ingress-nginx causa falha em clusters kind onde
# o admission controller ainda não está aceitando conexões. Removê-lo é
# seguro em desenvolvimento local.
if kubectl get validatingwebhookconfiguration ingress-nginx-admission &>/dev/null; then
  info "Removendo webhook de validação (não necessário em ambiente local)..."
  kubectl delete validatingwebhookconfiguration ingress-nginx-admission
fi

kubectl apply -f k8s/ingress.yaml
success "Ingress configurado"

# ── Resumo final ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          🚗  AutoMarket — Deploy concluído!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Para acessar a aplicação, execute em outro terminal:"
echo -e "  ${CYAN}./port-forward.sh${NC}"
echo ""
echo -e "  URLs após o port-forward:"
echo -e "  ${GREEN}Aplicação  →  http://localhost:8080${NC}"
echo -e "  ${GREEN}API        →  http://localhost:8080/api${NC}"
echo -e "  ${GREEN}MinIO UI   →  http://localhost:9001${NC}"
echo ""
echo -e "  Outros comandos úteis:"
echo -e "  ${YELLOW}kubectl get pods -n automarket${NC}         # ver pods"
echo -e "  ${YELLOW}kubectl logs -n automarket -l app=backend${NC} # logs do backend"
echo -e "  ${YELLOW}./port-forward.sh --stop${NC}               # parar port-forwards"
echo ""
