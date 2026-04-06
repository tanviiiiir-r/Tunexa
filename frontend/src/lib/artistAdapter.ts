// Adapter: Transform Tunexa Artist data → Git City CityBuilding format
// Uses full district-based city layout (matches Git City)

import { generateCityLayout, type LayoutArtist } from './cityLayout';

export interface TunexaArtist {
  id: string;
  name: string;
  genre: string;
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

// Convert array of artists to buildings using full Git City layout
export function artistsToBuildings(artists: TunexaArtist[]): CityBuilding[] {
  // Map TunexaArtist to LayoutArtist
  const layoutArtists: LayoutArtist[] = artists.map(a => ({
    id: a.id,
    name: a.name,
    genre: a.genre,
    sub_genres: a.sub_genres,
    lastfm_listeners: a.lastfm_listeners,
    track_count: a.track_count,
    image_url: a.image_url,
    claimed: a.claimed,
  }));

  // Generate full city layout with districts
  const { buildings } = generateCityLayout(layoutArtists);

  // Map LayoutBuilding to CityBuilding (compatible with Git City components)
  return buildings.map(b => ({
    login: b.login,
    rank: b.rank,
    contributions: b.contributions,
    total_stars: b.total_stars,
    public_repos: b.total_stars, // Same as total_stars for artists
    name: b.login,
    avatar_url: b.avatar_url,
    primary_language: b.primary_language,
    claimed: b.claimed,
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
    district: b.district,
    district_chosen: true,
    position: b.position,
    width: b.width,
    depth: b.depth,
    height: b.height,
    floors: b.floors,
    windowsPerFloor: b.windowsPerFloor,
    sideWindowsPerFloor: b.sideWindowsPerFloor,
    litPercentage: b.litPercentage,
  }));
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

// Re-export types for convenience
export type { LayoutArtist };
