import React, { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('Checking API...');
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setStatus(d.message))
      .catch(() => setStatus('API unreachable'));
  }, []);

  // Check if we're returning from OAuth with an error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(`OAuth error: ${errorParam}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const login = () => {
    setError(null);
    window.location.href = '/login';
  };

  const logout = () => {
    window.location.href = '/logout';
  };

  const fetchProfile = async () => {
    const resp = await fetch('/me');
    if (resp.ok) {
      setUser(await resp.json());
      setError(null);
    } else if (resp.status === 401) {
      setUser(null);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchPayload = async () => {
    setError(null);
    const resp = await fetch('/city_payload');
    if (resp.ok) {
      const data = await resp.json();
      console.log('city_payload:', data);
      alert(`Payload loaded! ${data.artists?.length || 0} artists, ${data.tracks?.length || 0} tracks`);
    } else {
      const err = await resp.json();
      console.error('Failed to fetch payload:', err);
      setError(err.detail || 'Failed to fetch payload');
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>{status}</h1>

      {error && (
        <div style={{ color: 'red', padding: '1rem', background: '#fee', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {user ? (
        <div>
          <h2>Welcome, {user.display_name}!</h2>
          {user.images && user.images[0] && (
            <img src={user.images[0].url} alt="avatar" width={80} style={{ borderRadius: '50%' }} />
          )}
          <div style={{ marginTop: '1rem' }}>
            <button onClick={fetchPayload} style={{ marginRight: '0.5rem' }}>
              Fetch City Payload
            </button>
            <button onClick={logout} style={{ background: '#dc3545', color: 'white' }}>
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button onClick={login}>Log in with Spotify</button>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            First time? Make sure your Spotify app has the redirect URI configured:
            <code style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', background: '#f5f5f5' }}>
              http://127.0.0.1:5173/callback
            </code>
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
