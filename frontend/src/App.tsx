import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { refreshToken, getMe } from './api/client';
import Header from './components/Header';
import Home from './pages/Home';
import VehicleDetail from './pages/VehicleDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Favorites from './pages/Favorites';
import MyAds from './pages/MyAds';
import CreateVehicle from './pages/CreateVehicle';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    // Try to restore session on mount
    (async () => {
      try {
        const token = await refreshToken();
        if (token) {
          const user = await fetch('/me', {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
          }).then((r) => (r.ok ? r.json() : null));
          if (user) setAuth(token, user);
        }
      } catch { /* ignore */ } finally {
        setInitialized();
      }
    })();
  }, [setAuth, setInitialized]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/favorites"
            element={<RequireAuth><Favorites /></RequireAuth>}
          />
          <Route
            path="/my-ads"
            element={<RequireAuth><MyAds /></RequireAuth>}
          />
          <Route
            path="/vehicles/new"
            element={<RequireAuth><CreateVehicle /></RequireAuth>}
          />
          <Route
            path="/vehicles/:id/edit"
            element={<RequireAuth><CreateVehicle /></RequireAuth>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
