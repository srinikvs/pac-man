import type { Dir, GhostId } from "./types";
import { LEFT, UP } from "./types";

export const COLS = 28;
export const ROWS = 31;
export const HUD_TOP = 3;
export const HUD_BOT = 2;
export const VIEW_ROWS = HUD_TOP + ROWS + HUD_BOT;
export const TILE_PX = 16;
export const VIEW_W = COLS * TILE_PX;
export const VIEW_H = VIEW_ROWS * TILE_PX;

export const TUNNEL_ROW = 14;
export const DOOR_COL = 14;
export const DOOR_ROW = 12;

export const PAC_SPAWN = { x: 14, y: 23.5, dir: LEFT as Dir };
export const BLINKY_SPAWN = { x: 14, y: 11.5, dir: LEFT as Dir };
export const PINKY_SPAWN = { x: 14, y: 14.5, dir: UP as Dir };
export const INKY_SPAWN = { x: 12, y: 14.5, dir: UP as Dir };
export const CLYDE_SPAWN = { x: 16, y: 14.5, dir: UP as Dir };

export const HOUSE_EXIT = { x: 14, y: 11.5 };
export const HOUSE_CENTER = { x: 14, y: 14.5 };

export const SCATTER: Record<GhostId, { x: number; y: number }> = {
  blinky: { x: 25, y: -2 },
  pinky: { x: 2, y: -2 },
  inky: { x: 27, y: 32 },
  clyde: { x: 0, y: 32 },
};

/** Intersections where ghosts may not choose UP (arcade rule). */
export const NO_UP = new Set(["12,9", "15,9", "12,21", "15,21"]);

export const GHOST_COLOR: Record<GhostId, string> = {
  blinky: "#ff2a2a",
  pinky: "#ffb8ff",
  inky: "#00e5e5",
  clyde: "#ffb851",
};

export const GHOST_NICK: Record<GhostId, { nick: string; name: string }> = {
  blinky: { nick: "SHADOW", name: "BLINKY" },
  pinky: { nick: "SPEEDY", name: "PINKY" },
  inky: { nick: "BASHFUL", name: "INKY" },
  clyde: { nick: "POKEY", name: "CLYDE" },
};

export const COLOR = {
  bg: "#000000",
  wall: "#2121de",
  wallFlash: "#f2efe6",
  pellet: "#ffb897",
  pac: "#ffe14a",
  door: "#ffb8ff",
  fright: "#2121de",
  frightFace: "#ffb8ff",
  frightWhite: "#f2efe6",
  frightWhiteFace: "#ff2a2a",
  text: "#f2efe6",
  muted: "#deba7b",
  score: "#00e5e5",
} as const;

/** Base speed in tiles / second at 100%. Arcade ~ 75.75 px/s at 8px tiles = 9.47 t/s. */
export const BASE_SPEED = 9.5;

export const STEP = 1 / 60;
export const STEP_CAP = 0.1;

export const READY_TIME = 2.2;
export const DEATH_TIME = 1.8;
export const GHOST_PAUSE = 0.7;
export const LEVEL_FLASH = 1.6;
export const FRUIT_TIME = 9.5;

export const EXTRA_LIFE_AT = 10000;

export const FRUIT_VALUES = [100, 300, 500, 500, 700, 700, 1000, 1000, 2000, 2000, 3000, 3000, 5000];
export const FRUIT_AT = [70, 170];

export const GHOST_SCORES = [200, 400, 800, 1600];

/** Scatter/chase wave durations in seconds (level 1–4). Last chase is infinite. */
export const WAVES_L1 = [7, 20, 7, 20, 5, 20, 5, Infinity];
export const WAVES_L2 = [7, 20, 7, 20, 5, 1033, 1 / 60, Infinity];
export const WAVES_L5 = [5, 20, 5, 20, 5, 1037, 1 / 60, Infinity];

export function wavesFor(level: number): number[] {
  if (level <= 1) return WAVES_L1;
  if (level <= 4) return WAVES_L2;
  return WAVES_L5;
}

export function speedsFor(level: number): {
  pac: number;
  ghost: number;
  pacFright: number;
  ghostFright: number;
  tunnel: number;
  elroy1: number;
  elroy2: number;
  elroyDots1: number;
  elroyDots2: number;
} {
  const L = level;
  if (L === 1) {
    return {
      pac: 0.8,
      ghost: 0.75,
      pacFright: 0.9,
      ghostFright: 0.5,
      tunnel: 0.4,
      elroy1: 0.8,
      elroy2: 0.85,
      elroyDots1: 20,
      elroyDots2: 10,
    };
  }
  if (L <= 4) {
    return {
      pac: 0.9,
      ghost: 0.85,
      pacFright: 0.95,
      ghostFright: 0.55,
      tunnel: 0.45,
      elroy1: 0.9,
      elroy2: 0.95,
      elroyDots1: L === 2 ? 30 : 40,
      elroyDots2: L === 2 ? 15 : 20,
    };
  }
  if (L <= 20) {
    return {
      pac: 1,
      ghost: 0.95,
      pacFright: 1,
      ghostFright: 0.6,
      tunnel: 0.5,
      elroy1: 1,
      elroy2: 1.05,
      elroyDots1: 40,
      elroyDots2: 20,
    };
  }
  return {
    pac: 0.9,
    ghost: 0.95,
    pacFright: 0.9,
    ghostFright: 0,
    tunnel: 0.5,
    elroy1: 1,
    elroy2: 1.05,
    elroyDots1: 0,
    elroyDots2: 0,
  };
}

export function frightTime(level: number): number {
  const table = [0, 6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1, 0];
  if (level >= 19) return 0;
  return table[level] ?? 1;
}

export function dotsToLeave(id: GhostId, level: number): number {
  if (id === "blinky") return 0;
  if (id === "pinky") return 0;
  if (id === "inky") return level === 1 ? 30 : 0;
  return level === 1 ? 90 : level === 2 ? 50 : 0;
}

export const SAVE_KEY = "pacman.v1";
export const SAVE_VERSION = 1;
