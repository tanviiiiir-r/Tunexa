"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
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
  // 0 – Night (Deep blue-purple)
  {
    name: "Night",
    sky: [
      [0, "#0a0514"], [0.15, "#120924"], [0.30, "#1a1238"], [0.45, "#221a4c"],
      [0.55, "#2a2058"], [0.65, "#221a4c"], [0.80, "#151030"], [1, "#0a0818"],
    ],
    // Exponential fog for distance fading
    fogColor: "#1a1430", fogNear: 200, fogFar: 8000,
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
  // 1 – Neon (Cyberpunk style)
  {
    name: "Neon",
    sky: [
      [0, "#080010"], [0.15, "#0c0020"], [0.30, "#140030"], [0.42, "#1e0048"],
      [0.52, "#280060"], [0.60, "#1e0048"], [0.75, "#120030"], [0.90, "#080018"],
      [1, "#040008"],
    ],
    fogColor: "#120028", fogNear: 200, fogFar: 8000,
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

// ─── Moon Component ──────────────────────────────────────────

function Moon({ position, color, size = 80 }: { position: [number, number, number]; color: string; size?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create glow texture
  const glowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Create radial gradient for moon glow
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, color + "80"); // 50% opacity
    gradient.addColorStop(0.6, color + "20"); // 12% opacity
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [color]);

  return (
    <group position={position}>
      {/* Moon glow */}
      <mesh ref={meshRef} renderOrder={-2}>
        <planeGeometry args={[size * 4, size * 4]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.6}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Moon core */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[size * 0.3, 32, 32]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
    </group>
  );
}

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
    <mesh ref={meshRef} material={mat} renderOrder={-3} onBeforeRender={onBeforeRender}>
      <sphereGeometry args={[5000, 32, 48]} />
    </mesh>
  );
}

// ─── Ground Plane ────────────────────────────────────────────

function Ground({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[15000, 15000]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// ─── Fog Effect (Exponential) ─────────────────────────────────

function ExponentialFog({ color, density }: { color: string; density: number }) {
  const { scene } = useThree();

  useEffect(() => {
    const oldFog = scene.fog;
    scene.fog = new THREE.FogExp2(color, density);

    return () => {
      scene.fog = oldFog;
    };
  }, [scene, color, density]);

  return null;
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
  const { invalidate } = useThree();

  useEffect(() => {
    // Handle clearing focus - animate back to overview position
    if (!focusedBuilding) {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = true;

        // Animate back to overview position if we were focused
        if (prevFocusedRef.current) {
          startPos.current.copy(camera.position);
          startLook.current.copy(controlsRef.current.target);

          // Reset to overview position
          endPos.current.set(-1200, 800, -1500);
          endLook.current.set(0, 0, 0);

          const travelDist = startPos.current.distanceTo(endPos.current);
          duration.current = getAnimationDuration(travelDist);
          progress.current = 0;
          active.current = true;
          invalidate(); // Kickstart animation loop
        }
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
    invalidate(); // Kickstart animation loop
  }, [focusedBuilding, buildings, camera, invalidate]);

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

    // Trigger re-render for frameloop="demand"
    invalidate();

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
      maxDistance={8000}
      minDistance={50}
      // Prevent rotating underground - stay above horizon
      maxPolarAngle={Math.PI / 2 - 0.05} // Just slightly above ground level
      minPolarAngle={0.1} // Don't go too far above (prevent looking from underneath)
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

  // Moon position - upper left in the sky
  const moonPosition: [number, number, number] = [-2000, 1500, -2000];
  const moonColor = t.name === "Neon" ? "#ff00aa" : "#c8e0ff";

  return (
    <Canvas
      camera={{ position: [-1200, 800, -1500], fov: 60, near: 0.5, far: 20000 }}
      style={{ background: t.fogColor }}
      dpr={dpr}
      frameloop="demand"
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
    >
      {/* Exponential fog for better distance fading */}
      <ExponentialFog color={t.fogColor} density={0.0002} />

      <ambientLight intensity={t.ambientIntensity * 3} color={t.ambientColor} />
      <directionalLight position={t.sunPos} intensity={t.sunIntensity * 3.5} color={t.sunColor} />
      <directionalLight position={t.fillPos} intensity={t.fillIntensity * 3} color={t.fillColor} />
      <hemisphereLight args={[t.hemiSky, t.hemiGround, t.hemiIntensity * 3.5]} />

      {/* Sky and atmosphere */}
      <SkyDome stops={t.sky} />

      {/* Stars - more visible in Night theme */}
      <Stars
        radius={4000}
        depth={1000}
        count={t.name === "Night" ? 3000 : 1500}
        factor={8}
        saturation={t.name === "Neon" ? 1 : 0}
        fade
        speed={0.2}
      />

      {/* Moon */}
      <Moon position={moonPosition} color={moonColor} size={100} />

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
