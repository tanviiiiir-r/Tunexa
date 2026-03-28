import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';

interface Building {
  id: string;
  artist_name: string;
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
    popularity?: number;
  };
  windows?: Array<{
    floor: number;
    is_lit: boolean;
  }>;
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

// Building Component
function BuildingMesh({ building }: { building: Building }) {
  const position = building.position || { x: 0, y: 0, z: 0 };
  const dimensions = building.dimensions || { width: 10, height: 30, depth: 10 };
  const style = building.style || { color: '#808080', brightness: 0.5, glow_intensity: 0.3, animation: false };

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

  return (
    <group position={[position.x, (position.y || 0) + dimensions.height / 2, position.z]}>
      {/* Main building */}
      <mesh>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial
          color={style.color || '#808080'}
          emissive={style.color || '#808080'}
          emissiveIntensity={style.animation ? (style.glow_intensity || 0.5) * 0.3 : 0.1}
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
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
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
function CityScene({ cityData }: { cityData: CityData }) {
  const buildings = cityData.buildings || [];
  const districts = cityData.districts || [];

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[50, 50, 50]} intensity={0.8} castShadow />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#ffffff" />

      <Ground />

      {districts.length > 0 && <DistrictMarkers districts={districts} />}

      {buildings.map((building) => (
        <BuildingMesh key={building.id || Math.random().toString()} building={building} />
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

// Main City View Component
export default function CityView() {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      console.log(`Rendering ${validatedData.buildings.length} buildings`);

      setCityData(validatedData);
    } catch (err) {
      console.error('Error fetching city:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
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

      <Canvas
        camera={{ position: [100, 100, 100], fov: 60 }}
        style={{ background: '#0a0a1a' }}
      >
        <CityScene cityData={cityData} />
      </Canvas>
    </div>
  );
}
