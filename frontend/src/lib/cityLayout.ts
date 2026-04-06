// Full Git City-style district-based layout system for Tunexa
// Mirrors github.ts generateCityLayout but adapted for artists

import * as THREE from 'three';

// ─── Layout Constants (exact match to Git City) ─────────────────

const BLOCK_SIZE = 4;     // 4x4 buildings per city block
const LOT_W = 38;         // lot width (X axis)
const LOT_D = 32;         // lot depth (Z axis)
const ALLEY_W = 3;        // narrow gap between buildings within a block
const STREET_W = 12;      // street between blocks

// Derived: total block footprint
const BLOCK_FOOTPRINT_X = BLOCK_SIZE * LOT_W + (BLOCK_SIZE - 1) * ALLEY_W; // 161
const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * LOT_D + (BLOCK_SIZE - 1) * ALLEY_W; // 137

const BLOCK_STEP_X = BLOCK_FOOTPRINT_X + STREET_W; // 173
const BLOCK_STEP_Z = BLOCK_FOOTPRINT_Z + STREET_W; // 149

const LOTS_PER_BLOCK = BLOCK_SIZE * BLOCK_SIZE; // 16

// ─── District Mapping for Artists ─────────────────────────────

// Map genres to districts - expanded for 10K artists with diverse genres
const GENRE_TO_DISTRICT: Record<string, string> = {
  // Major genres
  'pop': 'pop',
  'rock': 'rock',
  'hip-hop': 'hiphop',
  'hip hop': 'hiphop',
  'electronic': 'electronic',
  'edm': 'electronic',
  'house': 'electronic',
  'techno': 'electronic',
  'trance': 'electronic',
  'dubstep': 'electronic',
  'r&b': 'rnb',
  'randb': 'rnb',
  'rhythm and blues': 'rnb',
  'indie': 'indie',
  'indie rock': 'indie',
  'indie pop': 'indie',
  'alternative': 'indie',
  'jazz': 'jazz',
  'classical': 'classical',
  'country': 'country',
  'metal': 'metal',
  'heavy metal': 'metal',
  'death metal': 'metal',
  'black metal': 'metal',
  // Additional genres
  'blues': 'blues',
  'folk': 'folk',
  'reggae': 'reggae',
  'punk': 'punk',
  'punk rock': 'punk',
  'soul': 'soul',
  'funk': 'funk',
  'disco': 'disco',
  'gospel': 'gospel',
  'latin': 'latin',
  'latin pop': 'latin',
  'reggaeton': 'latin',
  'salsa': 'latin',
  'ambient': 'ambient',
  'new age': 'ambient',
  'world': 'world',
  'k-pop': 'kpop',
  'kpop': 'kpop',
  'j-pop': 'jpop',
  'jpop': 'jpop',
  'ska': 'ska',
  'grunge': 'grunge',
  'progressive rock': 'prog',
  'experimental': 'experimental',
  'lo-fi': 'lofi',
  'lofi': 'lofi',
  'trap': 'trap',
  'drill': 'trap',
  'afrobeat': 'afrobeat',
  'dancehall': 'dancehall',
  'dance': 'dance',
  'synthwave': 'synthwave',
  'industrial': 'industrial',
  'emo': 'emo',
  'screamo': 'emo',
  'post-rock': 'postrock',
  'shoegaze': 'shoegaze',
  'britpop': 'britpop',
  'glam rock': 'glam',
  'psychedelic': 'psychedelic',
  'hard rock': 'hardrock',
  'soft rock': 'softrock',
  'arena rock': 'arenarock',
};

const DISTRICT_ORDER = [
  'pop', 'rock', 'hiphop', 'electronic', 'rnb',
  'indie', 'jazz', 'classical', 'country', 'metal',
  'blues', 'folk', 'reggae', 'punk', 'soul',
  'funk', 'disco', 'gospel', 'latin', 'ambient',
  'world', 'kpop', 'jpop', 'ska', 'grunge',
  'prog', 'experimental', 'lofi', 'trap', 'afrobeat',
  'dancehall', 'dance', 'synthwave', 'industrial', 'emo',
  'postrock', 'shoegaze', 'britpop', 'glam', 'psychedelic',
  'hardrock', 'softrock', 'arenarock', 'other'
];

// ─── Types ──────────────────────────────────────────────────────

export interface LayoutArtist {
  id: string;
  name: string;
  genre: string;
  sub_genres?: string[];
  lastfm_listeners: number;
  track_count: number;
  image_url: string | null;
  claimed?: boolean;
}

export interface LayoutBuilding {
  id: string;
  login: string;  // artist name
  rank: number;
  district: string;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
  contributions: number;  // mapped from listeners
  total_stars: number;    // mapped from track_count
  avatar_url: string | null;
  primary_language: string;  // mapped from genre
  claimed: boolean;
}

export interface CityBlock {
  cx: number;
  cz: number;
  gx: number;
  gz: number;
  district: string;
}

// ─── Seeded Random Utilities ────────────────────────────────────

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): number {
  // Mulberry32
  let t = seed;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }();
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 7919) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── Spiral Coordinate Generator ──────────────────────────────

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

// ─── Grid to World Position ─────────────────────────────────────

function localBlockAxisPos(idx: number, footprint: number): number {
  if (idx === 0) return 0;
  const abs = Math.abs(idx);
  const sign = idx >= 0 ? 1 : -1;
  return sign * (abs * footprint + abs * STREET_W);
}

function gridToWorld(gx: number, gz: number): [number, number] {
  return [
    localBlockAxisPos(gx, BLOCK_FOOTPRINT_X),
    localBlockAxisPos(gz, BLOCK_FOOTPRINT_Z)
  ];
}

// ─── Building Dimension Calculations ───────────────────────────

const MAX_BUILDING_HEIGHT = 600;
const MIN_BUILDING_HEIGHT = 35;
const HEIGHT_RANGE = MAX_BUILDING_HEIGHT - MIN_BUILDING_HEIGHT;

function calcHeight(listeners: number, trackCount: number, maxListeners: number): { height: number; composite: number } {
  const maxL = Math.min(maxListeners, 10_000_000);
  const listenerNorm = Math.min(listeners / Math.max(1, maxL), 3);
  const trackNorm = Math.min(trackCount / 1000, 1);

  const lScore = Math.pow(Math.min(listenerNorm, 3), 0.55);
  const tScore = Math.pow(trackNorm, 0.45);

  const composite = lScore * 0.7 + tScore * 0.3;
  const height = Math.min(MAX_BUILDING_HEIGHT, MIN_BUILDING_HEIGHT + composite * HEIGHT_RANGE);

  return { height, composite };
}

function calcWidth(trackCount: number): number {
  const trackNorm = Math.min(trackCount / 1000, 1);
  const repoFactor = trackNorm;
  const baseW = 14 + repoFactor * 12;
  return Math.round(baseW + Math.random() * 8);
}

function calcDepth(seed: number): number {
  return Math.round(12 + seededRandom(seed) * 16);
}

// ─── Main Layout Generator ────────────────────────────────────

export function generateCityLayout(artists: LayoutArtist[]): {
  buildings: LayoutBuilding[];
  blocks: CityBlock[];
  maxListeners: number;
} {
  const buildings: LayoutBuilding[] = [];
  const blocks: CityBlock[] = [];

  const maxListeners = artists.reduce((max, a) => Math.max(max, a.lastfm_listeners), 1);

  // ── 1. Group artists by genre/district ──
  const districtGroups: Record<string, LayoutArtist[]> = {};
  for (const artist of artists) {
    const district = GENRE_TO_DISTRICT[artist.genre?.toLowerCase()] || 'other';
    if (!districtGroups[district]) districtGroups[district] = [];
    districtGroups[district].push(artist);
  }

  // ── 2. Extract top artists as "downtown" (center) ──
  const DOWNTOWN_COUNT = Math.min(50, Math.floor(artists.length * 0.1));
  const allSorted = [...artists].sort((a, b) => b.lastfm_listeners - a.lastfm_listeners);
  const downtownArtists = allSorted.slice(0, DOWNTOWN_COUNT);
  const downtownSet = new Set(downtownArtists.map(a => a.id));

  // Shuffle downtown blocks for variety
  for (let i = 0; i < downtownArtists.length; i += LOTS_PER_BLOCK) {
    const end = Math.min(i + LOTS_PER_BLOCK, downtownArtists.length);
    const slice = downtownArtists.slice(i, end);
    const shuffled = seededShuffle(slice, hashStr('downtown') + i);
    for (let j = 0; j < shuffled.length; j++) downtownArtists[i + j] = shuffled[j];
  }

  // ── 3. Prepare district arrays (excluding downtown) ──
  const districtArrays: { did: string; artists: LayoutArtist[] }[] = [];
  for (const did of DISTRICT_ORDER) {
    const group = districtGroups[did];
    if (!group || group.length === 0) continue;
    const filtered = group.filter(a => !downtownSet.has(a.id));
    if (filtered.length === 0) continue;
    districtArrays.push({ did, artists: seededShuffle(filtered, hashStr(did)) });
  }

  // ── 4. Track occupied cells ──
  const occupiedCells = new Set<string>();
  let globalIndex = 0;
  let globalBlockSeed = 0;

  // ── Helper: place spiral cluster ──
  function placeSpiralCluster(
    clusterArtists: LayoutArtist[],
    ogx: number,
    ogz: number,
    district: string
  ) {
    let artistIdx = 0;
    let spiralIdx = 0;

    while (artistIdx < clusterArtists.length) {
      const [bx, by] = spiralCoord(spiralIdx);
      const gx = ogx + bx;
      const gz = ogz + by;
      const key = `${gx},${gz}`;

      if (occupiedCells.has(key)) { spiralIdx++; continue; }
      occupiedCells.add(key);

      let [blockCX, blockCZ] = gridToWorld(gx, gz);

      // Add slight jitter to block center
      const jitterSeed = globalBlockSeed * 10000;
      blockCX += (seededRandom(jitterSeed) - 0.5) * 6;
      blockCZ += (seededRandom(jitterSeed + 7777) - 0.5) * 6;

      // Place buildings in this block
      const blockArtists = clusterArtists.slice(artistIdx, artistIdx + LOTS_PER_BLOCK);
      for (let i = 0; i < blockArtists.length; i++) {
        const artist = blockArtists[i];
        const localRow = Math.floor(i / BLOCK_SIZE);
        const localCol = i % BLOCK_SIZE;

        const posX = blockCX + (localCol - (BLOCK_SIZE - 1) / 2) * (LOT_W + ALLEY_W);
        const posZ = blockCZ + (localRow - (BLOCK_SIZE - 1) / 2) * (LOT_D + ALLEY_W);

        const { height, composite } = calcHeight(artist.lastfm_listeners, artist.track_count, maxListeners);
        const w = calcWidth(artist.track_count);
        const d = calcDepth(hashStr(artist.id));
        const litPercentage = 0.2 + composite * 0.75;

        const floorH = 6;
        const floors = Math.max(3, Math.floor(height / floorH));
        const windowsPerFloor = Math.max(3, Math.floor(w / 5));
        const sideWindowsPerFloor = Math.max(3, Math.floor(d / 5));

        buildings.push({
          id: artist.id,
          login: artist.name,
          rank: globalIndex + i + 1,
          district: district,
          position: [posX, 0, posZ],
          width: w,
          depth: d,
          height,
          floors,
          windowsPerFloor,
          sideWindowsPerFloor,
          litPercentage: Math.min(0.95, litPercentage),
          contributions: artist.lastfm_listeners,
          total_stars: artist.track_count,
          avatar_url: artist.image_url,
          primary_language: artist.genre,
          claimed: artist.claimed || false,
        });
      }

      blocks.push({ cx: blockCX, cz: blockCZ, gx, gz, district });

      artistIdx += blockArtists.length;
      spiralIdx++;
      globalBlockSeed++;
      globalIndex += blockArtists.length;
    }
  }

  // ── 5. Place downtown at center (0, 0) ──
  placeSpiralCluster(downtownArtists, 0, 0, 'downtown');

  // ── 6. Place districts in spirals around center ──
  const DISTRICT_GRID_RADIUS = 4;
  for (let di = 0; di < districtArrays.length; di++) {
    const angle = (di / districtArrays.length) * Math.PI * 2 - Math.PI / 2;
    const ogx = Math.round(Math.cos(angle) * DISTRICT_GRID_RADIUS);
    const ogz = Math.round(Math.sin(angle) * DISTRICT_GRID_RADIUS);
    placeSpiralCluster(districtArrays[di].artists, ogx, ogz, districtArrays[di].did);
  }

  return { buildings, blocks, maxListeners };
}

// ─── Export constants for reference ─────────────────────────────

export const CITY_LAYOUT_CONSTANTS = {
  BLOCK_SIZE,
  LOT_W,
  LOT_D,
  ALLEY_W,
  STREET_W,
  BLOCK_FOOTPRINT_X,
  BLOCK_FOOTPRINT_Z,
  BLOCK_STEP_X,
  BLOCK_STEP_Z,
};
