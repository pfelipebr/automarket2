#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  AutoMarket — Teste: criar anúncio e deletar
#  Uso: ./test-delete.sh [API_URL]
#  Exemplo: ./test-delete.sh http://localhost:8080
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

API="${1:-http://localhost:8080}"
GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

pass() { echo -e "${GREEN}  ✅ $*${NC}"; }
fail() { echo -e "${RED}  ❌ $*${NC}"; exit 1; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

assert_code() {
  local label=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    pass "$label → HTTP $actual"
  else
    fail "$label → esperado HTTP $expected, obtido HTTP $actual"
  fi
}

TEST_EMAIL="test-delete-$(date +%s)@automarket.test"
TEST_PASS="senha123"

step "1. Registrar usuário de teste"
REGISTER=$(curl -s -w '\n%{http_code}' -X POST "$API/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Teste Delete\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
REGISTER_CODE=$(echo "$REGISTER" | tail -1)
assert_code "POST /auth/register" "201" "$REGISTER_CODE"
TOKEN=$(echo "$REGISTER" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

step "2. Criar anúncio"
CREATE=$(curl -s -w '\n%{http_code}' -X POST "$API/vehicles" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "brand":"Toyota","model":"Corolla","version":"XEi",
    "year_fab":2022,"year_model":2023,"mileage_km":15000,
    "price":120000,"condition":"used",
    "lat":-23.5505,"lng":-46.6333,"city":"São Paulo","state":"SP",
    "features":{
      "transmission":"automatic","fuel":"flex","color":"Prata",
      "doors":4,"ac":true,"power_steering":true,"abs":true,"airbags":2
    }
  }')
CREATE_CODE=$(echo "$CREATE" | tail -1)
assert_code "POST /vehicles" "201" "$CREATE_CODE"
VEHICLE_ID=$(echo "$CREATE" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo -e "   ID do anúncio: ${VEHICLE_ID}"

step "3. Confirmar que o anúncio existe"
GET_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/vehicles/$VEHICLE_ID")
assert_code "GET /vehicles/:id" "200" "$GET_CODE"

step "4. Deletar anúncio (sem Content-Type — comportamento correto do cliente)"
DEL_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  "$API/vehicles/$VEHICLE_ID" \
  -H "Authorization: Bearer $TOKEN")
assert_code "DELETE /vehicles/:id (sem Content-Type)" "204" "$DEL_CODE"

step "5. Deletar anúncio com Content-Type: application/json (cliente legado)"
# Cria outro anúncio para testar o cenário com Content-Type
CREATE2=$(curl -s -w '\n%{http_code}' -X POST "$API/vehicles" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "brand":"Honda","model":"Civic",
    "year_fab":2021,"year_model":2021,"mileage_km":30000,
    "price":95000,"condition":"used",
    "lat":-23.5505,"lng":-46.6333,"city":"São Paulo","state":"SP"
  }')
VEHICLE_ID2=$(echo "$CREATE2" | head -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo -e "   ID do anúncio 2: ${VEHICLE_ID2}"

DEL2_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
  "$API/vehicles/$VEHICLE_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
assert_code "DELETE /vehicles/:id (com Content-Type)" "204" "$DEL2_CODE"

step "6. Confirmar que os anúncios foram removidos"
GET_AFTER=$(curl -s -o /dev/null -w '%{http_code}' "$API/vehicles/$VEHICLE_ID")
assert_code "GET /vehicles/:id após delete" "404" "$GET_AFTER"

GET_AFTER2=$(curl -s -o /dev/null -w '%{http_code}' "$API/vehicles/$VEHICLE_ID2")
assert_code "GET /vehicles/:id2 após delete" "404" "$GET_AFTER2"

step "7. Limpeza — excluir usuário de teste via logout"
curl -s -o /dev/null -X POST "$API/auth/logout" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo -e "${GREEN}════════════════════════════════${NC}"
echo -e "${GREEN}  Todos os testes passaram! ✅  ${NC}"
echo -e "${GREEN}════════════════════════════════${NC}"
