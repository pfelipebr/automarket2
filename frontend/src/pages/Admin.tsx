import React, { useState, useCallback } from 'react';

const API = '/admin-api';

interface Status {
  db: { users: number; vehicles: number; favorites: number };
  failure: { active: boolean; until: string | null; reason: string; failureRate: number };
}

interface LoadResult {
  requests: number;
  completed: number;
  errors: number;
  status_codes: Record<string, number>;
  elapsed_ms: number;
  rps: number;
}

function Card({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#1e293b',
        border: `1px solid ${color}33`,
        borderRadius: '0.75rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '1.4rem' }}>{icon}</span>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        background: active ? '#450a0a' : '#052e16',
        color: active ? '#f87171' : '#4ade80',
        border: `1px solid ${active ? '#991b1b' : '#166534'}`,
      }}
    >
      {active ? 'FAILURE ACTIVE' : 'HEALTHY'}
    </span>
  );
}

export default function Admin() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [authError, setAuthError] = useState('');

  // Reset state
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  // Seed state
  const [seedCount, setSeedCount] = useState(50);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  // Load state
  const [loadRequests, setLoadRequests] = useState(200);
  const [loadConcurrency, setLoadConcurrency] = useState(20);
  const [loading, setLoading] = useState(false);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);

  // Failure state
  const [failDuration, setFailDuration] = useState(30);
  const [failRate, setFailRate] = useState(50);
  const [failReason, setFailReason] = useState('Simulated failure triggered from admin panel');
  const [failing, setFailing] = useState(false);
  const [failMsg, setFailMsg] = useState('');

  const adminFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          ...(options.headers ?? {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      return data;
    },
    [adminKey],
  );

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await adminFetch('/status');
      setStatus(data);
      setAuthenticated(true);
    } catch {
      setAuthError('Invalid admin key or server unreachable');
    }
  }

  async function refreshStatus() {
    try {
      const data = await adminFetch('/status');
      setStatus(data);
    } catch { /* ignore */ }
  }

  async function handleReset() {
    if (!confirm('Delete ALL data? This cannot be undone.')) return;
    setResetting(true);
    setResetMsg('');
    try {
      await adminFetch('/reset', { method: 'DELETE' });
      setResetMsg('All data deleted successfully.');
      await refreshStatus();
    } catch (err) {
      setResetMsg(`Error: ${err instanceof Error ? err.message : err}`);
    }
    setResetting(false);
  }

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg('');
    try {
      const data = await adminFetch('/seed', {
        method: 'POST',
        body: JSON.stringify({ vehicles: seedCount }),
      });
      setSeedMsg(`Created ${data.vehiclesCreated} vehicles across ${data.usersReady} users.`);
      await refreshStatus();
    } catch (err) {
      setSeedMsg(`Error: ${err instanceof Error ? err.message : err}`);
    }
    setSeeding(false);
  }

  async function handleLoad() {
    setLoading(true);
    setLoadResult(null);
    try {
      const data = await adminFetch('/load', {
        method: 'POST',
        body: JSON.stringify({ requests: loadRequests, concurrency: loadConcurrency }),
      });
      setLoadResult(data);
    } catch (err) {
      setLoadResult({ requests: 0, completed: 0, errors: -1, status_codes: {}, elapsed_ms: 0, rps: 0 });
    }
    setLoading(false);
  }

  async function handleSimulateFailure() {
    setFailing(true);
    setFailMsg('');
    try {
      const data = await adminFetch('/simulate-failure', {
        method: 'POST',
        body: JSON.stringify({ duration_seconds: failDuration, failure_rate: failRate / 100, reason: failReason }),
      });
      setFailMsg(`Failure active until ${new Date(data.failUntil).toLocaleTimeString()}`);
      await refreshStatus();
    } catch (err) {
      setFailMsg(`Error: ${err instanceof Error ? err.message : err}`);
    }
    setFailing(false);
  }

  async function handleClearFailure() {
    setFailing(true);
    setFailMsg('');
    try {
      await adminFetch('/simulate-failure', { method: 'DELETE' });
      setFailMsg('Failure simulation cleared.');
      await refreshStatus();
    } catch (err) {
      setFailMsg(`Error: ${err instanceof Error ? err.message : err}`);
    }
    setFailing(false);
  }

  // ── Auth screen ────────────────────────────────────────────────────────────
  if (!authenticated) {
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
            maxWidth: '380px',
          }}
        >
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>
            Admin Panel
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Enter your admin secret key to continue.
          </p>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="field">
              <label>Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                required
                placeholder="••••••••"
                autoFocus
              />
            </div>
            {authError && (
              <div
                style={{
                  color: '#f87171',
                  fontSize: '0.875rem',
                  background: '#450a0a',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.375rem',
                }}
              >
                {authError}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Admin Panel</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Manage data, load testing, and failure simulation
          </p>
        </div>
        <StatusBadge active={status?.failure.active ?? false} />
      </div>

      {/* Status bar */}
      {status && (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            display: 'flex',
            gap: '1.5rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#94a3b8' }}>
            Users: <strong style={{ color: '#e2e8f0' }}>{status.db.users}</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            Vehicles: <strong style={{ color: '#e2e8f0' }}>{status.db.vehicles}</strong>
          </span>
          <span style={{ color: '#94a3b8' }}>
            Favorites: <strong style={{ color: '#e2e8f0' }}>{status.db.favorites}</strong>
          </span>
          {status.failure.active && (
            <span style={{ color: '#f87171' }}>
              Failure {Math.round(status.failure.failureRate * 100)}% until{' '}
              <strong>{new Date(status.failure.until!).toLocaleTimeString()}</strong>
              {' — '}{status.failure.reason}
            </span>
          )}
          <button
            onClick={refreshStatus}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: 0,
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* 1. Reset */}
        <Card title="Reset Data" icon="🗑️" color="#f87171">
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Permanently delete all users, vehicles, favorites, and sessions from the
            database. The application will start completely clean.
          </p>
          {resetMsg && (
            <div
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                background: resetMsg.startsWith('Error') ? '#450a0a' : '#052e16',
                color: resetMsg.startsWith('Error') ? '#f87171' : '#4ade80',
              }}
            >
              {resetMsg}
            </div>
          )}
          <button
            className="btn"
            style={{
              background: '#7f1d1d',
              color: '#fca5a5',
              border: '1px solid #991b1b',
              justifyContent: 'center',
            }}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Deleting...' : 'Delete All Data'}
          </button>
        </Card>

        {/* 2. Seed */}
        <Card title="Create Sample Data" icon="🌱" color="#4ade80">
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Populate the database with realistic Brazilian vehicle listings across
            5 demo users. Safe to run multiple times.
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label>Number of vehicles</label>
            <input
              type="number"
              min={1}
              max={500}
              value={seedCount}
              onChange={(e) => setSeedCount(Number(e.target.value))}
            />
          </div>
          {seedMsg && (
            <div
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                background: seedMsg.startsWith('Error') ? '#450a0a' : '#052e16',
                color: seedMsg.startsWith('Error') ? '#f87171' : '#4ade80',
              }}
            >
              {seedMsg}
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center' }}
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? 'Seeding...' : 'Create Sample Data'}
          </button>
        </Card>

        {/* 3. Load */}
        <Card title="Generate Load" icon="⚡" color="#facc15">
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Run concurrent database queries to simulate heavy usage. Results show
            throughput and any errors encountered.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Total requests</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={loadRequests}
                onChange={(e) => setLoadRequests(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Concurrency</label>
              <input
                type="number"
                min={1}
                max={50}
                value={loadConcurrency}
                onChange={(e) => setLoadConcurrency(Number(e.target.value))}
              />
            </div>
          </div>
          {loadResult && (
            <div
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                background: '#0f172a',
                border: '1px solid #334155',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.25rem',
              }}
            >
              <span style={{ color: '#94a3b8' }}>Completed</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>{loadResult.completed}</span>
              <span style={{ color: '#94a3b8' }}>Errors</span>
              <span style={{ color: loadResult.errors > 0 ? '#f87171' : '#4ade80', fontWeight: 700 }}>
                {loadResult.errors}
              </span>
              <span style={{ color: '#94a3b8' }}>Elapsed</span>
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{loadResult.elapsed_ms} ms</span>
              <span style={{ color: '#94a3b8' }}>Throughput</span>
              <span style={{ color: '#facc15', fontWeight: 700 }}>{loadResult.rps} req/s</span>
              {Object.entries(loadResult.status_codes ?? {}).map(([code, count]) => (
                <React.Fragment key={code}>
                  <span style={{ color: '#94a3b8' }}>HTTP {code}</span>
                  <span style={{ color: code === '200' ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                    {count}x
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
          <button
            className="btn"
            style={{
              background: '#78350f',
              color: '#fde68a',
              border: '1px solid #92400e',
              justifyContent: 'center',
            }}
            onClick={handleLoad}
            disabled={loading}
          >
            {loading ? 'Running...' : 'Generate Load'}
          </button>
        </Card>

        {/* 4. Simulate Failure */}
        <Card title="Simulate Failure" icon="💥" color="#c084fc">
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Intermittently fail vehicle search requests at the configured rate.
            Other routes and health probes are unaffected.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Duration (seconds)</label>
              <input
                type="number"
                min={5}
                max={300}
                value={failDuration}
                onChange={(e) => setFailDuration(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Failure rate: {failRate}%</label>
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={failRate}
                onChange={(e) => setFailRate(Number(e.target.value))}
                style={{ marginTop: '0.5rem' }}
              />
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Reason</label>
            <input
              type="text"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              maxLength={120}
              placeholder="Reason for failure..."
            />
          </div>
          {failMsg && (
            <div
              style={{
                fontSize: '0.82rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                background: failMsg.startsWith('Error') ? '#450a0a' : '#2e1065',
                color: failMsg.startsWith('Error') ? '#f87171' : '#c084fc',
              }}
            >
              {failMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              style={{
                flex: 1,
                background: '#3b0764',
                color: '#e9d5ff',
                border: '1px solid #6b21a8',
                justifyContent: 'center',
              }}
              onClick={handleSimulateFailure}
              disabled={failing}
            >
              {failing ? 'Working...' : 'Activate Failure'}
            </button>
            <button
              className="btn"
              style={{
                background: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #475569',
                justifyContent: 'center',
              }}
              onClick={handleClearFailure}
              disabled={failing}
              title="Clear active failure simulation"
            >
              Clear
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
