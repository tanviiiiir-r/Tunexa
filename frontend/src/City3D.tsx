import React, { useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

// Building component
function Building({ building, onClick }: { building: any; onClick: () => void }) {
  const { dimensions, position, style, windows, artist_name } = building;
  const { width, height, depth } = dimensions;
  const { color, brightness, glowIntensity, animation } = style;

  const meshRef = React.useRef<THREE.Mesh>(null);

  // Create windows as small planes on building face
  const windowElements = useMemo(() => {
    const windowCount = Math.min(windows?.length || 5, 10);
    const elements = [];
    const cols = 2;
    const rows = Math.ceil(windowCount / cols);

    for (let i = 0; i < windowCount; i++) {
      const window = windows?.[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Position windows on front face
      const wx = (col - 0.5) * (width * 0.3);
      const wy = (row - rows / 2) * (height * 0.15) + height * 0.1;
      const wz = depth / 2 + 0.1;

      const isLit = window?.is_lit || false;
      const windowColor = isLit ? '#FFD700' : '#333333';

      elements.push(
        <mesh key={i} position={[wx, wy, wz]}>
          <planeGeometry args={[width * 0.15, height * 0.1]} />
          <meshBasicMaterial color={windowColor} />
        </mesh>
      );
    }
    return elements;
  }, [windows, width, height, depth]);

  // Emissive material for glow effect
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: animation ? glowIntensity : glowIntensity * 0.5,
      roughness: 0.3,
      metalness: 0.2,
    });
    return mat;
  }, [color, glowIntensity, animation]);

  return (
    <group position={[position.x, position.y + height / 2, position.z]}>
      {/* Building base */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <boxGeometry args={[width, height, depth]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Windows */}
      {windowElements}

      {/* Artist name label (floating above) */}
      <Text
        position={[0, height / 2 + 5, 0]}
        fontSize={2}
        color="white"
        anchorX="center"
        anchorY="middle"
        visible={false} // Only show on hover - simplified for now
      >
        {artist_name}
      </Text>
    </group>
  );
}

// District floor component
function DistrictFloor({ district }: { district: any }) {
  const { color, direction } = district;

  // Position floor based on direction
  const angle = (direction * Math.PI) / 180;
  const distance = 50;
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;

  return (
    <group position={[x, -1, z]}>
      {/* District floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 32]} />
        <meshStandardMaterial color={color} opacity={0.3} transparent />
      </mesh>

      {/* District label */}
      <Text
        position={[0, 1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={4}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {district.name}
      </Text>
    </group>
  );
}

// Ground plane
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  );
}

// Camera controller
function CameraController() {
  const { camera } = useThree();

  React.useEffect(() => {
    camera.position.set(100, 100, 100);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return null;
}

// Main City3D component
interface City3DProps {
  cityData: {
    buildings: any[];
    districts: any[];
    stats: any;
  };
  onBuildingClick?: (building: any) => void;
}

export function City3D({ cityData, onBuildingClick }: City3DProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);

  const { buildings, districts } = cityData;

  const handleBuildingClick = (building: any) => {
    setSelectedBuilding(building);
    onBuildingClick?.(building);
    console.log('Clicked building:', building);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Stats overlay */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '1rem',
        borderRadius: '8px',
        zIndex: 100,
        fontFamily: 'sans-serif'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0' }}>My Spotify City</h3>
        <p style={{ margin: '0' }}>Buildings: {buildings.length}</p>
        <p style={{ margin: '0' }}>Districts: {districts.length}</p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#aaa' }}>
          Click buildings to explore
        </p>
      </div>

      {/* Selected building info */}
      {selectedBuilding && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '1rem',
          borderRadius: '8px',
          zIndex: 100,
          fontFamily: 'sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          {selectedBuilding.artist_image_url && (
            <img
              src={selectedBuilding.artist_image_url}
              alt={selectedBuilding.artist_name}
              style={{ width: '60px', height: '60px', borderRadius: '4px' }}
            />
          )}
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0' }}>{selectedBuilding.artist_name}</h3>
            <p style={{ margin: '0', fontSize: '0.9rem', color: '#aaa' }}>
              Genre: {selectedBuilding.metadata.genre} |
              Popularity: {selectedBuilding.metadata.popularity}/100 |
              Listening: {selectedBuilding.metadata.listening_minutes} min
            </p>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas>
        <CameraController />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[100, 100, 50]} intensity={1} />
        <pointLight position={[0, 50, 0]} intensity={0.5} color="#ffffff" />

        {/* Ground */}
        <Ground />

        {/* Districts */}
        {districts.map((district, i) => (
          <DistrictFloor key={i} district={district} />
        ))}

        {/* Buildings */}
        {buildings.map((building, i) => (
          <Building
            key={building.id || i}
            building={building}
            onClick={() => handleBuildingClick(building)}
          />
        ))}
      </Canvas>
    </div>
  );
}

export default City3D;
