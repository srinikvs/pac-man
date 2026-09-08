import {
  COLOR,
  COLS,
  DOOR_COL,
  GHOST_COLOR,
  HUD_TOP,
  ROWS,
  TILE_PX,
  TUNNEL_ROW,
  VIEW_H,
  VIEW_W,
} from "./constants";
import { isCorridor, tileAt } from "./maze";
import { DOWN, DX, DY, LEFT, RIGHT, TILE, UP, type Dir, type Ghost } from "./types";
import type { PacmanSim } from "./sim";

export function drawFrame(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  const reduce =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shake = !reduce && sim.trauma > 0 ? sim.trauma * sim.trauma * 3.2 : 0;
  const ox = shake ? (Math.random() * 2 - 1) * shake : 0;
  const oy = shake ? (Math.random() * 2 - 1) * shake : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  ctx.translate(ox, oy + HUD_TOP * TILE_PX);

  drawMaze(ctx, sim);
  if (sim.fruit.alive) drawFruit(ctx, sim.fruit.x, sim.fruit.y, sim.fruit.kind);
  drawPellets(ctx, sim);
  if (sim.state !== "levelclear" && sim.state !== "dying") {
    for (const g of sim.ghosts) {
      if (sim.state === "ghostpause" && g.phase !== "eyes") continue;
      drawGhost(ctx, g, sim);
    }
  }
  if (sim.state !== "ghostpause") drawPac(ctx, sim);
  drawParticles(ctx, sim);
  drawFloaters(ctx, sim);

  ctx.restore();
  drawHud(ctx, sim);
}


function drawMaze(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  const flashing = sim.state === "levelclear" && Math.floor(sim.flashLeft * 8) % 2 === 0;
  const wall = flashing ? COLOR.wallFlash : COLOR.wall;
  ctx.strokeStyle = wall;
  ctx.lineWidth = 2;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";

  const T = TILE_PX;
  const inset = 3.5;
  const rad = 4;

  ctx.beginPath();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(sim.grid, x, y);
      if (!isCorridor(t) && t !== TILE.DOOR) continue;
      const n = neighborBlocks(sim, x, y - 1, y);
      const s = neighborBlocks(sim, x, y + 1, y);
      const w = neighborBlocks(sim, x - 1, y, y);
      const e = neighborBlocks(sim, x + 1, y, y);
      const x0 = x * T + inset;
      const y0 = y * T + inset;
      const x1 = x * T + T - inset;
      const y1 = y * T + T - inset;

      if (n) {
        ctx.moveTo(w ? x0 + rad : x0, y0);
        ctx.lineTo(e ? x1 - rad : x1, y0);
        if (w) ctx.arc(x0 + rad, y0 + rad, rad, -Math.PI / 2, Math.PI, true);
        if (e) ctx.arc(x1 - rad, y0 + rad, rad, -Math.PI / 2, 0, false);
      }
      if (s) {
        ctx.moveTo(w ? x0 + rad : x0, y1);
        ctx.lineTo(e ? x1 - rad : x1, y1);
        if (w) ctx.arc(x0 + rad, y1 - rad, rad, Math.PI / 2, Math.PI, false);
        if (e) ctx.arc(x1 - rad, y1 - rad, rad, Math.PI / 2, 0, true);
      }
      if (w) {
        const ty = n ? y0 + rad : y0;
        const by = s ? y1 - rad : y1;
        if (by > ty) {
          ctx.moveTo(x0, ty);
          ctx.lineTo(x0, by);
        }
      }
      if (e) {
        const ty = n ? y0 + rad : y0;
        const by = s ? y1 - rad : y1;
        if (by > ty) {
          ctx.moveTo(x1, ty);
          ctx.lineTo(x1, by);
        }
      }
    }
  }
  ctx.stroke();

  ctx.strokeStyle = COLOR.door;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  const doorX = (DOOR_COL - 1) * T;
  const doorY = 12 * T + T * 0.42;
  ctx.moveTo(doorX + 6, doorY);
  ctx.lineTo(doorX + T * 2 - 6, doorY);
  ctx.stroke();
}


function neighborBlocks(sim: PacmanSim, col: number, row: number, fromRow: number): boolean {
  if (row < 0 || row >= ROWS) return true;
  if (col < 0 || col >= COLS) {
    return fromRow !== TUNNEL_ROW;
  }
  const t = tileAt(sim.grid, col, row);
  if (t === TILE.DOOR) return false;
  return !isCorridor(t);
}

function drawPellets(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  const blink = Math.floor(sim.powerBlink * 4) % 2 === 0;
  ctx.fillStyle = COLOR.pellet;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(sim.grid, x, y);
      const cx = x * TILE_PX + TILE_PX / 2;
      const cy = y * TILE_PX + TILE_PX / 2;
      if (t === TILE.PELLET) {
        ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
      } else if (t === TILE.POWER && blink) {
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function actorPx(x: number, y: number): { px: number; py: number } {
  return { px: x * TILE_PX, py: y * TILE_PX };
}

function drawPac(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  const { px, py } = actorPx(sim.pac.x, sim.pac.y);
  const r = 7.2;
  ctx.fillStyle = COLOR.pac;

  if (sim.state === "dying") {
    const t = sim.deathAnim;
    const start = -Math.PI / 2 + t * Math.PI * 1.15;
    const end = -Math.PI / 2 - t * Math.PI * 1.15 + Math.PI * 2;
    if (t > 0.92) return;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, start, end, false);
    ctx.closePath();
    ctx.fill();
    return;
  }

  const chomp = 0.12 + (Math.sin(sim.mouth) * 0.5 + 0.5) * 0.55;
  const moving = sim.state === "playing" || sim.state === "ready";
  const mouth = moving ? chomp : 0.35;
  const rot = dirAngle(sim.pac.dir);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (sim.pac.x < 1) {
    drawPacAt(ctx, sim, px + COLS * TILE_PX, py, r, mouth, rot);
  } else if (sim.pac.x > COLS - 1) {
    drawPacAt(ctx, sim, px - COLS * TILE_PX, py, r, mouth, rot);
  }
}

function drawPacAt(
  ctx: CanvasRenderingContext2D,
  _sim: PacmanSim,
  px: number,
  py: number,
  r: number,
  mouth: number,
  rot: number,
): void {
  ctx.fillStyle = COLOR.pac;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dirAngle(dir: Dir): number {
  switch (dir) {
    case RIGHT:
      return 0;
    case DOWN:
      return Math.PI / 2;
    case LEFT:
      return Math.PI;
    case UP:
      return -Math.PI / 2;
  }
}

function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, sim: PacmanSim): void {
  const { px, py } = actorPx(g.x, g.y);
  drawGhostSprite(ctx, px, py, g, sim);
  if (g.x < 1) drawGhostSprite(ctx, px + COLS * TILE_PX, py, g, sim);
  if (g.x > COLS - 1) drawGhostSprite(ctx, px - COLS * TILE_PX, py, g, sim);
}

function drawGhostSprite(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  g: Ghost,
  sim: PacmanSim,
): void {
  const r = 7.2;
  const eyesOnly = g.phase === "eyes" || g.phase === "enter";
  const fright = g.phase === "frightened";
  const flash = fright && sim.frightFlash();

  if (!eyesOnly) {
    ctx.fillStyle = fright ? (flash ? COLOR.frightWhite : COLOR.fright) : GHOST_COLOR[g.id];
    ctx.beginPath();
    ctx.arc(px, py - 1, r, Math.PI, 0, false);
    ctx.lineTo(px + r, py + r);
    const scallops = 4;
    const w = r * 2;
    for (let i = scallops; i >= 0; i--) {
      const sx = px - r + (w * i) / scallops;
      const sy = py + r + ((i % 2 === 0 ? -1 : 1) * 1.6);
      ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  }

  const lookX = DX[g.dir]! * 1.4;
  const lookY = DY[g.dir]! * 1.4;
  const eyeOff = 2.6;
  const eyes: [number, number][] = [
    [px - eyeOff, py - 2.2],
    [px + eyeOff, py - 2.2],
  ];

  if (fright && !eyesOnly) {
    ctx.fillStyle = flash ? COLOR.frightWhiteFace : COLOR.frightFace;
    for (const [ex, ey] of eyes) {
      ctx.beginPath();
      ctx.arc(ex, ey, 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = flash ? COLOR.frightWhiteFace : COLOR.frightFace;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const wy = py + 3.2;
    ctx.moveTo(px - 4, wy);
    ctx.quadraticCurveTo(px - 2, wy + 2, px, wy);
    ctx.quadraticCurveTo(px + 2, wy + 2, px + 4, wy);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = "#ffffff";
  for (const [ex, ey] of eyes) {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.1, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#2121de";
  for (const [ex, ey] of eyes) {
    ctx.beginPath();
    ctx.arc(ex + lookX, ey + lookY, 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFruit(ctx: CanvasRenderingContext2D, x: number, y: number, kind: number): void {
  const { px, py } = actorPx(x, y);
  const k = kind % 8;
  if (k === 0) {
    // cherry
    ctx.fillStyle = "#e02020";
    ctx.beginPath();
    ctx.arc(px - 3, py + 2, 3.4, 0, Math.PI * 2);
    ctx.arc(px + 3, py + 3, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3aa05a";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px - 2, py);
    ctx.quadraticCurveTo(px, py - 8, px + 5, py - 5);
    ctx.stroke();
  } else if (k === 1) {
    ctx.fillStyle = "#ff4d6a";
    ctx.beginPath();
    ctx.moveTo(px, py + 6);
    ctx.bezierCurveTo(px + 7, py + 2, px + 6, py - 6, px, py - 5);
    ctx.bezierCurveTo(px - 6, py - 6, px - 7, py + 2, px, py + 6);
    ctx.fill();
    ctx.fillStyle = "#3aa05a";
    ctx.fillRect(px - 1, py - 7, 2, 4);
  } else if (k === 2 || k === 3) {
    ctx.fillStyle = "#ff9a2e";
    ctx.beginPath();
    ctx.arc(px, py + 1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3aa05a";
    ctx.fillRect(px - 1, py - 7, 2, 4);
  } else if (k === 4 || k === 5) {
    ctx.fillStyle = "#e02020";
    ctx.beginPath();
    ctx.arc(px, py + 1, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2efe6";
    ctx.fillRect(px - 1, py - 1, 2, 2);
  } else {
    ctx.fillStyle = k === 6 ? "#3aa05a" : k === 7 ? "#ffb851" : "#00e5e5";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  for (const p of sim.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const { px, py } = actorPx(p.x, p.y);
    ctx.fillRect(px, py, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawFloaters(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of sim.floaters) {
    const a = f.life / f.max;
    ctx.globalAlpha = Math.min(1, a * 1.4);
    const { px, py } = actorPx(f.x, f.y - (1 - a) * 1.2);
    ctx.fillStyle = COLOR.score;
    ctx.fillText(f.text, px, py);
    ctx.globalAlpha = 1;
  }
}

function drawHud(ctx: CanvasRenderingContext2D, sim: PacmanSim): void {
  ctx.font = "8px 'Press Start 2P', ui-monospace, monospace";
  ctx.textBaseline = "top";

  ctx.textAlign = "left";
  ctx.fillStyle = "#deba7b";
  ctx.fillText("1UP", 18, 6);
  ctx.fillStyle = COLOR.text;
  ctx.fillText(pad(sim.score), 18, 22);

  ctx.textAlign = "center";
  ctx.fillStyle = "#deba7b";
  ctx.fillText("HIGH SCORE", VIEW_W / 2, 6);
  ctx.fillStyle = COLOR.text;
  ctx.fillText(pad(sim.highScore), VIEW_W / 2, 22);

  const livesY = VIEW_H - TILE_PX * 1.15;
  const n = Math.max(0, sim.lives);
  for (let i = 0; i < Math.min(n, 5); i++) {
    drawLife(ctx, 22 + i * 18, livesY);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#deba7b";
  ctx.fillText(`LVL ${sim.level}`, VIEW_W - 12, VIEW_H - 20);

  if (sim.state === "ready") {
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.pac;
    ctx.font = "12px 'Press Start 2P', ui-monospace, monospace";
    ctx.fillText("READY!", VIEW_W / 2, (HUD_TOP + 17.2) * TILE_PX);
  }
  if (sim.state === "gameover") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff2a2a";
    ctx.font = "12px 'Press Start 2P', ui-monospace, monospace";
    ctx.fillText("GAME OVER", VIEW_W / 2, (HUD_TOP + 17.2) * TILE_PX);
  }
}

function drawLife(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLOR.pac;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, 6, 0.45, Math.PI * 2 - 0.45, false);
  ctx.closePath();
  ctx.fill();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
