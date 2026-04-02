import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/auth';

const mockUser = { id: '1', name: 'Test', email: 'test@test.com' };

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, initialized: false });
  });

  it('initial state has no token and no user', () => {
    const { accessToken, user } = useAuthStore.getState();
    expect(accessToken).toBeNull();
    expect(user).toBeNull();
  });

  it('setAuth stores token and user', () => {
    useAuthStore.getState().setAuth('my-token', mockUser);
    const { accessToken, user } = useAuthStore.getState();
    expect(accessToken).toBe('my-token');
    expect(user).toEqual(mockUser);
  });

  it('clearAuth removes token and user', () => {
    useAuthStore.getState().setAuth('my-token', mockUser);
    useAuthStore.getState().clearAuth();
    const { accessToken, user } = useAuthStore.getState();
    expect(accessToken).toBeNull();
    expect(user).toBeNull();
  });

  it('setInitialized marks store as initialized', () => {
    expect(useAuthStore.getState().initialized).toBe(false);
    useAuthStore.getState().setInitialized();
    expect(useAuthStore.getState().initialized).toBe(true);
  });

  it('state is independent between test runs', () => {
    useAuthStore.getState().setAuth('token-a', mockUser);
    useAuthStore.setState({ accessToken: null, user: null, initialized: false });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
