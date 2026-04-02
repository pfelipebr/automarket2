import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { createVehicle, uploadVehicleImage, geocodeCity } from '../api/client';
import type { CreateVehiclePayload } from '../types';

type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  photos: File[];
  coverIndex: number;
  brand: string;
  model: string;
  version: string;
  year_fab: string;
  year_model: string;
  mileage_km: string;
  price: string;
  condition: 'new' | 'used' | 'certified';
  description: string;
  transmission: 'manual' | 'automatic' | 'cvt';
  fuel: 'flex' | 'gasoline' | 'diesel' | 'electric' | 'hybrid';
  color: string;
  doors: string;
  ac: boolean;
  power_steering: boolean;
  abs: boolean;
  airbags: string;
  city_input: string;
  neighborhood: string;
  lat: number | null;
  lng: number | null;
  city: string;
  state: string;
}

const STEP_TITLES = [
  'Fotos',
  'Dados básicos',
  'Características',
  'Localização',
  'Revisão',
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#273549',
  border: '1px solid #334155',
  borderRadius: '0.375rem',
  color: '#f1f5f9',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.3rem',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '1rem' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function CreateVehicle() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormData>({
    photos: [],
    coverIndex: 0,
    brand: '',
    model: '',
    version: '',
    year_fab: String(new Date().getFullYear()),
    year_model: String(new Date().getFullYear()),
    mileage_km: '0',
    price: '',
    condition: 'used',
    description: '',
    transmission: 'manual',
    fuel: 'flex',
    color: '',
    doors: '4',
    ac: false,
    power_steering: false,
    abs: false,
    airbags: '0',
    city_input: '',
    neighborhood: '',
    lat: null,
    lng: null,
    city: '',
    state: '',
  });

  function upd<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleGeocode() {
    if (!form.city_input.trim()) return;
    setGeocoding(true);
    setError('');
    const query = form.neighborhood.trim()
      ? `${form.neighborhood}, ${form.city_input}`
      : form.city_input;
    const result = await geocodeCity(query);
    setGeocoding(false);
    if (result) {
      const parts = form.city_input.split(',').map((s) => s.trim());
      upd('lat', result.lat);
      upd('lng', result.lng);
      upd('city', parts[0] ?? form.city_input);
      upd('state', parts[1]?.substring(0, 2).toUpperCase() ?? '');
    } else {
      setError('Localização não encontrada. Tente "São Paulo, SP".');
    }
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 15 - form.photos.length;
    upd('photos', [...form.photos, ...files.slice(0, remaining)]);
  }

  function removePhoto(index: number) {
    const photos = form.photos.filter((_, i) => i !== index);
    upd('photos', photos);
    if (form.coverIndex >= photos.length) upd('coverIndex', Math.max(0, photos.length - 1));
  }

  async function handleSubmit() {
    setError('');
    if (!form.lat || !form.lng) { setError('Defina a localização antes de publicar.'); return; }
    if (!form.state || form.state.length !== 2) { setError('UF inválida. Volte à localização e confirme no formato "Cidade, UF" (ex: São Paulo, SP).'); return; }
    setLoading(true);
    try {
      const payload: CreateVehiclePayload = {
        brand: form.brand,
        model: form.model,
        version: form.version || undefined,
        year_fab: parseInt(form.year_fab),
        year_model: parseInt(form.year_model),
        mileage_km: parseInt(form.mileage_km),
        price: parseFloat(form.price),
        condition: form.condition,
        description: form.description || undefined,
        lat: form.lat,
        lng: form.lng,
        neighborhood: form.neighborhood || undefined,
        city: form.city,
        state: form.state,
        features: {
          transmission: form.transmission,
          fuel: form.fuel,
          color: form.color,
          doors: parseInt(form.doors),
          ac: form.ac,
          power_steering: form.power_steering,
          abs: form.abs,
          airbags: parseInt(form.airbags),
        },
      };

      const vehicle = await createVehicle(payload);

      if (form.photos.length > 0) {
        // Upload cover first
        const orderedPhotos = [
          form.photos[form.coverIndex],
          ...form.photos.filter((_, i) => i !== form.coverIndex),
        ];
        for (const photo of orderedPhotos) {
          await uploadVehicleImage(vehicle.id, photo);
        }
      }

      navigate(`/vehicles/${vehicle.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar anúncio');
    }
    setLoading(false);
  }

  return (
    <div className="page-container" style={{ maxWidth: '680px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
        {editId ? 'Editar anúncio' : 'Anunciar veículo'}
      </h1>

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', marginTop: '1rem' }}>
        {STEP_TITLES.map((title, i) => {
          const s = (i + 1) as Step;
          const active = s === step;
          const done = s < step;
          return (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: done ? '#059669' : active ? '#38bdf8' : '#334155',
                  color: done || active ? '#fff' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  margin: '0 auto 0.25rem',
                  cursor: done ? 'pointer' : 'default',
                }}
                onClick={() => done && setStep(s)}
              >
                {done ? '✓' : s}
              </div>
              <div style={{ fontSize: '0.7rem', color: active ? '#38bdf8' : '#94a3b8', fontWeight: active ? 700 : 400 }}>
                {title}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.5rem' }}>
        {/* Step 1: Photos */}
        {step === 1 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Fotos do veículo</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Até 15 fotos. A primeira será a capa (ou escolha abaixo).
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoAdd}
              style={{ display: 'none' }}
            />
            {form.photos.length < 15 && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginBottom: '1rem', width: '100%', justifyContent: 'center', height: '80px', borderStyle: 'dashed' }}
                onClick={() => fileInputRef.current?.click()}
              >
                + Adicionar fotos
              </button>
            )}
            {form.photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {form.photos.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                      border: i === form.coverIndex ? '2px solid #38bdf8' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => upd('coverIndex', i)}
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }}
                    />
                    {i === form.coverIndex && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(56,189,248,0.85)', fontSize: '0.65rem', textAlign: 'center', color: '#fff', fontWeight: 700, padding: '2px' }}>
                        CAPA
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(15,23,42,0.8)', border: 'none', color: '#f87171', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.65rem', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Basic data */}
        {step === 2 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Dados básicos</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <Field label="Marca">
                <input style={inputStyle} value={form.brand} onChange={(e) => upd('brand', e.target.value)} placeholder="Ex: Toyota" required />
              </Field>
              <Field label="Modelo">
                <input style={inputStyle} value={form.model} onChange={(e) => upd('model', e.target.value)} placeholder="Ex: Corolla" required />
              </Field>
            </div>
            <Field label="Versão (opcional)">
              <input style={inputStyle} value={form.version} onChange={(e) => upd('version', e.target.value)} placeholder="Ex: 2.0 XEi" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <Field label="Ano fabricação">
                <input style={inputStyle} type="number" value={form.year_fab} onChange={(e) => upd('year_fab', e.target.value)} />
              </Field>
              <Field label="Ano modelo">
                <input style={inputStyle} type="number" value={form.year_model} onChange={(e) => upd('year_model', e.target.value)} />
              </Field>
              <Field label="Kilometragem">
                <input style={inputStyle} type="number" value={form.mileage_km} onChange={(e) => upd('mileage_km', e.target.value)} min="0" />
              </Field>
              <Field label="Preço (R$)">
                <input style={inputStyle} type="number" value={form.price} onChange={(e) => upd('price', e.target.value)} min="0" step="0.01" placeholder="0.00" required />
              </Field>
            </div>
            <Field label="Condição">
              <select style={inputStyle} value={form.condition} onChange={(e) => upd('condition', e.target.value as FormData['condition'])}>
                <option value="new">Novo (0km)</option>
                <option value="used">Usado</option>
                <option value="certified">Certificado</option>
              </select>
            </Field>
            <Field label="Descrição (opcional)">
              <textarea
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                value={form.description}
                onChange={(e) => upd('description', e.target.value)}
                placeholder="Descreva o estado do veículo, histórico de revisões, etc."
              />
            </Field>
          </div>
        )}

        {/* Step 3: Features */}
        {step === 3 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Características</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
              <Field label="Câmbio">
                <select style={inputStyle} value={form.transmission} onChange={(e) => upd('transmission', e.target.value as FormData['transmission'])}>
                  <option value="manual">Manual</option>
                  <option value="automatic">Automático</option>
                  <option value="cvt">CVT</option>
                </select>
              </Field>
              <Field label="Combustível">
                <select style={inputStyle} value={form.fuel} onChange={(e) => upd('fuel', e.target.value as FormData['fuel'])}>
                  <option value="flex">Flex</option>
                  <option value="gasoline">Gasolina</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Elétrico</option>
                  <option value="hybrid">Híbrido</option>
                </select>
              </Field>
              <Field label="Cor">
                <input style={inputStyle} value={form.color} onChange={(e) => upd('color', e.target.value)} placeholder="Ex: Branco" />
              </Field>
              <Field label="Portas">
                <select style={inputStyle} value={form.doors} onChange={(e) => upd('doors', e.target.value)}>
                  <option value="2">2</option>
                  <option value="4">4</option>
                </select>
              </Field>
              <Field label="Airbags">
                <input style={inputStyle} type="number" value={form.airbags} onChange={(e) => upd('airbags', e.target.value)} min="0" />
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              {([['ac', 'Ar-condicionado'], ['power_steering', 'Direção assistida'], ['abs', 'ABS']] as [keyof FormData, string][]).map(([key, label]) => (
                <label
                  key={key}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: '#273549', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #334155' }}
                >
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={(e) => upd(key, e.target.checked as FormData[typeof key])}
                    style={{ accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Location */}
        {step === 4 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Localização</h2>
            <Field label="Bairro (opcional)">
              <input
                style={inputStyle}
                value={form.neighborhood}
                onChange={(e) => upd('neighborhood', e.target.value)}
                placeholder="Ex: Jardins"
              />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 0.5rem', alignItems: 'end' }}>
              <Field label="Cidade, Estado (ex: São Paulo, SP)">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={form.city_input}
                    onChange={(e) => upd('city_input', e.target.value)}
                    placeholder="Ex: São Paulo, SP"
                    onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleGeocode} disabled={geocoding} style={{ whiteSpace: 'nowrap' }}>
                    {geocoding ? '...' : 'Confirmar'}
                  </button>
                </div>
              </Field>
            </div>

            {form.lat && form.lng && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '0 1rem', marginBottom: '1rem' }}>
                <Field label="Cidade (extraída)">
                  <input
                    style={inputStyle}
                    value={form.city}
                    onChange={(e) => upd('city', e.target.value)}
                    placeholder="Cidade"
                  />
                </Field>
                <Field label="UF">
                  <input
                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                    value={form.state}
                    onChange={(e) => upd('state', e.target.value.toUpperCase().substring(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                  />
                </Field>
              </div>
            )}

            {error && <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

            {form.lat && form.lng && (
              <div style={{ borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #334155' }}>
                <MapContainer center={[form.lat, form.lng]} zoom={13} style={{ height: '260px' }} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  <Marker position={[form.lat, form.lng]} />
                </MapContainer>
                <div style={{ padding: '0.75rem', background: '#273549', fontSize: '0.875rem', color: '#94a3b8' }}>
                  📍 {form.neighborhood ? `${form.neighborhood}, ` : ''}{form.city}, {form.state} · ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div>
            <h2 style={{ fontWeight: 700, marginBottom: '1.25rem' }}>Revisão do anúncio</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Fotos</span>
                <span>{form.photos.length} imagem{form.photos.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Veículo</span>
                <span>{form.brand} {form.model} {form.version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Ano</span>
                <span>{form.year_fab}/{form.year_model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Kilometragem</span>
                <span>{parseInt(form.mileage_km).toLocaleString('pt-BR')} km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Preço</span>
                <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '1.1rem' }}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(form.price) || 0)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Combustível</span>
                <span>{form.fuel}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Câmbio</span>
                <span>{form.transmission}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #273549' }}>
                <span style={{ color: '#94a3b8' }}>Localização</span>
                <span>{form.neighborhood ? `${form.neighborhood}, ` : ''}{form.city}, {form.state}</span>
              </div>
            </div>

            {error && (
              <div style={{ color: '#f87171', background: '#450a0a', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          {step > 1 ? (
            <button className="btn btn-ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              ← Voltar
            </button>
          ) : (
            <div />
          )}
          {step < 5 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => (s + 1) as Step)}>
              Próximo →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Publicando...' : '✓ Publicar anúncio'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
