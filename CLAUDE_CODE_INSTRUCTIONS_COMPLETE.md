# COMPLETE Claude Code Instruction Plan: Tunexa 3D Overhaul
## All Git City Features - Phased Implementation

---

## PHASE 1: Quick Visual Wins (Immediate - 5 Steps)
*From your "Do Today" list - High impact, easy to implement*

### STEP 1: Fix Building Dimensions
**Changes:** Height 220→400, Width 12-20→12-39, Depth variation
**File:** `CityView.tsx:transformArtistToBuilding()`
**Verification:** Height ratios 1:25, aspect ratios match Git City

### STEP 2: Implement Block Layout & Dense Spacing
**Changes:** Spacing 120→39, Grid→3×3 Blocks, Streets between blocks
**File:** `CityView.tsx:getArtistPosition()`
**Verification:** Density 1/1521 vs Git City's 1/1378

### STEP 3: Lighting, Atmosphere & Effects
**Changes:**
- ✅ 4-light system (add fill + hemisphere)
- ✅ Bloom post-processing
- ✅ SkyDome with gradient
- ✅ Themed fog (#0a1428)
- ✅ Camera FOV 45, position [400,300,400]
**Files:** `CityScene.tsx`, `SkyDome.tsx` (new)
**Verification:** Visual match to Git City screenshots

### STEP 4: Building Rise Animation
**Changes:** Entry animation (grow from ground), 850ms, cubic ease-out
**File:** `BuildingMesh` component in `CityView.tsx`
**Verification:** Buildings animate on page load

### STEP 5: Testing & Deployment Phase 1
**Verification:**
- Dimensions correct (verify script)
- Density matches Git City
- 60fps maintained
- Deploy to Vercel

---

## PHASE 2: Intermediate Features (This Week - 4 Steps)
*From your "This Week" list - Medium effort*

### STEP 6: Theme System
**Changes:**
- Create 2-3 themes (Midnight, Sunset, Neon)
- Theme switcher UI
- Persist theme preference
**Files:** `themes.ts` (new), `CityCanvas.tsx`, UI components
**Skills:** `/frontend-design` for theme validation

### STEP 7: Pixel-Style UI Overhaul
**Changes:**
- Hard pixel shadows (box-shadow: 4px 4px 0 0 rgba(0,0,0,0.5))
- Monospace pixel font (Silkscreen or VT323)
- Button press animations (transform on hover/active)
- Lime accent color (#c8e64a)
**Files:** `globals.css`, button components
**Skills:** `/frontend-design`

### STEP 8: Focus/Dim System
**Changes:**
- When building clicked: dim others to 60% opacity
- Screen-door transparency pattern for unfocused
- Cursor changes to pointer on hover
- Click outside to reset
**File:** `CityView.tsx` (state management)
**Verification:** Visual feedback matches Git City

### STEP 9: Testing Phase 2
**Verification:**
- Theme switching works
- UI pixel-perfect
- Focus system responsive
- Deploy

---

## PHASE 3: Performance & Advanced Rendering (Later - 3 Steps)
*From your "Later" list - Major refactors*

### STEP 10: Instanced Rendering Implementation
**Problem:** Current 100 buildings = 100+ draw calls (windows separate)
**Solution:** Single InstancedMesh for ALL buildings
**Changes:**
- One `BoxGeometry(1,1,1)` shared
- `InstancedMesh` with count = buildings.length
- Matrix updates per frame for animations
**File:** `InstancedBuildings.tsx` (new, replaces BuildingMesh)
**Skills:** `/simplify` for optimization review
**Verification:** 60fps with 500+ buildings

### STEP 11: Texture Atlas for Windows
**Problem:** Each building creates 4-8 window meshes (400-800 draw calls!)
**Solution:** Single canvas texture with all windows baked in
**Changes:**
- Create 2048×2048 canvas atlas
- 6 luminosity bands (42 rows each)
- Custom shader reads from atlas
- Zero individual window meshes
**Files:** `WindowAtlas.ts` (new), shader material
**Verification:** Window rendering in 1 draw call

### STEP 12: Custom Shader Material
**Changes:**
- Vertex shader: rise animation, tint colors, UV mapping
- Fragment shader: fog, focus/dim, emissive glow, texture sampling
- Uniforms: fogColor, fogNear/fogFar, focusedId, dimOpacity, cityEnergy
**Files:** `BuildingShaderMaterial.ts` (new)
**Skills:** `/simplify`
**Verification:** All effects work in single shader

---

## COMPLETE Feature Checklist

### Immediate (Phase 1)
- [x] Height 35-400 units
- [x] Width 12-39 units
- [x] Depth variation (rectangular)
- [x] Spacing 39 units (blocks)
- [x] 4-light system
- [x] Bloom post-processing
- [x] SkyDome
- [x] Themed fog
- [x] Rise animation

### This Week (Phase 2)
- [ ] Theme system (3 themes)
- [ ] Pixel-style UI
- [ ] Focus/dim system
- [ ] Cursor feedback

### Later (Phase 3)
- [ ] Instanced rendering
- [ ] Texture atlas windows
- [ ] Custom shader material
- [ ] Spatial grid LOD
- [ ] Object pooling

---

## Skill Usage by Phase

### Phase 1-2: `/frontend-design`
Use for:
- Theme validation
- UI component review
- Color scheme checking
- Animation timing

### Phase 3: `/simplify`
Use for:
- Instanced mesh optimization
- Shader code review
- Performance bottlenecks
- Memory cleanup

### All Phases: Cron monitoring (optional)
```bash
/schedule every 24h /performance-check
```

---

## Performance Targets by Phase

| Phase | Buildings | FPS Target | Draw Calls |
|-------|-----------|------------|------------|
| 1-2 (Current) | 100 | 60fps | ~500 |
| 3 (Instanced) | 500+ | 60fps | ~10 |
| 3 (Atlas) | 1000+ | 60fps | ~5 |

---

## What Was Missing in Original Plan?

Your original message had these items NOT in my first plan:

| Feature | Original Plan | Now Included In |
|---------|---------------|-----------------|
| Instanced rendering | ❌ Missing | Phase 3, Step 10 |
| Texture atlas windows | ❌ Missing | Phase 3, Step 11 |
| Custom shader material | ❌ Missing | Phase 3, Step 12 |
| Theme system | ❌ Missing | Phase 2, Step 6 |
| Pixel-style UI | ❌ Missing | Phase 2, Step 7 |
| Focus/dim system | ❌ Missing | Phase 2, Step 8 |

---

## Recommended Execution Order

### Option A: Immediate Visual Impact (Recommended)
Do **Phase 1 only** first → Deploy → Get feedback → Then Phase 2 → Then Phase 3

### Option B: Complete Overhaul
Do all 12 steps sequentially (takes longer, higher risk)

### Option C: Hybrid
Phase 1 (visual fixes) → Deploy → Phase 3 first (performance) → Phase 2 (polish)

---

## Summary

**My Original 5-Step Plan:** Only covered Phase 1 (Quick Wins)

**This Complete Plan:**
- Phase 1: 5 steps (Dimensions, Layout, Lighting, Animation, Deploy)
- Phase 2: 4 steps (Themes, Pixel UI, Focus system, Test)
- Phase 3: 3 steps (Instanced, Atlas, Shaders)

**Total: 12 Steps covering ALL Git City features**

---

**Ready to proceed with Phase 1 Step 1? Or want to jump to a specific phase?**
