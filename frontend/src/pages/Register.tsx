import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/client';

export default function Register() {
  const navigate = useNavigate();
  const [fields, setFields] = useState({ name: '', email: '', password: '', confirm: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof fields, val: string) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (fields.password !== fields.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: fields.name,
        email: fields.email,
        password: fields.password,
        phone: fields.phone || undefined,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '1rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          Criar conta
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Já tem conta?{' '}
          <Link to="/login">Entrar</Link>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="field">
            <label>Nome completo</label>
            <input type="text" value={fields.name} onChange={(e) => update('name', e.target.value)} required placeholder="Seu nome" autoComplete="name" />
          </div>

          <div className="field">
            <label>Email</label>
            <input type="email" value={fields.email} onChange={(e) => update('email', e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
          </div>

          <div className="field">
            <label>Senha</label>
            <input type="password" value={fields.password} onChange={(e) => update('password', e.target.value)} required placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          </div>

          <div className="field">
            <label>Confirmar senha</label>
            <input type="password" value={fields.confirm} onChange={(e) => update('confirm', e.target.value)} required placeholder="Repita a senha" autoComplete="new-password" />
          </div>

          <div className="field">
            <label>Telefone (opcional)</label>
            <input type="tel" value={fields.phone} onChange={(e) => update('phone', e.target.value)} placeholder="(11) 99999-9999" autoComplete="tel" />
          </div>

          {error && (
            <div style={{ color: '#f87171', fontSize: '0.875rem', background: '#450a0a', padding: '0.6rem 0.8rem', borderRadius: '0.375rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
