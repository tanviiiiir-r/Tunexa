"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import TunexaCityScene from "./TunexaCityScene";
import type { FocusInfo } from "./TunexaCityScene";
import type { CityBuilding } from "../../lib/artistAdapter";

// ─── Theme Definitions (from Git City) ───────────────────────

export interface BuildingColors {
  windowLit: string[];
  windowOff: string;
  face: string;
  roof: string;
  accent: string;
}

interface CityTheme {
  sky: [number, string][];
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPos: [number, number, number];
  fillColor: string;
  fillIntensity: number;
  fillPos: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  groundColor: string;
  building: BuildingColors;
}

export const THEMES: CityTheme[] = [
  // 0 – Midnight
  {
    sky: [
      [0, "#000206"], [0.15, "#020814"], [0.30, "#061428"], [0.45, "#0c2040"],
      [0.55, "#102850"], [0.65, "#0c2040"], [0.80, "#061020"], [1, "#020608"],
    ],
    fogColor: "#0a1428", fogNear: 400, fogFar: 3500,
    ambientColor: "#4060b0", ambientIntensity: 0.55,
    sunColor: "#7090d0", sunIntensity: 0.75, sunPos: [300, 120, -200],
    fillColor: "#304080", fillIntensity: 0.3, fillPos: [-200, 60, 200],
    hemiSky: "#5080a0", hemiGround: "#202830", hemiIntensity: 0.5,
    groundColor: "#242c38",
    building: {
      windowLit: ["#a0c0f0", "#80a0e0", "#6080c8", "#c0d8f8", "#e0e8ff"],
      windowOff: "#0c0e18", face: "#101828", roof: "#2a3858",
      accent: "#6090e0",
    },
  },
  // 1 – Sunset
  {
    sky: [
      [0, "#0c0614"], [0.15, "#1c0e30"], [0.28, "#3a1850"], [0.38, "#6a3060"],
      [0.46, "#a05068"], [0.52, "#d07060"], [0.57, "#e89060"], [0.62, "#f0b070"],
      [0.68, "#f0c888"], [0.75, "#c08060"], [0.85, "#603030"], [1, "#180c10"],
    ],
    fogColor: "#80405a", fogNear: 400, fogFar: 3500,
    ambientColor: "#e0a080", ambientIntensity: 0.7,
    sunColor: "#f0b070", sunIntensity: 1.0, sunPos: [400, 120, -300],
    fillColor: "#6050a0", fillIntensity: 0.35, fillPos: [-200, 80, 200],
    hemiSky: "#d09080", hemiGround: "#4a2828", hemiIntensity: 0.55,
    groundColor: "#3a3038",
    building: {
      windowLit: ["#f8d880", "#f0b860", "#e89840", "#d07830", "#f0c060"],
      windowOff: "#1a1018", face: "#281828", roof: "#604050",
      accent: "#c8e64a",
    },
  },
  // 2 – Neon
  {
    sky: [
      [0, "#06001a"], [0.15, "#100028"], [0.30, "#200440"], [0.42, "#380650"],
      [0.52, "#500860"], [0.60, "#380648"], [0.75, "#180230"], [0.90, "#0c0118"],
      [1, "#06000c"],
    ],
    fogColor: "#1a0830", fogNear: 400, fogFar: 3500,
    ambientColor: "#8040c0", ambientIntensity: 0.6,
    sunColor: "#c050e0", sunIntensity: 0.85, sunPos: [300, 100, -200],
    fillColor: "#00c0d0", fillIntensity: 0.4, fillPos: [-250, 60, 200],
    hemiSky: "#9040d0", hemiGround: "#201028", hemiIntensity: 0.5,
    groundColor: "#2c2038",
    building: {
      windowLit: ["#ff40c0", "#c040ff", "#00e0ff", "#40ff80", "#ff8040"],
      windowOff: "#0a0814", face: "#180830", roof: "#3c1858",
      accent: "#e040c0",
    },
  },
  // 3 – Emerald
  {
    sky: [
      [0, "#000804"], [0.15, "#001408"], [0.30, "#002810"], [0.42, "#003c1c"],
      [0.52, "#004828"], [0.60, "#003820"], [0.75, "#002014"], [0.90, "#001008"],
      [1, "#000604"],
    ],
    fogColor: "#0a2014", fogNear: 400, fogFar: 3500,
    ambientColor: "#40a060", ambientIntensity: 0.55,
    sunColor: "#70d090", sunIntensity: 0.75, sunPos: [300, 100, -250],
    fillColor: "#20a080", fillIntensity: 0.35, fillPos: [-200, 60, 200],
    hemiSky: "#50b068", hemiGround: "#183020", hemiIntensity: 0.5,
    groundColor: "#1e3020",
    building: {
      windowLit: ["#0e4429", "#006d32", "#26a641", "#39d353", "#c8e64a"],
      windowOff: "#060e08", face: "#0c1810", roof: "#1e4028",
      accent: "#f0c060",
    },
  },
];

export const DEFAULT_THEME = THEMES[0];

// ─── Sky Dome ────────────────────────────────────────────────

function SkyDome({ stops }: { stops: [number, string][] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    for (const [stop, color] of stops) g.addColorStop(stop, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false });
  }, [stops]);

  useEffect(() => {
    return () => {
      mat.map?.dispose();
      mat.dispose();
    };
  }, [mat]);

  const onBeforeRender = useCallback((_renderer: THREE.WebGLRenderer, _scene: THREE.Scene, camera: THREE.Camera) => {
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  }, []);

  return (
    <mesh ref={meshRef} material={mat} renderOrder={-1} onBeforeRender={onBeforeRender}>
      <sphereGeometry args={[3500, 32, 48]} />
    </mesh>
  );
}

// ─── Ground Plane ────────────────────────────────────────────

function Ground({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[8000, 8000]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// ─── Orbit Scene ─────────────────────────────────────────────

function OrbitScene({
  buildings,
  focusedBuilding,
  onBuildingClick
}: {
  buildings: CityBuilding[];
  focusedBuilding: string | null;
  onBuildingClick?: (building: CityBuilding) => void;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!focusedBuilding) {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true;
      }
      return;
    }

    const b = buildings.find(b => b.login === focusedBuilding);
    if (!b || !controlsRef.current) return;

    // Focus on building
    const targetPos = new THREE.Vector3(b.position[0], b.height * 0.5, b.position[2]);
    const offset = new THREE.Vector3(150, 100, 150);
    const endPos = targetPos.clone().add(offset);

    controlsRef.current.target.copy(targetPos);
    controlsRef.current.object.position.copy(endPos);
    controlsRef.current.autoRotate = false;
  }, [focusedBuilding, buildings, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      maxDistance={1500}
      minDistance={50}
      enableDamping={true}
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      autoRotate={true}
      autoRotateSpeed={0.5}
    />
  );
}

// ─── Main Canvas Component ───────────────────────────────────

interface TunexaCityCanvasProps {
  buildings: CityBuilding[];
  theme?: CityTheme;
  focusedBuilding?: string | null;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
}

export default function TunexaCityCanvas({
  buildings,
  theme = DEFAULT_THEME,
  focusedBuilding,
  onBuildingClick,
  onFocusInfo,
}: TunexaCityCanvasProps) {
  const t = theme;
  const [dpr, setDpr] = useState(1);

  return (
    <Canvas
      camera={{ position: [-400, 450, -600], fov: 55, near: 0.5, far: 8000 }}
      style={{ background: t.fogColor }}
      dpr={dpr}
      frameloop="demand"
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
    >
      <fog attach="fog" args={[t.fogColor, t.fogNear, t.fogFar]} />

      <ambientLight intensity={t.ambientIntensity * 3} color={t.ambientColor} />
      <directionalLight position={t.sunPos} intensity={t.sunIntensity * 3.5} color={t.sunColor} />
      <directionalLight position={t.fillPos} intensity={t.fillIntensity * 3} color={t.fillColor} />
      <hemisphereLight args={[t.hemiSky, t.hemiGround, t.hemiIntensity * 3.5]} />

      <SkyDome stops={t.sky} />
      <Ground color={t.groundColor} />

      <TunexaCityScene
        buildings={buildings}
        colors={t.building}
        focusedBuilding={focusedBuilding}
        onBuildingClick={onBuildingClick}
        onFocusInfo={onFocusInfo}
      />

      <OrbitScene
        buildings={buildings}
        focusedBuilding={focusedBuilding}
        onBuildingClick={onBuildingClick}
      />
    </Canvas>
  );
}
