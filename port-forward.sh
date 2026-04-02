#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  AutoMarket — Port-forward para acesso local
#  Uso: ./port-forward.sh           # inicia os tunnels em background
#       ./port-forward.sh --stop    # encerra todos os tunnels
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
PID_FILE="/tmp/automarket-portforward.pids"

info()  { echo -e "${CYAN}ℹ️  $*${NC}"; }
ok()    { echo -e "${GREEN}✅ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $*${NC}"; }
error() { echo -e "${RED}❌ $*${NC}"; }

stop_forwards() {
  if [ -f "$PID_FILE" ]; then
    echo -e "${YELLOW}Encerrando port-forwards...${NC}"
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && echo "  Processo $pid encerrado" || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    ok "Port-forwards encerrados."
  else
    echo "Nenhum port-forward ativo encontrado."
  fi
  exit 0
}

if [[ "${1:-}" == "--stop" ]]; then
  stop_forwards
fi

rm -f "$PID_FILE"

echo -e "${CYAN}Iniciando port-forwards para o AutoMarket...${NC}"
echo ""

# ── Garantir que o nó kind tem o label exigido pelo Ingress Controller ─────────
NODE=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$NODE" ]; then
  INGRESS_LABEL=$(kubectl get node "$NODE" -o jsonpath='{.metadata.labels.ingress-ready}' 2>/dev/null || true)
  if [ "$INGRESS_LABEL" != "true" ]; then
    info "Adicionando label ingress-ready=true ao nó $NODE..."
    kubectl label node "$NODE" ingress-ready=true --overwrite &>/dev/null
  fi
fi

# ── Aguardar o Ingress Controller ficar Ready (até 60s) ───────────────────────
INGRESS_READY=false
if kubectl get namespace ingress-nginx &>/dev/null; then
  info "Aguardando Ingress Controller ficar Ready..."
  if kubectl wait --namespace ingress-nginx \
      --for=condition=ready pod \
      --selector=app.kubernetes.io/component=controller \
      --timeout=60s &>/dev/null; then
    INGRESS_READY=true
    ok "Ingress Controller pronto."
  else
    warn "Ingress Controller não ficou Ready em 60s — usando modo fallback."
  fi
else
  warn "Namespace ingress-nginx não encontrado — usando modo fallback."
fi

echo ""

if [ "$INGRESS_READY" = true ]; then
  # ── Modo A: via Ingress Controller (frontend + backend numa porta só) ─────────
  # Todas as rotas (/auth, /vehicles, /favorites, /me → backend; / → frontend)
  echo -e "  🌐 Aplicação   → ${GREEN}http://localhost:8080${NC}  (frontend + API via Ingress)"
  kubectl port-forward \
    --namespace ingress-nginx \
    service/ingress-nginx-controller \
    8080:80 &>/dev/null &
  echo $! >> "$PID_FILE"
else
  # ── Modo B: port-forward direto nos serviços ──────────────────────────────────
  warn "Modo fallback ativo."
  warn "Chamadas de API (/auth, /vehicles, etc.) NÃO funcionarão pelo frontend."
  warn "Use http://localhost:3000 diretamente para testar a API."
  echo ""
  echo -e "  🖥️  Frontend   → ${GREEN}http://localhost:8080${NC}  (apenas UI estática)"
  kubectl port-forward \
    --namespace automarket \
    service/frontend-svc \
    8080:80 &>/dev/null &
  echo $! >> "$PID_FILE"

  echo -e "  ⚙️  Backend    → ${GREEN}http://localhost:3000${NC}  (API direta)"
  kubectl port-forward \
    --namespace automarket \
    service/backend-svc \
    3000:3000 &>/dev/null &
  echo $! >> "$PID_FILE"
fi

# ── MinIO API (imagens) e Console ─────────────────────────────────────────────
echo -e "  🗄️  MinIO API  → ${GREEN}http://localhost:9000${NC}  (imagens)"
kubectl port-forward \
  --namespace automarket \
  service/minio-svc \
  9000:9000 &>/dev/null &
echo $! >> "$PID_FILE"

echo -e "  🗄️  MinIO UI   → ${GREEN}http://localhost:9001${NC}  (console)"
kubectl port-forward \
  --namespace automarket \
  service/minio-svc \
  9001:9001 &>/dev/null &
echo $! >> "$PID_FILE"

# ── PostgreSQL ─────────────────────────────────────────────────────────────────
echo -e "  🐘 PostgreSQL  → ${GREEN}localhost:5432${NC}"
kubectl port-forward \
  --namespace automarket \
  service/postgres-svc \
  5432:5432 &>/dev/null &
echo $! >> "$PID_FILE"

# ── Redis ──────────────────────────────────────────────────────────────────────
echo -e "  🔴 Redis       → ${GREEN}localhost:6379${NC}"
kubectl port-forward \
  --namespace automarket \
  service/redis-svc \
  6379:6379 &>/dev/null &
echo $! >> "$PID_FILE"

sleep 1
echo ""
ok "Port-forwards ativos!"
echo -e "  Para parar: ${YELLOW}./port-forward.sh --stop${NC}"
echo ""

trap 'stop_forwards' INT TERM
wait
