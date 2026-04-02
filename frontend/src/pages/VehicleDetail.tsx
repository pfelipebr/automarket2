import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { getVehicle, addFavorite, removeFavorite } from '../api/client';
import { useAuthStore } from '../store/auth';

const conditionLabel: Record<string, string> = { new: 'Novo', used: 'Usado', certified: 'Certificado' };
const fuelLabel: Record<string, string> = { flex: 'Flex', gasoline: 'Gasolina', diesel: 'Diesel', electric: 'Elétrico', hybrid: 'Híbrido' };
const transmissionLabel: Record<string, string> = { manual: 'Manual', automatic: 'Automático', cvt: 'CVT' };

function formatPrice(price: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
}

function resolveUrl(url: string) {
  if (url.startsWith('http://minio-svc')) return url.replace('http://minio-svc', 'http://localhost');
  return url;
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [imgIndex, setImgIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => getVehicle(id!),
    enabled: !!id,
  });

  const favMutation = useMutation({
    mutationFn: () => favorited ? removeFavorite(id!) : addFavorite(id!),
    onSuccess: () => {
      setFavorited((f) => !f);
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  function handleFavorite() {
    if (!user) { navigate('/login'); return; }
    favMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#94a3b8' }}>
        Carregando veículo...
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: '4rem', color: '#f87171' }}>
        Veículo não encontrado. <Link to="/">Voltar</Link>
      </div>
    );
  }

  const images = vehicle.images ?? [];
  const currentImage = images[imgIndex];

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <Link to="/" style={{ color: '#94a3b8', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '1rem' }}>
        ← Voltar aos resultados
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: gallery + info */}
        <div>
          {/* Gallery */}
          <div style={{ background: '#0f172a', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '0.75rem', position: 'relative' }}>
            {currentImage ? (
              <img
                src={resolveUrl(currentImage.url)}
                alt={`${vehicle.brand} ${vehicle.model}`}
                style={{ width: '100%', height: '420px', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', color: '#334155' }}>
                🚗
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.8)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1rem', cursor: 'pointer' }}
                >←</button>
                <button
                  onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(15,23,42,0.8)', border: 'none', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1rem', cursor: 'pointer' }}
                >→</button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1.25rem' }}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIndex(i)}
                  style={{
                    flexShrink: 0,
                    width: '72px',
                    height: '54px',
                    border: i === imgIndex ? '2px solid #38bdf8' : '2px solid #334155',
                    borderRadius: '0.375rem',
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <img src={resolveUrl(img.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {/* Title & price */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
              {vehicle.brand} · <span className={`badge badge-${vehicle.condition}`}>{conditionLabel[vehicle.condition]}</span>
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              {vehicle.model} {vehicle.version}
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {vehicle.year_fab}/{vehicle.year_model} · {vehicle.mileage_km.toLocaleString('pt-BR')} km · {vehicle.neighborhood ? `${vehicle.neighborhood}, ` : ''}{vehicle.city}, {vehicle.state}
            </div>
          </div>

          {/* Attributes table */}
          {vehicle.features && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Características</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  ['Câmbio', transmissionLabel[vehicle.features.transmission]],
                  ['Combustível', fuelLabel[vehicle.features.fuel]],
                  ['Cor', vehicle.features.color],
                  ['Portas', vehicle.features.doors],
                  ['Ar-condicionado', vehicle.features.ac ? 'Sim' : 'Não'],
                  ['Direção', vehicle.features.power_steering ? 'Hidráulica/Elétrica' : 'Mecânica'],
                  ['ABS', vehicle.features.abs ? 'Sim' : 'Não'],
                  ['Airbags', vehicle.features.airbags],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #273549' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {vehicle.description && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Descrição</h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{vehicle.description}</p>
            </div>
          )}

          {/* Map */}
          {vehicle.lat !== undefined && vehicle.lng !== undefined && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ padding: '1rem 1rem 0' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Localização aproximada</h2>
              </div>
              <MapContainer
                center={[vehicle.lat, vehicle.lng]}
                zoom={13}
                style={{ height: '260px', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <Marker position={[vehicle.lat, vehicle.lng]}>
                  <Popup>{vehicle.neighborhood ? `${vehicle.neighborhood}, ` : ''}{vehicle.city}, {vehicle.state}</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
        </div>

        {/* Right: price card + seller */}
        <div style={{ position: 'sticky', top: '72px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.5rem' }}>
              {formatPrice(vehicle.price)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {vehicle.neighborhood ? `${vehicle.neighborhood}, ` : ''}{vehicle.city}, {vehicle.state}
            </div>

            <button
              onClick={handleFavorite}
              disabled={favMutation.isPending}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '0.75rem' }}
            >
              {favorited ? '❤️ Favoritado' : '🤍 Favoritar'}
            </button>

            {vehicle.user?.phone && (
              <a
                href={`https://wa.me/55${vehicle.user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, tenho interesse no ${vehicle.brand} ${vehicle.model} ${vehicle.year_fab}`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex' }}
              >
                💬 WhatsApp
              </a>
            )}
          </div>

          {/* Seller card */}
          {vehicle.user && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Anunciante
              </h3>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{vehicle.user.name}</div>
              {vehicle.user.phone && (
                <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{vehicle.user.phone}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
