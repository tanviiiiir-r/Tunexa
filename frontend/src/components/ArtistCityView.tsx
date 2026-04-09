import React, { useState, useEffect, useMemo } from 'react';
import TunexaCityCanvas, { THEMES, DEFAULT_THEME } from './GitCity/TunexaCityCanvas';
import type { FocusInfo } from './GitCity/TunexaCityScene';
import { artistsToBuildings, type TunexaArtist, type CityBuilding } from '../lib/artistAdapter';
import { apiUrl } from '../config';

// API Response Type
interface CityResponse {
  artists: TunexaArtist[];
  total: number;
  page: number;
  limit: number;
  genres: string[];
}

export default function ArtistCityView() {
  const [artists, setArtists] = useState<TunexaArtist[]>([]);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState(DEFAULT_THEME);
  const [focusedBuilding, setFocusedBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<CityBuilding | null>(null);

  // Fetch artists from Tunexa API
  useEffect(() => {
    const fetchArtists = async () => {
      try {
        setLoading(true);
        const response = await fetch(apiUrl('/city?page=1&limit=50000'));
        if (!response.ok) throw new Error('Failed to fetch artists');
        const data: CityResponse = await response.json();
        setArtists(data.artists);
        setApiTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchArtists();
  }, []);

  // Convert artists to Git City building format
  const buildings = useMemo(() => {
    return artistsToBuildings(artists);
  }, [artists]);

  const handleBuildingClick = (building: CityBuilding) => {
    setSelectedBuilding(building);
    setFocusedBuilding(building.login);
  };

  const handleClosePanel = () => {
    setSelectedBuilding(null);
    setFocusedBuilding(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0a0a1a',
        color: '#c8e64a',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '1.5rem'
      }}>
        Loading Music City...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0a0a1a',
        color: '#ff6b6b',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '1.5rem'
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Debug Stats Panel */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'rgba(10, 14, 24, 0.95)',
        padding: '15px',
        border: '2px solid #c8e64a',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '14px',
        color: '#e0e0e0',
        minWidth: '220px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#c8e64a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px' }}>
          🎵 City Stats
        </div>
        <div style={{ display: 'grid', gap: '4px', lineHeight: '1.5' }}>
          <div>DB Total: <span style={{ color: '#c8e64a', fontWeight: 600 }}>{apiTotal.toLocaleString()}</span></div>
          <div>Fetched: <span style={{ color: '#c8e64a', fontWeight: 600 }}>{artists.length.toLocaleString()}</span></div>
          <div>Buildings: <span style={{ color: '#c8e64a', fontWeight: 600 }}>{buildings.length.toLocaleString()}</span></div>
          {buildings.length > 0 && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333', fontSize: '11px', color: '#4ade80' }}>
              ✅ Rendering
            </div>
          )}
        </div>
      </div>

      {/* Theme Selector */}
      <div style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        zIndex: 100,
        background: 'rgba(10, 14, 24, 0.9)',
        padding: '1rem',
        border: '2px solid #2a3a4a',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: '1rem',
      }}>
        <div style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c8e64a' }}>
          Theme
        </div>
        {THEMES.map((theme) => (
          <button
            key={theme.name}
            onClick={() => setCurrentTheme(theme)}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.4rem 0.75rem',
              marginBottom: '0.25rem',
              fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
              fontSize: '1rem',
              cursor: 'pointer',
              background: currentTheme.name === theme.name ? theme.building.accent : '#1a1f28',
              color: currentTheme.name === theme.name ? '#000' : '#e0e0e0',
              border: `2px solid ${currentTheme.name === theme.name ? theme.building.accent : '#2a3a4a'}`,
              boxShadow: currentTheme.name === theme.name ? '2px 2px 0 0 rgba(0,0,0,0.5)' : 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {theme.name}
          </button>
        ))}
      </div>

      {/* 3D City Canvas using Git City's renderer */}
      <TunexaCityCanvas
        buildings={buildings}
        theme={currentTheme}
        focusedBuilding={focusedBuilding}
        onBuildingClick={handleBuildingClick}
      />

      {/* Artist Info Panel */}
      {selectedBuilding && (
        <ArtistPanel
          building={selectedBuilding}
          onClose={handleClosePanel}
          theme={currentTheme}
        />
      )}
    </div>
  );
}

// Artist Info Panel Component
interface ArtistPanelProps {
  building: CityBuilding;
  onClose: () => void;
  theme: typeof THEMES[0];
}

function ArtistPanel({ building, onClose, theme }: ArtistPanelProps) {
  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '280px',
      width: '320px',
      maxHeight: '80vh',
      overflow: 'auto',
      background: 'rgba(10, 14, 24, 0.95)',
      border: `2px solid ${theme.building.accent}`,
      padding: '1.5rem',
      color: '#e0e0e0',
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      zIndex: 100,
      boxShadow: '4px 4px 0 0 rgba(0,0,0,0.5)',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          color: '#e0e0e0',
          fontSize: '1.5rem',
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      <h2 style={{
        margin: '0 0 1rem 0',
        color: theme.building.accent,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontSize: '1.5rem',
      }}>
        {building.name}
      </h2>

      {building.avatar_url && (
        <img
          src={building.avatar_url}
          alt={building.name || 'Artist'}
          style={{
            width: '100%',
            height: '200px',
            objectFit: 'cover',
            border: `2px solid ${theme.building.accent}`,
            marginBottom: '1rem',
          }}
        />
      )}

      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '1.1rem' }}>
        <div>
          <span style={{ color: '#808080' }}>Genre: </span>
          <span style={{ color: theme.building.accent }}>{building.primary_language}</span>
        </div>
        <div>
          <span style={{ color: '#808080' }}>Listeners: </span>
          <span style={{ fontWeight: 600 }}>{building.contributions.toLocaleString()}</span>
        </div>
        <div>
          <span style={{ color: '#808080' }}>Tracks: </span>
          <span style={{ fontWeight: 600 }}>{building.total_stars}</span>
        </div>
        <div>
          <span style={{ color: '#808080' }}>District: </span>
          <span style={{ textTransform: 'capitalize' }}>{building.district}</span>
        </div>
        <div>
          <span style={{ color: '#808080' }}>Building Height: </span>
          <span>{Math.round(building.height)}m</span>
        </div>
      </div>

      {building.claimed && (
        <div style={{
          marginTop: '1rem',
          padding: '0.5rem',
          background: `${theme.building.accent}20`,
          border: `1px solid ${theme.building.accent}`,
          textAlign: 'center',
          color: theme.building.accent,
        }}>
          ✓ Claimed by Artist
        </div>
      )}
    </div>
  );
}
