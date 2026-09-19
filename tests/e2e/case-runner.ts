import { expect, type Page } from "@playwright/test";
import type { CaseFile, Expectation, Step } from "../cases/types.ts";
import {
  forceGameOver,
  formatScore,
  openFresh,
  parkGhosts,
  readProbe,
  readSave,
  setSimDir,
  simTick,
  steer,
  waitForProbe,
  watchEmbed,
  type EmbedWatch,
} from "./helpers.ts";

type Ctx = {
  startScore: number;
  startX: number;
  startY: number;
  embedWatch: EmbedWatch | null;
};

function ids(exp: Expectation): string[] {
  return (Array.isArray(exp.testId) ? exp.testId : [exp.testId]) as string[];
}

async function applyExpect(page: Page, ctx: Ctx, exp: Expectation, caseId: string): Promise<void> {
  const tag = `${caseId}/${exp.assert}`;
  switch (exp.assert) {
    case "visible":
      await expect(page.getByTestId(String(exp.testId)), tag).toBeVisible();
      return;
    case "count": {
      const loc = exp.selector
        ? page.getByTestId(String(exp.testId)).locator(String(exp.selector))
        : page.getByTestId(String(exp.testId));
      await expect(loc, tag).toHaveCount(Number(exp.value));
      return;
    }
    case "text": {
      await expect(page.getByTestId(String(exp.testId)), tag).toHaveText(new RegExp(String(exp.match)));
      return;
    }
    case "textEquals":
      await expect(page.getByTestId(String(exp.testId)), tag).toHaveText(String(exp.value));
      return;
    case "below": {
      const above = await page.getByTestId(String(exp.above)).boundingBox();
      const below = await page.getByTestId(String(exp.below)).boundingBox();
      expect(above && below, tag).toBeTruthy();
      expect(below!.y, tag).toBeGreaterThan(above!.y);
      return;
    }
    case "heading":
      await expect(page.getByRole("heading", { name: String(exp.name) }), tag).toBeVisible();
      return;
    case "enabled":
      await expect(page.getByTestId(String(exp.testId)), tag).toBeEnabled();
      return;
    case "bestValue":
      await expect(page.getByTestId("best-value"), tag).toHaveText(formatScore(Number(exp.value)));
      return;
    case "viewport": {
      const vp = page.viewportSize();
      expect(vp, tag).toEqual({ width: Number(exp.width), height: Number(exp.height) });
      return;
    }
    case "inViewport":
    case "noVerticalClip": {
      const vp = page.viewportSize()!;
      for (const id of ids(exp)) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, `${tag} ${id}`).toBeTruthy();
        expect(box!.y, `${tag} ${id} top`).toBeGreaterThanOrEqual(-1);
        expect(box!.y + box!.height, `${tag} ${id} bottom`).toBeLessThanOrEqual(vp.height + 1);
        expect(box!.x, `${tag} ${id} left`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${tag} ${id} right`).toBeLessThanOrEqual(vp.width + 1);
      }
      return;
    }
    case "mazeFullyVisible": {
      const vp = page.viewportSize()!;
      const maze = await page.getByTestId("maze").boundingBox();
      const hud = await page.getByTestId("hud").boundingBox();
      expect(maze && hud, tag).toBeTruthy();
      expect(maze!.width, `${tag} width`).toBeGreaterThan(160);
      expect(maze!.height, `${tag} height`).toBeGreaterThan(160);
      expect(maze!.y, `${tag} below hud`).toBeGreaterThanOrEqual((hud?.y ?? 0) - 2);
      expect(maze!.y + maze!.height, `${tag} bottom`).toBeLessThanOrEqual(vp.height + 1);
      expect(maze!.x, `${tag} left`).toBeGreaterThanOrEqual(-1);
      expect(maze!.x + maze!.width, `${tag} right`).toBeLessThanOrEqual(vp.width + 1);
      return;
    }
    case "dpadAboveHomeBar": {
      const vp = page.viewportSize()!;
      const sab = Number(exp.sab ?? 0);
      const dpad = await page.getByTestId("dpad").boundingBox();
      expect(dpad, tag).toBeTruthy();
      expect(dpad!.y + dpad!.height, tag).toBeLessThanOrEqual(vp.height - sab + 2);
      for (const id of ["dpad-up", "dpad-down", "dpad-left", "dpad-right"]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, `${tag} ${id}`).toBeTruthy();
        expect(box!.y + box!.height, `${tag} ${id}`).toBeLessThanOrEqual(vp.height - sab + 2);
      }
      return;
    }
    case "dpadTargetsUsable": {
      const minSize = Number(exp.minSize ?? 44);
      const vp = page.viewportSize()!;
      for (const id of ["dpad-up", "dpad-down", "dpad-left", "dpad-right"]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, `${tag} ${id}`).toBeTruthy();
        expect(box!.width, `${tag} ${id} w`).toBeGreaterThanOrEqual(minSize - 0.5);
        expect(box!.height, `${tag} ${id} h`).toBeGreaterThanOrEqual(minSize - 0.5);
        expect(box!.x, `${tag} ${id} left`).toBeGreaterThanOrEqual(-1);
        expect(box!.y, `${tag} ${id} top`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${tag} ${id} right`).toBeLessThanOrEqual(vp.width + 1);
        expect(box!.y + box!.height, `${tag} ${id} bottom`).toBeLessThanOrEqual(vp.height + 1);
      }
      return;
    }
    case "versionReadable": {
      const el = page.getByTestId("version");
      await expect(el, tag).toBeVisible();
      await expect(el, tag).toHaveText(/v1\.\d+\.\d+/);
      const box = await el.boundingBox();
      expect(box, tag).toBeTruthy();
      expect(box!.width, `${tag} width`).toBeGreaterThan(16);
      expect(box!.height, `${tag} height`).toBeGreaterThan(6);
      return;
    }
    case "bestReadable": {
      const el = page.getByTestId("best");
      await expect(el, tag).toBeVisible();
      await expect(el, tag).toHaveText(/Best/);
      const box = await el.boundingBox();
      expect(box, tag).toBeTruthy();
      expect(box!.width, `${tag} width`).toBeGreaterThan(20);
      expect(box!.height, `${tag} height`).toBeGreaterThan(10);
      return;
    }
    case "scoreAtLeast": {
      const p = await readProbe(page);
      expect(p.score, tag).toBeGreaterThanOrEqual(Number(exp.value));
      return;
    }
    case "scoreIncreased": {
      const p = await readProbe(page);
      expect(p.score, tag).toBeGreaterThan(ctx.startScore);
      return;
    }
    case "bestAtLeast": {
      const p = await readProbe(page);
      const chip = page.getByTestId("best-value");
      await expect(chip, tag).toBeVisible();
      expect(p.high, tag).toBeGreaterThanOrEqual(Number(exp.value));
      const text = (await chip.textContent()) ?? "";
      expect(Number(text), tag).toBeGreaterThanOrEqual(Number(exp.value));
      return;
    }
    case "storageBestAtLeast": {
      const save = await readSave(page);
      expect(save?.highScore ?? 0, tag).toBeGreaterThanOrEqual(Number(exp.value));
      return;
    }
    case "bestSurvivesReload": {
      const before = await readProbe(page);
      expect(before.high, tag).toBeGreaterThan(0);
      await page.reload();
      await waitForProbe(page);
      const chip = page.getByTestId("best-value");
      await expect(chip, tag).toHaveText(formatScore(before.high));
      const save = await readSave(page);
      expect(save?.highScore, tag).toBe(before.high);
      return;
    }
    case "ghostsLeftHouse": {
      const p = await readProbe(page);
      expect(p.ghosts.length, tag).toBe(4);
      for (const g of p.ghosts) {
        expect(["out", "frightened"].includes(g.phase), `${tag} ${g.id}=${g.phase}`).toBeTruthy();
      }
      return;
    }
    case "noWallEmbed": {
      if (exp.duringWatch) {
        expect(ctx.embedWatch, tag).toBeTruthy();
        expect(ctx.embedWatch!.embeds, tag).toBe(0);
        expect(ctx.embedWatch!.samples, tag).toBeGreaterThan(60);
        return;
      }
      const result = await page.evaluate(() => {
        const sim = window.__pac;
        if (!sim) return 1;
        const WALL = 0;
        const VOID = 6;
        const bad = (x: number, y: number) => {
          const col = Math.round(x - 0.5);
          const row = Math.round(y - 0.5);
          if (row < 0 || row >= 31) return true;
          if (col < 0 || col >= 28) return row !== 14;
          const t = sim.grid[row]?.[col];
          return t === WALL || t === VOID;
        };
        return sim.ghosts.filter((g) => bad(g.x, g.y)).length;
      });
      expect(result, tag).toBe(0);
      return;
    }
    case "pacMoved": {
      const p = await readProbe(page);
      const dist = Math.hypot(p.x - ctx.startX, p.y - ctx.startY);
      expect(dist, tag).toBeGreaterThanOrEqual(Number(exp.min ?? 0.4));
      return;
    }
    case "state": {
      const p = await readProbe(page);
      expect(p.state, tag).toBe(String(exp.value));
      return;
    }
    case "stateIn": {
      const p = await readProbe(page);
      expect(exp.values as string[], tag).toContain(p.state);
      return;
    }
    case "controlsWork": {
      const before = await readProbe(page);
      await setSimDir(page, "left");
      await simTick(page, 0.45);
      const after = await readProbe(page);
      const dist = Math.hypot(after.x - before.x, after.y - before.y);
      expect(dist, tag).toBeGreaterThan(0.2);
      expect(["ready", "playing"].includes(after.state), tag).toBeTruthy();
      return;
    }
    case "spritesInMaze": {
      const p = await readProbe(page);
      expect(p.x, `${tag} pac x`).toBeGreaterThanOrEqual(-0.6);
      expect(p.x, `${tag} pac x`).toBeLessThanOrEqual(28.6);
      expect(p.y, `${tag} pac y`).toBeGreaterThanOrEqual(0);
      expect(p.y, `${tag} pac y`).toBeLessThanOrEqual(31);
      for (const g of p.ghosts) {
        expect(g.x, `${tag} ${g.id} x`).toBeGreaterThanOrEqual(-0.6);
        expect(g.x, `${tag} ${g.id} x`).toBeLessThanOrEqual(28.6);
        expect(g.y, `${tag} ${g.id} y`).toBeGreaterThanOrEqual(0);
        expect(g.y, `${tag} ${g.id} y`).toBeLessThanOrEqual(31);
      }
      return;
    }
    default:
      throw new Error(`${tag}: unknown e2e/pixel assert "${exp.assert}"`);
  }
}

async function snapshotStart(page: Page, ctx: Ctx): Promise<void> {
  const p = await readProbe(page);
  ctx.startScore = p.score;
  ctx.startX = p.x;
  ctx.startY = p.y;
}

async function runStep(page: Page, ctx: Ctx, step: Step, c: CaseFile): Promise<void> {
  switch (step.op) {
    case "openFresh":
      await openFresh(page, step.best != null ? Number(step.best) : undefined);
      await snapshotStart(page, ctx);
      return;
    case "click":
      await page.getByTestId(String(step.testId)).click();
      return;
    case "waitState": {
      const allowed = (Array.isArray(step.state) ? step.state : [step.state]) as string[];
      await expect
        .poll(async () => (await readProbe(page)).state, { message: `${c.id} waitState` })
        .toSatisfy((s) => allowed.includes(String(s)));
      await snapshotStart(page, ctx);
      return;
    }
    case "simTick":
      await simTick(page, Number(step.seconds));
      return;
    case "parkGhosts":
      await parkGhosts(page);
      return;
    case "setDir":
      await setSimDir(page, String(step.dir));
      return;
    case "steer":
      await snapshotStart(page, ctx);
      await steer(page, String(step.dir));
      await setSimDir(page, String(step.dir));
      return;
    case "waitScoreIncrease": {
      await expect
        .poll(async () => (await readProbe(page)).score, { timeout: Number(step.timeout ?? 8000) })
        .toBeGreaterThan(ctx.startScore);
      return;
    }
    case "watchEmbed":
      ctx.embedWatch = await watchEmbed(page, Number(step.seconds));
      return;
    case "forceGameOver":
      await forceGameOver(page);
      return;
    case "reload":
      await page.reload();
      await waitForProbe(page);
      return;
    case "emulateSafeArea": {
      const sat = Number(step.sat ?? 0);
      const sab = Number(step.sab ?? 0);
      await page.addStyleTag({
        content: `:root { --sat: ${sat}px; --sab: ${sab}px; }`,
      });
      const vp = page.viewportSize()!;
      await page.setViewportSize({ width: vp.width, height: vp.height - 1 });
      await page.setViewportSize(vp);
      return;
    }
    case "expect":
      await applyExpect(page, ctx, step as unknown as Expectation, c.id);
      return;
    default:
      throw new Error(`${c.id}: unknown e2e op "${step.op}"`);
  }
}

export async function runE2ECase(page: Page, c: CaseFile): Promise<void> {
  const ctx: Ctx = { startScore: 0, startX: 0, startY: 0, embedWatch: null };
  for (const step of c.steps) await runStep(page, ctx, step, c);
  for (const exp of c.expect) await applyExpect(page, ctx, exp, c.id);
}
