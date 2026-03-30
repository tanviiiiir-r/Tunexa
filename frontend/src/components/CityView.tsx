import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { apiUrl } from '../config';
import { THEMES, DEFAULT_THEME, type CityTheme } from '../lib/themes';

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

// STEP 2: Block-based layout with dense spacing (Git City style)
// Block layout constants
const BLOCK_SIZE = 3;           // 3x3 buildings per block
const LOT_W = 35;              // Lot width (X)
const LOT_D = 35;              // Lot depth (Z)
const ALLEY_W = 4;             // Gap between buildings in block
const STREET_W = 15;           // Street width between blocks

const BLOCK_FOOTPRINT_X = BLOCK_SIZE * (LOT_W + ALLEY_W); // 117 units
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * (LOT_D + ALLEY_W); // 117 units
const HORIZONTAL_SPACING = LOT_W + ALLEY_W;  // 39 units
const VERTICAL_SPACING = LOT_D + ALLEY_W;    // 39 units

// Spiral coordinate generator (from Git City)
function spiralCoord(index: number): [number, number] {
  if (index === 0) return [0, 0];
  let x = 0, y = 0, dx = 1, dy = 0;
  let segLen = 1, segPassed = 0, turns = 0;
  for (let i = 0; i < index; i++) {
    x += dx; y += dy; segPassed++;
    if (segPassed === segLen) {
      segPassed = 0;
      const tmp = dx; dx = -dy; dy = tmp; // turn left
      turns++; if (turns % 2 === 0) segLen++;
    }
  }
  return [x, y];
}

// Git City style - Block-based layout with dense spacing
function getArtistPosition(artist: Artist, index: number): { x: number, z: number } {
  // Always generate fresh positions (ignore DB coords for now)
  const useDatabaseCoords = false;

  if (useDatabaseCoords && artist.city_x !== null && artist.city_z !== null && artist.city_x !== 0 && artist.city_z !== 0) {
    return { x: artist.city_x, z: artist.city_z };
  }

  // STEP 2: Block-based positioning with spiral layout
  const buildingsPerBlock = BLOCK_SIZE * BLOCK_SIZE; // 9 buildings per block
  const blockIndex = Math.floor(index / buildingsPerBlock);
  const [blockX, blockZ] = spiralCoord(blockIndex);

  // Position within block
  const localIndex = index % buildingsPerBlock;
  const localRow = Math.floor(localIndex / BLOCK_SIZE);
  const localCol = localIndex % BLOCK_SIZE;

  // Calculate world position
  // Center the block around 0
  const centerOffset = (BLOCK_SIZE - 1) / 2; // 1
  const posX = blockX * (BLOCK_FOOTPRINT_X + STREET_W) +
               (localCol - centerOffset) * HORIZONTAL_SPACING;
  const posZ = blockZ * (BLOCK_FOOTPRINT_Z + STREET_W) +
               (localRow - centerOffset) * VERTICAL_SPACING;

  // Small jitter for organic feel (±4 units like Git City)
  const jitter = () => (Math.random() - 0.5) * 8;

  return { x: posX + jitter(), z: posZ + jitter() };
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

  // STEP 1: Building Dimensions - Git City style
  // Constants
  const MIN_BUILDING_HEIGHT = 35;
  const MAX_BUILDING_HEIGHT = 400;
  const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT;

  // Height: Power curve for better distribution, multi-factor (listeners + tracks)
  const listenerNorm = artist.lastfm_listeners / maxListeners;
  const trackNorm = Math.min(1, artist.track_count / 1000);
  // Weighted composite: 70% listeners, 30% track count
  const heightScore =
    Math.pow(Math.min(listenerNorm, 3), 0.6) * 0.7 +
    Math.pow(trackNorm, 0.5) * 0.3;
  const buildingHeight = MIN_BUILDING_HEIGHT + (heightScore * HEIGHT_RANGE);

  // Width: 12-39 range with power curve and jitter (Git City style)
  const baseWidth = 14;
  const widthScore = Math.pow(Math.min(1, artist.track_count / 1000), 0.5) * 21; // 0-21 range
  const jitter = (Math.random() - 0.5) * 4; // ±2 units seeded jitter
  const buildingWidth = Math.round(baseWidth + widthScore + jitter);

  // Depth: Varies from width (not square) - 0.8 to 1.2× width
  const depthRatio = 0.8 + (Math.random() * 0.4); // 0.8-1.2
  const buildingDepth = buildingWidth * depthRatio;

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
      depth: buildingDepth // STEP 1: Rectangular buildings (not square)
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
function BuildingMesh({ building, onClick, index }: { building: Building; onClick: (building: Building) => void; index: number }) {
  const position = building.position;
  const dimensions = building.dimensions;
  const style = building.style;
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // STEP 4: Rise Animation - Building grows from ground on load
  const [riseProgress, setRiseProgress] = useState(0.001);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) return;

    const RISE_DURATION = 850; // ms (matches Git City)
    const staggerDelay = index * 15; // 15ms stagger per building

    const timer = setTimeout(() => {
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / RISE_DURATION);

        // Cubic ease-out
        const eased = 1 - Math.pow(1 - progress, 3);
        setRiseProgress(0.001 + eased * (1 - 0.001));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setHasAnimated(true);
        }
      };

      requestAnimationFrame(animate);
    }, staggerDelay);

    return () => clearTimeout(timer);
  }, [index, hasAnimated]);
  const groupRef = useRef<THREE.Group>(null);

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
      position={[position.x, position.y + (dimensions.height / 2) * riseProgress, position.z]}
      scale={[1, riseProgress, 1]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      frustumCulled={false}
    >
      {/* Main building */}
      <mesh ref={meshRef} frustumCulled={false}>
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

// STEP 3: SkyDome with gradient (Git City style)
// STEP 6: Now accepts theme prop
function SkyDome({ theme }: { theme: CityTheme }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Use theme sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    theme.sky.forEach(([stop, color]) => {
      gradient.addColorStop(stop, color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [theme]);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[3000, 32, 48]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} />
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

// Main City Scene - STEP 6: Now accepts theme prop
function CityScene({ cityData, onBuildingClick, theme }: {
  cityData: { buildings: Building[]; districts: District[] };
  onBuildingClick: (building: Building) => void;
  theme: CityTheme;
}) {
  const { buildings, districts } = cityData;

  return (
    <>
      {/* STEP 3 & 6: Git City 4-Light System + Themed Atmosphere */}

      {/* Fog and Background */}
      <color attach="background" args={[theme.fogColor]} />
      <fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

      {/* 1. Ambient Light - base illumination */}
      <ambientLight intensity={theme.ambientIntensity} color={theme.ambientColor} />

      {/* 2. Sun Light - main directional with shadows */}
      <directionalLight
        intensity={theme.sunIntensity}
        color={theme.sunColor}
        position={theme.sunPos}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* 3. Fill Light - reduces harsh shadows */}
      <directionalLight
        intensity={theme.fillIntensity}
        color={theme.fillColor}
        position={theme.fillPos}
      />

      {/* 4. Hemisphere Light - sky/ground color blend */}
      <hemisphereLight
        skyColor={theme.hemiSky}
        groundColor={theme.hemiGround}
        intensity={theme.hemiIntensity}
      />

      <SkyDome theme={theme} />
      <Ground themeColor={theme.groundColor} />

      {districts.length > 0 && <DistrictMarkers districts={districts} />}

      {buildings.map((building, idx) => (
        <BuildingMesh
          key={building.id}
          building={building}
          onClick={onBuildingClick}
          index={idx}
        />
      ))}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxDistance={3000}
        minDistance={20}
      />

      {/* STEP 3: Bloom Post-Processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          height={300}
          intensity={0.3}
        />
      </EffectComposer>
    </>
  );
}

// Claim Artist Button Component
interface ClaimButtonProps {
  artistId: string;
  artistName: string;
}

function ClaimArtistButton({ artistId, artistName }: ClaimButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '', proof_description: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const resp = await fetch(apiUrl('/claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: artistId,
          email: formData.email,
          name: formData.name,
          proof_description: formData.proof_description
        })
      });

      const data = await resp.json();

      if (resp.ok) {
        setStatus('success');
        setMessage(data.message || 'Claim submitted successfully!');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to submit claim');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div style={{
        background: 'rgba(29, 185, 84, 0.2)',
        border: '1px solid #1DB954',
        borderRadius: '8px',
        padding: '1rem',
        textAlign: 'center'
      }}>
        <div style={{ color: '#1DB954', fontSize: '1.5rem' }}>✓</div>
        <div style={{ color: '#fff', marginTop: '0.5rem' }}>{message}</div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        style={{
          width: '100%',
          padding: '0.75rem 1.5rem',
          background: '#1DB954',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = '#1ed760'}
        onMouseOut={(e) => e.currentTarget.style.background = '#1DB954'}
      >
        📝 Claim This Artist
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1rem' }}>
        Claim "{artistName}"
      </h4>
      <input
        type="text"
        placeholder="Your Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff'
        }}
      />
      <input
        type="email"
        placeholder="your@email.com"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff'
        }}
      />
      <textarea
        placeholder="Proof you own this artist profile (e.g., official website, social media links)"
        value={formData.proof_description}
        onChange={(e) => setFormData({ ...formData, proof_description: e.target.value })}
        rows={3}
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff',
          resize: 'vertical'
        }}
      />
      {status === 'error' && (
        <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{message}</div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={status === 'submitting'}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            background: status === 'submitting' ? '#666' : '#1DB954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer'
          }}
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit Claim'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            color: '#888',
            border: '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Artist Info Panel Component// Artist Info Panel Component
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

        {/* Claim Artist Button */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
          <ClaimArtistButton artistId={building.artist_id} artistName={building.artist_name} />
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
  const [currentTheme, setCurrentTheme] = useState<CityTheme>(DEFAULT_THEME);

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

      {/* Theme Selector */}
      <div
        style={{
          position: 'absolute',
          top: '5rem',
          right: '1rem',
          zIndex: 10,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontFamily: 'sans-serif',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Theme</div>
        {THEMES.map((theme) => (
          <button
            key={theme.name}
            onClick={() => setCurrentTheme(theme)}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.4rem 0.75rem',
              marginBottom: '0.25rem',
              fontSize: '0.8rem',
              cursor: 'pointer',
              background: currentTheme.name === theme.name ? theme.accent : '#333',
              color: currentTheme.name === theme.name ? '#000' : '#fff',
              border: `1px solid ${theme.accent}`,
              borderRadius: '4px',
            }}
          >
            {theme.name}
          </button>
        ))}
      </div>

      {/* Theme Selector */}
      <div
        style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          zIndex: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontFamily: 'sans-serif',
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#888' }}>Theme</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {THEMES.map((theme) => (
            <button
              key={theme.name}
              onClick={() => setCurrentTheme(theme)}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                border: currentTheme.name === theme.name ? `2px solid ${theme.accent}` : '2px solid transparent',
                borderRadius: '4px',
                background: currentTheme.name === theme.name ? theme.wall : '#333',
                color: currentTheme.name === theme.name ? theme.accent : '#fff',
              }}
            >
              {theme.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [400, 300, 400], fov: 60, near: 1, far: 5000 }}
        style={{ background: '#0a0a1a' }}
      >
        <CameraController />
        <CityScene cityData={cityData} onBuildingClick={handleBuildingClick} theme={currentTheme} />
      </Canvas>

      {/* Artist Info Panel */}
      {selectedBuilding && (
        <ArtistPanel building={selectedBuilding} onClose={handleClosePanel} />
      )}
    </div>
  );
}
