export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface VehicleFeatures {
  transmission: 'manual' | 'automatic' | 'cvt';
  fuel: 'flex' | 'gasoline' | 'diesel' | 'electric' | 'hybrid';
  color: string;
  doors: number;
  ac: boolean;
  power_steering: boolean;
  abs: boolean;
  airbags: number;
}

export interface VehicleImage {
  id: string;
  url: string;
  order: number;
  is_cover: boolean;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  version?: string | null;
  year_fab: number;
  year_model: number;
  mileage_km: number;
  price: number;
  condition: 'new' | 'used' | 'certified';
  status?: 'active' | 'paused' | 'sold';
  description?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
  distance_km?: number | null;
  cover_image_url?: string | null;
  user?: User | null;
  features?: VehicleFeatures | null;
  images?: VehicleImage[];
}

export interface VehicleMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface VehicleListResponse {
  data: Vehicle[];
  meta: VehicleMeta;
}

export interface SearchFilters {
  lat?: number;
  lng?: number;
  radius_km?: number;
  brand?: string;
  model?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  min_km?: number;
  max_km?: number;
  year_from?: number;
  year_to?: number;
  fuel?: string;
  transmission?: string;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'nearest';
}

export interface CreateVehiclePayload {
  brand: string;
  model: string;
  version?: string;
  year_fab: number;
  year_model: number;
  mileage_km: number;
  price: number;
  condition: 'new' | 'used' | 'certified';
  description?: string;
  lat: number;
  lng: number;
  neighborhood?: string;
  city: string;
  state: string;
  features?: Omit<VehicleFeatures, never>;
}
