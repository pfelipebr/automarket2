# AutoMarket

Plataforma de compra e venda de veículos, desenvolvida como projeto de demonstração full-stack com deploy em Kubernetes no Google Cloud.

**Demo:** https://demo.aidevcowork.com

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    GKE (Google Kubernetes Engine)        │
│                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │  Frontend   │   │   Backend    │   │    MinIO    │  │
│  │  React/Vite │   │  Fastify API │   │  (imagens)  │  │
│  │  Nginx SPA  │   │  Node.js     │   │             │  │
│  └──────┬──────┘   └──────┬───────┘   └──────┬──────┘  │
│         │                 │                  │         │
│         └─────────────────┼──────────────────┘         │
│                    ┌──────┴───────┐                     │
│              NGINX Ingress Controller                   │
│                    └──────┬───────┘                     │
│              ┌────────────┼────────────┐                │
│         ┌────┴────┐  ┌────┴────┐       │                │
│         │PostgreSQL│  │  Redis  │       │                │
│         └──────────┘  └─────────┘       │                │
└─────────────────────────────────────────────────────────┘
                           │
              GitHub Actions (CI/CD)
              WIF → Artifact Registry → GKE
```

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Leaflet |
| Backend | Node.js, Fastify, TypeScript, Prisma ORM, Zod |
| Banco de dados | PostgreSQL (com extensão `earthdistance` para busca geográfica) |
| Cache / Sessões | Redis |
| Armazenamento de imagens | MinIO (compatível com S3) |
| Infraestrutura | Google Kubernetes Engine (GKE) |
| CI/CD | GitHub Actions com Workload Identity Federation (sem chaves de serviço) |
| Autenticação | JWT (access token 15 min) + refresh token (30 dias) via cookie HttpOnly |

---

## Funcionalidades

### Anúncios
- Listagem com filtros por marca, modelo, ano, preço, câmbio e combustível
- Busca por proximidade geográfica (raio em km a partir da localização do usuário ou cidade digitada)
- Ordenação por relevância, preço, data e distância
- Página de detalhes com galeria de imagens, mapa de localização, informações do vendedor e características do veículo
- Criação de anúncios com upload de múltiplas fotos (até 5 MB cada)

### Visualização em mapa
- Alterna entre lista de cards e mapa interativo (OpenStreetMap via Leaflet)
- Agrupamento automático de veículos próximos em bolhas com 3 tamanhos (1 / 2–7 / 8+ veículos)
- Raio de agrupamento proporcional ao zoom — bolhas se separam conforme o usuário aproxima a visão
- Rótulo com faixa de preço nos clusters ("R$50mil – R$120mil")
- Botão **"Pesquisar nesta área"** aparece ao mover o mapa e recarrega os anúncios para a nova região
- Ao usar a geolocalização, o mapa é ativado automaticamente

### Geolocalização
- Solicita localização via `navigator.geolocation` com verificação via Permissions API
- Alternativa de busca por cidade com geocodificação via Nominatim
- Compatível com iOS Safari (requer permissão em Ajustes → Privacidade → Serviços de Localização → Sites Safari)

### Usuários
- Cadastro e login com e-mail e senha (bcrypt)
- Perfis do tipo **Pessoa Física** ou **Concessionária**
- Gerenciamento dos próprios anúncios (meus anúncios)
- Favoritos: salvar e remover veículos de interesse

---

## Estrutura do repositório

```
automarket/
├── backend/
│   ├── src/
│   │   ├── routes/         # auth, vehicles, favorites, me
│   │   ├── middleware/      # autenticação JWT
│   │   ├── scripts/         # seed de 500 veículos de exemplo
│   │   ├── app.ts           # setup Fastify
│   │   └── db.ts            # cliente Prisma
│   └── prisma/
│       └── schema.prisma
├── frontend/
│   └── src/
│       ├── pages/           # Home, VehicleDetail, CreateVehicle, Login, Register...
│       ├── components/      # VehicleCard, VehicleMapView, SearchFilters, Header
│       ├── api/             # cliente HTTP (fetch + TanStack Query)
│       └── store/           # estado de autenticação (Zustand)
├── k8s-gke/                 # manifests Kubernetes (deployments, services, ingress)
└── .github/workflows/
    └── deploy.yml           # pipeline de build e deploy no GKE
```

---

## CI/CD

O pipeline no GitHub Actions executa a cada push em `main`:

1. Autenticação no GCP via **Workload Identity Federation** (sem chaves JSON armazenadas)
2. Build das imagens Docker para `linux/amd64` e push para o **Artifact Registry**
3. Atualização dos deployments no GKE via `kubectl set image`
4. Aguarda rollout com `kubectl rollout status`
