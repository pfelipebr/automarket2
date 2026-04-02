import { useAuthStore } from '../store/auth';
import type {
  Vehicle,
  VehicleListResponse,
  SearchFilters,
  User,
  CreateVehiclePayload,
} from '../types';

const BASE = '';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401 && retry) {
    // Try refreshing the token
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      const store = useAuthStore.getState();
      if (store.user) store.setAuth(data.access_token, store.user);
      return apiFetch<T>(path, options, false);
    } else {
      useAuthStore.getState().clearAuth();
      throw new Error('Sessão expirada. Faça login novamente.');
    }
  }

  if (!res.ok) {
    let errorMsg = `Erro ${res.status}`;
    try {
      const err = await res.json();
      errorMsg = err.error ?? err.message ?? errorMsg;
    } catch { /* ignore */ }
    throw new Error(errorMsg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export async function login(email: string, password: string) {
  const data = await apiFetch<{ user: User; access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  useAuthStore.getState().setAuth(data.access_token, data.user);
  return data;
}

export async function register(payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const data = await apiFetch<{ user: User; access_token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  useAuthStore.getState().setAuth(data.access_token, data.user);
  return data;
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' });
  useAuthStore.getState().clearAuth();
}

export async function refreshToken(): Promise<string | null> {
  try {
    const data = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!data.ok) return null;
    const json = await data.json();
    return json.access_token as string;
  } catch {
    return null;
  }
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/me');
}

export async function updateMe(payload: { name?: string; phone?: string }): Promise<User> {
  return apiFetch<User>('/me', { method: 'PATCH', body: JSON.stringify(payload) });
}

// Vehicles
export async function searchVehicles(filters: SearchFilters): Promise<VehicleListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  });
  return apiFetch<VehicleListResponse>(`/vehicles?${params.toString()}`);
}

export async function getVehicle(id: string): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}`);
}

export async function createVehicle(payload: CreateVehiclePayload): Promise<Vehicle> {
  return apiFetch<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateVehicle(
  id: string,
  payload: Partial<CreateVehiclePayload>,
): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteVehicle(id: string): Promise<void> {
  return apiFetch<void>(`/vehicles/${id}`, { method: 'DELETE' });
}

export async function updateVehicleStatus(
  id: string,
  status: 'active' | 'paused' | 'sold',
): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function uploadVehicleImage(vehicleId: string, file: File) {
  const token = useAuthStore.getState().accessToken;
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE}/vehicles/${vehicleId}/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao fazer upload da imagem');
  return res.json();
}

export async function getMyVehicles(): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>('/me/vehicles');
}

// Favorites
export async function getFavorites() {
  return apiFetch<{ vehicle_id: string; vehicle: Vehicle }[]>('/favorites');
}

export async function addFavorite(vehicleId: string) {
  return apiFetch(`/favorites/${vehicleId}`, { method: 'POST' });
}

export async function removeFavorite(vehicleId: string) {
  return apiFetch<void>(`/favorites/${vehicleId}`, { method: 'DELETE' });
}

// Geocoding via Nominatim
export async function geocodeCity(
  city: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
