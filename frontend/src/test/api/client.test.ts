import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../../store/auth';

// Reset store between tests
beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, initialized: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── searchVehicles ────────────────────────────────────────────────────────────

describe('searchVehicles', () => {
  it('builds correct query params, skipping undefined/null values', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { searchVehicles } = await import('../../api/client');
    await searchVehicles({ brand: 'Toyota', min_price: undefined, page: 1, limit: 20 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('brand=Toyota');
    expect(calledUrl).toContain('page=1');
    expect(calledUrl).not.toContain('min_price');
    expect(calledUrl).not.toContain('undefined');
  });

  it('includes Authorization header when token is set', async () => {
    useAuthStore.setState({ accessToken: 'my-jwt', user: null, initialized: false });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { searchVehicles } = await import('../../api/client');
    await searchVehicles({ page: 1 });

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('login', () => {
  it('stores token and user in auth store on success', async () => {
    const mockUser = { id: '1', name: 'Ana', email: 'ana@test.com' };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser, access_token: 'tok-123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { login } = await import('../../api/client');
    await login('ana@test.com', 'pass');

    const { accessToken, user } = useAuthStore.getState();
    expect(accessToken).toBe('tok-123');
    expect(user).toEqual(mockUser);
  });

  it('throws on invalid credentials (401)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Credenciais inválidas' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { login } = await import('../../api/client');
    await expect(login('x@x.com', 'wrong')).rejects.toThrow('Credenciais inválidas');
  });
});

// ── apiFetch retry on 401 ─────────────────────────────────────────────────────

describe('apiFetch — token refresh retry', () => {
  it('retries original request after successful token refresh', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
      // First call to /vehicles returns 401
      if (callCount === 0 && (url as string).includes('/vehicles')) {
        callCount++;
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      }
      // Call to /auth/refresh returns new token
      if ((url as string).includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'new-tok' }),
        });
      }
      // Retry of /vehicles succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: [], meta: { total: 0, page: 1, limit: 20, total_pages: 0 } }),
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Set a user so the refresh path can call setAuth
    useAuthStore.setState({
      accessToken: 'old-tok',
      user: { id: '1', name: 'A', email: 'a@a.com' },
      initialized: true,
    });

    const { searchVehicles } = await import('../../api/client');
    const result = await searchVehicles({ page: 1 });
    expect(result.data).toEqual([]);
    // Token must have been updated in the store
    expect(useAuthStore.getState().accessToken).toBe('new-tok');
  });

  it('clears auth when refresh also fails', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if ((url as string).includes('/auth/refresh')) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', mockFetch);

    useAuthStore.setState({
      accessToken: 'expired',
      user: { id: '1', name: 'A', email: 'a@a.com' },
      initialized: true,
    });

    const { searchVehicles } = await import('../../api/client');
    await expect(searchVehicles({ page: 1 })).rejects.toThrow();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
