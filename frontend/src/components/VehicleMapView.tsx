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

interface Cluster {
  lat: number;
  lng: number;
  vehicles: Vehicle[];
  minPrice: number;
  maxPrice: number;
}

// Greedy distance-based clustering (~0.015 deg ≈ ~1.5 km)
const CLUSTER_RADIUS = 0.015;

function clusterVehicles(vehicles: Vehicle[]): Cluster[] {
  const remaining = vehicles.filter((v) => v.lat != null && v.lng != null);
  const clusters: Cluster[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members: Vehicle[] = [seed];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const v = remaining[i];
      const dlat = (v.lat ?? 0) - (seed.lat ?? 0);
      const dlng = (v.lng ?? 0) - (seed.lng ?? 0);
      if (Math.sqrt(dlat * dlat + dlng * dlng) <= CLUSTER_RADIUS) {
        members.push(v);
        remaining.splice(i, 1);
      }
    }

    const lat = members.reduce((s, v) => s + (v.lat ?? 0), 0) / members.length;
    const lng = members.reduce((s, v) => s + (v.lng ?? 0), 0) / members.length;
    const prices = members.map((v) => v.price);

    clusters.push({
      lat,
      lng,
      vehicles: members,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    });
  }

  return clusters;
}

function formatPriceShort(price: number): string {
  if (price >= 1_000_000) return `R$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `R$${Math.round(price / 1_000)}mil`;
  return `R$${price}`;
}

function clusterLabel(cluster: Cluster): string {
  if (cluster.vehicles.length === 1) {
    return formatPriceShort(cluster.minPrice);
  }
  const lo = formatPriceShort(cluster.minPrice);
  const hi = formatPriceShort(cluster.maxPrice);
  if (lo === hi) return `${lo} (${cluster.vehicles.length})`;
  return `${lo} – ${hi}`;
}

function clusterSizeClass(count: number): string {
  if (count === 1) return 'map-cluster-sm';
  if (count <= 7) return 'map-cluster-md';
  return 'map-cluster-lg';
}

// Recentraliza o mapa quando as coords mudam
function MapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 13); }, [lat, lng]);
  return null;
}

function ClusterMarkers({
  vehicles,
  onSelectVehicle,
}: {
  vehicles: Vehicle[];
  onSelectVehicle: (v: Vehicle) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const clusters = clusterVehicles(vehicles);

    clusters.forEach((cluster) => {
      const sizeClass = clusterSizeClass(cluster.vehicles.length);
      const label = clusterLabel(cluster);
      const countBadge =
        cluster.vehicles.length > 1
          ? `<span class="map-cluster-count">${cluster.vehicles.length}</span>`
          : '';

      const icon = L.divIcon({
        className: '',
        html: `<div class="${sizeClass}">${label}${countBadge}</div>`,
        iconAnchor: [0, 0],
      });

      const marker = L.marker([cluster.lat, cluster.lng], { icon }).addTo(map);

      if (cluster.vehicles.length === 1) {
        marker.on('click', () => onSelectVehicle(cluster.vehicles[0]));
      } else {
        // Zoom into the cluster
        marker.on('click', () => {
          map.flyTo([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 17), {
            duration: 0.5,
          });
        });
      }

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
    };
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
          <MapCenter lat={userLat} lng={userLng} />
        )}

        <ClusterMarkers
          vehicles={vehicles}
          onSelectVehicle={(v) => navigate(`/vehicles/${v.id}`)}
        />

        {userLat != null && userLng != null && (
          <UserMarker lat={userLat} lng={userLng} />
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
        {vehicles.length} anúncios · bolha única = toque para zoom · 1 carro = toque para detalhes
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
