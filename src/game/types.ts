export const UP = 0;
export const LEFT = 1;
export const DOWN = 2;
export const RIGHT = 3;

export type Dir = 0 | 1 | 2 | 3;

export const DX = [0, -1, 0, 1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const REVERSE: Dir[] = [DOWN, RIGHT, UP, LEFT];

export const TILE = {
  WALL: 0,
  PELLET: 1,
  POWER: 2,
  EMPTY: 3,
  DOOR: 4,
  HOUSE: 5,
  VOID: 6,
} as const;

export type Tile = (typeof TILE)[keyof typeof TILE];

export type GhostId = "blinky" | "pinky" | "inky" | "clyde";

export type GhostPhase = "house" | "leave" | "out" | "frightened" | "eyes" | "enter";

export type GlobalMode = "scatter" | "chase";

export type PlayState =
  | "title"
  | "ready"
  | "playing"
  | "paused"
  | "dying"
  | "ghostpause"
  | "levelclear"
  | "gameover";

export interface Actor {
  x: number;
  y: number;
  dir: Dir;
  nextDir: Dir;
}

export interface Ghost extends Actor {
  id: GhostId;
  phase: GhostPhase;
  frightLeft: number;
  bob: number;
}

export interface Fruit {
  alive: boolean;
  x: number;
  y: number;
  kind: number;
  left: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
