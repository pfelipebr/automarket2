import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchVehicles, geocodeCity } from '../api/client';
import { useAuthStore } from '../store/auth';
import VehicleCard from '../components/VehicleCard';
import SearchFiltersPanel from '../components/SearchFilters';
import VehicleMapView from '../components/VehicleMapView';
import type { SearchFilters } from '../types';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Mais relevantes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'newest', label: 'Mais recentes' },
  { value: 'nearest', label: 'Mais próximos' },
];

export default function Home() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<SearchFilters>({ page: 1, limit: 20, sort: 'relevance', radius_km: 5 });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [geocodingCity, setGeocodingCity] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [geoGranted, setGeoGranted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setGeoGranted(false); return; }
    setGeoGranted(false);
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoGranted(false);
      setLocationError('❌ navigator.geolocation não existe neste browser.');
      return;
    }
    setGeoGranted(null);
    setLocationError('⏳ Chamando getCurrentPosition...');

    const permState = navigator.permissions
      ? '(Permissions API disponível)'
      : '(Permissions API indisponível)';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoGranted(true);
        setLocationError('');
        setFilters((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setMapView(true);
      },
      (err) => {
        setGeoGranted(false);
        const labels: Record<number, string> = {
          1: 'PERMISSION_DENIED',
          2: 'POSITION_UNAVAILABLE',
          3: 'TIMEOUT',
        };
        setLocationError(
          `Erro ${err.code} — ${labels[err.code] ?? 'UNKNOWN'}: "${err.message}" ${permState}. ` +
          `Verifique: Ajustes iOS → Privacidade → Serviços de Localização → Sites Safari → Ao Usar o App`
        );
      },
      { timeout: 10000 },
    );
  }

  async function handleCitySearch(e: React.FormEvent) {
    e.preventDefault();
    if (!cityInput.trim()) return;
    setGeocodingCity(true);
    setLocationError('');
    const result = await geocodeCity(cityInput);
    setGeocodingCity(false);
    if (result) {
      setFilters((f) => ({ ...f, lat: result.lat, lng: result.lng, page: 1 }));
    } else {
      setLocationError('Cidade não encontrada. Tente outro nome.');
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => searchVehicles(filters),
  });

  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  function handleFavoriteChange(vehicleId: string, favorited: boolean) {
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (favorited) next.add(vehicleId); else next.delete(vehicleId);
      return next;
    });
  }

  const totalPages = data?.meta.total_pages ?? 1;

  return (
    <div className="page-container">
      {/* Location bar */}
      <div className="location-bar">

        {/* Linha 1: status / botão de localização */}
        <div className="location-status">
          {geoGranted === true ? (
            <>
              <span style={{ color: '#34d399', fontSize: '0.9rem' }}>
                📍 Localização detectada — mostrando veículos próximos a você
              </span>
              {locationError && <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{locationError}</span>}
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={requestLocation}
                disabled={geoGranted === null}
                style={{ whiteSpace: 'nowrap' }}
              >
                {geoGranted === null ? '⏳ Detectando...' : '📍 Usar minha localização'}
              </button>
              {locationError && <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{locationError}</span>}
            </>
          )}
        </div>

        {/* Linha 2: atualizar (se localização ativa) ou campo de cidade */}
        <div className="location-actions">
          {geoGranted === true ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={requestLocation}
              style={{ whiteSpace: 'nowrap' }}
            >
              🔄 Atualizar
            </button>
          ) : (
            <form onSubmit={handleCitySearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
              <input
                type="text"
                placeholder="ou digite sua cidade (ex: São Paulo, SP)"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#273549',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#f1f5f9',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              <button type="submit" className="btn btn-ghost" disabled={geocodingCity}>
                {geocodingCity ? '...' : 'Buscar'}
              </button>
            </form>
          )}
        </div>

        {/* Linha 3: ordenação */}
        <div className="location-sort">
          <select
            value={filters.sort ?? 'relevance'}
            onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as SearchFilters['sort'], page: 1 }))}
            style={{
              background: '#273549',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#f1f5f9',
              padding: '0.45rem 0.65rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Toolbar: filtros (mobile only) + visualizar mapa (always) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-ghost filter-toggle-btn"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{ gap: '0.5rem' }}
        >
          <span>⚙</span>
          {filtersOpen ? 'Ocultar filtros' : 'Filtros'}
        </button>
        <button
          type="button"
          className={`btn ${mapView ? 'btn-primary' : 'btn-ghost'} map-toggle-btn`}
          onClick={() => setMapView((v) => !v)}
          style={{ gap: '0.5rem' }}
        >
          <span>🗺️</span>
          {mapView ? 'Ver lista' : 'Visualizar no mapa'}
        </button>
      </div>

      <div className="home-layout">
        {/* Sidebar filters */}
        <aside
          className={`filters-sidebar${filtersOpen ? ' open' : ''}`}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            padding: '1rem',
            position: 'sticky',
            top: '72px',
          }}
        >
          <SearchFiltersPanel
            filters={filters}
            onChange={(f) => { setFilters({ ...filters, ...f }); setFiltersOpen(false); }}
          />
        </aside>

        {/* Results */}
        <div>
          {/* Result count */}
          {data && (
            <div style={{ marginBottom: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
              {data.meta.total.toLocaleString('pt-BR')} veículos encontrados
              {filters.lat !== undefined ? ` no raio de ${filters.radius_km ?? 100} km` : ''}
            </div>
          )}

          {isLoading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              Carregando veículos...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#f87171' }}>
              Erro ao carregar veículos. Tente novamente.
            </div>
          )}

          {data && data.data.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                Nenhum veículo encontrado
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                Tente ajustar os filtros ou aumentar o raio de busca.
              </div>
            </div>
          )}

          {data && data.data.length > 0 && !mapView && (
            <div className="vehicles-grid">
              {data.data.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  isFavorited={user ? favoritedIds.has(v.id) : false}
                  onFavoriteChange={handleFavoriteChange}
                />
              ))}
            </div>
          )}

          {data && data.data.length > 0 && mapView && (
            <VehicleMapView
              vehicles={data.data}
              userLat={filters.lat}
              userLng={filters.lng}
              onSearchArea={(lat, lng) =>
                setFilters((f) => ({ ...f, lat, lng, page: 1 }))
              }
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && !mapView && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '2rem',
              }}
            >
              <button
                className="btn btn-ghost"
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                ← Anterior
              </button>
              <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Página {filters.page} de {totalPages}
              </span>
              <button
                className="btn btn-ghost"
                disabled={filters.page === totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
