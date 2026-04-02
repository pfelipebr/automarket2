import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMyVehicles, deleteVehicle, updateVehicleStatus } from '../api/client';

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function resolveUrl(url: string) {
  if (url.startsWith('http://minio-svc')) return url.replace('http://minio-svc', 'http://localhost');
  return url;
}

const statusLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', sold: 'Vendido' };

export default function MyAds() {
  const queryClient = useQueryClient();

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['my-vehicles'],
    queryFn: getMyVehicles,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['my-vehicles'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' | 'sold' }) =>
      updateVehicleStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-vehicles'] }),
  });

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#94a3b8' }}>
        Carregando anúncios...
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.1rem' }}>Meus Anúncios</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            {vehicles.length} anúncio{vehicles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/vehicles/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + Novo anúncio
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚗</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Nenhum anúncio ainda
          </div>
          <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
            Comece anunciando seu veículo agora mesmo.
          </p>
          <Link to="/vehicles/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Anunciar veículo
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {vehicles.map((v) => (
            <div
              key={v.id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: '120px 1fr auto',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              {/* Thumb */}
              <div style={{ height: '80px', background: '#0f172a', borderRadius: '0.5rem', overflow: 'hidden' }}>
                {v.cover_image_url ? (
                  <img src={resolveUrl(v.cover_image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', color: '#334155' }}>🚗</div>
                )}
              </div>

              {/* Info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700 }}>{v.brand} {v.model}</span>
                  <span className={`badge badge-${v.status}`}>{statusLabel[v.status ?? 'active']}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  {v.year_fab}/{v.year_model} · {v.mileage_km?.toLocaleString('pt-BR')} km · {v.city}, {v.state}
                </div>
                <div style={{ fontWeight: 800, color: '#38bdf8' }}>{formatPrice(v.price)}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '160px' }}>
                <Link
                  to={`/vehicles/${v.id}/edit`}
                  className="btn btn-ghost"
                  style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '0.8rem' }}
                >
                  ✏️ Editar
                </Link>

                {v.status === 'active' ? (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                    onClick={() => statusMutation.mutate({ id: v.id, status: 'paused' })}
                    disabled={statusMutation.isPending}
                  >
                    ⏸ Pausar
                  </button>
                ) : v.status === 'paused' ? (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                    onClick={() => statusMutation.mutate({ id: v.id, status: 'active' })}
                    disabled={statusMutation.isPending}
                  >
                    ▶️ Reativar
                  </button>
                ) : null}

                {v.status !== 'sold' && (
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                    onClick={() => statusMutation.mutate({ id: v.id, status: 'sold' })}
                    disabled={statusMutation.isPending}
                  >
                    ✅ Vendido
                  </button>
                )}

                {confirmDeleteId === v.id ? (
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                      onClick={() => deleteMutation.mutate(v.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? '...' : 'Confirmar'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: '0.75rem', justifyContent: 'center' }}
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.8rem', justifyContent: 'center' }}
                    onClick={() => setConfirmDeleteId(v.id)}
                  >
                    🗑 Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
