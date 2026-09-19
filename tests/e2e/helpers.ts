import { expect, type Page } from "@playwright/test";

export const SAVE_KEY = "pacman.v1";

export type GhostSnap = {
  id: string;
  x: number;
  y: number;
  phase: string;
  dir: number;
};

export type Probe = {
  getState: () => string;
  getScore: () => number;
  getHigh: () => number;
  getX: () => number;
  getY: () => number;
  getGhosts: () => GhostSnap[];
  setKeys: (codes: string[]) => void;
  setDir: (dir: number) => void;
};

declare global {
  interface Window {
    __pac?: {
      state: string;
      score: number;
      highScore: number;
      lives: number;
      pac: { x: number; y: number; dir: number };
      ghosts: Array<{ id: string; x: number; y: number; phase: string }>;
      grid: number[][];
      startGame: () => void;
      setDir: (dir: number) => void;
      update: (dt: number) => void;
      setMuted: (muted: boolean) => void;
    };
    __controlsTest?: Probe;
  }
}

const DIR: Record<string, number> = { up: 0, left: 1, down: 2, right: 3 };

const KEY_FOR_DIR: Record<string, string> = {
  up: "ArrowUp",
  left: "ArrowLeft",
  down: "ArrowDown",
  right: "ArrowRight",
};

export function formatScore(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export async function waitForProbe(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => Boolean(window.__pac && window.__controlsTest))).toBe(true);
}

export async function openFresh(page: Page, best?: number): Promise<void> {
  await page.addInitScript(
    ({ SAVE_KEY, best }) => {
      if (sessionStorage.getItem("pacman-e2e-seeded")) return;
      localStorage.clear();
      if (best != null) {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, highScore: best, muted: true }));
      }
      sessionStorage.setItem("pacman-e2e-seeded", "1");
    },
    { SAVE_KEY, best },
  );
  await page.goto("./");
  await expect(page.getByTestId("start")).toBeVisible();
  await waitForProbe(page);
  await page.evaluate(() => window.__pac?.setMuted(true));
}

export async function readProbe(page: Page): Promise<{
  state: string;
  score: number;
  high: number;
  x: number;
  y: number;
  ghosts: GhostSnap[];
}> {
  return page.evaluate(() => {
    const p = window.__controlsTest;
    const sim = window.__pac;
    return {
      state: p?.getState() ?? sim?.state ?? "missing",
      score: p?.getScore() ?? sim?.score ?? 0,
      high: p?.getHigh() ?? sim?.highScore ?? 0,
      x: p?.getX() ?? sim?.pac.x ?? 0,
      y: p?.getY() ?? sim?.pac.y ?? 0,
      ghosts: p?.getGhosts() ?? [],
    };
  });
}

export async function readSave(page: Page): Promise<{ highScore: number; muted: boolean } | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { highScore: number; muted: boolean }) : null;
  }, SAVE_KEY);
}

export async function simTick(page: Page, seconds: number): Promise<void> {
  await page.evaluate((s) => {
    const sim = window.__pac;
    if (!sim) throw new Error("no __pac");
    const step = 1 / 60;
    let left = s;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      sim.update(dt);
      left -= dt;
    }
  }, seconds);
}

export async function parkGhosts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__pac;
    if (!sim) return;
    for (const g of sim.ghosts) {
      g.x = 26.5;
      g.y = 1.5;
      g.phase = "out";
    }
  });
}

export async function steer(page: Page, dir: string): Promise<void> {
  const testId = `dpad-${dir}`;
  const pad = page.getByTestId(testId);
  if (await pad.isVisible().catch(() => false)) {
    await pad.click();
    return;
  }
  const key = KEY_FOR_DIR[dir] ?? "ArrowLeft";
  await page.keyboard.press(key);
  await page.evaluate((code) => window.__controlsTest?.setKeys([code]), key);
}

export async function setSimDir(page: Page, dir: string): Promise<void> {
  const d = DIR[dir] ?? 1;
  await page.evaluate((n) => {
    window.__pac?.setDir(n as 0 | 1 | 2 | 3);
    window.__controlsTest?.setDir(n as 0 | 1 | 2 | 3);
  }, d);
}

export type EmbedWatch = { embeds: number; samples: number };

export async function watchEmbed(page: Page, seconds: number): Promise<EmbedWatch> {
  return page.evaluate((s) => {
    const sim = window.__pac;
    if (!sim) throw new Error("no __pac");
    const WALL = 0;
    const VOID = 6;
    const HOUSE = 5;
    const DOOR = 4;
    const COLS = 28;
    const ROWS = 31;
    const TUNNEL = 14;
    const tile = (x: number, y: number) => {
      const col = Math.round(x - 0.5);
      const row = Math.round(y - 0.5);
      if (row < 0 || row >= ROWS) return WALL;
      if (col < 0 || col >= COLS) return row === TUNNEL ? 3 : WALL;
      return sim.grid[row]?.[col] ?? WALL;
    };
    const bad = (x: number, y: number, phase: string) => {
      const t = tile(x, y);
      if (t === WALL || t === VOID) return true;
      if ((phase === "out" || phase === "frightened") && (t === HOUSE || t === DOOR)) return true;
      return false;
    };
    let embeds = 0;
    let samples = 0;
    const step = 1 / 60;
    let left = s;
    while (left > 1e-9) {
      const dt = Math.min(step, left);
      sim.update(dt);
      left -= dt;
      samples += 1;
      for (const g of sim.ghosts) {
        if (bad(g.x, g.y, g.phase)) embeds += 1;
      }
    }
    return { embeds, samples };
  }, seconds);
}

export async function forceGameOver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__pac;
    if (!sim) throw new Error("no __pac");
    const death = 1.8;
    for (let i = 0; i < 5 && sim.state !== "gameover"; i++) {
      if (sim.state === "title") sim.startGame();
      if (sim.state === "ready" || sim.state === "paused" || sim.state === "ghostpause") sim.state = "playing";
      if (sim.state === "dying") {
        sim.update(death + 0.05);
        continue;
      }
      const g = sim.ghosts[0];
      if (!g) break;
      g.phase = "out";
      g.x = sim.pac.x;
      g.y = sim.pac.y;
      sim.update(1 / 60);
      if (sim.state === "dying") sim.update(death + 0.05);
    }
  });
}
