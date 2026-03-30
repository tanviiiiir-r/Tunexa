import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { apiUrl } from '../config';

// API Response Types
interface Artist {
  id: string;
  name: string;
  genre: string;
  height: number;
  width: number;
  city_x: number;
  city_z: number;
  image_url: string | null;
  lastfm_listeners: number;
  track_count: number;
  sub_genres?: string[];
}

interface CityResponse {
  artists: Artist[];
  total: number;
  page: number;
  limit: number;
  genres: string[];
}

// Camera Controller - Git City style view from further back
function CameraController() {
  const { camera } = useThree();

  useEffect(() => {
    // Position camera further out to see the whole city spread
    camera.position.set(400, 300, 400);
    camera.lookAt(0, 50, 0);
  }, [camera]);

  return null;
}

// Building Types for 3D Rendering
interface Building {
  id: string;
  artist_id: string;
  artist_name: string;
  artist_image_url: string | null;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  style: {
    color: string;
    brightness: number;
    glow_intensity: number;
    animation: boolean;
  };
  metadata: {
    genre: string;
    popularity: number;
    listeners: number;
    track_count: number;
  };
  windows: Array<{
    floor: number;
    is_lit: boolean;
  }>;
}

interface District {
  name: string;
  genre: string;
  color: string;
}

// Genre to color mapping
const GENRE_COLORS: Record<string, string> = {
  'pop': '#FF6B6B',
  'rock': '#4ECDC4',
  'hip-hop': '#FFE66D',
  'hip hop': '#FFE66D',
  'electronic': '#95E1D3',
  'r&b': '#F38181',
  'indie': '#AA96DA',
  'alternative rock': '#FCBAD3',
  'default': '#808080'
};

// Position cache to ensure unique positions
type Position = { x: number; z: number };
const positionCache = new Map<string, Position>();

// Git City style - proper spacing with organic layout
function getArtistPosition(artist: Artist, index: number): { x: number, z: number } {
  // Always generate fresh positions with wide spacing (ignore DB coords for now)
  // This ensures proper Git City layout regardless of database values
  const useDatabaseCoords = false; // Set to true to use DB coords

  if (useDatabaseCoords && artist.city_x !== null && artist.city_z !== null && artist.city_x !== 0 && artist.city_z !== 0) {
    return { x: artist.city_x, z: artist.city_z };
  }

  // Git City style: wide spacing, staggered rows, organic feel
  const gridSize = 15; // 15x15 grid for more space
  const spacing = 120; // 120 units between buildings - much more space

  const col = index % gridSize;
  const row = Math.floor(index / gridSize);

  // Stagger every other row for organic city look
  const stagger = (row % 2) * (spacing * 0.5);

  // Small jitter for natural feel (±15 units, not too much)
  const jitter = () => (Math.random() - 0.5) * 30;

  const x = (col - gridSize / 2) * spacing + stagger + jitter();
  const z = (row - gridSize / 2) * spacing + jitter();

  return { x, z };
}

// Transform artist to building format - Git City style: tall, narrow, distinct
function transformArtistToBuilding(artist: Artist, index: number): Building {
  const genre = artist.genre?.toLowerCase() || 'default';
  const color = GENRE_COLORS[genre] || GENRE_COLORS['default'];

  // Get position (from DB or generated)
  const position = getArtistPosition(artist, index);

  // Calculate popularity based on listeners (normalized to 0-100)
  const maxListeners = 10000000; // 10M as max
  const popularity = Math.min(100, Math.round((artist.lastfm_listeners / maxListeners) * 100));

  // Git City style dimensions: narrow width, tall height
  // Width: 10-20 units (narrow like skyscrapers)
  // Height: proportional to listeners (50-200 units, much taller than wide)
  const baseWidth = 12;
  const widthVariation = Math.log10(Math.max(10, artist.track_count)) * 2;
  const buildingWidth = Math.min(20, baseWidth + widthVariation);

  // Height based on listeners - dramatic variation like Git City
  // Small artists: 20 units, Mega stars: 200+ units
  const minHeight = 20;
  const maxHeight = 220;

  // Use square root for better distribution (not as flat as log, not as extreme as linear)
  const sqrtListeners = Math.sqrt(artist.lastfm_listeners);
  const sqrtMax = Math.sqrt(10000000); // ~3162
  const heightScale = Math.min(1, sqrtListeners / sqrtMax);

  const buildingHeight = minHeight + (heightScale * (maxHeight - minHeight));

  // Generate windows based on building height
  const floorHeight = 6; // units per floor
  const floors = Math.max(3, Math.floor(buildingHeight / floorHeight));
  const windows: Array<{floor: number; is_lit: boolean}> = [];
  for (let i = 0; i < floors; i++) {
    windows.push({
      floor: i,
      is_lit: Math.random() > 0.3 // 70% lit windows
    });
  }

  return {
    id: artist.id,
    artist_id: artist.id,
    artist_name: artist.name,
    artist_image_url: artist.image_url,
    position: {
      x: position.x,
      y: 0,
      z: position.z
    },
    dimensions: {
      width: buildingWidth,
      height: buildingHeight,
      depth: buildingWidth // depth matches width for square footprint
    },
    style: {
      color: color,
      brightness: 0.5 + (popularity / 200),
      glow_intensity: 0.3 + (popularity / 200),
      animation: popularity > 70
    },
    metadata: {
      genre: artist.genre || 'Unknown',
      popularity: popularity,
      listeners: artist.lastfm_listeners,
      track_count: artist.track_count
    },
    windows
  };
}

// Building Component with Click Handler and Pulse Animation
function BuildingMesh({ building, onClick }: { building: Building; onClick: (building: Building) => void }) {
  const position = building.position;
  const dimensions = building.dimensions;
  const style = building.style;
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Pulse animation for popular buildings
  useFrame((state) => {
    if (materialRef.current && style.animation) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7;
      const baseIntensity = style.glow_intensity * 0.5;
      materialRef.current.emissiveIntensity = baseIntensity * pulse;
    }
  });

  // Create windows
  const windows = useMemo(() => {
    const windowMeshes = [];
    const floors = Math.max(1, Math.floor(dimensions.height / 5));
    const windowsPerFloor = 4;

    for (let floor = 0; floor < floors; floor++) {
      for (let w = 0; w < windowsPerFloor; w++) {
        const angle = (w / windowsPerFloor) * Math.PI * 2;
        const radius = dimensions.width / 2 + 0.1;
        const wx = Math.cos(angle) * radius;
        const wz = Math.sin(angle) * radius;
        const wy = floor * 5 - dimensions.height / 2 + 2.5;

        const isLit = building.windows && building.windows[floor] ? building.windows[floor].is_lit : false;
        const windowColor = isLit ? '#FFD700' : '#333333';
        const emissive = isLit ? style.glow_intensity : 0;

        windowMeshes.push(
          <mesh key={`${building.id}-window-${floor}-${w}`} position={[wx, wy, wz]}>
            <boxGeometry args={[0.8, 1.5, 0.1]} />
            <meshStandardMaterial
              color={windowColor}
              emissive={windowColor}
              emissiveIntensity={emissive}
            />
          </mesh>
        );
      }
    }
    return windowMeshes;
  }, [building, dimensions, style]);

  const handleClick = (e: any) => {
    e.stopPropagation();
    onClick(building);
  };

  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={[position.x, position.y + dimensions.height / 2, position.z]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Main building */}
      <mesh ref={meshRef}>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial
          ref={materialRef}
          color={style.color}
          emissive={style.color}
          emissiveIntensity={hovered ? 0.6 : (style.animation ? 0 : 0.1 + style.brightness * 0.2)}
        />
      </mesh>

      {/* Windows */}
      {windows}

      {/* Building label */}
      <Text
        position={[0, dimensions.height / 2 + 2, 0]}
        fontSize={2}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {building.artist_name}
      </Text>
    </group>
  );
}

// Ground/Platform - larger to accommodate wider spacing
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

// District markers
function DistrictMarkers({ districts }: { districts: District[] }) {
  if (!districts || districts.length === 0) return null;

  return (
    <>
      {districts.map((district, index) => {
        const angle = (index / Math.max(districts.length, 1)) * Math.PI * 2;
        const distance = 350;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        return (
          <group key={district.name || `district-${index}`} position={[x, 1, z]}>
            <Text
              position={[0, 5, 0]}
              fontSize={4}
              color={district.color}
              anchorX="center"
            >
              {district.name}
            </Text>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[20, 20, 0.5, 32]} />
              <meshStandardMaterial color={district.color} transparent opacity={0.2} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// Main City Scene
function CityScene({ cityData, onBuildingClick }: {
  cityData: { buildings: Building[]; districts: District[] };
  onBuildingClick: (building: Building) => void;
}) {
  const { buildings, districts } = cityData;

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[50, 50, 50]} intensity={0.8} castShadow />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#ffffff" />

      <Ground />

      {districts.length > 0 && <DistrictMarkers districts={districts} />}

      {buildings.map((building) => (
        <BuildingMesh
          key={building.id}
          building={building}
          onClick={onBuildingClick}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={800}
        minDistance={50}
      />
    </>
  );
}

// Artist Info Panel Component
interface ArtistPanelProps {
  building: Building | null;
  onClose: () => void;
}

function ArtistPanel({ building, onClose }: ArtistPanelProps) {
  if (!building) return null;

  const metadata = building.metadata;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '360px',
          height: '100vh',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          zIndex: 101,
          padding: '2rem',
          boxSizing: 'border-box',
          overflowY: 'auto',
          color: 'white',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.5rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Artist Image */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          {building.artist_image_url ? (
            <img
              src={building.artist_image_url}
              alt={building.artist_name}
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: `4px solid ${building.style.color}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            />
          ) : (
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: building.style.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                border: `4px solid ${building.style.color}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: '4rem', fontWeight: 'bold', color: 'white' }}>
                {building.artist_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Artist Name */}
        <h2 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.8rem',
          fontWeight: 'bold',
          textAlign: 'center',
        }}>
          {building.artist_name}
        </h2>

        {/* Genre Badge */}
        {metadata.genre && (
          <div style={{
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            <span style={{
              background: building.style.color,
              color: 'white',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontSize: '0.85rem',
              textTransform: 'capitalize',
              fontWeight: 600,
            }}>
              {metadata.genre}
            </span>
          </div>
        )}

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1DB954' }}>
              {metadata.popularity}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Popularity
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '1rem',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1DB954' }}>
              {(metadata.listeners / 1000000).toFixed(1)}M
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Listeners
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#888' }}>Tracks</span>
            <span style={{ fontWeight: 600 }}>{metadata.track_count}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Building Height</span>
            <span style={{ fontWeight: 600 }}>{building.dimensions.height.toFixed(1)}m</span>
          </div>
        </div>

        <div style={{
          marginTop: '1rem',
          fontSize: '0.85rem',
          color: '#888',
          textAlign: 'center',
        }}>
          Data from Last.fm + MusicBrainz
        </div>
      </div>
    </>
  );
}

// Main City View Component
interface CityViewProps {
  onBack?: () => void;
}

export default function CityView({ onBack }: CityViewProps) {
  const [cityData, setCityData] = useState<{ buildings: Building[]; districts: District[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const fetchCity = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch from new Global City endpoint (no auth required)
      const resp = await fetch(apiUrl('/city?limit=500'));
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to fetch: ${resp.status}`);
      }
      const data: CityResponse = await resp.json();
      console.log('City data received:', data);

      // Transform artists to buildings
      const buildings = data.artists.map((artist, index) => transformArtistToBuilding(artist, index));

      // Create districts from genres
      const districts: District[] = data.genres.map((genre, index) => ({
        name: genre.charAt(0).toUpperCase() + genre.slice(1),
        genre: genre,
        color: GENRE_COLORS[genre.toLowerCase()] || GENRE_COLORS['default']
      }));

      setCityData({ buildings, districts });
    } catch (err) {
      console.error('Error fetching city:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingClick = (building: Building) => {
    console.log('Building clicked:', building.artist_name);
    setSelectedBuilding(building);
  };

  const handleClosePanel = () => {
    setSelectedBuilding(null);
  };

  useEffect(() => {
    fetchCity();
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a1a',
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Building Global City...</h2>
          <p style={{ color: '#888' }}>Loading {loading ? '...' : ''} artists</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: '#0a0a1a', color: 'white', minHeight: '100vh' }}>
        <div style={{ color: '#ff6b6b', marginBottom: '1rem' }}>Error: {error}</div>
        <button onClick={fetchCity}>Try Again</button>
        {onBack && (
          <button onClick={onBack} style={{ marginLeft: '1rem' }}>
            ← Back
          </button>
        )}
      </div>
    );
  }

  if (!cityData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0a1a', color: 'white', minHeight: '100vh' }}>
        <h2>Global Music City</h2>
        <button
          onClick={fetchCity}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            background: '#1DB954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Load City
        </button>
      </div>
    );
  }

  // Show message if no buildings
  if (!cityData.buildings || cityData.buildings.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0a1a', color: 'white', minHeight: '100vh' }}>
        <h2>No buildings found</h2>
        <p>No artist data available. Please check the API.</p>
        <button onClick={() => setCityData(null)} style={{ marginTop: '1rem' }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Stats Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '1rem',
          borderRadius: '8px',
          fontFamily: 'sans-serif'
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0' }}>🌍 Global City</h3>
        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
          Buildings: {cityData.buildings?.length || 0}
        </p>
        <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
          Districts: {cityData.districts?.length || 0}
        </p>
        <button
          onClick={() => setCityData(null)}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            marginRight: '0.5rem'
          }}
        >
          Reload
        </button>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {/* Instruction Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontFamily: 'sans-serif',
          fontSize: '0.85rem',
          maxWidth: '200px',
        }}
      >
        Click on any building to see artist info
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [250, 250, 250], fov: 60, near: 1, far: 1000 }}
        style={{ background: '#0a0a1a' }}
      >
        <CameraController />
        <CityScene cityData={cityData} onBuildingClick={handleBuildingClick} />
      </Canvas>

      {/* Artist Info Panel */}
      {selectedBuilding && (
        <ArtistPanel building={selectedBuilding} onClose={handleClosePanel} />
      )}
    </div>
  );
}
