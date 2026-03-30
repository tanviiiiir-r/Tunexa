"use client";

import { useRef, useMemo, useEffect, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CityTheme } from "../lib/themes";

// ─── Atlas Constants ───────────────────────────────────────────
const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8; // 6px window + 2px gap
const ATLAS_COLS = ATLAS_SIZE / ATLAS_CELL; // 256
const ATLAS_BAND_ROWS = 42;
const ATLAS_LIT_PCTS = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95];

// ─── Building Data Interface ─────────────────────────────────────
interface BuildingData {
  id: string;
  position: [number, number, number];
  dimensions: { width: number; height: number; depth: number };
  color: string;
  floors: number;
  windowsPerFloor: number;
  litPercentage: number;
}

// ─── Shader Code ───────────────────────────────────────────────

const vertexShader = /* glsl */ `
  attribute vec4 aUvFront;
  attribute vec4 aUvSide;
  attribute float aRise;
  attribute vec3 aTint;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying float vInstanceId;
  varying vec3 vTint;

  void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vUvFront = aUvFront;
    vUvSide = aUvSide;
    vTint = aTint;

    // Rise animation: modulate Y position by aRise
    vec3 localPos = position;
    localPos.y = localPos.y * aRise + (aRise - 1.0) * 0.5;

    vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(localPos, 1.0);
    vViewPos = mvPos.xyz;
    vInstanceId = float(gl_InstanceID);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uRoofColor;
  uniform vec3 uFaceColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uFocusedId;
  uniform float uDimOpacity;
  uniform float uCityEnergy;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec4 vUvFront;
  varying vec4 vUvSide;
  varying vec3 vViewPos;
  varying float vInstanceId;
  varying vec3 vTint;

  void main() {
    // Early discard for fog
    float fogDepth = length(vViewPos);
    if (fogDepth > uFogFar) discard;

    vec3 absN = abs(vNormal);
    float isRoof = step(0.5, absN.y);

    // Choose UV params based on face normal
    bool isFrontBack = absN.z > absN.x;
    vec4 uvParams = isFrontBack ? vUvFront : vUvSide;

    vec2 atlasUv = uvParams.xy + vUv * uvParams.zw;
    vec3 wallColor = texture2D(uAtlas, atlasUv).rgb;

    // Custom color tint
    if (length(vTint) > 0.01) {
      float isFacePixel = step(length(wallColor - uFaceColor), 0.08);
      vec3 blendedTint = mix(uFaceColor, vTint, 0.5);
      wallColor = mix(wallColor, blendedTint, isFacePixel);
    }

    // Emissive glow for lit windows
    float ambientBase = 0.08 + 0.22 * uCityEnergy;
    vec3 emissive = wallColor * 1.8 * uCityEnergy;
    vec3 wallFinal = wallColor * ambientBase + emissive;

    // Roof color
    vec3 roofFinal = uRoofColor * (0.4 + 1.4 * uCityEnergy);

    vec3 color = mix(wallFinal, roofFinal, isRoof);

    // Simple directional light
    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.5));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.3 + 0.7;
    color *= diffuse;

    // Focus/dim: keep focused building at full opacity
    float isFocused = step(abs(vInstanceId - uFocusedId), 0.5);
    float hasFocus = step(0.0, uFocusedId);
    float dimFactor = mix(1.0, mix(uDimOpacity, 1.0, isFocused), hasFocus);
    color *= dimFactor;

    // Screen-door transparency for unfocused
    float isUnfocused = hasFocus * (1.0 - isFocused);
    if (isUnfocused > 0.5) {
      int x = int(mod(gl_FragCoord.x, 4.0));
      int y = int(mod(gl_FragCoord.y, 4.0));
      int idx = x + y * 4;
      float bayer;
      if (idx == 0) bayer = 0.0;    else if (idx == 1) bayer = 0.5;
      else if (idx == 2) bayer = 0.125; else if (idx == 3) bayer = 0.625;
      else if (idx == 4) bayer = 0.75;  else if (idx == 5) bayer = 0.25;
      else if (idx == 6) bayer = 0.875; else if (idx == 7) bayer = 0.375;
      else if (idx == 8) bayer = 0.1875; else if (idx == 9) bayer = 0.6875;
      else if (idx == 10) bayer = 0.0625; else if (idx == 11) bayer = 0.5625;
      else if (idx == 12) bayer = 0.9375; else if (idx == 13) bayer = 0.4375;
      else if (idx == 14) bayer = 0.8125; else bayer = 0.3125;
      if (bayer > uDimOpacity) discard;
    }

    // Linear fog
    float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Pre-allocated temp objects (Git City pattern) ──────────────
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();

// ─── Window Atlas Generator ────────────────────────────────────
function createWindowAtlas(colors: {
  face: string;
  windowLit: string[];
  windowOff: string;
}): THREE.CanvasTexture {
  const WS = 6;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Use ImageData for direct pixel writes (10-50x faster)
  const imageData = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const buf32 = new Uint32Array(imageData.data.buffer);

  // Helper to convert hex to ABGR
  const colorToABGR = (hex: string) => {
    const c = new THREE.Color(hex);
    return (
      255 << 24 |
      (Math.round(c.b * 255) << 16) |
      (Math.round(c.g * 255) << 8) |
      Math.round(c.r * 255)
    );
  };

  const faceABGR = colorToABGR(colors.face);
  const litABGRs = colors.windowLit.map(colorToABGR);
  const offABGR = colorToABGR(colors.windowOff);

  // Fill background with face color
  buf32.fill(faceABGR);

  // Seeded random
  let s = 42;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Generate 6 bands of different lit percentages
  for (let band = 0; band < ATLAS_LIT_PCTS.length; band++) {
    const litPct = ATLAS_LIT_PCTS[band];
    const bandStart = band * ATLAS_BAND_ROWS;
    for (let r = 0; r < ATLAS_BAND_ROWS; r++) {
      const rowY = (bandStart + r) * ATLAS_CELL;
      for (let c = 0; c < ATLAS_COLS; c++) {
        const px = c * ATLAS_CELL;
        const abgr = rand() < litPct
          ? litABGRs[Math.floor(rand() * litABGRs.length)]
          : offABGR;
        // Write WS×WS pixel block
        for (let dy = 0; dy < WS; dy++) {
          const rowOffset = (rowY + dy) * ATLAS_SIZE + px;
          for (let dx = 0; dx < WS; dx++) {
            buf32[rowOffset + dx] = abgr;
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Component ─────────────────────────────────────────────────

interface GitCityBuildingsProps {
  buildings: BuildingData[];
  theme: CityTheme;
  focusedBuildingId: string | null;
  onBuildingClick?: (building: BuildingData) => void;
}

const RISE_DURATION = 0.85; // seconds
const MAX_RISE_TOTAL = 4; // cap total stagger

let hasPlayedRiseGlobal = false;

export default memo(function GitCityBuildings({
  buildings,
  theme,
  focusedBuildingId,
  onBuildingClick,
}: GitCityBuildingsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = buildings.length;

  // Create window atlas texture
  const atlasTexture = useMemo(() => {
    return createWindowAtlas({
      face: theme.wall,
      windowLit: theme.windowLit,
      windowOff: "#0c0e18",
    });
  }, [theme]);

  // Lookup for id -> index
  const idToIdx = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < buildings.length; i++) {
      map.set(buildings[i].id, i);
    }
    return map;
  }, [buildings]);

  // Shared geometry (unit box)
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  // Custom shader material
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlasTexture },
        uRoofColor: { value: new THREE.Color(theme.roof) },
        uFaceColor: { value: new THREE.Color(theme.wall) },
        uFogColor: { value: new THREE.Color(theme.fogColor) },
        uFogNear: { value: theme.fogNear },
        uFogFar: { value: theme.fogFar },
        uFocusedId: { value: -1.0 },
        uDimOpacity: { value: 0.6 },
        uCityEnergy: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  // Update theme uniforms
  useEffect(() => {
    material.uniforms.uAtlas.value = atlasTexture;
    material.uniforms.uRoofColor.value.set(theme.roof);
    material.uniforms.uFaceColor.value.set(theme.wall);
    material.uniforms.uFogColor.value.set(theme.fogColor);
    material.uniforms.uFogNear.value = theme.fogNear;
    material.uniforms.uFogFar.value = theme.fogFar;
    material.needsUpdate = true;
  }, [material, atlasTexture, theme]);

  // Per-instance attribute buffers
  const { uvFrontData, uvSideData, riseData, tintData } = useMemo(() => {
    const uvF = new Float32Array(count * 4);
    const uvS = new Float32Array(count * 4);
    const rise = new Float32Array(count);
    const tint = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const seed = b.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 137;

      const bandIndex = Math.min(5, Math.max(0, Math.round(b.litPercentage * 5)));
      const bandRowOffset = bandIndex * ATLAS_BAND_ROWS;

      // Front face UV
      const frontColStart = Math.abs(seed % Math.max(1, ATLAS_COLS - b.windowsPerFloor));
      uvF[i * 4 + 0] = frontColStart / ATLAS_COLS;
      uvF[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvF[i * 4 + 2] = b.windowsPerFloor / ATLAS_COLS;
      uvF[i * 4 + 3] = b.floors / ATLAS_COLS;

      // Side face UV
      const sideColStart = Math.abs((seed + 7919) % Math.max(1, ATLAS_COLS - Math.floor(b.windowsPerFloor * 0.7)));
      uvS[i * 4 + 0] = sideColStart / ATLAS_COLS;
      uvS[i * 4 + 1] = bandRowOffset / ATLAS_COLS;
      uvS[i * 4 + 2] = (b.windowsPerFloor * 0.7) / ATLAS_COLS;
      uvS[i * 4 + 3] = b.floors / ATLAS_COLS;

      // Rise starts at 0
      rise[i] = 0;

      // Custom color tint
      _color.set(b.color);
      tint[i * 3 + 0] = _color.r;
      tint[i * 3 + 1] = _color.g;
      tint[i * 3 + 2] = _color.b;
    }

    return { uvFrontData: uvF, uvSideData: uvS, riseData: rise, tintData: tint };
  }, [buildings, count]);

  // Rise animation state
  const risingRef = useRef<{ startTime: number; idx: number }[]>([]);
  const riseInitialized = useRef(false);

  // Initialize instances
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Set instance matrices
    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      _position.set(b.position[0], b.dimensions.height / 2, b.position[2]);
      _scale.set(b.dimensions.width, b.dimensions.height, b.dimensions.depth);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(i, _matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Custom bounding sphere for raycasting
    let maxDist = 0;
    let maxHeight = 0;
    for (let i = 0; i < count; i++) {
      const b = buildings[i];
      const d = Math.sqrt(b.position[0] * b.position[0] + b.position[2] * b.position[2]);
      if (d > maxDist) maxDist = d;
      if (b.dimensions.height > maxHeight) maxHeight = b.dimensions.height;
    }
    const radius = Math.sqrt(maxDist * maxDist + maxHeight * maxHeight) + 100;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, maxHeight / 2, 0), radius);

    // Set attributes
    const uvFrontAttr = new THREE.InstancedBufferAttribute(uvFrontData, 4);
    const uvSideAttr = new THREE.InstancedBufferAttribute(uvSideData, 4);
    const riseAttr = new THREE.InstancedBufferAttribute(riseData, 1);
    riseAttr.setUsage(THREE.DynamicDrawUsage);
    const tintAttr = new THREE.InstancedBufferAttribute(tintData, 3);

    mesh.geometry.setAttribute("aUvFront", uvFrontAttr);
    mesh.geometry.setAttribute("aUvSide", uvSideAttr);
    mesh.geometry.setAttribute("aRise", riseAttr);
    mesh.geometry.setAttribute("aTint", tintAttr);

    if (hasPlayedRiseGlobal) {
      for (let i = 0; i < count; i++) riseData[i] = 1;
      riseAttr.needsUpdate = true;
      riseInitialized.current = true;
      risingRef.current = [];
    } else {
      hasPlayedRiseGlobal = true;
      riseInitialized.current = false;
      risingRef.current = [];
    }

    mesh.count = count;
  }, [buildings, count, uvFrontData, uvSideData, riseData, tintData]);

  // Rise animation
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const now = clock.elapsedTime;
    if (!riseInitialized.current) {
      riseInitialized.current = true;
      const staggerDelay = Math.min(0.003, MAX_RISE_TOTAL / Math.max(1, count));
      const queue: { startTime: number; idx: number }[] = [];
      for (let i = 0; i < count; i++) {
        queue.push({ startTime: now + i * staggerDelay, idx: i });
      }
      risingRef.current = queue;
    }

    const rising = risingRef.current;
    if (rising.length === 0) return;

    const riseAttr = mesh.geometry.getAttribute("aRise") as THREE.InstancedBufferAttribute;
    if (!riseAttr) return;
    const arr = riseAttr.array as Float32Array;

    let anyChanged = false;
    const nextRising: { startTime: number; idx: number }[] = [];

    for (let r = 0; r < rising.length; r++) {
      const state = rising[r];
      const elapsed = now - state.startTime;
      if (elapsed < 0) {
        for (let j = r; j < rising.length; j++) {
          nextRising.push(rising[j]);
        }
        break;
      }
      const progress = Math.min(1, elapsed / RISE_DURATION);
      const t = 1 - Math.pow(1 - progress, 3);
      arr[state.idx] = t;
      anyChanged = true;

      if (progress < 1) {
        nextRising.push(state);
      }
    }

    risingRef.current = nextRising;
    if (anyChanged) {
      riseAttr.needsUpdate = true;
    }
  });

  // Update focus uniform
  useEffect(() => {
    if (!material.uniforms) return;
    const id = focusedBuildingId ? idToIdx.get(focusedBuildingId) : undefined;
    material.uniforms.uFocusedId.value = id !== undefined ? id : -1.0;
  }, [focusedBuildingId, idToIdx, material]);

  // ─── Manual Raycasting (Git City pattern) ─────────────────────
  const { gl, camera } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerNDC = useRef(new THREE.Vector2());

  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;
  const onClickRef = useRef(onBuildingClick);
  onClickRef.current = onBuildingClick;

  useEffect(() => {
    const canvas = gl.domElement;

    const screenToNDC = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pointerNDC.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const raycastInstance = (clientX: number, clientY: number): number | null => {
      const mesh = meshRef.current;
      if (!mesh) return null;
      screenToNDC(clientX, clientY);
      raycasterRef.current.setFromCamera(pointerNDC.current, camera);
      const hits: THREE.Intersection[] = [];
      mesh.raycast(raycasterRef.current, hits);
      if (hits.length > 0) {
        hits.sort((a, b) => a.distance - b.distance);
        if (hits[0].instanceId !== undefined) return hits[0].instanceId;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      const id = raycastInstance(e.clientX, e.clientY);
      // Store for click detection
    };

    const onPointerUp = (e: PointerEvent) => {
      const id = raycastInstance(e.clientX, e.clientY);
      if (id !== null && id < buildingsRef.current.length) {
        onClickRef.current?.(buildingsRef.current[id]);
      }
    };

    // Throttled hover for cursor
    let lastMoveTime = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveTime < 125) return; // 8Hz
      lastMoveTime = now;
      const id = raycastInstance(e.clientX, e.clientY);
      document.body.style.cursor = id !== null ? "pointer" : "auto";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      document.body.style.cursor = "auto";
    };
  }, [gl, camera]);

  // Cleanup
  useEffect(() => {
    return () => {
      geo.dispose();
      material.dispose();
      atlasTexture.dispose();
    };
  }, [geo, material, atlasTexture]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, material, count]}
      frustumCulled={false}
    />
  );
});
