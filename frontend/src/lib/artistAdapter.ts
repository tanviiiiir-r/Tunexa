// Adapter: Transform Tunexa Artist data → Git City CityBuilding format
// Applies visual scaling for dramatic effect (height variation, spacing)

export interface TunexaArtist {
  id: string;
  name: string;
  genre: string;
  image_url: string | null;
  lastfm_listeners: number;
  track_count: number;
  sub_genres?: string[];
  claimed?: boolean;
  // Backend-calculated layout values
  city_x?: number;
  city_z?: number;
  height?: number;
  width?: number;
  depth?: number;
  district?: string;
}

// Git City compatible building type
export interface CityBuilding {
  login: string;
  rank: number;
  contributions: number;
  total_stars: number;
  public_repos: number;
  name: string | null;
  avatar_url: string | null;
  primary_language: string | null;
  claimed: boolean;
  owned_items: string[];
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

// Visual scaling constants for dramatic effect
const HEIGHT_SCALE = 4.0;        // Make height differences 4x more visible
const HEIGHT_OFFSET = 30;      // Minimum height boost
const SPACING_SCALE = 2.5;     // Wider spacing between buildings

// Convert API artist to building with visual enhancement
export function artistsToBuildings(artists: TunexaArtist[]): CityBuilding[] {
  // Find min/max for normalization
  const heights = artists.map(a => a.height ?? 50).filter(h => h > 0);
  const minDbHeight = Math.min(...heights);
  const maxDbHeight = Math.max(...heights);
  const heightRange = maxDbHeight - minDbHeight || 1;

  // Find city bounds for centering
  const xs = artists.map(a => a.city_x ?? 0);
  const zs = artists.map(a => a.city_z ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return artists.map((a, index) => {
    // Scale positions for wider spacing (less saturation)
    const rawX = (a.city_x ?? 0) - centerX;
    const rawZ = (a.city_z ?? 0) - centerZ;
    const posX = rawX * SPACING_SCALE;
    const posZ = rawZ * SPACING_SCALE;

    // Dramatic height scaling - normalize then apply exponential curve
    const rawHeight = a.height ?? 50;
    const normalizedHeight = (rawHeight - minDbHeight) / heightRange;
    // Exponential curve: popular artists get MUCH taller
    const curvedHeight = Math.pow(normalizedHeight, 0.4);
    const buildingHeight = HEIGHT_OFFSET + curvedHeight * 600 * HEIGHT_SCALE;

    // Width varies less dramatically
    const buildingWidth = Math.max(15, (a.width ?? 24) * 0.6);
    const buildingDepth = Math.max(12, buildingWidth * 0.7 + (index % 4));

    const floorH = 6;
    const floors = Math.max(3, Math.floor(buildingHeight / floorH));
    const windowsPerFloor = Math.max(3, Math.floor(buildingWidth / 5));
    const sideWindowsPerFloor = Math.max(3, Math.floor(buildingDepth / 5));

    // Lit percentage based on listeners
    const listenerNorm = Math.min(a.lastfm_listeners / 10_000_000, 1);
    const litPercentage = 0.2 + listenerNorm * 0.75;

    return {
      login: a.name,
      rank: index + 1,
      contributions: a.lastfm_listeners,
      total_stars: a.track_count,
      public_repos: a.track_count,
      name: a.name,
      avatar_url: a.image_url,
      primary_language: a.genre,
      claimed: a.claimed || false,
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
      district: a.district || a.genre,
      district_chosen: true,
      position: [posX, 0, posZ],
      width: buildingWidth,
      depth: buildingDepth,
      height: buildingHeight,
      floors,
      windowsPerFloor,
      sideWindowsPerFloor,
      litPercentage: Math.min(0.95, litPercentage),
    };
  });
}

// Calculate lit percentage based on popularity
const maxListeners = 10000000;

export function calculateLitPercentage(listeners: number): number {
  return Math.min(0.95, 0.2 + (listeners / maxListeners) * 0.75);
}

// Stub for tierFromLevel
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
