// STEP 6: Theme System - Git City style themes
export interface CityTheme {
  name: string;
  // Sky
  sky: [number, string][];
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
  // Building colors
  windowLit: string[];
  wall: string;
  roof: string;
  accent: string;
}

export const THEMES: CityTheme[] = [
  {
    name: "Midnight",
    sky: [[0, "#1a2848"], [0.5, "#0f1828"], [1, "#0a0f18"]],
    fogColor: "#0a1428",
    fogNear: 400,
    fogFar: 3500,
    ambientColor: "#4060b0",
    ambientIntensity: 1.65,
    sunColor: "#7090d0",
    sunIntensity: 2.625,
    sunPos: [100, 200, 100],
    fillColor: "#6080ff",
    fillIntensity: 1.2,
    fillPos: [-100, 100, -100],
    hemiSky: "#5080a0",
    hemiGround: "#202838",
    hemiIntensity: 1.75,
    groundColor: "#242c38",
    windowLit: ["#a0c0f0", "#80a0d0", "#6090c0", "#4080b0", "#2070a0"],
    wall: "#101828",
    roof: "#2a3858",
    accent: "#c8e64a",
  },
  {
    name: "Sunset",
    sky: [[0, "#80405a"], [0.5, "#603040"], [1, "#1a0f18"]],
    fogColor: "#80405a",
    fogNear: 400,
    fogFar: 3500,
    ambientColor: "#e0a080",
    ambientIntensity: 1.75,
    sunColor: "#f0b070",
    sunIntensity: 2.8,
    sunPos: [80, 180, 80],
    fillColor: "#d09080",
    fillIntensity: 1.3,
    fillPos: [-80, 80, -80],
    hemiSky: "#d09080",
    hemiGround: "#3a3038",
    hemiIntensity: 1.85,
    groundColor: "#3a3038",
    windowLit: ["#f8d880", "#e8c060", "#d8b040", "#c8a020", "#b89010"],
    wall: "#281828",
    roof: "#604050",
    accent: "#ff6b35",
  },
  {
    name: "Neon",
    sky: [[0, "#ff40c0"], [0.5, "#8020a0"], [1, "#1a0830"]],
    fogColor: "#1a0830",
    fogNear: 400,
    fogFar: 3500,
    ambientColor: "#8040c0",
    ambientIntensity: 1.8,
    sunColor: "#c050e0",
    sunIntensity: 2.9,
    sunPos: [120, 220, 120],
    fillColor: "#00c0d0",
    fillIntensity: 1.4,
    fillPos: [-120, 120, -120],
    hemiSky: "#9040d0",
    hemiGround: "#2c2038",
    hemiIntensity: 1.9,
    groundColor: "#2c2038",
    windowLit: ["#ff40c0", "#e030b0", "#c020a0", "#a01090", "#800080"],
    wall: "#180830",
    roof: "#3c1858",
    accent: "#00ffff",
  },
];

export const DEFAULT_THEME = THEMES[0];
