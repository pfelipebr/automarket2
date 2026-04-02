import { useState } from 'react';
import type { SearchFilters } from '../types';

interface Props {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}

export default function SearchFilters({ filters, onChange }: Props) {
  const [local, setLocal] = useState<SearchFilters>(filters);

  function update(key: keyof SearchFilters, value: string | number | undefined) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onChange({ ...local, page: 1 });
  }

  function handleClear() {
    const cleared: SearchFilters = {
      lat: filters.lat,
      lng: filters.lng,
      radius_km: filters.radius_km,
      page: 1,
    };
    setLocal(cleared);
    onChange(cleared);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#273549',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    color: '#f1f5f9',
    padding: '0.45rem 0.65rem',
    fontSize: '0.875rem',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
    display: 'block',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '0.75rem',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Filtros</span>
        <button type="button" onClick={handleClear} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer' }}>
          Limpar
        </button>
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}>
        Buscar
      </button>

      <div style={fieldStyle}>
        <label style={labelStyle}>Raio de busca</label>
        <select
          style={inputStyle}
          value={local.radius_km ?? 5}
          onChange={(e) => update('radius_km', Number(e.target.value))}
        >
          {[1, 2, 5, 10, 25, 50, 100, 200, 500].map((r) => (
            <option key={r} value={r}>{r} km</option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Marca</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Ex: Toyota"
          value={local.brand ?? ''}
          onChange={(e) => update('brand', e.target.value || undefined)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Modelo</label>
        <input
          style={inputStyle}
          type="text"
          placeholder="Ex: Corolla"
          value={local.model ?? ''}
          onChange={(e) => update('model', e.target.value || undefined)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Condição</label>
        <select
          style={inputStyle}
          value={local.condition ?? ''}
          onChange={(e) => update('condition', e.target.value || undefined)}
        >
          <option value="">Todas</option>
          <option value="new">Novo (0km)</option>
          <option value="used">Usado</option>
          <option value="certified">Certificado</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Preço mín.</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="R$"
            value={local.min_price ?? ''}
            onChange={(e) => update('min_price', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Preço máx.</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="R$"
            value={local.max_price ?? ''}
            onChange={(e) => update('max_price', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Km mín.</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="0"
            value={local.min_km ?? ''}
            onChange={(e) => update('min_km', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Km máx.</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="∞"
            value={local.max_km ?? ''}
            onChange={(e) => update('max_km', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Ano de</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="2000"
            value={local.year_from ?? ''}
            onChange={(e) => update('year_from', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Ano até</label>
          <input
            style={inputStyle}
            type="number"
            placeholder={String(new Date().getFullYear())}
            value={local.year_to ?? ''}
            onChange={(e) => update('year_to', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Combustível</label>
        <select
          style={inputStyle}
          value={local.fuel ?? ''}
          onChange={(e) => update('fuel', e.target.value || undefined)}
        >
          <option value="">Todos</option>
          <option value="flex">Flex</option>
          <option value="gasoline">Gasolina</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Elétrico</option>
          <option value="hybrid">Híbrido</option>
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Câmbio</label>
        <select
          style={inputStyle}
          value={local.transmission ?? ''}
          onChange={(e) => update('transmission', e.target.value || undefined)}
        >
          <option value="">Todos</option>
          <option value="manual">Manual</option>
          <option value="automatic">Automático</option>
          <option value="cvt">CVT</option>
        </select>
      </div>

    </form>
  );
}
