# Git City vs Tunexa: Detailed 3D Design Analysis

## Executive Summary

This document analyzes the 3D design, rendering, and UX patterns from **Git City** (https://github.com/srizzon/git-city) to provide specific recommendations for improving Tunexa's visual quality and user experience.

---

## Part 1: Building Design & Materials

### 1.1 Building Geometry

**Git City Approach:**
- Uses **single shared BoxGeometry** for ALL buildings (1,1,1 unit cube)
- Scales via `instanceMatrix` rather than creating unique geometries
- **Reuses geometry** across thousands of buildings → massive performance gain
- Buildings are positioned and scaled using `_matrix.compose(_position, _quaternion, _scale)`

**Tunexa Current:**
- Creates individual mesh for each building in `BuildingMesh`
- Each building has its own geometry: `<boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />`
- Creates windows as individual child meshes inside each building group
- ~10+ meshes per building (main + windows)

**Recommendation:**
```typescript
// Create ONE shared geometry
const sharedGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

// Scale via matrix for each instance
_matrix.compose(position, quaternion, scale);
mesh.setMatrixAt(i, _matrix);
```

### 1.2 Window Rendering Technique

**Git City Approach - Canvas Texture Atlas:**

```typescript
// Creates ONE 2048x2048 canvas texture atlas
// Contains 6 luminosity bands (42 rows each = 252 rows)
// Each band represents different window brightness levels

const ATLAS_SIZE = 2048;
const ATLAS_CELL = 8;  // 8px per window
const ATLAS_BAND_ROWS = 42;

// Atlas layout:
// - 6 bands of lit percentages
// - Each band has 42 rows of windows
// - Different brightness levels for each band
```

**Key Innovation:**
- **Single texture atlas** used for ALL building windows
- Custom shader reads from the atlas based on building properties
- No individual window meshes → renders thousands of windows in one draw call
- Windows appear "lit" based on star count and recent activity

**Tunexa Current:**
```typescript
// Creates individual window meshes for each building
const windows = [];
for (let floor = 0; floor < floors; floor++) {
  for (let w = 0; w < windowsPerFloor; w++) {
    windows.push(
      <mesh key={`${building.id}-window-${floor}-${w}`}>
        <boxGeometry args={[0.8, 1.5, 0.1]} />
        <meshStandardMaterial color={windowColor} emissive={windowColor} />
      </mesh>
    );
  }
}
// Renders 4-8 window meshes PER building
// 100 buildings = 400-800 window meshes
```

**Recommendation:**
Switch to texture atlas approach or at minimum use instanced windows:
```typescript
// Option 1: Texture atlas (Git City style)
// Create canvas-based window texture with all windows baked in

// Option 2: InstancedMesh for windows
<instancedMesh args={[windowGeo, windowMat, totalWindows]} />
```

### 1.3 Custom Shaders for Performance

**Git City's ShaderMaterial:**

```glsl
// Vertex shader features:
- aRise attribute for grow animation
- aTint attribute for custom colors
- aUvFront/aUvSide for window texture coordinates
- Instance-based transforms

// Fragment shader features:
- Texture sampling from atlas for windows
- Fog calculation with smoothstep
- Focus/dim logic for highlighting
- Screen-door dither for unfocused buildings
- Emissive glow scaled by "city energy"
- Live presence boost for active users
```

**Tunexa Current:**
- Uses standard `meshStandardMaterial`
- No custom shaders
- Limited control over lighting/fog per-building

**Recommendation:**
Implement custom shader material for:
- Better fog integration
- Glow effects without bloom overhead
- Focus highlighting (dim non-focused buildings)
- Consistent lighting across all buildings

### 1.4 Building Animation - Rise Effect

**Git City:**
```typescript
// Staggered rise animation on first load
const RISE_DURATION = 0.85; // seconds per building
const MAX_RISE_TOTAL = 4;   // seconds max stagger

// Each building starts at scale Y = 0.001
// Animates to full height with cubic ease-out
// Staggered by index: startTime = now + i * delay

// Shader handles the actual scaling:
localPos.y = localPos.y * aRise + (aRise - 1.0) * 0.5;
```

**Tunexa:**
- No entry animation currently
- Buildings appear instantly

**Recommendation:**
Add rise animation for visual polish:
```typescript
// Animate building scale Y from 0 to 1 on first view
// Stagger by position in grid for wave effect
```

### 1.5 Building Materials Summary

| Aspect | Git City | Tunexa | Recommendation |
|--------|----------|--------|----------------|
| Geometry | Shared BoxGeometry(1,1,1) | Unique per building | Switch to shared geometry |
| Windows | Texture atlas (1 draw call) | Individual meshes (~400-800 draws) | Implement texture atlas or instancing |
| Materials | Custom ShaderMaterial | MeshStandardMaterial | Custom shader for performance |
| Animation | Vertex shader rise | None | Add rise animation |
| Custom Colors | Tint attribute in shader | Fixed per genre | Allow artist custom colors |

---

## Part 2: Lighting & Atmosphere

### 2.1 Lighting Setup

**Git City:**
```typescript
// THREE types of lights working together:

// 1. Ambient - base illumination
<ambientLight intensity={0.55 * 3} color={theme.ambientColor} />

// 2. Directional "sun" - main shadows
<directionalLight
  intensity={theme.sunIntensity * 3.5}
  color={theme.sunColor}
  position={theme.sunPos}
  castShadow
  shadow-mapSize={[2048, 2048]}
/>

// 3. Fill light - reduces harsh shadows
<directionalLight
  position={theme.fillPos}
  intensity={theme.fillIntensity * 3}
  color={theme.fillColor}
/>

// 4. Hemisphere - sky/ground color blend
<hemisphereLight
  skyColor={theme.hemiSky}
  groundColor={theme.hemiGround}
  intensity={theme.hemiIntensity * 3.5}
/>
```

**Tunexa:**
```typescript
// Only THREE lights:
<ambientLight intensity={0.3} />
<directionalLight position={[50, 50, 50]} intensity={0.8} castShadow />
<pointLight position={[0, 50, 0]} intensity={0.5} />
```

**Recommendation:**
Add fill light and hemisphere light for richer lighting:
```typescript
// Add fill light (opposite side from sun)
<directionalLight position={[-50, 30, -50]} intensity={0.4} color="#6080ff" />

// Add hemisphere for natural sky/ground blend
<hemisphereLight skyColor="#4060a0" groundColor="#202838" intensity={0.5} />
```

### 2.2 Theme System

**Git City - 4 Complete Themes:**

Each theme defines:
```typescript
interface CityTheme {
  // Sky
  sky: [number, string][];  // gradient stops

  // Fog
  fogColor: string;
  fogNear: number;
  fogFar: number;

  // Lighting
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

  // Ground
  groundColor: string;
  grid1: string;
  grid2: string;
  roadColor: string;
  sidewalkColor: string;

  // Buildings
  windowLit: string[];
  wall: string;
  roof: string;
  water: string;
  dock: string;
}
```

**Available Themes:**
1. **Midnight** (default): Deep blues, fog #0a1428
2. **Sunset**: Warm oranges/purples, fog #80405a
3. **Neon**: Violet/cyans, cyberpunk feel, fog #1a0830
4. **Emerald**: Greens, nature feel, fog #0a2014

**Tunexa:**
- Single hardcoded background: `#0a0a1a`
- No theme switching
- Single fog color

**Recommendation:**
Implement theme system with at least 2-3 themes:
```typescript
const THEMES = [
  {
    name: "Midnight",
    fogColor: "#0a1428",
    ambientColor: "#4060b0",
    sunColor: "#7090d0",
    // ... etc
  },
  {
    name: "Sunset",
    fogColor: "#80405a",
    ambientColor: "#e0a080",
    // ... etc
  }
];
```

### 2.3 Sky Rendering

**Git City - SkyDome:**
```typescript
function SkyDome({ stops }: { stops: [number, string][] }) {
  const mat = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 512;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    for (const [stop, color] of stops) g.addColorStop(stop, color);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  }, [stops]);

  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[3500, 32, 48]} />
    </mesh>
  );
}
```

**Features:**
- Large inverted sphere (radius 3500)
- Canvas-generated gradient texture
- Multiple gradient stops for smooth sky colors
- `renderOrder={-1}` ensures it renders first
- `fog: false` keeps sky clear

**Tunexa:**
- Uses flat background color: `<Canvas style={{ background: '#0a0a1a' }} />`
- No sky gradient

**Recommendation:**
Add SkyDome component with gradient:
```typescript
function SkyDome() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a2848');    // horizon
    gradient.addColorStop(0.5, '#0f1828');  // mid
    gradient.addColorStop(1, '#0a0f18');    // top
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[3000, 32, 48]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} />
    </mesh>
  );
}
```

### 2.4 Post-Processing (Bloom)

**Git City:**
```typescript
<EffectComposer>
  <Bloom
    luminanceThreshold={0.2}
    luminanceSmoothing={0.9}
    height={300}
    intensity={0.3}
  />
</EffectComposer>
```

**Features:**
- Subtle bloom for window glow
- Threshold at 0.2 (only bright pixels bloom)
- Low intensity (0.3) for tasteful effect
- Height 300 for performance/quality balance

**Tunexa:**
- No post-processing currently
- Emissive materials but no bloom effect

**Recommendation:**
Add @react-three/postprocessing:
```bash
npm install @react-three/postprocessing
```

```typescript
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// In scene:
<EffectComposer>
  <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.4} />
</EffectComposer>
```

### 2.5 Fog Configuration

**Git City:**
```typescript
<color attach="background" args={[theme.fogColor]} />
<fog attach="fog" args={[theme.fogColor, theme.fogNear, theme.fogFar]} />

// Example values:
fogNear: 400
fogFar: 3500
```

**Tunexa:**
```typescript
<fog attach="fog" args={['#0a0a1a', 500, 2500]} />
```

**Differences:**
- Git City uses theme-specific fog colors (matches sky)
- Tunexa uses hardcoded dark fog
- Git City's fogFar is 3500 vs Tunexa's 2500

**Recommendation:**
Match fog color to background:
```typescript
// For Midnight theme:
<fog attach="fog" args={['#0a1428', 400, 3500]} />
```

---

## Part 3: Performance & Optimization

### 3.1 Instanced Rendering

**Git City - Single InstancedMesh for ALL buildings:**
```typescript
<instancedMesh
  ref={meshRef}
  args={[geo, material, count]}
  frustumCulled={false}
/>
```

**Benefits:**
- **One draw call** for thousands of buildings
- Custom attributes for per-instance data (UVs, rise, tint, live)
- Manual frustum culling disabled (GPU faster than CPU check)
- Custom shader handles all visual variation

**Tunexa:**
- Individual `<BuildingMesh />` component per building
- React renders 100+ components
- Each has multiple child meshes (windows)
- Many draw calls

**Recommendation:**
Implement instanced rendering:
```typescript
// Key components needed:
1. InstancedBuildings - main buildings
2. InstancedLabels - floating text labels
3. EffectsLayer - special effects near camera

// Trade-off: Lose individual React component per building
// Gain: Massive performance improvement (60fps with 1000s of buildings)
```

### 3.2 Spatial Grid for LOD

**Git City:**
```typescript
const GRID_CELL_SIZE = 200;

function buildSpatialGrid(buildings: CityBuilding[], cellSize: number): GridIndex {
  const cells = new Map<string, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const cx = Math.floor(b.position[0] / cellSize);
    const cz = Math.floor(b.position[2] / cellSize);
    const key = `${cx},${cz}`;
    let arr = cells.get(key);
    if (!arr) { arr = []; cells.set(key, arr); }
    arr.push(i);
  }
  return { cells, cellSize };
}
```

**Usage:**
- EffectsLayer only renders effects for grid cells near camera
- Dramatically reduces effect rendering overhead
- O(1) lookup for spatial queries

**Tunexa:**
- No spatial partitioning
- All effects/elements render regardless of distance

**Recommendation:**
Add spatial grid if adding effects:
```typescript
// Only render expensive effects for nearby buildings
const nearbyBuildings = getBuildingsInRadius(camera.position, 500);
```

### 3.3 Object Pooling & Reuse

**Git City:**
```typescript
// Reused temp objects to avoid GC
const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _position = new THREE.Vector3(); // for screen projection

// In animation loop, reuse instead of new
_matrix.compose(_position, _quaternion, _scale);
```

**Tunexa:**
- Creates new objects in render loops
- No explicit pooling

**Recommendation:**
Move temp objects outside component:
```typescript
// Outside component
const _tempMatrix = new THREE.Matrix4();
const _tempPos = new THREE.Vector3();

// Inside useFrame
_tempPos.set(x, y, z);
```

### 3.4 Texture Management

**Git City:**
```typescript
// Dispose textures on cleanup
useEffect(() => () => atlasTexture.dispose(), [atlasTexture]);

// Material disposal
useEffect(() => () => { geo.dispose(); material.dispose(); }, [geo, material]);
```

**Tunexa:**
- No explicit texture cleanup
- Potential memory leaks on hot reloads

**Recommendation:**
Add cleanup effects:
```typescript
useEffect(() => {
  return () => {
    texture.dispose();
    material.dispose();
    geometry.dispose();
  };
}, []);
```

---

## Part 4: UI/UX & Styling

### 4.1 Visual Style - Pixel Art Aesthetic

**Git City:**
```css
/* Typography */
font-family: "Silkscreen", monospace;

/* Colors */
--color-bg: #0d0d0f;
--color-cream: #e8dcc8;
--color-lime: #c8e64a;
--color-border: #2a2a30;

/* Effects */
.pixel-shadow { box-shadow: 4px 4px 0 0 rgba(0,0,0,0.5); }
.pixel-shadow-lime { box-shadow: 4px 4px 0 0 #5a7a00; }

/* Button press effect */
.btn-press:hover { transform: translate(2px, 2px); }
.btn-press:hover.pixel-shadow-lime { box-shadow: 2px 2px 0 0 #5a7a00; }
.btn-press:active { transform: translate(4px, 4px); box-shadow: none; }
```

**Key Elements:**
- Hard pixel shadows (not blurred)
- Offset shadow moves on press
- Monospace pixel font
- Limited color palette with accent lime
- Consistent 4px spacing/grid

**Tunexa:**
- Standard sans-serif fonts
- Standard box shadows
- No cohesive aesthetic theme

**Recommendation:**
Add pixel-art touches:
```css
/* Pixel-style buttons */
.pixel-btn {
  background: #1DB954;
  border: 2px solid #0f0;
  box-shadow: 4px 4px 0 0 #050;
  font-family: monospace;
  transition: transform 0.05s, box-shadow 0.05s;
}

.pixel-btn:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 0 #050;
}

.pixel-btn:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

### 4.2 Animations

**Git City Animations:**

```css
/* Kudos float animation */
@keyframes kudos-float {
  0% { opacity: 1; transform: translateY(0) scale(1); }
  60% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-60px) scale(1.3); }
}

/* Live dot pulse */
@keyframes live-pulse {
  0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74,222,128,.6); }
  50% { opacity: .7; box-shadow: 0 0 0 3px rgba(74,222,128,0); }
}

/* Gift glow */
@keyframes gift-glow {
  0%,100% { box-shadow: 0 0 8px 2px var(--gift-glow-color); }
  50% { box-shadow: 0 0 20px 6px var(--gift-glow-color); }
}

/* District fly-by */
@keyframes district-in {
  0% { opacity: 0; transform: translateX(-20px); }
  10% { opacity: 1; transform: translateX(0); }
  80% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(0); }
}

/* Equalizer bars */
@keyframes eq-bar-1 { 0%,100% { height: 3px } 50% { height: 10px } }
@keyframes eq-bar-2 { 0%,100% { height: 8px } 50% { height: 3px } }
```

**Tunexa:**
- Basic CSS transitions
- No unique animations

**Recommendation:**
Add personality animations:
```css
/* Building pulse for popular artists */
@keyframes building-pulse {
  0%,100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}

/* Genre district reveal */
@keyframes district-reveal {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 4.3 Interactive Feedback

**Git City:**

```typescript
// Focus system dims other buildings
// Shader handles dim in fragment:
float dimFactor = mix(1.0, mix(uDimOpacity, 1.0, isFocused), hasFocus);
color *= dimFactor;

// Screen-door dither for unfocused
float isUnfocused = hasFocus * (1.0 - isFocused);
if (isUnfocused > 0.5) {
  // Bayer dither pattern
  if (bayer > uDimOpacity) discard;
}

// Cursor changes on hover
const onMove = (e:PointerEvent) => {
  const id = raycast(e.clientX, e.clientY);
  document.body.style.cursor = id !== null ? "pointer" : "auto";
};
```

**Features:**
- Buildings dim when focusing on one
- Screen-door transparency pattern
- Cursor changes to pointer on hover
- Click/tap detection with raycaster

**Tunexa:**
- Basic onClick handler
- No focus/dim system
- No cursor feedback

**Recommendation:**
Add focus feedback:
```typescript
// When user clicks a building:
// 1. Dim all other buildings to 60% opacity
// 2. Remove dim when clicking elsewhere
// 3. Change cursor to pointer on building hover
```

---

## Part 5: Specific Recommendations for Tunexa

### Priority 1: Critical (High Impact, Lower Effort)

1. **Add Bloom Post-Processing**
   - Install `@react-three/postprocessing`
   - Add subtle bloom for building glow
   - Immediate visual upgrade

2. **Improve Lighting**
   - Add hemisphere light for natural fill
   - Add secondary directional light (fill)
   - Increase ambient light intensity

3. **Add Sky Gradient**
   - Create SkyDome component with canvas gradient
   - Better than flat background color

4. **Implement Pixel-Style UI**
   - Hard shadows on buttons
   - Monospace fonts for headers
   - Consistent accent color

### Priority 2: Important (Medium Effort, High Impact)

5. **Theme System**
   - Create 2-3 themes (Midnight, Sunset, Neon)
   - Theme selector UI
   - Persist theme choice

6. **Building Entry Animation**
   - Rise from ground on first view
   - Staggered timing for wave effect
   - Can use scale Y animation

7. **Focus/Dim System**
   - Dim unselected buildings
   - Highlight selected building
   - Click outside to reset

### Priority 3: Advanced (Higher Effort, Performance Focus)

8. **Texture Atlas for Windows**
   - Create canvas-based window texture
   - Single texture per building face
   - Remove individual window meshes

9. **Instanced Rendering**
   - Single instanced mesh for all buildings
   - Custom shader material
   - Major performance gain

10. **Custom Shader Material**
    - Implement fog in shader
    - Per-building tint/color
    - Glow effects without bloom

### Priority 4: Nice-to-Have

11. **Spatial Grid System**
    - For future effects optimization

12. **More Animations**
    - District labels fly-in
    - Building pulse for top artists
    - Genre color transitions

---

## Quick Implementation Guide

### Immediate Wins (Can do today):

```typescript
// 1. Add bloom
import { EffectComposer, Bloom } from '@react-three/postprocessing';

<EffectComposer>
  <Bloom luminanceThreshold={0.3} intensity={0.4} />
</EffectComposer>

// 2. Add lights
<hemisphereLight skyColor="#4060a0" groundColor="#202838" intensity={0.5} />
<directionalLight position={[-50, 30, -50]} intensity={0.4} color="#6080ff" />

// 3. Improve fog
<fog attach="fog" args={['#0a1428', 400, 3500]} />

// 4. Better camera position
<Canvas camera={{ position: [400, 250, 400], fov: 45 }}>
```

### Next Steps:

1. Create design.md with chosen themes
2. Implement SkyDome component
3. Add rise animation to buildings
4. Create pixel-style button components
5. Plan custom shader implementation

---

## Summary

Git City's visual success comes from:
1. **Cohesive aesthetic** - Pixel art + dark theme + lime accents
2. **Performance** - Instanced rendering, texture atlases, custom shaders
3. **Atmosphere** - Multi-layered lighting, fog, sky, bloom
4. **Feedback** - Focus states, animations, cursor changes
5. **Polish** - Rise animations, dither patterns, consistent UI

Tunexa can achieve similar quality by:
- Adding bloom and improving lighting (immediate impact)
- Creating theme system for variety
- Implementing building animations
- Adopting pixel-art UI elements
- Eventually moving to instanced rendering for scale

The key is prioritizing atmosphere (lighting, fog, bloom) before performance optimization, as it provides the most visual impact per effort.
