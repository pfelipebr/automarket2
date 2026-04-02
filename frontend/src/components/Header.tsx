import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { logout } from '../api/client';

export default function Header() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    navigate('/');
  }

  return (
    <header
      style={{
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '0 1rem',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Link
        to="/"
        style={{
          color: '#38bdf8',
          fontSize: '1.3rem',
          fontWeight: 800,
          textDecoration: 'none',
          letterSpacing: '-0.02em',
        }}
      >
        🚗 AutoMarket
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {user ? (
          <>
            <Link
              to="/favorites"
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
              }}
            >
              Favoritos
            </Link>
            <Link
              to="/my-ads"
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
              }}
            >
              Meus Anúncios
            </Link>
            <Link
              to="/vehicles/new"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              + Anunciar
            </Link>
            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{ marginLeft: '0.25rem' }}
            >
              Sair
            </button>
          </>
        ) : (
          <>
            <Link
              to="/vehicles/new"
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
              className="btn btn-ghost"
              style={{ textDecoration: 'none' }}
            >
              + Anunciar
            </Link>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              Entrar
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
