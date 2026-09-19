import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEATH_TIME,
  EXIT_LANE,
  houseReleaseAt,
  READY_TIME,
  SAVE_KEY,
  VERSION,
} from "../../src/game/constants.ts";
import { writeSave } from "../../src/game/save.ts";
import { PacmanSim } from "../../src/game/sim.ts";
import { DOWN, LEFT, RIGHT, TILE, UP, type Dir, type GhostId, type GhostPhase } from "../../src/game/types.ts";
import { isIllegalOutTile, isWallEmbed } from "./embed.ts";
import type { CaseFile, Expectation, Step } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const mem = new Map<string, string>();

function ensureLocalStorage(): void {
  if (typeof (globalThis as { localStorage?: Storage }).localStorage?.getItem === "function") return;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, String(v));
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => mem.clear(),
      key: (i: number) => [...mem.keys()][i] ?? null,
      get length() {
        return mem.size;
      },
    },
  });
}

type ExitSnap = { id: GhostId; x: number; y: number; embeds: number };

type Ctx = {
  sim: PacmanSim;
  startScore: number;
  startX: number;
  startY: number;
  exitSnaps: ExitSnap[];
  embeds: number;
};

function dirFrom(name: string): Dir {
  switch (String(name).toLowerCase()) {
    case "up":
      return UP;
    case "down":
      return DOWN;
    case "right":
      return RIGHT;
    case "left":
    default:
      return LEFT;
  }
}

export function tick(sim: PacmanSim, seconds: number): void {
  const step = 1 / 60;
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(step, left);
    sim.update(dt);
    left -= dt;
  }
}

function countEmbeds(sim: PacmanSim): number {
  let n = 0;
  for (const g of sim.ghosts) {
    if (isWallEmbed(sim.grid, g.x, g.y)) n += 1;
    if (isIllegalOutTile(sim.grid, g.x, g.y, g.phase)) n += 1;
  }
  return n;
}

function watchUntilOut(ctx: Ctx, maxSeconds: number): void {
  const seen = new Set<GhostId>();
  const step = 1 / 60;
  let t = 0;
  while (t < maxSeconds && seen.size < ctx.sim.ghosts.length) {
    ctx.sim.update(step);
    t += step;
    ctx.embeds += countEmbeds(ctx.sim);
    for (const g of ctx.sim.ghosts) {
      if (seen.has(g.id)) continue;
      if (g.phase === "out" || g.phase === "frightened") {
        seen.add(g.id);
        ctx.exitSnaps.push({ id: g.id, x: g.x, y: g.y, embeds: isWallEmbed(ctx.sim.grid, g.x, g.y) ? 1 : 0 });
      }
    }
  }
}

function forceDeath(sim: PacmanSim): void {
  if (sim.state === "title") sim.startGame();
  if (sim.state === "ready" || sim.state === "paused" || sim.state === "ghostpause") {
    sim.state = "playing";
  }
  if (sim.state === "dying") tick(sim, DEATH_TIME + 0.05);
  if (sim.state === "gameover") return;
  sim.frightLeft = 0;
  const g = sim.ghosts[0]!;
  g.phase = "out";
  g.x = sim.pac.x;
  g.y = sim.pac.y;
  tick(sim, 1 / 60);
  if (sim.state === "dying") tick(sim, DEATH_TIME + 0.05);
}

function storageBest(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { highScore?: number };
    return typeof parsed.highScore === "number" ? parsed.highScore : 0;
  } catch {
    return 0;
  }
}

function ghostOf(sim: PacmanSim, id: string) {
  const g = sim.ghosts.find((x) => x.id === id);
  assert.ok(g, `missing ghost ${id}`);
  return g;
}

function applyExpect(ctx: Ctx, exp: Expectation, caseId: string): void {
  const tag = `${caseId}/${exp.assert}`;
  const sim = ctx.sim;
  switch (exp.assert) {
    case "releaseTimersZero": {
      for (const id of ["blinky", "pinky", "inky", "clyde"] as GhostId[]) {
        assert.equal(houseReleaseAt(id), 0, `${tag} ${id}`);
      }
      return;
    }
    case "ghostPhase": {
      assert.equal(ghostOf(sim, String(exp.id)).phase, exp.phase as GhostPhase, tag);
      return;
    }
    case "ghostPhaseIn": {
      const phases = exp.phases as GhostPhase[];
      assert.ok(phases.includes(ghostOf(sim, String(exp.id)).phase), `${tag} got ${ghostOf(sim, String(exp.id)).phase}`);
      return;
    }
    case "allGhostsLeftHouse": {
      for (const g of sim.ghosts) {
        assert.ok(g.phase === "out" || g.phase === "frightened", `${tag} ${g.id}=${g.phase}`);
      }
      return;
    }
    case "closerToExit": {
      const a = ghostOf(sim, String(exp.id));
      const da = Math.hypot(a.x - EXIT_LANE.x, a.y - EXIT_LANE.y);
      for (const other of exp.than as string[]) {
        const b = ghostOf(sim, other);
        const db = Math.hypot(b.x - EXIT_LANE.x, b.y - EXIT_LANE.y);
        const aDone = a.phase === "out" || a.phase === "frightened";
        const bDone = b.phase === "out" || b.phase === "frightened";
        assert.ok(aDone || da + 1e-6 <= db || (a.phase === "leave" && b.phase === "house"), `${tag} ${a.id} vs ${other}`);
        if (!aDone && bDone) assert.fail(`${tag} ${other} finished before ${a.id}`);
      }
      return;
    }
    case "noWallEmbed": {
      if (exp.duringWatch) {
        assert.equal(ctx.embeds, 0, `${tag} embeds during watch`);
      }
      for (const g of sim.ghosts) {
        assert.equal(isWallEmbed(sim.grid, g.x, g.y), false, `${tag} ${g.id} at ${g.x},${g.y}`);
        if (exp.outIllegal !== false) {
          assert.equal(
            isIllegalOutTile(sim.grid, g.x, g.y, g.phase),
            false,
            `${tag} ${g.id} illegal out tile ${g.phase} ${g.x},${g.y}`,
          );
        }
      }
      if (exp.includePac) {
        assert.equal(isWallEmbed(sim.grid, sim.pac.x, sim.pac.y), false, `${tag} pac`);
      }
      return;
    }
    case "exitLanePark": {
      const slop = Number(exp.slop ?? 0.65);
      const snaps = ctx.exitSnaps.length ? ctx.exitSnaps : sim.ghosts.map((g) => ({ id: g.id, x: g.x, y: g.y, embeds: 0 }));
      for (const s of snaps) {
        if (s.id === "blinky") {
          assert.ok(Math.hypot(s.x - EXIT_LANE.x, s.y - EXIT_LANE.y) < 1.2, `${tag} blinky spawn`);
          continue;
        }
        assert.equal(s.embeds, 0, `${tag} ${s.id} embed on first out`);
        assert.ok(
          Math.hypot(s.x - EXIT_LANE.x, s.y - EXIT_LANE.y) <= slop,
          `${tag} ${s.id} first-out (${s.x.toFixed(2)},${s.y.toFixed(2)}) must park near exit lane`,
        );
      }
      return;
    }
    case "scoreAtLeast": {
      assert.ok(sim.score >= Number(exp.value), `${tag} score ${sim.score}`);
      return;
    }
    case "scoreEquals": {
      assert.equal(sim.score, Number(exp.value), tag);
      return;
    }
    case "scoreIncreased": {
      assert.ok(sim.score > ctx.startScore, `${tag} ${ctx.startScore} → ${sim.score}`);
      return;
    }
    case "pelletsEaten": {
      assert.ok(sim.pelletsEaten >= Number(exp.min ?? 1), `${tag} ${sim.pelletsEaten}`);
      return;
    }
    case "pacMoved": {
      const dist = Math.hypot(sim.pac.x - ctx.startX, sim.pac.y - ctx.startY);
      assert.ok(dist >= Number(exp.min ?? 0.4), `${tag} dist ${dist}`);
      return;
    }
    case "frightActive": {
      assert.ok(sim.frightLeft > 0, `${tag} frightLeft ${sim.frightLeft}`);
      return;
    }
    case "ghostEdible": {
      const n = sim.ghosts.filter((g) => g.phase === "frightened").length;
      assert.ok(n >= Number(exp.min ?? 1), `${tag} frightened=${n}`);
      return;
    }
    case "ghostPhaseCount": {
      const n = sim.ghosts.filter((g) => g.phase === exp.phase).length;
      assert.ok(n >= Number(exp.min ?? 1), `${tag} ${String(exp.phase)}=${n}`);
      return;
    }
    case "state": {
      assert.equal(sim.state, exp.value, tag);
      return;
    }
    case "lives": {
      if (exp.max != null) assert.ok(sim.lives <= Number(exp.max), `${tag} lives ${sim.lives}`);
      if (exp.min != null) assert.ok(sim.lives >= Number(exp.min), `${tag} lives ${sim.lives}`);
      if (exp.value != null) assert.equal(sim.lives, Number(exp.value), tag);
      return;
    }
    case "best": {
      assert.equal(sim.highScore, Number(exp.value), tag);
      return;
    }
    case "bestAtLeast": {
      assert.ok(sim.highScore >= Number(exp.value), `${tag} ${sim.highScore}`);
      return;
    }
    case "storageBest": {
      assert.equal(storageBest(), Number(exp.value), tag);
      return;
    }
    case "storageBestAtLeast": {
      assert.ok(storageBest() >= Number(exp.value), `${tag} ${storageBest()}`);
      return;
    }
    case "bestMatchesStorage": {
      assert.equal(sim.highScore, storageBest(), tag);
      return;
    }
    case "versionMatchesPackage": {
      const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
      assert.equal(VERSION, pkg.version, tag);
      return;
    }
    case "htmlHasVersionTag": {
      const html = readFileSync(join(ROOT, String(exp.file ?? "index.html")), "utf8");
      assert.match(html, new RegExp(`Pac-Man v${VERSION.replaceAll(".", "\\.")}`), tag);
      return;
    }
    case "uiUsesVersionLabel": {
      const src = readFileSync(join(ROOT, String(exp.file ?? "src/game/PacmanApp.tsx")), "utf8");
      assert.match(src, /VERSION/, tag);
      assert.match(src, /v\{VERSION\}/, tag);
      return;
    }
    case "powerCleared": {
      let powers = 0;
      for (const row of sim.grid) for (const t of row) if (t === TILE.POWER) powers += 1;
      assert.ok(powers < 4, `${tag} remaining powers ${powers}`);
      return;
    }
    default:
      throw new Error(`${tag}: unknown unit assert "${exp.assert}"`);
  }
}

function runStep(ctx: Ctx, step: Step, c: CaseFile): void {
  const tag = `${c.id}/${step.op}`;
  switch (step.op) {
    case "nop":
    case "readVersionSources":
      return;
    case "expect":
      applyExpect(ctx, step as unknown as Expectation, c.id);
      return;
    case "resetStorage":
      ensureLocalStorage();
      localStorage.clear();
      mem.clear();
      return;
    case "writeBest":
      ensureLocalStorage();
      if (step.reset !== false) localStorage.clear();
      writeSave({ highScore: Number(step.value) });
      return;
    case "newSim":
      ctx.sim = new PacmanSim();
      ctx.sim.setMuted(true);
      ctx.startScore = ctx.sim.score;
      ctx.startX = ctx.sim.pac.x;
      ctx.startY = ctx.sim.pac.y;
      return;
    case "startGame":
      ctx.sim.startGame();
      ctx.startScore = ctx.sim.score;
      ctx.startX = ctx.sim.pac.x;
      ctx.startY = ctx.sim.pac.y;
      return;
    case "startPlaying":
      ctx.sim.startGame();
      tick(ctx.sim, READY_TIME + 0.05);
      ctx.startScore = ctx.sim.score;
      ctx.startX = ctx.sim.pac.x;
      ctx.startY = ctx.sim.pac.y;
      return;
    case "tick":
      tick(ctx.sim, Number(step.seconds));
      ctx.embeds += countEmbeds(ctx.sim);
      return;
    case "setDir":
      ctx.sim.setDir(dirFrom(String(step.dir)));
      return;
    case "placePac":
      ctx.sim.pac.x = Number(step.x);
      ctx.sim.pac.y = Number(step.y);
      if (step.dir) ctx.sim.setDir(dirFrom(String(step.dir)));
      return;
    case "placeGhost": {
      const g = ghostOf(ctx.sim, String(step.id));
      if (step.x != null) g.x = Number(step.x);
      if (step.y != null) g.y = Number(step.y);
      if (step.phase) g.phase = step.phase as GhostPhase;
      return;
    }
    case "parkGhosts":
      for (const g of ctx.sim.ghosts) {
        g.x = 26.5;
        g.y = 1.5;
        g.phase = "out";
      }
      return;
    case "watchExitUntilOut":
      watchUntilOut(ctx, Number(step.maxSeconds ?? 4));
      return;
    case "forceDeath": {
      const n = Number(step.count ?? 1);
      for (let i = 0; i < n; i++) forceDeath(ctx.sim);
      return;
    }
    case "eatEnergizer": {
      ctx.sim.pac.x = Number(step.x ?? 1.5);
      ctx.sim.pac.y = Number(step.y ?? 3.5);
      if (ctx.sim.state === "ready") ctx.sim.state = "playing";
      tick(ctx.sim, Number(step.seconds ?? 0.08));
      return;
    }
    default:
      throw new Error(`${tag}: unknown unit op "${step.op}"`);
  }
}

export function runUnitCase(c: CaseFile): void {
  ensureLocalStorage();
  mem.clear();
  localStorage.clear();
  const sim = new PacmanSim();
  sim.setMuted(true);
  const ctx: Ctx = {
    sim,
    startScore: sim.score,
    startX: sim.pac.x,
    startY: sim.pac.y,
    exitSnaps: [],
    embeds: 0,
  };
  for (const step of c.steps) runStep(ctx, step, c);
  for (const exp of c.expect) applyExpect(ctx, exp, c.id);
}
