# Building Design, Placement & Size Comparison
## Git City vs Tunexa - Detailed Analysis

---

## Part 1: Building Dimensions Comparison

### 1.1 Height Calculation

**Git City:**
```typescript
// Multi-factor weighted composite score
const composite =
  cScore  * 0.35 +  // contributions (35%)
  sScore  * 0.20 +  // stars (20%)
  prScore * 0.15 +  // PRs + reviews (15%)
  extScore * 0.10 + // external repos (10%)
  cnsScore * 0.10 + // consistency (10%)
  fScore  * 0.10;   // followers (10%)

const height = MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE;
// MIN_BUILDING_HEIGHT = 35, MAX = 600, RANGE = 565
// Height range: 35m to 600m (skyscraper scale)
```

**Key Characteristics:**
- Uses **power curves** for each factor (Math.pow(x, 0.55))
- **Weighted composite** of multiple metrics
- **600m max** height (17:1 ratio for tallest buildings)
- Accounts for **consistency over time**
- **Log normalization** for followers (prevents outliers)

**Tunexa:**
```typescript
// Single-factor: listeners only
const sqrtListeners = Math.sqrt(artist.lastfm_listeners);
const sqrtMax = Math.sqrt(10000000); // ~3162
const heightScale = Math.min(1, sqrtListeners / sqrtMax);

const buildingHeight = minHeight + (heightScale * (maxHeight - minHeight));
// minHeight = 20, maxHeight = 220
// Height range: 20 to 220 units (11:1 ratio)
```

**Key Characteristics:**
- Uses **square root** for distribution
- **Single metric** (listeners only)
- **220 max** height (11:1 ratio)
- **Simpler formula** but less nuanced
- **Smaller absolute scale** than Git City

**Comparison:**
| Aspect | Git City | Tunexa | Recommendation |
|--------|----------|--------|----------------|
| **Max Height** | 600m | 220 units | Tunexa too short |
| **Height Ratio** | 17:1 | 11:1 | More dramatic variation needed |
| **Formula** | Multi-factor weighted | Single factor | Add track_count to height? |
| **Normalization** | Power curves + log | Square root | Git City better for outliers |
| **Min Height** | 35m | 20 units | Tunexa OK |

**Recommendation for Tunexa:**
```typescript
// Blend listeners AND track_count for height
const listenerScore = Math.pow(listeners / maxListeners, 0.6);
const trackScore = Math.pow(tracks / maxTracks, 0.4);
const composite = listenerScore * 0.7 + trackScore * 0.3;

const height = 35 + composite * 400; // 35 to 435 range
```

---

### 1.2 Width Calculation

**Git City:**
```typescript
// Width V2 Formula
const repoNorm = Math.min(1, dev.public_repos / 200);
const langNorm = Math.min(1, (dev.language_diversity ?? 1) / 10);
const topStarNorm = Math.min(1, (dev.top_repos?.[0]?.stars ?? 0) / 50_000);

const score =
  Math.pow(repoNorm, 0.5) * 0.50 +
  Math.pow(langNorm, 0.6) * 0.30 +
  Math.pow(topStarNorm, 0.4) * 0.20;

const jitter = (seededRandom(hashStr(dev.github_login)) - 0.5) * 4;

return Math.round(14 + score * 24 + jitter);
// Range: ~12m to ~38m (3.2:1 ratio)
// Base 14m + up to 24m from score ±4m jitter
```

**Key Characteristics:**
- **14m base** width (guaranteed minimum)
- **Multi-factor**: repos (50%), languages (30%), top repo stars (20%)
- **Power curves** for distribution
- **Seeded jitter** ±4m for variety
- **Aspect ratio**: Tall buildings, width ~20-40m typical

**Tunexa:**
```typescript
// Width based on track_count
const baseWidth = 12;
const widthVariation = Math.log10(Math.max(10, artist.track_count)) * 2;
const buildingWidth = Math.min(20, baseWidth + widthVariation);

// Range: ~12 to ~20 units (1.7:1 ratio)
// Example: 10 tracks = 12 + 2 = 14
// Example: 1000 tracks = 12 + 6 = 18
// Example: 10000 tracks = 12 + 8 = 20 (capped)
```

**Key Characteristics:**
- **12 unit base** (similar to Git City)
- **Single factor**: track_count only
- **Log scale** (flattens distribution)
- **Hard cap at 20** units
- **No jitter** (identical widths for same track count)
- **Aspect ratio**: Too narrow range

**Comparison:**
| Aspect | Git City | Tunexa | Issue |
|--------|----------|--------|-------|
| **Min Width** | 14m | 12 units | Similar |
| **Max Width** | ~38m | 20 units | **Tunexa too narrow** |
| **Width Ratio** | 3.2:1 | 1.7:1 | **Not enough variation** |
| **Formula** | Multi-factor | Single factor | Git City richer |
| **Jitter** | ±4m seeded | None | **Tunexa lacks organic feel** |

**Recommendation for Tunexa:**
```typescript
// Increase max width and add jitter
const baseWidth = 14;
const trackNorm = Math.min(1, artist.track_count / 1000);
const score = Math.pow(trackNorm, 0.5); // sqrt curve
const jitter = (Math.random() - 0.5) * 6;

const buildingWidth = Math.round(14 + score * 20 + jitter);
// Range: ~11 to ~40 units (3.6:1 ratio)
```

---

### 1.3 Depth Calculation

**Git City:**
```typescript
// Depth V2 Formula
const extNorm = Math.min(1, (dev.repos_contributed_to ?? 0) / 100);
const orgNorm = Math.min(1, (dev.organizations_count ?? 0) / 10);
const prNorm = Math.min(1, (dev.total_prs ?? 0) / 1_000);
const ratioNorm = (dev.followers ?? 0) > 0
  ? Math.min(1, ((dev.followers ?? 0) / Math.max(1, dev.following ?? 1)) / 10)
  : 0;

const score =
  Math.pow(extNorm, 0.5) * 0.40 +
  Math.pow(orgNorm, 0.5) * 0.25 +
  Math.pow(prNorm, 0.5) * 0.20 +
  Math.pow(ratioNorm, 0.5) * 0.15;

const jitter = (seededRandom(hashStr(dev.github_login) + 99) - 0.5) * 4;

return Math.round(12 + score * 20 + jitter);
// Range: ~10m to ~36m (3.6:1 ratio)
```

**Key Characteristics:**
- **12m base** depth
- **Different factors than width** (community engagement)
- **Slightly different range** than width (buildings aren't perfect squares)
- **Seeded jitter** ±4m

**Tunexa:**
```typescript
// Depth equals width (square footprint)
depth: buildingWidth // Square buildings
```

**Key Characteristics:**
- **Perfect squares** (width = depth)
- **No depth variation**
- **Less realistic** (real buildings vary)

**Comparison:**
| Aspect | Git City | Tunexa | Issue |
|--------|----------|--------|-------|
| **Min Depth** | ~10m | Same as width | OK |
| **Max Depth** | ~36m | Same as width | OK |
| **Shape** | Varying rectangles | Perfect squares | **Tunexa less realistic** |
| **Factors** | Different from width | Same as width | Git City richer |

**Recommendation for Tunexa:**
```typescript
// Make depth related but different from width
const widthRatio = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
const buildingDepth = buildingWidth * widthRatio;
// Buildings are slightly rectangular, not perfect squares
```

---

### 1.4 Building Aspect Ratios

**Git City Aspect Ratios:**
```
Typical small building:  38m wide × 36m deep × 60m tall  = 1:1.6 ratio
Typical medium building: 28m wide × 24m deep × 200m tall = 1:8.3 ratio
Typical tall building:   24m wide × 22m deep × 450m tall = 1:19.5 ratio
Max building:            38m wide × 36m deep × 600m tall = 1:16.2 ratio

// Buildings get TALLER relative to base as they grow
// Small: height ≈ width
// Large: height >> width (skyscraper proportion)
```

**Tunexa Aspect Ratios:**
```
Typical small building:  14 wide × 14 deep × 50 tall   = 1:3.6 ratio
Typical medium building: 16 wide × 16 deep × 120 tall  = 1:7.5 ratio
Typical tall building:   20 wide × 20 deep × 220 tall  = 1:11 ratio

// All buildings are perfect squares
// Height grows but width is constrained (20 max)
// Max ratio only 1:11 vs Git City's 1:19.5
```

**Visual Impact:**
- **Git City**: Buildings feel like proper skyscrapers (tall, narrow)
- **Tunexa**: Buildings look like chunky towers (too wide for height)

**Recommendation:**
```typescript
// Decouple width more from height
// Allow width up to 30-35 units
// Push height up to 400-500 units for top artists
// Result: 1:15+ aspect ratios for mega stars
```

---

## Part 2: Building Placement Comparison

### 2.1 Grid Layout

**Git City:**
```typescript
// Block-based layout
const BLOCK_SIZE = 4;        // 4x4 buildings per block
const LOT_W = 38;            // Lot width (X)
const LOT_D = 32;            // Lot depth (Z)
const ALLEY_W = 3;           // Gap between lots
const STREET_W = 12;         // Street between blocks

// Calculated spacing:
// Horizontal: LOT_W + ALLEY_W = 38 + 3 = 41 units between building centers
// Vertical: LOT_D + ALLEY_W = 32 + 3 = 35 units between building centers

// Blocks arranged in SPIRAL pattern from center
// Multiple districts (downtown, residential, etc.) each with own spiral
// River runs through city (buildings pushed aside)
```

**Visual Characteristics:**
- **City blocks** like real city (4×4 grid)
- **Streets between blocks** (12 units wide)
- **Alleys between lots** (3 units)
- **Spiral expansion** from multiple centers
- **Organic but structured**

**Tunexa:**
```typescript
// Simple grid layout
const gridSize = 15;         // 15x15 grid
const spacing = 120;         // 120 units between buildings

// Stagger every other row
const stagger = (row % 2) * (spacing * 0.5);

// Random jitter
const jitter = () => (Math.random() - 0.5) * 30;

// Position calculation:
// x = (col - 7.5) * 120 + stagger + jitter
// z = (row - 7.5) * 120 + jitter
```

**Visual Characteristics:**
- **Uniform grid** (no blocks)
- **Large spacing** (120 units)
- **Staggered rows** (offset every other row)
- **Random jitter** (±15 units)
- **No streets** (just open space)

**Comparison:**
| Aspect | Git City | Tunexa | Issue |
|--------|----------|--------|-------|
| **Structure** | City blocks | Uniform grid | Tunexa lacks realism |
| **Spacing** | 35-41 units | 120 units | **Tunexa too spread out** |
| **Streets** | Yes (12 units) | No | Tunexa lacks infrastructure |
| **Pattern** | Spiral from centers | Simple grid | Git City more organic |
| **Density** | Dense blocks | Sparse | Tunexa feels empty |

### 2.2 Position Distribution

**Git City:**
```
Block 0 (center): 4×4 = 16 buildings
Block 1 (spiral): 4×4 = 16 buildings
Block 2-8: ... etc

Each block: 161×137 units footprint
Building centers within block: 41 units apart

Result: Buildings clustered in blocks with clear streets between
```

**Tunexa:**
```
15×15 grid = 225 positions
120 unit spacing

Result: Uniform spread, no clustering
Feels like scattered towers, not a city
```

**Recommendation for Tunexa:**
```typescript
// Implement block-based layout
const BLOCK_SIZE = 3;      // 3x3 buildings per block
const LOT_SIZE = 40;       // Space per building
const ALLEY = 5;           // Gap between buildings in block
const STREET = 15;         // Gap between blocks

// Position within block
const localX = (col % BLOCK_SIZE) * (LOT_SIZE + ALLEY);
const localZ = Math.floor(col / BLOCK_SIZE) * (LOT_SIZE + ALLEY);

// Block position with streets
const blockX = Math.floor(index / (BLOCK_SIZE * BLOCK_SIZE)) * (BLOCK_SIZE * (LOT_SIZE + ALLEY) + STREET);
```

---

## Part 3: Building Density & Layout

### 3.1 Building Density Comparison

**Git City Density:**
```
Block dimensions: 161m × 137m
Buildings per block: 16
Spacing: 41m (horizontal), 35m (vertical)

Density: 16 buildings / (161 × 137)m²
       = 16 / 22,057 m²
       = 1 building per 1,378 m²

City feel: Dense urban blocks with streets
```

**Tunexa Density:**
```
Grid spacing: 120 units
Positions: 15×15 = 225

Density with 109 buildings:
       = 109 buildings / (15×120 × 15×120) units²
       = 109 / 3,240,000 units²
       = 1 building per 29,724 units²

City feel: Very sparse, scattered towers
```

**Comparison:**
- **Git City**: 1 building per ~1,400 units²
- **Tunexa**: 1 building per ~29,700 units²
- **Tunexa is 21× less dense!**

**Recommendation:**
```typescript
// Reduce spacing significantly
const spacing = 50; // instead of 120
// OR implement block system with ~40 unit building spacing
```

### 3.2 Visual Comparison

**Git City:**
```
[Block 1]          [Block 2]
┌────┬────┬────┐   ┌────┬────┬────┐
│ B1 │ B2 │ B3 │   │ B17│ B18│ B19│
├────┼────┼────┤   ├────┼────┼────┤
│ B4 │ B5 │ B6 │   │ B20│ B21│ B22│
├────┼────┼────┤   ├────┼────┼────┤
│ B7 │ B8 │ B9 │   │ B23│ B24│ B25│
└────┴────┴────┘   └────┴────┴────┘
   ←── street ──→

Looks like: Real city with blocks, streets, density
```

**Tunexa:**
```
    B1                    B2

              B3

         B4

    B5

Looks like: Scattered towers in empty space
```

---

## Part 4: Specific Recommendations

### Immediate Fixes (High Impact):

#### 1. **Increase Building Heights**
```typescript
// Current: 20-220 units
// Target: 35-400+ units

const minHeight = 35;
const maxHeight = 400; // Nearly double current max

// Use power curve like Git City
const heightScale = Math.pow(listeners / maxListeners, 0.6);
const buildingHeight = minHeight + heightScale * (maxHeight - minHeight);
```

#### 2. **Increase Width Range**
```typescript
// Current: 12-20 units (1.7:1 ratio)
// Target: 14-35 units (2.5:1 ratio)

const baseWidth = 14;
const trackNorm = Math.min(1, track_count / 1000);
const widthScore = Math.pow(trackNorm, 0.5) * 21; // 0-21 range
const jitter = (Math.random() - 0.5) * 4;

const buildingWidth = Math.round(baseWidth + widthScore + jitter);
// Range: ~12 to ~39 units
```

#### 3. **Add Depth Variation**
```typescript
// Current: width === depth
// Target: depth 0.8-1.2× width

const aspectRatio = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
const buildingDepth = buildingWidth * aspectRatio;
```

#### 4. **Reduce Spacing Dramatically**
```typescript
// Current: 120 units
// Target: 40-50 units (like Git City)

const spacing = 45; // Similar to Git City's 41 unit horizontal
```

#### 5. **Implement Block System**
```typescript
const BLOCK_SIZE = 3;      // 3×3 buildings
const LOT_SIZE = 35;       // Space per building
const ALLEY = 4;           // Gap between buildings
const STREET = 15;         // Gap between blocks

// Buildings clustered in blocks with streets between
```

### Code Comparison:

**Current Tunexa (Sparse):**
```
Spacing: 120 units
Width: 12-20 units
Height: 20-220 units
Ratio: 1:11 max
Visual: Scattered chunky towers
```

**Recommended Tunexa (Dense):**
```
Spacing: 45 units (inside blocks)
Width: 12-39 units
Height: 35-400 units
Ratio: 1:25 max
Visual: Dense city with skyscrapers
```

**Git City Reference:**
```
Spacing: 35-41 units (inside blocks)
Width: 12-38m
Height: 35-600m
Ratio: 1:19 max
Visual: Realistic city blocks
```

---

## Part 5: Summary Table

| Feature | Git City | Tunexa Current | Recommended |
|---------|----------|----------------|-------------|
| **Height Range** | 35-600m | 20-220 | 35-400 |
| **Height Ratio** | 17:1 | 11:1 | 11:1 → 25:1 |
| **Width Range** | 14-38m | 12-20 | 12-39 |
| **Width Ratio** | 2.7:1 | 1.7:1 | 3.3:1 |
| **Depth** | Varies (10-36m) | Same as width | 0.8-1.2× width |
| **Max Aspect** | 1:19.5 | 1:11 | 1:25 |
| **Building Spacing** | 35-41m | 120 | 40-50 |
| **Layout** | Block-based | Grid | Block-based |
| **Streets** | Yes (12m) | No | Add streets |
| **Density** | 1/1,400m² | 1/29,700 | 1/2,000 |
| **Visual Feel** | Real city | Scattered | Real city |

---

## Part 6: Implementation Priority

### Phase 1: Quick Wins (Immediate Impact)
1. ✅ **Reduce spacing** from 120 to 50 units
2. ✅ **Increase max height** from 220 to 350
3. ✅ **Increase max width** from 20 to 30
4. ✅ **Add depth variation** (not square)

### Phase 2: Layout (This Week)
5. **Implement block system** (3×3 buildings)
6. **Add street gaps** between blocks
7. **Spiral arrangement** from center

### Phase 3: Polish
8. **Height power curves** (better distribution)
9. **Seeded jitter** (consistent randomness)
10. **Genre-based districts** (different areas)

---

## Conclusion

**The Problem:**
Tunexa's buildings are:
- Too short (max 220 vs Git City's 600)
- Too narrow in width range (12-20 vs 14-38)
- Too far apart (120 vs 35-41 units)
- Perfect squares (no depth variation)
- Uniform grid (no city blocks)

**Result:** Scattered chunky towers instead of a dense cityscape.

**The Solution:**
1. Increase heights to 400+ for mega stars
2. Increase width range to 12-39
3. Reduce spacing to 45-50 units
4. Add depth variation
5. Implement block-based layout

**Expected Visual:** Dense, realistic city with proper skyscrapers that get dramatically taller for popular artists.
