import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getFavorites, removeFavorite } from '../api/client';

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function resolveUrl(url: string) {
  if (url.startsWith('http://minio-svc')) return url.replace('http://minio-svc', 'http://localhost');
  return url;
}

export default function Favorites() {
  const queryClient = useQueryClient();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
  });

  const removeMutation = useMutation({
    mutationFn: (vehicleId: string) => removeFavorite(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#94a3b8' }}>
        Carregando favoritos...
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Meus Favoritos</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {favorites.length} veículo{favorites.length !== 1 ? 's' : ''} salvo{favorites.length !== 1 ? 's' : ''}
      </p>

      {favorites.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💔</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Nenhum favorito ainda
          </div>
          <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
            Clique no coração de qualquer veículo para salvá-lo aqui.
          </p>
          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Buscar veículos
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {favorites.map(({ vehicle_id, vehicle }) => (
            <div
              key={vehicle_id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.75rem',
                overflow: 'hidden',
              }}
            >
              <Link to={`/vehicles/${vehicle.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ height: '160px', background: '#0f172a', overflow: 'hidden' }}>
                  {vehicle.cover_image_url ? (
                    <img
                      src={resolveUrl(vehicle.cover_image_url)}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: '#334155' }}>
                      🚗
                    </div>
                  )}
                </div>
                <div style={{ padding: '0.875rem 0.875rem 0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{vehicle.brand}</div>
                  <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                    {vehicle.model} {vehicle.version}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    {vehicle.year_fab}/{vehicle.year_model} · {vehicle.mileage_km.toLocaleString('pt-BR')} km
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
                    {formatPrice(vehicle.price)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {vehicle.city}, {vehicle.state}
                  </div>
                </div>
              </Link>
              <div style={{ padding: '0.5rem 0.875rem 0.875rem' }}>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={() => removeMutation.mutate(vehicle_id)}
                  disabled={removeMutation.isPending}
                >
                  🗑 Remover favorito
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
