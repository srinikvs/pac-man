import { COLS, ROWS, TUNNEL_ROW } from "./constants";
import { TILE, type Tile } from "./types";

/**
 * Canonical arcade maze. 28×31.
 * # wall  . pellet  o power  = empty  - door  H house  space void
 */
const RAW = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "     #.#####.##.#####.#     ",
  "     #.##==========##.#     ",
  "     #.##=###--###=##.#     ",
  "######.##=#HHHHHH#=##.######",
  "==========#HHHHHH#==========",
  "######.##=#HHHHHH#=##.######",
  "     #.##=########=##.#     ",
  "     #.##==========##.#     ",
  "     #.##=########=##.#     ",
  "######.##=########=##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......==.......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
] as const;

const CHAR: Record<string, Tile> = {
  "#": TILE.WALL,
  ".": TILE.PELLET,
  o: TILE.POWER,
  "=": TILE.EMPTY,
  "-": TILE.DOOR,
  H: TILE.HOUSE,
  " ": TILE.VOID,
};

function parse(raw: readonly string[]): Tile[][] {
  if (raw.length !== ROWS) throw new Error(`maze rows ${raw.length}`);
  return raw.map((line, y) => {
    if (line.length !== COLS) throw new Error(`maze row ${y} len ${line.length}`);
    return [...line].map((ch) => {
      const t = CHAR[ch];
      if (t === undefined) throw new Error(`bad maze char '${ch}' at row ${y}`);
      return t;
    });
  });
}

export function makeMaze(): Tile[][] {
  return parse(RAW).map((row) => row.slice());
}

export function countPellets(grid: Tile[][]): number {
  let n = 0;
  for (const row of grid) {
    for (const t of row) {
      if (t === TILE.PELLET || t === TILE.POWER) n += 1;
    }
  }
  return n;
}

export function isWallTile(t: Tile): boolean {
  return t === TILE.WALL;
}

export function isCorridor(t: Tile): boolean {
  return t === TILE.PELLET || t === TILE.POWER || t === TILE.EMPTY;
}

export function wrapCol(col: number): number {
  if (col < 0) return col + COLS;
  if (col >= COLS) return col - COLS;
  return col;
}

export function inBounds(col: number, row: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

export type Who = "pac" | "ghost" | "eyes";

export function tileAt(grid: Tile[][], col: number, row: number): Tile {
  if (row < 0 || row >= ROWS) return TILE.WALL;
  if (col < 0 || col >= COLS) {
    return row === TUNNEL_ROW ? TILE.EMPTY : TILE.WALL;
  }
  return grid[row]![col]!;
}

export function canEnter(grid: Tile[][], col: number, row: number, who: Who): boolean {
  if (row < 0 || row >= ROWS) return false;
  if (col < 0 || col >= COLS) return row === TUNNEL_ROW;
  const t = grid[row]![col]!;
  if (t === TILE.WALL || t === TILE.VOID) return false;
  if (who === "pac") return t !== TILE.DOOR && t !== TILE.HOUSE;
  if (who === "eyes") return true;
  // ghost: house/door only while leaving/entering (caller uses who="eyes" or a flag)
  return t !== TILE.DOOR && t !== TILE.HOUSE;
}

export function centerTile(x: number, y: number): { col: number; row: number } {
  return { col: Math.round(x - 0.5), row: Math.round(y - 0.5) };
}

export function nearCenter(p: number, eps = 0.18): boolean {
  return Math.abs(p - Math.floor(p) - 0.5) < eps;
}

export function snapCenter(p: number): number {
  return Math.round(p - 0.5) + 0.5;
}
