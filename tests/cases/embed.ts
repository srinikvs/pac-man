import { COLS, ROWS, TUNNEL_ROW } from "../../src/game/constants.ts";
import { TILE, type GhostPhase, type Tile } from "../../src/game/types.ts";

export function tileAtPos(grid: Tile[][], x: number, y: number): Tile | null {
  const col = Math.round(x - 0.5);
  const row = Math.round(y - 0.5);
  if (row < 0 || row >= ROWS) return TILE.WALL;
  if (col < 0 || col >= COLS) return row === TUNNEL_ROW ? TILE.EMPTY : TILE.WALL;
  return grid[row]?.[col] ?? TILE.WALL;
}

/** True when an actor's tile-center is inside a solid wall / void (not house, door, or tunnel). */
export function isWallEmbed(grid: Tile[][], x: number, y: number): boolean {
  const t = tileAtPos(grid, x, y);
  return t === TILE.WALL || t === TILE.VOID;
}

export function isIllegalOutTile(grid: Tile[][], x: number, y: number, phase: GhostPhase): boolean {
  if (isWallEmbed(grid, x, y)) return true;
  if (phase !== "out" && phase !== "frightened") return false;
  const t = tileAtPos(grid, x, y);
  return t === TILE.HOUSE || t === TILE.DOOR;
}
