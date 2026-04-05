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
  name: string;
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
  // 0 – Night (Deep blue-purple, different from Git City's Midnight)
  {
    name: "Night",
    sky: [
      [0, "#0a0514"], [0.15, "#120924"], [0.30, "#1a1238"], [0.45, "#221a4c"],
      [0.55, "#2a2058"], [0.65, "#221a4c"], [0.80, "#151030"], [1, "#0a0818"],
    ],
    fogColor: "#1a1430", fogNear: 400, fogFar: 3500,
    ambientColor: "#5040a0", ambientIntensity: 0.55,
    sunColor: "#8060d0", sunIntensity: 0.65, sunPos: [300, 120, -200],
    fillColor: "#403080", fillIntensity: 0.3, fillPos: [-200, 60, 200],
    hemiSky: "#6050b0", hemiGround: "#282038", hemiIntensity: 0.5,
    groundColor: "#2c2440",
    building: {
      windowLit: ["#b8a0ff", "#9880f0", "#7860e0", "#d0c0ff", "#e8e0ff"],
      windowOff: "#120a20", face: "#1a1030", roof: "#3a3060",
      accent: "#ff6b9d",
    },
  },
  // 1 – Neon (Cyberpunk style, different from Git City's Neon)
  {
    name: "Neon",
    sky: [
      [0, "#080010"], [0.15, "#0c0020"], [0.30, "#140030"], [0.42, "#1e0048"],
      [0.52, "#280060"], [0.60, "#1e0048"], [0.75, "#120030"], [0.90, "#080018"],
      [1, "#040008"],
    ],
    fogColor: "#120028", fogNear: 400, fogFar: 3500,
    ambientColor: "#602080", ambientIntensity: 0.6,
    sunColor: "#ff00aa", sunIntensity: 0.85, sunPos: [300, 100, -200],
    fillColor: "#00ff88", fillIntensity: 0.4, fillPos: [-250, 60, 200],
    hemiSky: "#ff00aa", hemiGround: "#180820", hemiIntensity: 0.5,
    groundColor: "#1a0828",
    building: {
      windowLit: ["#ff00aa", "#00ff88", "#00ffff", "#ffaa00", "#ff4488"],
      windowOff: "#080510", face: "#120820", roof: "#301040",
      accent: "#00ff88",
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

// ─── Camera Animation Helpers ────────────────────────────────

// Smooth ease-out for cinematic feel
function smoothEase(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

// Adaptive duration based on distance
function getAnimationDuration(distance: number): number {
  return Math.min(2.0, Math.max(0.8, distance / 800));
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

  // Animation refs
  const startPos = useRef(new THREE.Vector3());
  const startLook = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const endLook = useRef(new THREE.Vector3());
  const progress = useRef(1);
  const active = useRef(false);
  const duration = useRef(1.0);
  const prevFocusedRef = useRef<string | null>(null);

  useEffect(() => {
    // Handle clearing focus - restore auto-rotate
    if (!focusedBuilding) {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true;
      }
      prevFocusedRef.current = null;
      return;
    }

    const b = buildings.find(b => b.login === focusedBuilding);
    if (!b || !controlsRef.current) return;

    // Always animate when focusing on a building (even when switching)
    // Capture current camera state as start
    startPos.current.copy(camera.position);
    startLook.current.copy(controlsRef.current.target);

    // Calculate target position
    const targetPos = new THREE.Vector3(b.position[0], b.height * 0.5, b.position[2]);
    const offset = new THREE.Vector3(150, 100, 150);
    endPos.current.copy(targetPos).add(offset);
    endLook.current.copy(targetPos);

    // Calculate adaptive duration based on travel distance
    const travelDist = startPos.current.distanceTo(endPos.current);
    duration.current = getAnimationDuration(travelDist);
    progress.current = 0;
    active.current = true;

    controlsRef.current.autoRotate = false;
    prevFocusedRef.current = focusedBuilding;
  }, [focusedBuilding, buildings, camera]);

  // Animation frame
  useFrame((_, delta) => {
    if (!active.current || progress.current >= 1) return;

    progress.current = Math.min(1, progress.current + delta / duration.current);
    const t = smoothEase(progress.current);

    camera.position.lerpVectors(startPos.current, endPos.current, t);

    if (controlsRef.current) {
      controlsRef.current.target.lerpVectors(startLook.current, endLook.current, t);
      controlsRef.current.update();
    }

    if (progress.current >= 1) {
      active.current = false;
    }
  });

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
