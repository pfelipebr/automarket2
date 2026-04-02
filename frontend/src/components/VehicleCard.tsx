import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { addFavorite, removeFavorite } from '../api/client';
import type { Vehicle } from '../types';

interface Props {
  vehicle: Vehicle;
  isFavorited?: boolean;
  onFavoriteChange?: (vehicleId: string, favorited: boolean) => void;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Rewrite internal MinIO URLs for local dev
  if (url.startsWith('http://minio-svc')) {
    return url.replace('http://minio-svc', 'http://localhost');
  }
  return url;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function formatMileage(km: number) {
  return new Intl.NumberFormat('pt-BR').format(km) + ' km';
}

const conditionLabel: Record<string, string> = {
  new: 'Novo',
  used: 'Usado',
  certified: 'Certificado',
};

export default function VehicleCard({ vehicle, isFavorited = false, onFavoriteChange }: Props) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [favorited, setFavorited] = useState(isFavorited);
  const [loadingFav, setLoadingFav] = useState(false);
  const imageUrl = resolveImageUrl(vehicle.cover_image_url);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/login'); return; }
    setLoadingFav(true);
    try {
      if (favorited) {
        await removeFavorite(vehicle.id);
        setFavorited(false);
        onFavoriteChange?.(vehicle.id, false);
      } else {
        await addFavorite(vehicle.id);
        setFavorited(true);
        onFavoriteChange?.(vehicle.id, true);
      }
    } catch { /* ignore */ }
    setLoadingFav(false);
  }

  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          transition: 'border-color 0.2s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#38bdf8';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', height: '180px', background: '#0f172a' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${vehicle.brand} ${vehicle.model}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem',
                color: '#334155',
              }}
            >
              🚗
            </div>
          )}
          {/* Favorite button */}
          <button
            onClick={toggleFavorite}
            disabled={loadingFav}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'rgba(15,23,42,0.8)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            title={favorited ? 'Remover favorito' : 'Favoritar'}
          >
            {favorited ? '❤️' : '🤍'}
          </button>
          {/* Condition badge */}
          <span
            className={`badge badge-${vehicle.condition}`}
            style={{ position: 'absolute', top: '0.5rem', left: '0.5rem' }}
          >
            {conditionLabel[vehicle.condition]}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '0.875rem' }}>
          <div style={{ marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
              {vehicle.brand}
            </div>
            <div
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#f1f5f9',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {vehicle.model}
              {vehicle.version ? (
                <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.85rem' }}>
                  {' '}{vehicle.version}
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              fontSize: '0.8rem',
              color: '#64748b',
              marginBottom: '0.5rem',
            }}
          >
            <span>{vehicle.year_fab}/{vehicle.year_model}</span>
            <span>·</span>
            <span>{formatMileage(vehicle.mileage_km)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
                {formatPrice(vehicle.price)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {vehicle.neighborhood ? `${vehicle.neighborhood}, ` : ''}{vehicle.city}, {vehicle.state}
                {vehicle.distance_km != null ? (
                  <span style={{ marginLeft: '0.4rem', color: '#94a3b8' }}>
                    · {vehicle.distance_km} km de você
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
