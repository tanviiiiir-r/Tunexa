import React, { useEffect, useState } from 'react';
import CityView from './components/CityView';
import ShareView from './components/ShareView';

function App() {
  const [status, setStatus] = useState('Checking API...');
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCity, setShowCity] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if this is a share URL
    const path = window.location.pathname;
    const shareMatch = path.match(/^\/share\/(.+)$/);
    if (shareMatch) {
      setShareToken(shareMatch[1]);
      return;
    }

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
    // Don't fetch profile if this is a share view
    if (!shareToken) {
      fetchProfile();
    }
  }, [shareToken]);

  // If viewing a shared city, render ShareView
  if (shareToken) {
    return <ShareView token={shareToken} />;
  }

  // If showing city, render the CityView component
  if (showCity) {
    return <CityView />;
  }

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
            <button
              onClick={() => setShowCity(true)}
              style={{
                marginRight: '0.5rem',
                padding: '1rem 2rem',
                fontSize: '1.2rem',
                background: '#1DB954',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View My City
            </button>
            <button
              onClick={logout}
              style={{
                background: '#dc3545',
                color: 'white',
                padding: '1rem 2rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button onClick={login} style={{ padding: '1rem 2rem', fontSize: '1.2rem', cursor: 'pointer' }}>
            Log in with Spotify
          </button>
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
