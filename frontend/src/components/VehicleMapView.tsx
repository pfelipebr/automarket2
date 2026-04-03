import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Vehicle } from '../types';

interface Props {
  vehicles: Vehicle[];
  userLat?: number;
  userLng?: number;
}

function formatPriceShort(price: number): string {
  if (price >= 1_000_000) return `R$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `R$${Math.round(price / 1_000)}mil`;
  return `R$${price}`;
}

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://minio-svc')) return url.replace('http://minio-svc', 'http://localhost');
  return url;
}

// Recentraliza o mapa quando as coords mudam
function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 13); }, [lat, lng]);
  return null;
}

// Renderiza os marcadores via Leaflet puro (sem react-leaflet Marker) para usar divIcon customizado
function Markers({ vehicles, onSelect }: { vehicles: Vehicle[]; onSelect: (v: Vehicle) => void }) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Remove marcadores anteriores
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    vehicles.forEach((v) => {
      if (v.lat == null || v.lng == null) return;

      const icon = L.divIcon({
        className: '',
        html: `<div class="map-price-marker">${formatPriceShort(v.price)}</div>`,
        iconAnchor: [0, 0],
      });

      const marker = L.marker([v.lat, v.lng], { icon })
        .addTo(map)
        .on('click', () => onSelect(v));

      markersRef.current.push(marker);
    });

    return () => { markersRef.current.forEach((m) => m.remove()); };
  }, [vehicles, map]);

  return null;
}

export default function VehicleMapView({ vehicles, userLat, userLng }: Props) {
  const navigate = useNavigate();
  const defaultLat = userLat ?? -23.5505;
  const defaultLng = userLng ?? -46.6333;

  return (
    <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #334155' }}>
      <MapContainer
        center={[defaultLat, defaultLng]}
        zoom={13}
        style={{ height: 'calc(100vh - 280px)', minHeight: '400px', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {userLat != null && userLng != null && (
          <>
            <MapCenter lat={userLat} lng={userLng} />
            <Markers
              vehicles={vehicles}
              onSelect={(v) => navigate(`/vehicles/${v.id}`)}
            />
            {/* Marcador de posição do usuário */}
            <UserMarker lat={userLat} lng={userLng} />
          </>
        )}

        {(userLat == null || userLng == null) && (
          <Markers
            vehicles={vehicles}
            onSelect={(v) => navigate(`/vehicles/${v.id}`)}
          />
        )}
      </MapContainer>

      {/* Legenda */}
      <div style={{
        position: 'absolute',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid #334155',
        borderRadius: '2rem',
        padding: '0.4rem 1rem',
        fontSize: '0.8rem',
        color: '#94a3b8',
        pointerEvents: 'none',
        zIndex: 1000,
        whiteSpace: 'nowrap',
      }}>
        {vehicles.length} anúncios no mapa · toque no preço para ver detalhes
      </div>
    </div>
  );
}

// Marcador azul do usuário
function UserMarker({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) markerRef.current.remove();

    const icon = L.divIcon({
      className: '',
      html: `<div class="map-user-marker"></div>`,
      iconAnchor: [12, 12],
    });

    markerRef.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
    return () => { markerRef.current?.remove(); };
  }, [lat, lng, map]);

  return null;
}
