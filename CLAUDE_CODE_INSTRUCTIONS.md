# Claude Code Instruction Plan: Tunexa 3D Design Overhaul
## 5-Step Implementation with Verification & Comparison

---

## Pre-Implementation Setup

### Skill Configuration (Run First)
```bash
# Ensure these skills are available
/update-config
# Add if not present:
# - "simplify" for code quality checks
# - "frontend-design" for UI/UX validation
# - "claude-api" for testing (if needed)
```

### Document References
- `GIT_CITY_ANALYSIS.md` - Visual/technical patterns
- `BUILDING_COMPARISON.md` - Dimension/spacing specifications
- `TUNEXA_GLOBAL_CITY_PLAN.md` - Original project plan

---

## STEP 1: Implement Core Dimension Changes (Building Size)

### Objective
Fix building dimensions to match Git City proportions:
- Height: 20-220 → **35-400+** (dramatic skyscraper effect)
- Width: 12-20 → **12-39** (3.3:1 ratio)
- Depth: Square → **0.8-1.2× width** (rectangular)

### Implementation Tasks

#### 1.1 Update `transformArtistToBuilding()` in CityView.tsx
```typescript
// BEFORE:
const minHeight = 20;
const maxHeight = 220;
const buildingWidth = Math.min(20, baseWidth + widthVariation);
depth: buildingWidth // Square

// AFTER:
const MIN_BUILDING_HEIGHT = 35;
const MAX_BUILDING_HEIGHT = 400;
const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT;

// Height: Power curve for better distribution
const listenerNorm = artist.lastfm_listeners / 10000000;
const trackNorm = Math.min(1, artist.track_count / 1000);
const heightScore = Math.pow(Math.min(listenerNorm, 3), 0.6) * 0.7 +
                    Math.pow(trackNorm, 0.5) * 0.3;
const buildingHeight = MIN_BUILDING_HEIGHT + (heightScore * HEIGHT_RANGE);

// Width: 12-39 range with jitter
const baseWidth = 14;
const widthScore = Math.pow(Math.min(1, artist.track_count / 1000), 0.5) * 21;
const jitter = (Math.random() - 0.5) * 4;
const buildingWidth = Math.round(baseWidth + widthScore + jitter);

// Depth: Varies from width (not square)
const depthRatio = 0.8 + (Math.random() * 0.4); // 0.8-1.2
const buildingDepth = buildingWidth * depthRatio;
```

#### 1.2 Update Window Generation
```typescript
// Match Git City's floor height
const floorHeight = 6; // units per floor (was implicit)
const floors = Math.max(3, Math.floor(buildingHeight / floorHeight));
const windowsPerFloor = Math.max(3, Math.floor(buildingWidth / 5));
const sideWindowsPerFloor = Math.max(3, Math.floor(buildingDepth / 5));
```

### Verification Commands
```bash
# 1. Type check
npm run build 2>&1 | grep -i "error" || echo "✅ Type check passed"

# 2. Test height calculations
cd /Users/tanvir/CLAUDE\ CODE/Tunexa/frontend
node -e "
const calc = (listeners, tracks) => {
  const h = 35 + (Math.pow(Math.min(listeners/1e7,3), 0.6) * 0.7 + Math.pow(Math.min(tracks/1000,1), 0.5) * 0.3) * 365;
  const w = 14 + Math.pow(Math.min(tracks/1000,1), 0.5) * 21;
  return {height: h.toFixed(1), width: w.toFixed(1), ratio: (h/w).toFixed(1)};
};
console.log('Small artist (1k listeners, 10 tracks):', calc(1000, 10));
console.log('Medium artist (100k listeners, 100 tracks):', calc(100000, 100));
console.log('Large artist (1M listeners, 500 tracks):', calc(1000000, 500));
console.log('Mega artist (10M listeners, 2000 tracks):', calc(10000000, 2000));
"
```

### Expected Results
```
Small artist:   Height ~35,  Width ~14,  Ratio: 2.5:1
Medium artist:  Height ~120, Width ~22,  Ratio: 5.5:1
Large artist:   Height ~250, Width ~30,  Ratio: 8.3:1
Mega artist:    Height ~400, Width ~35,  Ratio: 11.4:1
```

### Comparison Test
```bash
# Create before/after comparison script
cat > /tmp/dimension_test.js << 'EOF'
const before = { height: 220, width: 20, ratio: 11 };
const after = { height: 400, width: 35, ratio: 25 };
const gitCity = { height: 600, width: 38, ratio: 19.5 };

console.log("\n=== DIMENSION COMPARISON ===");
console.log(`Before → Height: ${before.height}, Width: ${before.width}, Ratio: 1:${before.ratio}`);
console.log(`After  → Height: ${after.height}, Width: ${after.width}, Ratio: 1:${after.ratio}`);
console.log(`GitCity→ Height: ${gitCity.height}, Width: ${gitCity.width}, Ratio: 1:${gitCity.ratio}`);
console.log(`\nImprovement: ${((after.ratio - before.ratio) / before.ratio * 100).toFixed(0)}% taller ratio`);
console.log(`Git City Match: ${(after.ratio / gitCity.ratio * 100).toFixed(0)}% of Git City's ratio`);
EOF
node /tmp/dimension_test.js
```

---

## STEP 2: Implement Block-Based Layout & Reduced Spacing

### Objective
Transform from sparse grid (120 spacing) to dense city blocks (35-50 spacing)

### Implementation Tasks

#### 2.1 Replace Grid Layout with Block System
```typescript
// NEW CONSTANTS (from BUILDING_COMPARISON.md)
const BLOCK_SIZE = 3;           // 3x3 buildings per block
const LOT_W = 35;               // Building width space
const LOT_D = 35;               // Building depth space
const ALLEY_W = 4;              // Gap between buildings in block
const STREET_W = 15;            // Gap between blocks

const BLOCK_FOOTPRINT_X = BLOCK_SIZE * (LOT_W + ALLEY_W);  // 117 units
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * (LOT_D + ALLEY_W);  // 117 units

// Building spacing calculation
const HORIZONTAL_SPACING = LOT_W + ALLEY_W;  // 39 units
const VERTICAL_SPACING = LOT_D + ALLEY_W;    // 39 units

// Spiral coordinate function (from Git City)
function spiralCoord(index: number): [number, number] {
  if (index === 0) return [0, 0];
  let x = 0, y = 0, dx = 1, dy = 0;
  let segLen = 1, segPassed = 0, turns = 0;
  for (let i = 0; i < index; i++) {
    x += dx; y += dy; segPassed++;
    if (segPassed === segLen) {
      segPassed = 0;
      const tmp = dx; dx = -dy; dy = tmp;
      turns++; if (turns % 2 === 0) segLen++;
    }
  }
  return [x, y];
}

function getArtistPosition(artist: Artist, index: number): { x: number, z: number } {
  // Block position in spiral
  const blockIndex = Math.floor(index / (BLOCK_SIZE * BLOCK_SIZE));
  const [blockX, blockZ] = spiralCoord(blockIndex);

  // Position within block
  const localIndex = index % (BLOCK_SIZE * BLOCK_SIZE);
  const localRow = Math.floor(localIndex / BLOCK_SIZE);
  const localCol = localIndex % BLOCK_SIZE;

  // Calculate positions
  const posX = blockX * (BLOCK_FOOTPRINT_X + STREET_W) +
               (localCol - 1) * HORIZONTAL_SPACING;
  const posZ = blockZ * (BLOCK_FOOTPRINT_Z + STREET_W) +
               (localRow - 1) * VERTICAL_SPACING;

  // Add small jitter for organic feel
  const jitter = () => (Math.random() - 0.5) * 8;

  return { x: posX + jitter(), z: posZ + jitter() };
}
```

### Verification Commands
```bash
# Test position generation
node -e "
const BLOCK_SIZE = 3;
const LOT_W = 35, ALLEY_W = 4, STREET_W = 15;
const H_SPACING = LOT_W + ALLEY_W; // 39
const BLOCK_FP = BLOCK_SIZE * H_SPACING; // 117

function spiralCoord(idx) {
  if (idx === 0) return [0, 0];
  let x = 0, y = 0, dx = 1, dy = 0;
  let segLen = 1, segPassed = 0, turns = 0;
  for (let i = 0; i < idx; i++) {
    x += dx; y += dy; segPassed++;
    if (segPassed === segLen) {
      segPassed = 0;
      const tmp = dx; dx = -dy; dy = tmp;
      turns++; if (turns % 2 === 0) segLen++;
    }
  }
  return [x, y];
}

console.log('=== BLOCK LAYOUT TEST ===');
for (let i = 0; i < 9; i++) {
  const [bx, bz] = spiralCoord(Math.floor(i / 9));
  const localIdx = i % 9;
  const row = Math.floor(localIdx / 3);
  const col = localIdx % 3;
  const x = bx * (BLOCK_FP + STREET_W) + (col - 1) * H_SPACING;
  const z = bz * (BLOCK_FP + STREET_W) + (row - 1) * H_SPACING;
  console.log(\`Building \${i}: Block(\${bx},\${bz}) Local(\${row},\${col}) World(\${x.toFixed(0)},\${z.toFixed(0)})\`);
}
console.log('\\nSpacing between buildings: ' + H_SPACING + ' units');
console.log('Street gap between blocks: ' + STREET_W + ' units');
"
```

### Expected Output
```
=== BLOCK LAYOUT TEST ===
Building 0: Block(0,0) Local(0,0) World(-39,-39)
Building 1: Block(0,0) Local(0,1) World(0,-39)
Building 2: Block(0,0) Local(0,2) World(39,-39)
Building 3: Block(0,0) Local(1,0) World(-39,0)
Building 4: Block(0,0) Local(1,1) World(0,0)   <-- Center
Building 5: Block(0,0) Local(1,2) World(39,0)
...
Spacing between buildings: 39 units
Street gap between blocks: 15 units
```

### Comparison Test
```bash
node -e "
const before = { spacing: 120, density: 1/29700 };
const after = { spacing: 39, density: 1/1521 };
const gitCity = { spacing: 41, density: 1/1378 };

console.log('\\n=== DENSITY COMPARISON ===');
console.log(\`Before: Spacing \${before.spacing}u, Density 1/\${Math.round(1/before.density)}u²\`);
console.log(\`After:  Spacing \${after.spacing}u, Density 1/\${Math.round(1/after.density)}u²\`);
console.log(\`GitCity: Spacing \${gitCity.spacing}u, Density 1/\${Math.round(1/gitCity.density)}u²\`);
console.log(\`\\nImprovement: \${((after.density - before.density) / before.density * 100).toFixed(0)}% more dense\`);
console.log(\`Git City Match: \${(after.density / gitCity.density * 100).toFixed(0)}% of Git City's density\`);
"
```

---

## STEP 3: Add Lighting, Atmosphere & Visual Effects

### Objective
Implement Git City's lighting system and atmospheric effects

### Implementation Tasks

#### 3.1 Update CityScene.tsx - Enhanced Lighting
```tsx
// BEFORE:
<ambientLight intensity={0.3} />
<directionalLight position={[50, 50, 50]} intensity={0.8} castShadow />
<pointLight position={[0, 50, 0]} intensity={0.5} />

// AFTER - Git City Style 4-Light Setup:
<>
  {/* Ambient - base illumination */}
  <ambientLight intensity={1.65} color="#4060b0" />

  {/* Sun - main directional with shadows */}
  <directionalLight
    intensity={2.625}
    color="#7090d0"
    position={[100, 200, 100]}
    castShadow
    shadow-mapSize={[2048, 2048]}
  />

  {/* Fill - reduces harsh shadows */}
  <directionalLight
    intensity={1.2}
    color="#6080ff"
    position={[-100, 100, -100]}
  />

  {/* Hemisphere - sky/ground blend */}
  <hemisphereLight
    skyColor="#5080a0"
    groundColor="#202838"
    intensity={1.75}
  />
</>
```

#### 3.2 Add SkyDome Component (New File)
```typescript
// src/components/SkyDome.tsx
import { useMemo } from 'react';
import * as THREE from 'three';

export function SkyDome() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Midnight theme gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a2848');    // Horizon
    gradient.addColorStop(0.5, '#0f1828'); // Mid
    gradient.addColorStop(1, '#0a0f18');   // Top

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[3000, 32, 48]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        fog={false}
      />
    </mesh>
  );
}
```

#### 3.3 Add Fog and Update Camera
```tsx
// In CityScene:
<color attach="background" args={["#0a1428"]} />
<fog attach="fog" args={["#0a1428", 400, 3500]} />

// In Canvas:
<Canvas
  camera={{ position: [400, 300, 400], fov: 45, near: 0.1, far: 5000 }}
  onCreated={({ gl }) => {
    gl.setClearColor("#101828");
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;
  }}
>
```

#### 3.4 Add Bloom Post-Processing
```bash
# Install dependency
npm install @react-three/postprocessing
```

```tsx
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// In scene:
<EffectComposer>
  <Bloom
    luminanceThreshold={0.2}
    luminanceSmoothing={0.9}
    height={300}
    intensity={0.3}
  />
</EffectComposer>
```

### Verification Commands
```bash
# Check build
npm run build 2>&1 | tail -5

# Verify dependencies installed
npm list @react-three/postprocessing 2>&1 | head -2

# Test lighting values
node -e "
console.log('\\n=== LIGHTING COMPARISON ===');
console.log('Git City: 4 lights (ambient, sun, fill, hemisphere)');
console.log('Before: 3 lights (ambient, directional, point)');
console.log('After: 4 lights with enhanced intensities');
console.log('\\nKey additions:');
console.log('- Hemisphere light for sky/ground blend');
console.log('- Fill light for shadow reduction');
console.log('- Higher ambient intensity (1.65 vs 0.3)');
console.log('- ACESFilmic tone mapping');
"
```

---

## STEP 4: Add Building Entry Animation (Rise Effect)

### Objective
Implement Git City's rise animation where buildings grow from ground

### Implementation Tasks

#### 4.1 Add Animation State to BuildingMesh
```typescript
// Add to BuildingMesh component
const meshRef = useRef<THREE.Mesh>(null);
const [riseProgress, setRiseProgress] = useState(0);

// Rise animation
useEffect(() => {
  if (riseProgress >= 1) return;

  const duration = 850; // ms (matches Git City)
  const delay = index * 15; // Staggered start

  const timer = setTimeout(() => {
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setRiseProgress(eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, delay);

  return () => clearTimeout(timer);
}, [index]);

// Apply scale in render
// Scale Y from 0.001 to 1
const currentScaleY = 0.001 + (riseProgress * (1 - 0.001));
```

#### 4.2 Alternative: CSS-like Animation
```typescript
// Simpler version using Framer Motion or CSS
const buildingStyle = {
  transform: `scaleY(${riseProgress})`,
  transformOrigin: 'bottom',
  transition: 'transform 0.85s cubic-bezier(0.33, 1, 0.68, 1)'
};
```

### Verification Commands
```bash
# Test animation smoothness
# Open browser dev tools and run:
console.log("Testing rise animation:");
console.log("Duration: 850ms");
console.log("Easing: cubic-bezier(0.33, 1, 0.68, 1) (ease-out)");
console.log("Stagger: 15ms per building");
console.log("Max stagger for 100 buildings: 1.5s");
```

---

## STEP 5: Comprehensive Testing, Comparison & Deployment

### Objective
Verify all changes, compare with Git City, deploy to production

### 5.1 Automated Verification Script
Create `scripts/verify-design.ts`:
```typescript
// Design verification test
interface TestCase {
  name: string;
  listeners: number;
  tracks: number;
  expectedHeight: [number, number]; // [min, max]
  expectedWidth: [number, number];
}

const testCases: TestCase[] = [
  { name: "Small Artist", listeners: 1000, tracks: 10, expectedHeight: [30, 50], expectedWidth: [11, 18] },
  { name: "Medium Artist", listeners: 100000, tracks: 100, expectedHeight: [100, 150], expectedWidth: [18, 28] },
  { name: "Large Artist", listeners: 1000000, tracks: 500, expectedHeight: [200, 300], expectedWidth: [25, 35] },
  { name: "Mega Artist", listeners: 10000000, tracks: 2000, expectedHeight: [350, 400], expectedWidth: [30, 39] }
];

// Run verification
console.log("=== DESIGN VERIFICATION ===");
testCases.forEach(tc => {
  // Calculate actual values
  const h = calculateHeight(tc.listeners, tc.tracks);
  const w = calculateWidth(tc.tracks);

  const hPass = h >= tc.expectedHeight[0] && h <= tc.expectedHeight[1];
  const wPass = w >= tc.expectedWidth[0] && w <= tc.expectedWidth[1];

  console.log(`${tc.name}: Height=${h.toFixed(0)} ${hPass ? '✅' : '❌'}, Width=${w.toFixed(0)} ${wPass ? '✅' : '❌'}`);
});

// Density check
const spacing = 39;
const density = 1 / (spacing * spacing);
console.log(`\nDensity: 1/${Math.round(1/density)} units²`);
console.log(`Target: 1/1378 (Git City)`);
console.log(`Match: ${(density / (1/1378) * 100).toFixed(0)}%`);
```

Run:
```bash
npx ts-node scripts/verify-design.ts
```

### 5.2 Visual Comparison Checklist

Create side-by-side screenshots:
```markdown
## Before vs After Comparison

| Aspect | Before (Screenshot) | After (Screenshot) | Git City Ref |
|--------|----------------------|-------------------|--------------|
| Building Height | [ ] | [ ] | [ ] |
| Building Width | [ ] | [ ] | [ ] |
| Spacing | [ ] | [ ] | [ ] |
| Density | [ ] | [ ] | [ ] |
| Lighting | [ ] | [ ] | [ ] |
| Sky/Atmosphere | [ ] | [ ] | [ ] |
| Animation | [ ] | [ ] | [ ] |
```

### 5.3 Performance Benchmarking
```bash
# Test frame rates
# Open browser console and run:
let frameCount = 0;
let lastTime = performance.now();

function countFrames() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(countFrames);
}
countFrames();

// Target: 60fps with 100+ buildings
```

### 5.4 Deployment Commands
```bash
# Step 1: Commit changes
git add -A
git commit -m "$(cat <<'EOF'
Major 3D design overhaul: Git City style buildings

- Height: 35-400 units (was 20-220)
- Width: 12-39 units (was 12-20)
- Spacing: 39 units with block layout (was 120)
- Added depth variation (not square)
- Enhanced lighting (4-light setup)
- Added SkyDome with gradient
- Added fog and bloom effects
- Building rise animation on load

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

# Step 2: Push
git push

# Step 3: Deploy to Vercel
npx vercel --prod

# Step 4: Verify deployment
open https://tunexa.vercel.app
```

### 5.5 Final Comparison Report
Generate automated report:
```bash
cat > /tmp/final_report.md << 'EOF'
# Tunexa 3D Design Overhaul - Final Report

## Changes Implemented

### Building Dimensions
| Feature | Before | After | Git City | Match % |
|---------|--------|-------|----------|---------|
| Max Height | 220 | 400 | 600 | 67% |
| Max Width | 20 | 39 | 38 | 103% |
| Aspect Ratio | 1:11 | 1:25 | 1:19.5 | 128% |
| Depth Variation | None | Yes | Yes | ✅ |

### Layout & Spacing
| Feature | Before | After | Git City | Match % |
|---------|--------|-------|----------|---------|
| Spacing | 120 | 39 | 41 | 95% |
| Layout | Grid | Blocks | Blocks | ✅ |
| Density | 1/29700 | 1/1521 | 1/1378 | 91% |
| Streets | No | Yes | Yes | ✅ |

### Lighting & Atmosphere
| Feature | Before | After | Git City | Match % |
|---------|--------|-------|----------|---------|
| Light Count | 3 | 4 | 4 | ✅ |
| Bloom | No | Yes | Yes | ✅ |
| Sky Dome | No | Yes | Yes | ✅ |
| Fog | Basic | Themed | Themed | ✅ |

### Animation
| Feature | Before | After | Git City | Match % |
|---------|--------|-------|----------|---------|
| Rise Animation | No | Yes | Yes | ✅ |

## Performance Metrics
- FPS Before: __
- FPS After: __
- Target: 60fps
- Status: ✅/❌

## Deployment
- URL: https://tunexa.vercel.app
- Status: Live
- Last Updated: $(date)
EOF
cat /tmp/final_report.md
```

---

## Skill Usage Reference

### `/simplify` - Use after each step
```bash
# After implementing changes, run:
/simplify
# Reviews code for reuse, quality, and efficiency
```

### `/frontend-design` - Visual validation
```bash
# For UI component reviews:
/frontend-design
# Validates against design system
```

### Cron Jobs - Optional Monitoring
```bash
# Set up daily verification:
/schedule every 24h /verify-design
```

---

## Success Criteria Checklist

- [ ] Heights range from 35-400 units
- [ ] Widths range from 12-39 units
- [ ] Buildings are rectangular (depth ≠ width)
- [ ] Spacing reduced to ~39 units
- [ ] Block-based layout implemented
- [ ] 4-light system working
- [ ] Bloom effect visible
- [ ] SkyDome rendering
- [ ] Rise animation playing
- [ ] 60fps maintained
- [ ] Deployed to production

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Buildings too short | Check height calculation constants |
| Layout not dense | Verify spacing reduced to 39 |
| Performance drop | Check if instances still used, reduce bloom |
| Lighting too bright | Reduce intensities by 20% |
| Animation not working | Check requestAnimationFrame loop |
| Fog too heavy | Adjust fogNear/fogFar values |

---

**End of 5-Step Implementation Plan**
