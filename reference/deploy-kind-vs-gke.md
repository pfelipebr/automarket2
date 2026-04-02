# Deploy Local (kind) vs GKE — Diferenças

## Visão Geral

| Aspecto | kind (local) | GKE (produção) |
|---|---|---|
| Cluster | `kind create cluster` | GKE Autopilot (`us-central1`) |
| Registro de imagens | Docker local (sem push) | Artifact Registry |
| Ingress | NGINX via manifest estático | NGINX via Helm + LoadBalancer |
| IP de acesso | `localhost:8080` (port-forward) | IP público do LoadBalancer |
| Storage class | `standard` (hostPath) | `standard-rwo` (GCE Persistent Disk) |
| MinIO acesso externo | Port-forward porta 9000 | LoadBalancer separado (`minio-lb`) |
| Pull policy das imagens | `Never` | `Always` |
| Arquitetura das imagens | ARM64 (Apple Silicon) | AMD64 (linux/amd64) |
| Manifests | `k8s/` | `k8s-gke/` |

---

## 1. Registro de Imagens

### kind
```bash
# Build normal (sem push)
docker build -t automarket-backend:latest -f backend/Dockerfile backend/
docker build -t automarket-frontend:latest -f frontend/Dockerfile frontend/

# Carregar diretamente no cluster
kind load docker-image automarket-backend:latest --name kind
kind load docker-image automarket-frontend:latest --name kind
```

Nos manifests:
```yaml
image: automarket-backend:latest
imagePullPolicy: Never   # nunca tenta fazer pull externo
```

### GKE
```bash
# Build obrigatoriamente para linux/amd64
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/automarket-93369/automarket/backend:latest \
  -f backend/Dockerfile backend/

docker push us-central1-docker.pkg.dev/automarket-93369/automarket/backend:latest
```

Nos manifests:
```yaml
image: us-central1-docker.pkg.dev/automarket-93369/automarket/backend:latest
imagePullPolicy: Always  # sempre faz pull do registry
```

> **Atenção:** esquecer `--platform linux/amd64` causa erro `no match for platform in manifest` nos pods GKE.

---

## 2. Arquitetura da Imagem Docker

| | kind | GKE |
|---|---|---|
| Flag de build | *(nenhuma — usa padrão do host)* | `--platform linux/amd64` |
| Arquitetura resultante | `arm64` (Apple Silicon) | `amd64` |
| Nós do cluster | Qualquer (hostPath) | x86-64 obrigatório |

---

## 3. Ingress

### kind
Instalado via manifest YAML estático do projeto ingress-nginx para kind:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.1/deploy/static/provider/kind/deploy.yaml
```
- Requer label no nó: `kubectl label node kind-control-plane ingress-ready=true`
- Acesso via port-forward: `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80`
- Host no Ingress: `localhost`

### GKE
Instalado via Helm com LoadBalancer automático:
```bash
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.config.proxy-body-size="15m"
```
- IP público atribuído automaticamente pelo GCP
- Sem port-forward necessário
- Host no Ingress: sem restrição de host (aceita qualquer)

---

## 4. Storage (PVCs)

### kind
```yaml
spec:
  storageClassName: standard   # hostPath no nó local
  resources:
    requests:
      storage: 5Gi
```

### GKE
```yaml
spec:
  storageClassName: standard-rwo   # GCE Persistent Disk (ReadWriteOnce)
  resources:
    requests:
      storage: 10Gi   # mínimo recomendado para evitar throttling de I/O
```

> **Problema comum no GKE:** o disco GCE cria um diretório `lost+found` na raiz do volume.
> O PostgreSQL falha ao inicializar se `PGDATA` apontar para essa raiz.
> **Solução:** definir `PGDATA=/var/lib/postgresql/data/pgdata` (subdiretório).

```yaml
env:
  - name: PGDATA
    value: /var/lib/postgresql/data/pgdata
```

---

## 5. Extensões do PostgreSQL (earthdistance)

### kind
Usado `lifecycle.postStart` para rodar `psql` após o container iniciar:
```yaml
lifecycle:
  postStart:
    exec:
      command: ["/bin/sh", "-c", "until pg_isready...; do sleep 1; done && psql ..."]
```
> Problemático: se o hook falhar, o container é morto (CrashLoopBackOff).

### GKE
Usado `/docker-entrypoint-initdb.d/` via ConfigMap — executado automaticamente pelo Postgres na primeira inicialização:
```yaml
# ConfigMap com o script SQL
data:
  init.sql: |
    CREATE EXTENSION IF NOT EXISTS cube;
    CREATE EXTENSION IF NOT EXISTS earthdistance;

# Volume montado no StatefulSet
volumeMounts:
  - name: init-scripts
    mountPath: /docker-entrypoint-initdb.d
volumes:
  - name: init-scripts
    configMap:
      name: postgres-init
```

---

## 6. Acesso ao MinIO (imagens dos veículos)

O backend armazena a URL da imagem como `http://<MINIO_ENDPOINT>:9000/automarket-images/<key>`.
O browser precisa conseguir acessar esse URL diretamente.

### kind
- MinIO acessível via port-forward na porta 9000
- `MINIO_ENDPOINT=minio-svc` (serviço interno)
- Frontend reescreve `http://minio-svc` → `http://localhost` em `resolveImageUrl()`
- URL gerada: `http://minio-svc:9000/...` → reescrita para `http://localhost:9000/...`

### GKE
- MinIO exposto via **LoadBalancer dedicado** (`minio-lb`, porta 9000)
- `MINIO_ENDPOINT=<IP_do_minio-lb>` no ConfigMap
- URLs geradas pelo backend já são públicas: `http://<IP_do_minio-lb>:9000/...`
- Sem necessidade de reescrita no frontend para novas imagens

```yaml
# k8s-gke/minio/deployment.yaml — serviço extra
apiVersion: v1
kind: Service
metadata:
  name: minio-lb
  namespace: automarket
spec:
  type: LoadBalancer
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
      targetPort: 9000
```

---

## 7. ConfigMap — Variáveis que mudam

| Variável | kind | GKE |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:8080` | `http://<NGINX_LB_IP>` |
| `MINIO_ENDPOINT` | `minio-svc` | `<MINIO_LB_IP>` |

---

## 8. Secrets

### kind
Criados pelo `deploy.sh` com senhas geradas via `openssl rand`:
```bash
kubectl create secret generic automarket-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  ...
```

### GKE
Mesmo comando, executado manualmente ou via `deploy-gke.sh`.
Recomendação futura: usar **Google Secret Manager** + Workload Identity para produção.

---

## 9. Recursos Computacionais (requests/limits)

O GKE Autopilot exige requests mínimos por pod para agendamento correto:

| Componente | kind requests | GKE requests |
|---|---|---|
| Backend | 100m CPU / 128Mi | 250m CPU / 256Mi |
| Frontend | 50m CPU / 32Mi | 50m CPU / 64Mi |
| PostgreSQL | 100m CPU / 256Mi | 250m CPU / 512Mi |
| Redis | 50m CPU / 64Mi | 50m CPU / 128Mi |
| MinIO | 100m CPU / 128Mi | 100m CPU / 256Mi |

---

## 10. Script de Deploy

| | kind | GKE |
|---|---|---|
| Script | `./deploy.sh` | `./deploy-gke.sh` *(a criar)* |
| Port-forward | `./port-forward.sh` | não necessário |
| Manifests | `k8s/` | `k8s-gke/` |

---

## 11. Comandos Úteis — GKE

```bash
# Configurar kubectl para o cluster GKE
export USE_GKE_GCLOUD_AUTH_PLUGIN=True
gcloud container clusters get-credentials automarket \
  --region=us-central1 --project=automarket-93369

# Ver todos os pods
kubectl get pods -n automarket

# Logs do backend
kubectl logs -n automarket -l app=backend --tail=50

# Reiniciar backend (após novo push de imagem)
kubectl rollout restart deployment/backend -n automarket
kubectl rollout status deployment/backend -n automarket

# Atualizar imagem (build + push + rollout)
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/automarket-93369/automarket/backend:latest \
  -f backend/Dockerfile backend/
docker push us-central1-docker.pkg.dev/automarket-93369/automarket/backend:latest
kubectl rollout restart deployment/backend -n automarket

# Ver IP público da aplicação
kubectl get svc ingress-nginx-controller -n ingress-nginx

# Ver IP público do MinIO
kubectl get svc minio-lb -n automarket
```

---

## 12. Informações do Ambiente GKE Atual

| Item | Valor |
|---|---|
| Projeto GCP | `automarket-93369` |
| Cluster | `automarket` |
| Região | `us-central1` |
| Artifact Registry | `us-central1-docker.pkg.dev/automarket-93369/automarket` |
| URL da aplicação | `http://34.136.224.30` |
| URL do MinIO | `http://34.27.230.166:9000` |
| Conta GCP | `pfelipebr@gmail.com` |
