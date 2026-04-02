# AutoMarket — Especificação Técnica v1.0

> Plataforma web de compra e venda de veículos com busca por proximidade geográfica, projetada para deploy em cluster Kubernetes.

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Diferencial Principal](#diferencial-principal)
3. [Capacidades do Protótipo](#capacidades-do-protótipo)
4. [Telas](#telas)
5. [Modelo de Dados](#modelo-de-dados)
6. [API REST](#api-rest)
7. [Fluxos de Uso](#fluxos-de-uso)
8. [Stack Tecnológica](#stack-tecnológica)
9. [Containerização](#containerização)
10. [Arquitetura Kubernetes](#arquitetura-kubernetes)
11. [Manifests Kubernetes](#manifests-kubernetes)
12. [Guia de Deploy](#guia-de-deploy)
13. [Requisitos Não-Funcionais](#requisitos-não-funcionais)
14. [Próximos Passos](#próximos-passos)

---

## Visão Geral

O AutoMarket é uma aplicação web para anúncio e busca de veículos usados, seminovos e 0km. O produto conecta compradores e vendedores com foco em relevância geográfica: os resultados de busca são ordenados por proximidade ao usuário, com filtro de raio configurável.

A primeira versão (protótipo) cobre quatro capacidades principais: busca pública com filtros avançados, autenticação de usuário, favoritos e cadastro de anúncios.

A aplicação é estruturada em **três serviços independentes** — frontend, backend e banco de dados — todos containerizados e orquestrados via Kubernetes, permitindo deploy reproduzível em qualquer cluster compatível (k3s, kind, EKS, GKE, etc.).

---

## Diferencial Principal

### Busca por Proximidade Geográfica

Cada veículo cadastrado armazena coordenadas geográficas (latitude e longitude). A busca aceita os parâmetros `lat`, `lng` e `radius_km` e retorna resultados dentro do raio especificado, ordenados por distância crescente.

O campo `distance_km` é calculado no backend (fórmula de Haversine ou índice PostGIS) e retornado em cada resultado, permitindo que a interface exiba a distância em cada card de veículo.

**Obtenção da localização do usuário:**

- **Automática:** browser solicita permissão via `navigator.geolocation`. Se concedida, `lat/lng` é capturado e aplicado sem interação adicional.
- **Manual:** campo de cidade com geocoding. O usuário digita o nome da cidade e o backend converte para coordenadas via API de geocoding (Nominatim/OSM ou Google Maps).

---

## Capacidades do Protótipo

| Capacidade | Acesso | Descrição |
|---|---|---|
| Busca com filtros | Público | Listagem paginada com filtros de localização, modelo, preço, kilometragem e características |
| Detalhe do veículo | Público | Página completa com fotos, atributos, mapa e dados do anunciante |
| Login e cadastro | Público | Autenticação via email e senha |
| Favoritos | Requer login | Salvar e gerenciar veículos de interesse |
| Cadastro de anúncio | Requer login | Criar, editar e remover veículos para venda |

### Filtros de Busca Disponíveis

| Filtro | Tipo | Observação |
|---|---|---|
| Localização | `lat`, `lng`, `radius_km` | Detectado via browser ou geocoding manual |
| Marca | string | Autocomplete |
| Modelo | string | Autocomplete |
| Preço | range `min_price` / `max_price` | Valor em R$ |
| Kilometragem | range `min_km` / `max_km` | Valor em km |
| Ano | range `year_from` / `year_to` | Ano de fabricação |
| Combustível | enum | flex, gasolina, diesel, elétrico, híbrido |
| Câmbio | enum | manual, automático, CVT |
| Condição | enum | novo (0km), usado, certificado |

---

## Telas

### 1. Listagem de Veículos (Home)

Tela pública e ponto de entrada da aplicação.

**Elementos:**
- Barra de busca com campo de localização (cidade ou "usar minha localização")
- Chips de filtros rápidos: marca, ano, condição, faixa de preço
- Painel de filtros expandido (coluna lateral ou modal em mobile)
- Grid/lista de cards de veículos com foto, título, ano, km, cidade e preço
- Ícone de coração para favoritar (abre modal de login se não autenticado)
- Indicador de distância em cada card (ex: "42 km de você")
- Contador de resultados e ordenação: mais relevantes, menor preço, maior preço, mais recentes, mais próximos
- Paginação ou scroll infinito

### 2. Detalhe do Veículo

**Elementos:**
- Galeria de fotos com navegação (carrossel)
- Título, marca, modelo, versão, ano fabricação/modelo
- Preço em destaque
- Distância do usuário
- Tabela de atributos: kilometragem, câmbio, combustível, cor, portas, direção, ar-condicionado, airbags
- Descrição livre do anunciante
- Mapa com pin de localização aproximada (bairro/cidade, sem endereço exato)
- Dados de contato do anunciante (nome, telefone)
- Botão "Favoritar" / "Remover dos favoritos"
- Botão "Entrar em contato" (link para WhatsApp ou formulário de mensagem)

### 3. Login e Cadastro

**Tela de login:**
- Campo email e senha
- Link "Esqueci a senha" (envia email de recuperação)
- Link para criar conta

**Tela de cadastro:**
- Campos: nome, email, senha, confirmação de senha, telefone (opcional)
- Validação de email único

### 4. Meus Favoritos

Acessível apenas para usuários logados.

**Elementos:**
- Grid de cards dos veículos favoritados
- Botão para remover favorito
- Estado vazio com CTA para buscar veículos
- Ordenação: mais recentes, menor preço

### 5. Meus Anúncios

Acessível apenas para usuários logados.

**Elementos:**
- Lista dos veículos cadastrados pelo usuário
- Status de cada anúncio: ativo, pausado, vendido
- Ações: editar, pausar/reativar, marcar como vendido, excluir
- Botão "Anunciar veículo"

### 6. Cadastrar / Editar Veículo

Formulário multi-step para usuários logados.

**Etapas:**
1. **Fotos** — upload de até 15 imagens; definir foto de capa
2. **Dados básicos** — marca, modelo, versão, ano fabricação, ano modelo, kilometragem, preço, condição
3. **Características** — câmbio, combustível, cor, número de portas, ar-condicionado, direção hidráulica/elétrica, ABS, airbags, outros opcionais
4. **Localização** — CEP ou endereço; geocoding automático para obter lat/lng; confirmação no mapa
5. **Revisão** — preview completo do anúncio antes de publicar

---

## Modelo de Dados

### Entidade: User

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK |
| `name` | string | obrigatório |
| `email` | string | único, obrigatório |
| `password_hash` | string | obrigatório |
| `phone` | string | opcional |
| `created_at` | timestamp | auto |
| `updated_at` | timestamp | auto |

### Entidade: Vehicle

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User |
| `brand` | string | obrigatório |
| `model` | string | obrigatório |
| `version` | string | opcional |
| `year_fab` | int | obrigatório |
| `year_model` | int | obrigatório |
| `mileage_km` | int | obrigatório |
| `price` | decimal(12,2) | obrigatório |
| `condition` | enum | new / used / certified |
| `description` | text | opcional |
| `status` | enum | active / paused / sold |
| `lat` | float | obrigatório — índice geoespacial |
| `lng` | float | obrigatório — índice geoespacial |
| `city` | string | obrigatório |
| `state` | string(2) | obrigatório |
| `created_at` | timestamp | auto |
| `updated_at` | timestamp | auto |

> **Índice:** `CREATE INDEX ON vehicles USING GIST(ll_to_earth(lat, lng))` (extensão `earthdistance` do PostgreSQL) para consultas de proximidade eficientes.

### Entidade: VehicleFeatures

| Campo | Tipo | Valores |
|---|---|---|
| `vehicle_id` | UUID | FK → Vehicle (1:1) |
| `transmission` | enum | manual / automatic / cvt |
| `fuel` | enum | flex / gasoline / diesel / electric / hybrid |
| `color` | string | |
| `doors` | int | 2 / 4 |
| `ac` | bool | |
| `power_steering` | bool | |
| `abs` | bool | |
| `airbags` | int | |

### Entidade: VehicleImage

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | UUID | PK |
| `vehicle_id` | UUID | FK → Vehicle |
| `url` | string | URL pública (MinIO interno ou S3/R2 externo) |
| `order` | int | ordem de exibição |
| `is_cover` | bool | foto principal |

### Entidade: Favorite

| Campo | Tipo | Restrição |
|---|---|---|
| `user_id` | UUID | PK (composta) — FK → User |
| `vehicle_id` | UUID | PK (composta) — FK → Vehicle |
| `created_at` | timestamp | auto |

---

## API REST

Todas as respostas retornam JSON. Endpoints marcados com 🔒 exigem header `Authorization: Bearer <token>`.

### Autenticação

```
POST   /auth/register           Criar conta
POST   /auth/login              Login — retorna access_token + refresh_token
POST   /auth/refresh            Renovar access_token usando refresh_token
POST   /auth/logout        🔒   Invalidar refresh_token
POST   /auth/forgot-password    Enviar email de recuperação
POST   /auth/reset-password     Redefinir senha com token do email
```

### Veículos — Busca Pública

```
GET    /vehicles            Listagem com filtros e paginação
GET    /vehicles/:id        Detalhe completo de um veículo
```

**Query params de `GET /vehicles`:**

```
lat           float    latitude do usuário
lng           float    longitude do usuário
radius_km     int      raio de busca (padrão: 100)
brand         string   marca (parcial, case-insensitive)
model         string   modelo (parcial, case-insensitive)
condition     enum     new | used | certified
min_price     decimal
max_price     decimal
min_km        int
max_km        int
year_from     int
year_to       int
fuel          enum     flex | gasoline | diesel | electric | hybrid
transmission  enum     manual | automatic | cvt
page          int      padrão: 1
limit         int      padrão: 20, máx: 50
sort          enum     relevance | price_asc | price_desc | newest | nearest
```

**Exemplo de resposta `GET /vehicles`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "brand": "Jeep",
      "model": "Renegade",
      "version": "1.3 T270 Flex At6",
      "year_fab": 2023,
      "year_model": 2024,
      "mileage_km": 11000,
      "price": 115890.00,
      "condition": "used",
      "city": "São Paulo",
      "state": "SP",
      "distance_km": 12.4,
      "cover_image_url": "https://..."
    }
  ],
  "meta": {
    "total": 3790,
    "page": 1,
    "limit": 20,
    "total_pages": 190
  }
}
```

### Veículos — Gestão 🔒

```
POST   /vehicles                        Criar anúncio
PATCH  /vehicles/:id                    Editar anúncio (somente dono)
DELETE /vehicles/:id                    Remover anúncio (somente dono)
PATCH  /vehicles/:id/status             Alterar status: active | paused | sold

POST   /vehicles/:id/images             Upload de fotos (multipart/form-data)
DELETE /vehicles/:id/images/:imgId      Remover foto
PATCH  /vehicles/:id/images/:imgId      Atualizar ordem ou definir como capa
```

### Favoritos 🔒

```
GET    /favorites              Lista de veículos favoritados pelo usuário logado
POST   /favorites/:vehicleId   Adicionar favorito
DELETE /favorites/:vehicleId   Remover favorito
```

### Usuário 🔒

```
GET    /me           Dados do perfil logado
PATCH  /me           Atualizar nome, telefone
GET    /me/vehicles  Anúncios do usuário logado
```

### Health Check (para K8s probes)

```
GET    /health       Retorna 200 {"status":"ok"} — usado por liveness e readiness probes
GET    /ready        Retorna 200 somente quando conexão com DB está ativa
```

---

## Fluxos de Uso

### Fluxo 1 — Busca por Proximidade

1. Usuário acessa a home. O browser exibe solicitação de permissão de geolocalização.
2. **Se permissão concedida:** `lat/lng` capturado automaticamente. Busca inicial disparada com `radius_km=100`.
3. **Se permissão negada:** campo de cidade é exibido. Usuário digita e seleciona cidade. Frontend faz geocoding para obter `lat/lng`.
4. Frontend envia `GET /vehicles?lat=X&lng=Y&radius_km=100`.
5. Backend executa consulta com extensão `earthdistance`, calcula `distance_km` para cada resultado e retorna lista ordenada.
6. Cards exibem a distância calculada ("42 km de você").
7. Usuário ajusta raio no filtro → nova requisição com `radius_km` atualizado.

### Fluxo 2 — Cadastro de Veículo

1. Usuário logado clica em "Anunciar veículo".
2. Formulário multi-step:
   - **Etapa 1 — Fotos:** upload de até 15 imagens (JPG/PNG/WEBP, máx 5 MB cada). Definição da foto de capa.
   - **Etapa 2 — Dados básicos:** marca, modelo, versão, anos, kilometragem, preço, condição.
   - **Etapa 3 — Características:** câmbio, combustível, cor, opcionais.
   - **Etapa 4 — Localização:** CEP ou endereço digitado. Geocoding automático. Confirmação no mapa.
   - **Etapa 5 — Revisão:** preview do anúncio completo.
3. Ao confirmar: `POST /vehicles` cria o registro com `status: active`.
4. Frontend faz upload das fotos via `POST /vehicles/:id/images`. O backend salva no MinIO (deploy K8s interno) ou S3/R2 (externo).
5. Anúncio aparece imediatamente nas buscas de outros usuários.

### Fluxo 3 — Favoritar Veículo

1. Usuário clica no ícone de coração em qualquer card ou na página de detalhe.
2. **Se não logado:** modal de login é exibido. Após login bem-sucedido, ação de favoritar é executada automaticamente.
3. **Se logado:** `POST /favorites/:vehicleId` é chamado. Coração fica preenchido imediatamente (optimistic update). Em caso de erro, estado é revertido.
4. Para desfavoritar: `DELETE /favorites/:vehicleId`. Coração volta ao estado vazio.

### Fluxo 4 — Autenticação

1. Usuário acessa `/login` e preenche email e senha.
2. `POST /auth/login` retorna `access_token` (JWT, 15 min) e `refresh_token` (30 dias, armazenado em httpOnly cookie).
3. `access_token` é mantido em memória (não em localStorage).
4. Quando o `access_token` expira, cliente chama `POST /auth/refresh` automaticamente usando o cookie.
5. Logout chama `POST /auth/logout` para invalidar o `refresh_token` no servidor.

---

## Stack Tecnológica

### Frontend

| Tecnologia | Uso |
|---|---|
| React + TypeScript | Framework principal |
| Vite | Bundler e dev server |
| React Query (TanStack) | Cache de requisições e estado de servidor |
| Zustand | Estado global de autenticação |
| React Router v6 | Roteamento |
| Leaflet + React-Leaflet | Mapa interativo com pins de veículos |
| React Hook Form + Zod | Formulários e validação |
| Nginx (imagem Docker) | Servidor de arquivos estáticos no container |

### Backend

| Tecnologia | Uso |
|---|---|
| Node.js 20 LTS + TypeScript | Runtime |
| Fastify | Framework HTTP (alta performance) |
| Prisma ORM | Acesso ao banco com type-safety |
| Zod | Validação de inputs das rotas |
| jsonwebtoken | Geração e validação de JWT |
| bcrypt | Hash de senhas |

### Banco de Dados

| Tecnologia | Uso |
|---|---|
| PostgreSQL 16 + extensão `earthdistance` | Banco relacional principal com suporte geoespacial |
| Redis 7 | Cache de buscas frequentes (opcional no protótipo) |

**Índice geoespacial:**

```sql
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE INDEX idx_vehicles_geo ON vehicles USING GIST (ll_to_earth(lat, lng));
```

**Consulta de proximidade:**

```sql
SELECT *, earth_distance(ll_to_earth(lat, lng), ll_to_earth($1, $2)) / 1000 AS distance_km
FROM vehicles
WHERE earth_box(ll_to_earth($1, $2), $3 * 1000) @> ll_to_earth(lat, lng)
  AND status = 'active'
ORDER BY distance_km ASC;
```

### Armazenamento de Imagens

Para deploy K8s, duas opções são suportadas:

| Opção | Uso | Indicada para |
|---|---|---|
| **MinIO** (deploy interno no cluster) | Object storage S3-compatível self-hosted | Desenvolvimento, clusters isolados |
| **AWS S3 / Cloudflare R2** (externo) | Object storage gerenciado | Produção com acesso à internet |

A variável de ambiente `STORAGE_DRIVER` (valores: `minio` ou `s3`) seleciona o driver ativo. A interface do código é idêntica nos dois casos (SDK AWS S3 com endpoint customizável).

### Serviços Externos

| Serviço | Uso | Alternativa self-hosted |
|---|---|---|
| Nominatim (OSM) | Geocoding gratuito | Instância própria do Nominatim |
| SendGrid / Resend | Envio de emails | Mailhog (dev) / Postfix (prod) |

---

## Containerização

### Estrutura de Repositório

```
automarket/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
├── backend/
│   ├── Dockerfile
│   └── src/
├── k8s/
│   ├── namespace.yaml
│   ├── secrets.yaml
│   ├── configmap.yaml
│   ├── postgres/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── minio/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress.yaml
└── docker-compose.yml        ← desenvolvimento local
```

### Dockerfile — Frontend

```dockerfile
# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: serve com Nginx
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf** (para SPA com React Router):

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Compressão gzip
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;

  # Cache agressivo para assets com hash
  location ~* \.(js|css|png|jpg|webp|svg|ico|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # SPA fallback — todas as rotas para index.html
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Dockerfile — Backend

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

> O script de inicialização do container deve executar `npx prisma migrate deploy` antes de iniciar o servidor (via `initContainer` no K8s ou entrypoint script).

---

## Arquitetura Kubernetes

### Visão Geral

```
                        Internet
                            │
                     ┌──────┴──────┐
                     │   Ingress   │  (NGINX Ingress Controller)
                     │  automarket │
                     └──────┬──────┘
              ┌─────────────┴──────────────┐
              │                            │
      /api/* → Backend              /* → Frontend
     (Service: backend-svc)    (Service: frontend-svc)
              │
    ┌─────────┼──────────┐
    │         │          │
 Postgres   Redis      MinIO
(StatefulSet) (Deployment) (Deployment)
```

### Namespace

Todos os recursos do AutoMarket ficam em um único namespace dedicado: `automarket`.

### Componentes e Recursos K8s

| Componente | Tipo K8s | Réplicas | Persistência |
|---|---|---|---|
| Frontend (Nginx) | Deployment | 2 | — |
| Backend (Fastify) | Deployment | 2 | — |
| PostgreSQL | StatefulSet | 1 | PVC 10Gi |
| Redis | Deployment | 1 | — (cache volátil) |
| MinIO | Deployment | 1 | PVC 20Gi |

> Para produção, PostgreSQL pode ser migrado para um managed service externo (RDS, Cloud SQL) — basta atualizar a variável `DATABASE_URL` no Secret.

### Variáveis de Ambiente

As configurações são separadas em dois objetos K8s:

**ConfigMap** (valores não-sensíveis):

```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://automarket.example.com
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d
STORAGE_DRIVER=minio
MINIO_ENDPOINT=minio-svc
MINIO_PORT=9000
MINIO_BUCKET=automarket-images
GEOCODING_PROVIDER=nominatim
```

**Secret** (valores sensíveis — nunca em texto claro no repositório):

```
DATABASE_URL=postgresql://automarket:SENHA@postgres-svc:5432/automarket
REDIS_URL=redis://redis-svc:6379
JWT_SECRET=<string aleatória 64+ chars>
MINIO_ACCESS_KEY=<access key>
MINIO_SECRET_KEY=<secret key>
SMTP_DSN=smtp://user:pass@host:587
```

---

## Manifests Kubernetes

### namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: automarket
```

### configmap.yaml

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: automarket-config
  namespace: automarket
data:
  NODE_ENV: "production"
  PORT: "3000"
  CORS_ORIGIN: "https://automarket.example.com"
  JWT_EXPIRY: "15m"
  REFRESH_TOKEN_EXPIRY: "30d"
  STORAGE_DRIVER: "minio"
  MINIO_ENDPOINT: "minio-svc"
  MINIO_PORT: "9000"
  MINIO_BUCKET: "automarket-images"
  GEOCODING_PROVIDER: "nominatim"
```

### secrets.yaml

> ⚠️ Nunca versionar este arquivo com valores reais. Use `kubectl create secret` ou uma ferramenta de gestão de secrets (Sealed Secrets, External Secrets Operator).

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: automarket-secrets
  namespace: automarket
type: Opaque
stringData:
  DATABASE_URL: "postgresql://automarket:SENHA@postgres-svc:5432/automarket"
  REDIS_URL: "redis://redis-svc:6379"
  JWT_SECRET: "SUBSTITUA_POR_STRING_ALEATORIA_64_CHARS"
  MINIO_ACCESS_KEY: "SUBSTITUA"
  MINIO_SECRET_KEY: "SUBSTITUA"
  POSTGRES_PASSWORD: "SENHA"
  SMTP_DSN: "smtp://user:pass@host:587"
```

### postgres/pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: automarket
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### postgres/statefulset.yaml

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: automarket
spec:
  serviceName: postgres-svc
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: automarket
            - name: POSTGRES_USER
              value: automarket
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: automarket-secrets
                  key: POSTGRES_PASSWORD
          volumeMounts:
            - name: postgres-data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1"
              memory: "1Gi"
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "automarket"]
            initialDelaySeconds: 10
            periodSeconds: 5
      volumes:
        - name: postgres-data
          persistentVolumeClaim:
            claimName: postgres-pvc
```

### postgres/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-svc
  namespace: automarket
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  clusterIP: None  # headless service para StatefulSet
```

### redis/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: automarket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          readinessProbe:
            exec:
              command: ["redis-cli", "ping"]
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: redis-svc
  namespace: automarket
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

### minio/pvc.yaml

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: automarket
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
```

### minio/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: automarket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
        - name: minio
          image: minio/minio:latest
          args: ["server", "/data", "--console-address", ":9001"]
          ports:
            - containerPort: 9000   # API S3
            - containerPort: 9001   # Console web
          env:
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: automarket-secrets
                  key: MINIO_ACCESS_KEY
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: automarket-secrets
                  key: MINIO_SECRET_KEY
          volumeMounts:
            - name: minio-data
              mountPath: /data
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /minio/health/live
              port: 9000
            initialDelaySeconds: 10
            periodSeconds: 5
      volumes:
        - name: minio-data
          persistentVolumeClaim:
            claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: minio-svc
  namespace: automarket
spec:
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
      targetPort: 9000
    - name: console
      port: 9001
      targetPort: 9001
```

### backend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: automarket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      initContainers:
        - name: migrate
          image: seu-registry/automarket-backend:latest
          command: ["npx", "prisma", "migrate", "deploy"]
          envFrom:
            - configMapRef:
                name: automarket-config
            - secretRef:
                name: automarket-secrets
      containers:
        - name: backend
          image: seu-registry/automarket-backend:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: automarket-config
            - secretRef:
                name: automarket-secrets
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "1"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
  namespace: automarket
spec:
  selector:
    app: backend
  ports:
    - port: 3000
      targetPort: 3000
```

### frontend/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: automarket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: seu-registry/automarket-frontend:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-svc
  namespace: automarket
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
```

### ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: automarket-ingress
  namespace: automarket
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"          # uploads de até 10 MB
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"          # TLS automático via cert-manager
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - automarket.example.com
      secretName: automarket-tls
  rules:
    - host: automarket.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-svc
                port:
                  number: 3000
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: backend-svc
                port:
                  number: 3000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
```

> O Ingress assume que o **NGINX Ingress Controller** e o **cert-manager** estão instalados no cluster. Para clusters sem cert-manager, remova as anotações TLS e configure o certificado manualmente.

---

## Guia de Deploy

### Pré-requisitos

- Cluster Kubernetes 1.27+ (k3s, kind, EKS, GKE, AKS, etc.)
- `kubectl` configurado e apontando para o cluster
- NGINX Ingress Controller instalado
- cert-manager instalado (para TLS automático) — opcional
- Registry de imagens acessível pelo cluster (Docker Hub, GHCR, ECR, etc.)

### 1. Instalar o NGINX Ingress Controller (se necessário)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml
```

Para k3s/kind, usar o manifesto adequado ao provider. Aguardar o controller ficar `Ready`:

```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### 2. Construir e publicar as imagens Docker

```bash
# Frontend
docker build -t seu-registry/automarket-frontend:v1.0 ./frontend
docker push seu-registry/automarket-frontend:v1.0

# Backend
docker build -t seu-registry/automarket-backend:v1.0 ./backend
docker push seu-registry/automarket-backend:v1.0
```

Atualizar a tag `image:` nos arquivos `backend/deployment.yaml` e `frontend/deployment.yaml`.

### 3. Criar o namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 4. Criar os Secrets

**Opção A — via kubectl (manual):**

```bash
kubectl create secret generic automarket-secrets \
  --namespace automarket \
  --from-literal=DATABASE_URL="postgresql://automarket:SENHA@postgres-svc:5432/automarket" \
  --from-literal=REDIS_URL="redis://redis-svc:6379" \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=MINIO_ACCESS_KEY="admin" \
  --from-literal=MINIO_SECRET_KEY="$(openssl rand -hex 16)" \
  --from-literal=POSTGRES_PASSWORD="SENHA" \
  --from-literal=SMTP_DSN="smtp://user:pass@host:587"
```

**Opção B — via arquivo (desenvolvimento):**

```bash
# Editar k8s/secrets.yaml com os valores reais, depois:
kubectl apply -f k8s/secrets.yaml
```

### 5. Aplicar o ConfigMap

```bash
kubectl apply -f k8s/configmap.yaml
```

### 6. Deploy do banco de dados e serviços de suporte

```bash
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/statefulset.yaml
kubectl apply -f k8s/postgres/service.yaml

kubectl apply -f k8s/redis/deployment.yaml

kubectl apply -f k8s/minio/pvc.yaml
kubectl apply -f k8s/minio/deployment.yaml
```

Aguardar o PostgreSQL estar pronto antes de continuar:

```bash
kubectl wait --namespace automarket \
  --for=condition=ready pod \
  --selector=app=postgres \
  --timeout=120s
```

### 7. Criar o bucket no MinIO

Após o MinIO subir, criar o bucket `automarket-images` via CLI ou console web (`:9001`):

```bash
# Port-forward temporário para acessar o console
kubectl port-forward -n automarket svc/minio-svc 9001:9001

# Ou via mc (MinIO Client)
mc alias set local http://localhost:9000 MINIO_ACCESS_KEY MINIO_SECRET_KEY
mc mb local/automarket-images
mc policy set public local/automarket-images
```

### 8. Deploy da aplicação

```bash
kubectl apply -f k8s/backend/deployment.yaml
kubectl apply -f k8s/frontend/deployment.yaml
```

O `initContainer` do backend executará automaticamente `prisma migrate deploy` antes de iniciar o servidor.

### 9. Configurar o Ingress

Substituir `automarket.example.com` pelo domínio real em `k8s/ingress.yaml`, depois:

```bash
kubectl apply -f k8s/ingress.yaml
```

### 10. Verificar o deploy

```bash
# Verificar todos os pods
kubectl get pods -n automarket

# Verificar serviços
kubectl get svc -n automarket

# Verificar ingress
kubectl get ingress -n automarket

# Logs do backend
kubectl logs -n automarket -l app=backend --tail=50

# Testar health check
kubectl port-forward -n automarket svc/backend-svc 3000:3000
curl http://localhost:3000/health
```

### Deploy com um único comando (apply recursivo)

```bash
kubectl apply -R -f k8s/
```

> Aplicar recursivamente funciona bem para primeiro deploy. Para updates parciais, prefira aplicar arquivo por arquivo para evitar reordenação de dependências.

### Rollback

```bash
# Ver histórico de revisões
kubectl rollout history deployment/backend -n automarket

# Voltar para versão anterior
kubectl rollout undo deployment/backend -n automarket
```

### Desenvolvimento Local com Docker Compose

Para desenvolvimento sem um cluster K8s, use o arquivo `docker-compose.yml` na raiz:

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: automarket
      POSTGRES_USER: automarket
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: dev_password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://automarket:dev_password@postgres:5432/automarket
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_secret_key_32_chars_minimum
      STORAGE_DRIVER: minio
      MINIO_ENDPOINT: minio
      MINIO_PORT: "9000"
      MINIO_ACCESS_KEY: admin
      MINIO_SECRET_KEY: dev_password
      MINIO_BUCKET: automarket-images
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
      - minio

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  minio_data:
```

```bash
# Subir ambiente local
docker compose up -d

# Executar migrations
docker compose exec backend npx prisma migrate dev
```

---

## Requisitos Não-Funcionais

### Performance

- Busca com índice geoespacial deve responder em < 300 ms para base de até 100.000 veículos.
- Imagens servidas via MinIO (interno) ou CDN (produção) com cache agressivo.
- Frontend com code splitting por rota para carregamento inicial < 200 KB (gzipped).

### Segurança

- Senhas armazenadas com bcrypt (cost factor ≥ 12).
- `access_token` em memória; `refresh_token` em httpOnly cookie (proteção contra XSS).
- Endpoints de escrita validam que o recurso pertence ao usuário autenticado (autorização no backend).
- Upload de imagens: validação de tipo MIME e tamanho no backend antes de salvar no storage.
- Rate limiting nos endpoints de autenticação (máx. 10 tentativas por IP por minuto).
- Secrets K8s nunca devem ser versionados em texto claro; usar Sealed Secrets ou External Secrets Operator em produção.

### Upload de Imagens

- Máximo de 15 fotos por anúncio.
- Tamanho máximo por imagem: 5 MB (Ingress configurado com `proxy-body-size: 10m` para comportar múltiplos uploads).
- Formatos aceitos: JPG, PNG, WEBP.
- Redimensionamento automático no backend para gerar thumbnails antes de salvar no storage.

### Paginação

- Máximo de 20 resultados por página (configurável até 50).
- Paginação offset-based para o protótipo; cursor-based recomendado para scroll infinito em versões futuras.

### Mobile First

- Interface responsiva com breakpoints para mobile (< 768px), tablet e desktop.
- Experiência otimizada para dispositivos móveis.

### Observabilidade no Cluster

- Endpoints `/health` (liveness) e `/ready` (readiness) implementados no backend para integração nativa com K8s.
- Logs estruturados em JSON (Fastify com `pino`) compatíveis com Loki/Grafana ou CloudWatch.
- Métricas expostas em `/metrics` (formato Prometheus) para integração com kube-prometheus-stack (opcional).

---

## Próximos Passos (Pós-Protótipo)

- **Mensagens:** sistema de chat entre comprador e vendedor dentro da plataforma.
- **Integração FIPE:** sugestão automática de preço baseada na tabela FIPE no cadastro do veículo.
- **Buscas salvas e alertas:** usuário salva uma busca e recebe notificação quando novos veículos são cadastrados.
- **Login social:** autenticação via Google e Apple.
- **Painel administrativo:** moderação de anúncios, banimento de usuários.
- **Destaque de anúncios:** funcionalidade paga para impulsionar visibilidade.
- **HPA (Horizontal Pod Autoscaler):** escalar automaticamente backend e frontend baseado em CPU/RPS.
- **Helm Chart:** empacotar todos os manifests em um chart Helm para instalação com um único comando.
- **GitOps com ArgoCD/Flux:** deploy automatizado a partir do repositório Git.

---

*Especificação atualizada em 01/04/2026 — AutoMarket v1.0 | K8s-ready*
