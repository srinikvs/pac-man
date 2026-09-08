import {
  BASE_SPEED,
  BLINKY_SPAWN,
  CLYDE_SPAWN,
  DEATH_TIME,
  dotsToLeave,
  EXTRA_LIFE_AT,
  FRUIT_AT,
  FRUIT_TIME,
  FRUIT_VALUES,
  frightTime,
  GHOST_PAUSE,
  GHOST_SCORES,
  HOUSE_CENTER,
  HOUSE_EXIT,
  INKY_SPAWN,
  LEVEL_FLASH,
  NO_UP,
  PAC_SPAWN,
  PINKY_SPAWN,
  READY_TIME,
  SCATTER,
  speedsFor,
  STEP,
  TUNNEL_ROW,
  wavesFor,
} from "./constants";
import {
  canEnter,
  centerTile,
  countPellets,
  makeMaze,
  nearCenter,
  snapCenter,
  tileAt,
  wrapCol,
  type Who,
} from "./maze";
import { TILE, type Tile } from "./types";
import {
  DOWN,
  DX,
  DY,
  LEFT,
  REVERSE,
  RIGHT,
  UP,
  type Actor,
  type Dir,
  type Floater,
  type Fruit,
  type Ghost,
  type GhostId,
  type GlobalMode,
  type Particle,
  type PlayState,
} from "./types";
import { ArcadeAudio } from "./audio";
import { loadSave, writeSave } from "./save";
import { useHud } from "./store";

const GHOST_IDS: GhostId[] = ["blinky", "pinky", "inky", "clyde"];

export class PacmanSim {
  grid: Tile[][] = makeMaze();
  pac: Actor = { ...PAC_SPAWN, nextDir: PAC_SPAWN.dir };
  ghosts: Ghost[] = [];
  fruit: Fruit = { alive: false, x: 14, y: 17.5, kind: 0, left: 0 };
  floaters: Floater[] = [];
  particles: Particle[] = [];

  state: PlayState = "title";
  score = 0;
  highScore = 0;
  lives = 3;
  level = 1;
  pelletsLeft = 0;
  pelletsEaten = 0;
  totalPellets = 0;
  ghostCombo = 0;
  extraGiven = false;
  muted = false;

  mode: GlobalMode = "scatter";
  waveIndex = 0;
  waveLeft = 0;
  frightLeft = 0;
  readyLeft = 0;
  deathLeft = 0;
  deathAnim = 0;
  ghostPauseLeft = 0;
  flashLeft = 0;
  fruitTriggers = new Set<number>();

  trauma = 0;
  acc = 0;
  tick = 0;
  mouth = 0;
  powerBlink = 0;

  audio = new ArcadeAudio();
  pendingDir: Dir | null = null;

  constructor() {
    const s = loadSave();
    this.highScore = s.highScore;
    this.muted = s.muted;
    this.audio.setMuted(s.muted);
    this.resetLevel(true);
    this.syncHud();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audio.setMuted(muted);
    writeSave({ muted });
    this.syncHud();
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  startGame(): void {
    try {
      this.audio.unlock();
      this.audio.intro();
    } catch {
      /* AudioContext can throw on some mobile browsers; never block play. */
    }
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.extraGiven = false;
    this.resetLevel(true);
    this.state = "ready";
    this.readyLeft = READY_TIME;
    this.syncHud();
  }

  togglePause(): void {
    if (this.state === "playing") {
      this.state = "paused";
      this.audio.stopSiren();
      this.syncHud();
    } else if (this.state === "paused") {
      this.state = "playing";
      this.syncHud();
    }
  }

  setDir(dir: Dir): void {
    this.pendingDir = dir;
    this.pac.nextDir = dir;
    if (dir === REVERSE[this.pac.dir] && (this.state === "playing" || this.state === "ready")) {
      this.pac.dir = dir;
    }
  }

  update(dt: number): void {
    const cap = Math.min(dt, 0.1);
    this.acc += cap;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step(STEP);
    }
    this.trauma = Math.max(0, this.trauma - cap * 2.2);
  }

  private step(dt: number): void {
    this.tick += 1;
    this.mouth += dt * (this.state === "playing" ? 12 : 6);
    this.powerBlink += dt;

    if (this.state === "title") {
      this.audio.setSiren("off");
      return;
    }
    if (this.state === "paused" || this.state === "gameover") {
      this.audio.setSiren("off");
      return;
    }
    if (this.state === "ready") {
      this.audio.setSiren("off");
      this.readyLeft -= dt;
      if (this.readyLeft <= 0) {
        this.state = "playing";
        this.syncHud();
      }
      return;
    }
    if (this.state === "dying") {
      this.audio.setSiren("off");
      this.deathLeft -= dt;
      this.deathAnim = 1 - this.deathLeft / DEATH_TIME;
      if (this.deathLeft <= 0) this.afterDeath();
      return;
    }
    if (this.state === "ghostpause") {
      this.ghostPauseLeft -= dt;
      this.advanceFloaters(dt);
      if (this.ghostPauseLeft <= 0) this.state = "playing";
      return;
    }
    if (this.state === "levelclear") {
      this.audio.setSiren("off");
      this.flashLeft -= dt;
      if (this.flashLeft <= 0) this.nextLevel();
      return;
    }

    this.advanceModes(dt);
    this.movePac(dt);
    for (const g of this.ghosts) this.moveGhost(g, dt);
    this.updateFruit(dt);
    this.advanceFloaters(dt);
    this.advanceParticles(dt);
    this.checkCollisions();
    this.updateSiren();
  }

  private resetLevel(full: boolean): void {
    this.grid = makeMaze();
    this.totalPellets = countPellets(this.grid);
    this.pelletsLeft = this.totalPellets;
    this.pelletsEaten = 0;
    this.fruitTriggers = new Set();
    this.fruit.alive = false;
    this.floaters = [];
    this.particles = [];
    this.waveIndex = 0;
    this.mode = "scatter";
    this.waveLeft = wavesFor(this.level)[0] ?? 7;
    this.frightLeft = 0;
    this.ghostCombo = 0;
    this.resetActors(full);
  }

  private resetActors(_full: boolean): void {
    this.pac = { x: PAC_SPAWN.x, y: PAC_SPAWN.y, dir: PAC_SPAWN.dir, nextDir: PAC_SPAWN.dir };
    this.pendingDir = PAC_SPAWN.dir;
    this.ghosts = [
      spawnGhost("blinky", BLINKY_SPAWN, "out"),
      spawnGhost("pinky", PINKY_SPAWN, "house"),
      spawnGhost("inky", INKY_SPAWN, "house"),
      spawnGhost("clyde", CLYDE_SPAWN, "house"),
    ];
    this.deathAnim = 0;
  }

  private afterDeath(): void {
    this.lives -= 1;
    if (this.lives < 0) {
      this.state = "gameover";
      this.persistHigh();
      this.syncHud();
      return;
    }
    this.resetActors(false);
    this.frightLeft = 0;
    this.state = "ready";
    this.readyLeft = READY_TIME;
    this.syncHud();
  }

  private nextLevel(): void {
    this.level += 1;
    this.resetLevel(true);
    this.state = "ready";
    this.readyLeft = READY_TIME;
    this.syncHud();
  }

  private persistHigh(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      writeSave({ highScore: this.highScore });
    }
  }

  private addScore(n: number): void {
    const before = this.score;
    this.score += n;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      writeSave({ highScore: this.highScore });
    }
    if (!this.extraGiven && before < EXTRA_LIFE_AT && this.score >= EXTRA_LIFE_AT) {
      this.extraGiven = true;
      this.lives += 1;
      this.audio.extraLife();
    }
    this.syncHud();
  }

  private advanceModes(dt: number): void {
    if (this.frightLeft > 0) {
      this.frightLeft -= dt;
      if (this.frightLeft <= 0) {
        this.frightLeft = 0;
        this.ghostCombo = 0;
        for (const g of this.ghosts) {
          if (g.phase === "frightened") {
            g.phase = "out";
            reverse(g);
          }
        }
      }
      return;
    }
    const waves = wavesFor(this.level);
    const dur = waves[this.waveIndex] ?? Infinity;
    if (!Number.isFinite(dur)) {
      this.mode = "chase";
      return;
    }
    this.waveLeft -= dt;
    if (this.waveLeft <= 0) {
      this.waveIndex = Math.min(this.waveIndex + 1, waves.length - 1);
      this.waveLeft = waves[this.waveIndex] ?? Infinity;
      const next: GlobalMode = this.waveIndex % 2 === 0 ? "scatter" : "chase";
      if (next !== this.mode) {
        this.mode = next;
        for (const g of this.ghosts) {
          if (g.phase === "out") reverse(g);
        }
      }
    }
  }

  private elroy(): 0 | 1 | 2 {
    const s = speedsFor(this.level);
    if (this.pelletsLeft <= s.elroyDots2) return 2;
    if (this.pelletsLeft <= s.elroyDots1) return 1;
    return 0;
  }

  private pacSpeed(): number {
    const s = speedsFor(this.level);
    const f = this.frightLeft > 0 ? s.pacFright : s.pac;
    return BASE_SPEED * f;
  }

  private ghostSpeed(g: Ghost): number {
    const s = speedsFor(this.level);
    if (g.phase === "eyes" || g.phase === "enter") return BASE_SPEED * 1.5;
    if (g.phase === "house" || g.phase === "leave") return BASE_SPEED * 0.4;
    const { col } = centerTile(g.x, g.y);
    const inTunnel = Math.round(g.y - 0.5) === TUNNEL_ROW && (col <= 4 || col >= 23 || g.x < 0 || g.x > 28);
    if (inTunnel) return BASE_SPEED * s.tunnel;
    if (g.phase === "frightened") return BASE_SPEED * (s.ghostFright || 0.5);
    if (g.id === "blinky") {
      const e = this.elroy();
      if (e === 2) return BASE_SPEED * s.elroy2;
      if (e === 1) return BASE_SPEED * s.elroy1;
    }
    return BASE_SPEED * s.ghost;
  }

  private whoFor(g: Ghost): Who {
    if (g.phase === "eyes" || g.phase === "enter" || g.phase === "leave" || g.phase === "house") return "eyes";
    return "ghost";
  }

  private movePac(dt: number): void {
    if (this.pendingDir !== null) this.pac.nextDir = this.pendingDir;
    if (this.pac.nextDir === REVERSE[this.pac.dir]) this.pac.dir = this.pac.nextDir;
    this.advance(this.pac, this.pacSpeed() * dt, "pac", true);
    this.eatAtPac();
  }

  private eatAtPac(): void {
    const { col, row } = centerTile(this.pac.x, this.pac.y);
    const t = tileAt(this.grid, wrapCol(col), row);
    if (t === TILE.PELLET || t === TILE.POWER) {
      const c = wrapCol(col);
      if (c >= 0 && c < 28 && this.grid[row]) {
        this.grid[row]![c] = TILE.EMPTY;
        this.pelletsLeft -= 1;
        this.pelletsEaten += 1;
        if (t === TILE.POWER) {
          this.addScore(50);
          this.audio.power();
          this.activateFright();
          this.burst(this.pac.x, this.pac.y, "#ffe14a", 10);
        } else {
          this.addScore(10);
          this.audio.munch();
        }
        if (FRUIT_AT.includes(this.pelletsEaten) && !this.fruitTriggers.has(this.pelletsEaten)) {
          this.fruitTriggers.add(this.pelletsEaten);
          this.spawnFruit();
        }
        if (this.pelletsLeft <= 0) {
          this.state = "levelclear";
          this.flashLeft = LEVEL_FLASH;
          this.audio.stopSiren();
          this.syncHud();
        }
      }
    }
  }

  private activateFright(): void {
    const t = frightTime(this.level);
    if (t <= 0) return;
    this.frightLeft = t;
    this.ghostCombo = 0;
    for (const g of this.ghosts) {
      if (g.phase === "out") {
        g.phase = "frightened";
        g.frightLeft = t;
        reverse(g);
      }
    }
  }

  private spawnFruit(): void {
    const kind = Math.min(this.level - 1, FRUIT_VALUES.length - 1);
    this.fruit = { alive: true, x: 14, y: 17.5, kind, left: FRUIT_TIME };
  }

  private updateFruit(dt: number): void {
    if (!this.fruit.alive) return;
    this.fruit.left -= dt;
    if (this.fruit.left <= 0) {
      this.fruit.alive = false;
      return;
    }
    if (Math.hypot(this.pac.x - this.fruit.x, this.pac.y - this.fruit.y) < 0.8) {
      const value = FRUIT_VALUES[this.fruit.kind] ?? 100;
      this.addScore(value);
      this.audio.fruit();
      this.floaters.push({
        x: this.fruit.x,
        y: this.fruit.y,
        text: String(value),
        life: 1.1,
        max: 1.1,
      });
      this.burst(this.fruit.x, this.fruit.y, "#ff2a2a", 8);
      this.fruit.alive = false;
    }
  }

  private moveGhost(g: Ghost, dt: number): void {
    g.bob += dt * 3;
    if (g.phase === "house") {
      g.y = HOUSE_CENTER.y + Math.sin(g.bob * 2) * 0.35;
      if (this.pelletsEaten >= dotsToLeave(g.id, this.level)) {
        g.phase = "leave";
        g.x = g.id === "inky" ? 12 : g.id === "clyde" ? 16 : 14;
        g.y = HOUSE_CENTER.y;
        g.dir = UP;
      }
      return;
    }
    if (g.phase === "leave") {
      const speed = this.ghostSpeed(g) * dt;
      if (Math.abs(g.x - HOUSE_EXIT.x) > 0.05) {
        g.x += Math.sign(HOUSE_EXIT.x - g.x) * Math.min(speed, Math.abs(HOUSE_EXIT.x - g.x));
        g.dir = g.x < HOUSE_EXIT.x ? RIGHT : LEFT;
      } else {
        g.x = HOUSE_EXIT.x;
        if (g.y > HOUSE_EXIT.y) {
          g.y -= Math.min(speed, g.y - HOUSE_EXIT.y);
          g.dir = UP;
        } else {
          g.y = HOUSE_EXIT.y;
          g.phase = this.frightLeft > 0 ? "frightened" : "out";
          g.dir = LEFT;
        }
      }
      return;
    }
    if (g.phase === "enter") {
      const speed = this.ghostSpeed(g) * dt;
      if (g.y < HOUSE_CENTER.y) {
        g.x = HOUSE_EXIT.x;
        g.y += Math.min(speed, HOUSE_CENTER.y - g.y);
        g.dir = DOWN;
      } else {
        g.y = HOUSE_CENTER.y;
        g.phase = "leave";
      }
      return;
    }

    const who = this.whoFor(g);
    if (nearCenter(g.x) && nearCenter(g.y)) {
      g.x = snapCenter(g.x);
      g.y = snapCenter(g.y);
      const next = this.pickGhostDir(g);
      g.dir = next;
    } else if (g.phase !== "eyes") {
      // corridors: allow 180 only on reverse-mode already applied
    }
    this.advance(g, this.ghostSpeed(g) * dt, who);

    if (g.phase === "eyes") {
      const d = Math.hypot(g.x - HOUSE_EXIT.x, g.y - HOUSE_EXIT.y);
      if (d < 0.45) {
        g.x = HOUSE_EXIT.x;
        g.y = HOUSE_EXIT.y;
        g.phase = "enter";
      }
    }
  }

  private pickGhostDir(g: Ghost): Dir {
    const { col, row } = centerTile(g.x, g.y);
    const who = this.whoFor(g);
    const rev = REVERSE[g.dir]!;
    const options: Dir[] = [];
    for (const dir of [UP, LEFT, DOWN, RIGHT] as Dir[]) {
      if (dir === rev) continue;
      if (dir === UP && NO_UP.has(`${col},${row}`) && g.phase !== "eyes" && g.phase !== "frightened") continue;
      const nc = col + DX[dir]!;
      const nr = row + DY[dir]!;
      if (canEnter(this.grid, nc, nr, who)) options.push(dir);
    }
    if (options.length === 0) return rev;

    if (g.phase === "frightened") {
      return options[(Math.random() * options.length) | 0]!;
    }

    const target = this.ghostTarget(g);
    let best = options[0]!;
    let bestD = Infinity;
    for (const dir of options) {
      const nx = col + DX[dir]! + 0.5;
      const ny = row + DY[dir]! + 0.5;
      const d = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      if (d + 1e-6 < bestD) {
        bestD = d;
        best = dir;
      }
    }
    return best;
  }

  private ghostTarget(g: Ghost): { x: number; y: number } {
    if (g.phase === "eyes") return HOUSE_EXIT;
    const elroy = g.id === "blinky" && this.elroy() > 0;
    const scatter = this.mode === "scatter" && !elroy && g.phase === "out";
    if (scatter) return SCATTER[g.id];
    const pac = this.pac;
    const pcol = pac.x;
    const prow = pac.y;
    const ahead = (n: number) => ({ x: pac.x + DX[pac.dir]! * n, y: pac.y + DY[pac.dir]! * n });
    if (g.id === "blinky") return { x: pcol, y: prow };
    if (g.id === "pinky") {
      const a = ahead(4);
      if (pac.dir === UP) a.x -= 4; // original overflow bug
      return a;
    }
    if (g.id === "inky") {
      const a = ahead(2);
      if (pac.dir === UP) a.x -= 2;
      const blinky = this.ghosts.find((x) => x.id === "blinky")!;
      return { x: a.x * 2 - blinky.x, y: a.y * 2 - blinky.y };
    }
    const dist = Math.hypot(g.x - pac.x, g.y - pac.y);
    if (dist > 8) return { x: pcol, y: prow };
    return SCATTER.clyde;
  }

  /**
   * Move along the current heading. Turns happen when the actor *crosses*
   * a tile center — never by snapping back into a wide "near center" window,
   * which glued everyone to spawn (step 0.06 < epsilon 0.1).
   */
  private advance(a: Actor, dist: number, who: Who, steering = false): void {
    let left = dist;
    const EPS = 1e-4;
    let guard = 0;
    while (left > EPS) {
      if (++guard > 64) break;
      const dx = DX[a.dir]!;
      const dy = DY[a.dir]!;
      if (dx === 0 && dy === 0) return;
      const { col, row } = centerTile(a.x, a.y);
      const cx = col + 0.5;
      const cy = row + 0.5;
      const toCenter = dx !== 0 ? (cx - a.x) / dx : (cy - a.y) / dy;
      if (toCenter >= -EPS && toCenter <= left) {
        left -= Math.max(toCenter, 0);
        a.x = cx;
        a.y = cy;
        if (steering) tryTurn(this.grid, a, a.nextDir, who);
        const now = centerTile(a.x, a.y);
        const nc = now.col + DX[a.dir]!;
        const nr = now.row + DY[a.dir]!;
        if (!canEnter(this.grid, nc, nr, who)) return;
        const nudge = Math.min(left, 1e-3);
        a.x += DX[a.dir]! * nudge;
        a.y += DY[a.dir]! * nudge;
        left -= nudge;
      } else {
        a.x += dx * left;
        a.y += dy * left;
        left = 0;
      }
      if (Math.round(a.y - 0.5) === TUNNEL_ROW) {
        if (a.x < -0.5) a.x += 28;
        if (a.x >= 28.5) a.x -= 28;
      }
    }
  }

  private checkCollisions(): void {
    for (const g of this.ghosts) {
      if (g.phase === "eyes" || g.phase === "enter" || g.phase === "house" || g.phase === "leave") continue;
      if (Math.hypot(g.x - this.pac.x, g.y - this.pac.y) > 0.72) continue;
      if (g.phase === "frightened") {
        const pts = GHOST_SCORES[Math.min(this.ghostCombo, GHOST_SCORES.length - 1)]!;
        this.ghostCombo += 1;
        this.addScore(pts);
        this.audio.eatGhost();
        this.floaters.push({ x: g.x, y: g.y, text: String(pts), life: 0.9, max: 0.9 });
        this.burst(g.x, g.y, "#f2efe6", 12);
        g.phase = "eyes";
        this.state = "ghostpause";
        this.ghostPauseLeft = GHOST_PAUSE;
        this.trauma = Math.min(1, this.trauma + 0.35);
      } else {
        this.killPac();
        return;
      }
    }
  }

  private killPac(): void {
    this.state = "dying";
    this.deathLeft = DEATH_TIME;
    this.deathAnim = 0;
    this.audio.death();
    this.trauma = 0.7;
    this.persistHigh();
    this.syncHud();
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const s = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.28 + Math.random() * 0.2,
        max: 0.4,
        color,
        size: 1.2 + Math.random(),
      });
    }
  }

  private advanceFloaters(dt: number): void {
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      return f.life > 0;
    });
  }

  private advanceParticles(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 4 * dt;
      return p.life > 0;
    });
  }

  private updateSiren(): void {
    if (this.state !== "playing") {
      this.audio.setSiren("off");
      return;
    }
    if (this.ghosts.some((g) => g.phase === "eyes")) {
      this.audio.setSiren("eyes");
      return;
    }
    if (this.frightLeft > 0) {
      this.audio.setSiren("fright");
      return;
    }
    const ratio = this.totalPellets === 0 ? 1 : this.pelletsLeft / this.totalPellets;
    this.audio.setSiren("chase", ratio);
  }

  syncHud(): void {
    useHud.getState().patch({
      state: this.state,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      muted: this.muted,
      pelletsLeft: this.pelletsLeft,
    });
  }

  frightFlash(): boolean {
    if (this.frightLeft <= 0) return false;
    if (this.frightLeft > 2) return false;
    return Math.floor(this.frightLeft * 6) % 2 === 0;
  }
}

function spawnGhost(
  id: GhostId,
  spawn: { x: number; y: number; dir: Dir },
  phase: Ghost["phase"],
): Ghost {
  return {
    id,
    x: spawn.x,
    y: spawn.y,
    dir: spawn.dir,
    nextDir: spawn.dir,
    phase,
    frightLeft: 0,
    bob: 0,
  };
}

function reverse(a: Actor): void {
  a.dir = REVERSE[a.dir]!;
  a.nextDir = a.dir;
}

function tryTurn(grid: Tile[][], a: Actor, next: Dir, who: Who): boolean {
  if (next === a.dir) return true;
  if (next === REVERSE[a.dir]) {
    a.dir = next;
    return true;
  }
  if (!nearCenter(a.x) || !nearCenter(a.y)) return false;
  const { col, row } = centerTile(a.x, a.y);
  if (!canEnter(grid, col + DX[next]!, row + DY[next]!, who)) return false;
  a.x = snapCenter(a.x);
  a.y = snapCenter(a.y);
  a.dir = next;
  return true;
}
