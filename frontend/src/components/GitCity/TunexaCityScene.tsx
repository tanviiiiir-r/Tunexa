"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createWindowAtlas } from "./Building3D";
import InstancedBuildings from "./InstancedBuildings";
import InstancedLabels from "./InstancedLabels";
import type { CityBuilding } from "../../lib/artistAdapter";
import type { BuildingColors } from "./TunexaCityCanvas";

const GRID_CELL_SIZE = 200;

// Pre-allocated temp vector for focus info projection
const _position = new THREE.Vector3();

export interface FocusInfo {
  dist: number;
  screenX: number;
  screenY: number;
}

// ─── Spatial Grid ───────────────────────────────────────────────

interface GridIndex {
  cells: Map<string, number[]>;
  cellSize: number;
}

function buildSpatialGrid(buildings: CityBuilding[], cellSize: number): GridIndex {
  const cells = new Map<string, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const cx = Math.floor(b.position[0] / cellSize);
    const cz = Math.floor(b.position[2] / cellSize);
    const key = `${cx},${cz}`;
    let arr = cells.get(key);
    if (!arr) {
      arr = [];
      cells.set(key, arr);
    }
    arr.push(i);
  }
  return { cells, cellSize };
}

// ─── Pre-computed building data ─────────────────────────────────

interface BuildingLookup {
  indexByLogin: Map<string, number>;
}

function buildLookup(buildings: CityBuilding[]): BuildingLookup {
  const indexByLogin = new Map<string, number>();
  for (let i = 0; i < buildings.length; i++) {
    indexByLogin.set(buildings[i].login.toLowerCase(), i);
  }
  return { indexByLogin };
}

// ─── Component ──────────────────────────────────────────────────

interface TunexaCitySceneProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  focusedBuilding?: string | null;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
}

export default function TunexaCityScene({
  buildings,
  colors,
  focusedBuilding,
  onBuildingClick,
  onFocusInfo,
}: TunexaCitySceneProps) {
  // Single atlas texture for all building windows (created once per theme)
  const atlasTexture = useMemo(() => createWindowAtlas(colors), [colors]);

  // Spatial grid for effects LOD
  const grid = useMemo(() => buildSpatialGrid(buildings, GRID_CELL_SIZE), [buildings]);

  // Lookup for focus info emission
  const lookup = useMemo(() => buildLookup(buildings), [buildings]);

  // Cache focus name
  const focusedLower = focusedBuilding?.toLowerCase() ?? null;

  // Focused building data (for FocusBeacon positioning)
  const focusedBuildingData = useMemo(() => {
    if (!focusedLower) return null;
    const idx = lookup.indexByLogin.get(focusedLower);
    if (idx === undefined) return null;
    return buildings[idx];
  }, [focusedLower, lookup, buildings]);

  const lastFocusUpdate = useRef(-1);

  // Emit focus info for focused buildings (throttled to 5Hz)
  useFrame(({ camera, clock, size }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastFocusUpdate.current < 0.2) return;
    lastFocusUpdate.current = elapsed;

    if (!onFocusInfo || !focusedLower) return;

    const fi = lookup.indexByLogin.get(focusedLower);
    if (fi === undefined) return;

    const b = buildings[fi];
    const dx = camera.position.x - b.position[0];
    const dz = camera.position.z - b.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    _position.set(b.position[0], b.height * 0.65, b.position[2]);
    _position.project(camera);
    const screenX = (_position.x * 0.5 + 0.5) * size.width;
    const screenY = (-_position.y * 0.5 + 0.5) * size.height;
    onFocusInfo({ dist, screenX, screenY });
  });

  // Dispose atlas on theme change
  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  return (
    <>
      {/* All buildings: single instanced draw call with custom shader */}
      <InstancedBuildings
        buildings={buildings}
        colors={colors}
        atlasTexture={atlasTexture}
        focusedBuilding={focusedBuilding}
        onBuildingClick={onBuildingClick}
      />

      {/* All labels: single instanced draw call with billboard shader */}
      <InstancedLabels
        buildings={buildings}
        focusedBuilding={focusedBuilding}
      />
    </>
  );
}
