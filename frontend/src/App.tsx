import React, { useEffect, useState } from 'react';
import CityView from './components/CityView';
import ShareView from './components/ShareView';
import { apiUrl } from './config';

function App() {
  const [status, setStatus] = useState('Checking API...');
  const [error, setError] = useState<string | null>(null);
  const [showCity, setShowCity] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Check for share token in URL
  useEffect(() => {
    const path = window.location.pathname;
    const matched = path.match(/^\/share\/(.+)$/);
    if (matched) {
      setShareToken(matched[1]);
    } else {
      setShareToken(null);
      // Check API health
      fetch(apiUrl('/health'))
        .then((r) => r.json())
        .then((d) => setStatus(d.message || 'Connected'))
        .catch(() => setStatus('API unreachable'));
    }

    // Listen for browser back/forward
    const handlePopState = () => {
      const newPath = window.location.pathname;
      const newMatch = newPath.match(/^\/share\/(.+)$/);
      if (newMatch) {
        setShareToken(newMatch[1]);
      } else {
        setShareToken(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // If viewing a shared city, render ShareView
  if (shareToken) {
    return <ShareView token={shareToken} />;
  }

  // If showing city, render the CityView component
  if (showCity) {
    return <CityView onBack={() => setShowCity(false)} />;
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🎵 Tunexa Global City</h1>
      <p style={{ color: '#666' }}>{status}</p>

      {error && (
        <div style={{ color: 'red', padding: '1rem', background: '#fee', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h2>Explore the Global Music City</h2>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          A 3D visualization of the world's most popular artists. Each building represents
          an artist, with height based on Last.fm listeners and width based on track count.
        </p>
        <button
          onClick={() => setShowCity(true)}
          style={{
            marginTop: '1rem',
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            background: '#1DB954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Enter Global City
        </button>
      </div>

      <div style={{ marginTop: '3rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Current Data</h3>
        <ul style={{ color: '#666', lineHeight: '1.8' }}>
          <li>🎤 51 artists from Last.fm</li>
          <li>🏢 6 genre districts</li>
          <li>📊 Listener & track count data</li>
          <li>🎨 Color-coded by genre</li>
        </ul>
        <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '1rem' }}>
          Session 3 of Global City implementation.
          <br />
          No login required - public city data.
        </p>
      </div>
    </div>
  );
}

export default App;
