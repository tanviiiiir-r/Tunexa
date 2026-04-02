// Adapter: Transform Tunexa Artist data → Git City CityBuilding format

export interface TunexaArtist {
  id: string;
  name: string;
  genre: string;
  height?: number;
  width?: number;
  city_x?: number;
  city_z?: number;
  image_url: string | null;
  lastfm_listeners: number;
  track_count: number;
  sub_genres?: string[];
  claimed?: boolean;
}

// Git City compatible building type
export interface CityBuilding {
  login: string;           // artist name (unique identifier)
  rank: number;
  contributions: number;   // mapped from lastfm_listeners
  total_stars: number;     // mapped from track_count
  public_repos: number;    // mapped from track_count
  name: string | null;
  avatar_url: string | null;
  primary_language: string | null;  // mapped from genre
  claimed: boolean;
  owned_items: string[];
  custom_color?: string | null;
  achievements: string[];
  kudos_count: number;
  visit_count: number;
  app_streak: number;
  raid_xp: number;
  current_week_contributions: number;
  current_week_kudos_given: number;
  current_week_kudos_received: number;
  rabbit_completed: boolean;
  xp_total: number;
  xp_level: number;
  district?: string;
  district_chosen?: boolean;
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
  litPercentage: number;
}

// Position cache for consistent layout
const positionCache = new Map<string, { x: number; z: number }>();

// Spiral coordinate generator (from Git City)
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

// Generate consistent position for artist
function getArtistPosition(index: number): { x: number; z: number } {
  if (positionCache.has(String(index))) {
    return positionCache.get(String(index))!;
  }

  const BLOCK_SIZE = 3;
  const LOT_W = 35;
  const LOT_D = 35;
  const ALLEY_W = 4;
  const STREET_W = 15;
  const HORIZONTAL_SPACING = LOT_W + ALLEY_W;
  const VERTICAL_SPACING = LOT_D + ALLEY_W;
  const BLOCK_FOOTPRINT_X = BLOCK_SIZE * HORIZONTAL_SPACING;
  const BLOCK_FOOTPRINT_Z = BLOCK_SIZE * VERTICAL_SPACING;

  const buildingsPerBlock = BLOCK_SIZE * BLOCK_SIZE;
  const blockIndex = Math.floor(index / buildingsPerBlock);
  const [blockX, blockZ] = spiralCoord(blockIndex);

  const localIndex = index % buildingsPerBlock;
  const localRow = Math.floor(localIndex / BLOCK_SIZE);
  const localCol = localIndex % BLOCK_SIZE;

  const centerOffset = (BLOCK_SIZE - 1) / 2;
  const posX = blockX * (BLOCK_FOOTPRINT_X + STREET_W) +
               (localCol - centerOffset) * HORIZONTAL_SPACING;
  const posZ = blockZ * (BLOCK_FOOTPRINT_Z + STREET_W) +
               (localRow - centerOffset) * VERTICAL_SPACING;

  // Small jitter for organic feel
  const jitter = () => (Math.random() - 0.5) * 8;
  const pos = { x: posX + jitter(), z: posZ + jitter() };
  positionCache.set(String(index), pos);
  return pos;
}

// Calculate building dimensions from artist metrics
function calculateDimensions(artist: TunexaArtist): {
  width: number;
  height: number;
  depth: number;
  floors: number;
  windowsPerFloor: number;
  sideWindowsPerFloor: number;
} {
  const maxListeners = 10000000;
  const listenerNorm = Math.min(artist.lastfm_listeners / maxListeners, 1);
  const trackNorm = Math.min(artist.track_count / 1000, 1);

  // Height: 20-200 range (more dramatic difference)
  // Use exponential curve for more dramatic height differences
  const heightScore = Math.pow(listenerNorm, 0.5); // Square root for more spread at lower values
  const buildingHeight = 20 + heightScore * 180;

  // Width: 8-50 range (more dramatic difference)
  const widthScore = Math.pow(trackNorm, 0.6) * 35;
  const jitter = (Math.random() - 0.5) * 6;
  const buildingWidth = Math.max(8, Math.round(15 + widthScore + jitter));

  // Depth: 0.7-1.3x width (more variation)
  const depthRatio = 0.7 + Math.random() * 0.6;
  const buildingDepth = buildingWidth * depthRatio;

  const floors = Math.max(3, Math.floor(buildingHeight / 10));
  const windowsPerFloor = Math.max(2, Math.floor(buildingWidth / 8));
  const sideWindowsPerFloor = Math.max(2, Math.floor((buildingWidth * depthRatio) / 8));

  return {
    width: buildingWidth,
    height: buildingHeight,
    depth: buildingDepth,
    floors,
    windowsPerFloor,
    sideWindowsPerFloor,
  };
}

// Convert Tunexa artist to Git City building
export function artistToBuilding(artist: TunexaArtist, index: number): CityBuilding {
  const pos = getArtistPosition(index);
  const dims = calculateDimensions(artist);

  // Map genre to district
  const genreMap: Record<string, string> = {
    'pop': 'pop',
    'rock': 'rock',
    'hip-hop': 'hip-hop',
    'electronic': 'electronic',
    'r&b': 'r&b',
    'indie': 'indie',
  };
  const district = genreMap[artist.genre?.toLowerCase()] || 'other';

  return {
    login: artist.name,
    rank: index + 1,
    contributions: artist.lastfm_listeners,
    total_stars: artist.track_count,
    public_repos: artist.track_count,
    name: artist.name,
    avatar_url: artist.image_url,
    primary_language: artist.genre,
    claimed: artist.claimed || false,
    owned_items: [],
    achievements: [],
    kudos_count: 0,
    visit_count: 0,
    app_streak: 0,
    raid_xp: 0,
    current_week_contributions: 0,
    current_week_kudos_given: 0,
    current_week_kudos_received: 0,
    rabbit_completed: false,
    xp_total: 0,
    xp_level: 1,
    district,
    district_chosen: true,
    position: [pos.x, 0, pos.z],
    width: dims.width,
    depth: dims.depth,
    height: dims.height,
    floors: dims.floors,
    windowsPerFloor: dims.windowsPerFloor,
    sideWindowsPerFloor: dims.sideWindowsPerFloor,
    litPercentage: Math.min(0.95, 0.2 + (artist.lastfm_listeners / maxListeners) * 0.75),
  };
}

// Convert array of artists to buildings
export function artistsToBuildings(artists: TunexaArtist[]): CityBuilding[] {
  positionCache.clear();
  return artists.map((artist, index) => artistToBuilding(artist, index));
}

// Calculate lit percentage based on popularity
const maxListeners = 10000000;

export function calculateLitPercentage(listeners: number): number {
  return Math.min(0.95, 0.2 + (listeners / maxListeners) * 0.75);
}

// Stub for tierFromLevel - returns default tier since Tunexa doesn't have XP system
export function tierFromLevel(level: number): { name: string; color: string } {
  const tiers = [
    { name: 'bronze', color: '#cd7f32' },
    { name: 'silver', color: '#c0c0c0' },
    { name: 'gold', color: '#ffd700' },
    { name: 'platinum', color: '#e5e4e2' },
  ];
  const tierIndex = Math.min(Math.floor((level - 1) / 6), tiers.length - 1);
  return tiers[tierIndex];
}
