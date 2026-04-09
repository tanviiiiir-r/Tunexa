// Adapter: Transform Tunexa Artist data → Git City CityBuilding format
// Uses backend-provided positions directly for consistency

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

// Convert API artist directly to building using backend-calculated positions
export function artistsToBuildings(artists: TunexaArtist[]): CityBuilding[] {
  return artists.map((a, index) => {
    // Use backend-calculated values (backend determines layout, spacing, heights)
    const posX = a.city_x ?? (index % 100) * 50;
    const posZ = a.city_z ?? Math.floor(index / 100) * 50;
    const buildingHeight = a.height ?? 50;
    const buildingWidth = a.width ?? 24;
    // Calculate depth from width if not provided (typical building ratio)
    const buildingDepth = a.depth ?? Math.max(12, buildingWidth * 0.6 + (index % 5) * 2);

    const floorH = 6;
    const floors = Math.max(3, Math.floor(buildingHeight / floorH));
    const windowsPerFloor = Math.max(3, Math.floor(buildingWidth / 5));
    const sideWindowsPerFloor = Math.max(3, Math.floor(buildingDepth / 5));

    // Calculate lit percentage based on listeners
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
