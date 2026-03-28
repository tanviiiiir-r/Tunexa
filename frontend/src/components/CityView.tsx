import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

interface Floor {
  floor_number: number;
  track_id: string;
  track_name: string;
  album_cover: string;
  duration_ms: number;
  preview_url: string | null;
  is_lit: boolean;
}

interface Building {
  id: string;
  artist_id: string;
  artist_name: string;
  artist_image_url: string;
  position?: { x: number; y: number; z: number };
  dimensions?: { width: number; height: number; depth: number };
  style?: {
    color?: string;
    brightness?: number;
    glow_intensity?: number;
    animation?: boolean;
  };
  metadata?: {
    genre?: string;
    language?: string;
    popularity?: number;
    followers?: number;
    listening_minutes?: number;
    song_count?: number;
    last_played?: string;
  };
  windows?: Array<{
    floor: number;
    is_lit: boolean;
  }>;
  floors?: Floor[];
}

interface District {
  name: string;
  genre: string;
  color: string;
}

interface CityData {
  buildings?: Building[];
  districts?: District[];
  stats?: {
    total_artists?: number;
    total_buildings?: number;
  };
}

// Building Component with Click Handler
function BuildingMesh({ building, onClick }: { building: Building; onClick: (building: Building) => void }) {
  const position = building.position || { x: 0, y: 0, z: 0 };
  const dimensions = building.dimensions || { width: 10, height: 30, depth: 10 };
  const style = building.style || { color: '#808080', brightness: 0.5, glow_intensity: 0.3, animation: false };
  const meshRef = useRef<THREE.Mesh>(null);

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
        const emissive = isLit ? (style.glow_intensity || 0.5) : 0;

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

  // Hover effect
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={[position.x, (position.y || 0) + dimensions.height / 2, position.z]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Main building */}
      <mesh ref={meshRef}>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial
          color={style.color || '#808080'}
          emissive={style.color || '#808080'}
          emissiveIntensity={hovered ? 0.5 : (style.animation ? (style.glow_intensity || 0.5) * 0.3 : 0.1)}
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
        {building.artist_name || 'Unknown'}
      </Text>
    </group>
  );
}

// Ground/Platform
function Ground({ onClick }: { onClick?: () => void }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={onClick}>
      <planeGeometry args={[500, 500]} />
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
        const distance = 80;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        return (
          <group key={district.name || `district-${index}`} position={[x, 1, z]}>
            <Text
              position={[0, 5, 0]}
              fontSize={4}
              color={district.color || '#ffffff'}
              anchorX="center"
            >
              {district.name || district.genre || 'Unknown'}
            </Text>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[20, 20, 0.5, 32]} />
              <meshStandardMaterial color={district.color || '#ffffff'} transparent opacity={0.2} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// Main City Scene
function CityScene({ cityData, onBuildingClick }: { cityData: CityData; onBuildingClick: (building: Building) => void }) {
  const buildings = cityData.buildings || [];
  const districts = cityData.districts || [];

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[50, 50, 50]} intensity={0.8} castShadow />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#ffffff" />

      <Ground onClick={() => {}} />

      {districts.length > 0 && <DistrictMarkers districts={districts} />}

      {buildings.map((building) => (
        <BuildingMesh key={building.id || Math.random().toString()} building={building} onClick={onBuildingClick} />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={200}
        minDistance={20}
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  useEffect(() => {
    // Cleanup audio when panel closes
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Reset audio state when building changes
    setIsPlaying(false);
    setCurrentPreview(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [building]);

  if (!building) return null;

  const metadata = building.metadata || {};
  const floors = building.floors || [];
  const hasPreview = floors.some(f => f.preview_url);

  const handlePlayPreview = (previewUrl: string | null) => {
    if (!previewUrl) return;

    if (audioRef.current && currentPreview === previewUrl) {
      // Toggle play/pause for same track
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      // New track
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.play();
      setCurrentPreview(previewUrl);
      setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentPreview(null);
  };

  // Find first track with preview
  const firstPreviewTrack = floors.find(f => f.preview_url);

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
        onClick={() => {
          stopAudio();
          onClose();
        }}
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
          onClick={() => {
            stopAudio();
            onClose();
          }}
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
        {building.artist_image_url && (
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <img
              src={building.artist_image_url}
              alt={building.artist_name}
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: `4px solid ${building.style?.color || '#1DB954'}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}
            />
          </div>
        )}

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
              background: building.style?.color || '#1DB954',
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
              {metadata.popularity || 0}
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
              {metadata.followers ? (metadata.followers / 1000000).toFixed(1) + 'M' : 'N/A'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Followers
            </div>
          </div>
        </div>

        {/* Listening Stats */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '1rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#888' }}>Listening Time</span>
            <span style={{ fontWeight: 600 }}>{Math.round(metadata.listening_minutes || 0)} min</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Songs</span>
            <span style={{ fontWeight: 600 }}>{metadata.song_count || 0}</span>
          </div>
        </div>

        {/* Preview Button */}
        {firstPreviewTrack ? (
          <button
            onClick={() => handlePlayPreview(firstPreviewTrack.preview_url)}
            style={{
              width: '100%',
              padding: '1rem',
              background: isPlaying ? '#e74c3c' : '#1DB954',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              transition: 'background 0.2s',
            }}
          >
            {isPlaying ? '⏸ Stop Preview' : '▶ Play Preview'}
          </button>
        ) : (
          <div style={{
            width: '100%',
            padding: '1rem',
            background: 'rgba(255,255,255,0.1)',
            color: '#888',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            No preview available
          </div>
        )}

        {/* Tracks List */}
        {floors.length > 0 && (
          <div>
            <h3 style={{
              margin: '0 0 1rem 0',
              fontSize: '1.1rem',
              color: '#fff',
            }}>
              Top Tracks
            </h3>
            {floors.slice(0, 5).map((floor, index) => (
              <div
                key={floor.track_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: currentPreview === floor.preview_url && isPlaying
                    ? 'rgba(29, 185, 84, 0.2)'
                    : 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  cursor: floor.preview_url ? 'pointer' : 'default',
                  border: currentPreview === floor.preview_url && isPlaying
                    ? '1px solid #1DB954'
                    : '1px solid transparent',
                }}
                onClick={() => floor.preview_url && handlePlayPreview(floor.preview_url)}
              >
                {floor.album_cover ? (
                  <img
                    src={floor.album_cover}
                    alt={floor.track_name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '4px',
                    background: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: '#666',
                  }}>
                    ♪
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {floor.track_name}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#888',
                  }}>
                    {Math.round(floor.duration_ms / 60000)}:{String(Math.round((floor.duration_ms % 60000) / 1000)).padStart(2, '0')}
                  </div>
                </div>
                {floor.preview_url && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: currentPreview === floor.preview_url && isPlaying ? '#1DB954' : '#888',
                  }}>
                    {currentPreview === floor.preview_url && isPlaying ? '⏸' : '▶'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// Main City View Component
export default function CityView() {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);

  const fetchCity = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/city_payload');
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to fetch: ${resp.status}`);
      }
      const data = await resp.json();
      console.log('City data received:', data);

      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      // Ensure we have the expected structure
      const validatedData: CityData = {
        buildings: Array.isArray(data.buildings) ? data.buildings : [],
        districts: Array.isArray(data.districts) ? data.districts : [],
        stats: data.stats || {}
      };

      console.log('Validated data:', validatedData);
      console.log(`Rendering ${validatedData.buildings?.length || 0} buildings`);

      setCityData(validatedData);
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Building your city...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ color: 'red', marginBottom: '1rem' }}>Error: {error}</div>
        <button onClick={fetchCity}>Try Again</button>
      </div>
    );
  }

  if (!cityData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Your Spotify City</h2>
        <p>Generate a 3D city from your listening data</p>
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
          Generate My City
        </button>
      </div>
    );
  }

  // Show message if no buildings
  if (!cityData.buildings || cityData.buildings.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No buildings found</h2>
        <p>Your city data doesn't have any buildings. Try logging in again.</p>
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
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Spotify City</h3>
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
            cursor: 'pointer'
          }}
        >
          Regenerate
        </button>
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
        Click on any building to see artist info and play previews
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [100, 100, 100], fov: 60 }}
        style={{ background: '#0a0a1a' }}
      >
        <CityScene cityData={cityData} onBuildingClick={handleBuildingClick} />
      </Canvas>

      {/* Artist Info Panel */}
      {selectedBuilding && (
        <ArtistPanel building={selectedBuilding} onClose={handleClosePanel} />
      )}
    </div>
  );
}
