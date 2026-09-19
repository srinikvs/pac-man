# Testing Pac-Man

JSON case files under `tests/cases/` are the **source of truth**. Unit (`npm test`) and Playwright (`npm run test:e2e`) load those files and drive assertions from `steps` / `expect`. Do not add a new Scrutiny scenario only as hard-coded TypeScript.

CSV export of results is optional later. JSON stays canonical. There is no spreadsheet ingest.

## Case files

Path: `tests/cases/*.json` (one case = one object / file).

| Field | Required | Values |
|---|---|---|
| `id` | yes | Stable id (`A1`, `B8`, `C16`, …) |
| `layer` | yes | `unit` \| `e2e` \| `pixel` |
| `title` | yes | Human-readable name |
| `steps` | yes | Interpreter ops (`openFresh`, `startGame`, `simTick`, `steer`, …) |
| `expect` | yes | Interpreter asserts (`ghostsLeftHouse`, `visible`, `mazeFullyVisible`, …) |
| `gate` | yes | `block` (fails **TEST PASS**) \| `optional` |
| `viewport` | no | `desktop` for the 1280×800 smoke; otherwise Pixel project |

**Add a feature:** add or edit a JSON file, then re-run `npm test` and/or `npm run test:e2e`. Extend `tests/cases/unit-runner.ts` or `tests/e2e/case-runner.ts` only when you need a new op/assert.

Gate mapping: E2E **8, 9, 11–13** (`B8`, `B9`, `B11`, `B12`, `B13`) and Pixel **16–18** (`C16`–`C18`) use `gate: "block"`. Do not skip, soften, or `fixme` those cases.

Manual-only items are **not** JSON cases and are not executed (see below).

## Local

```bash
npm install
npx playwright install --with-deps chromium

npm test                 # loads tests/cases/*.json (layer=unit) + catalog checks
npm run test:e2e         # Playwright pixel + desktop; loads e2e/pixel JSON cases
npm run test:e2e:pixel   # Pixel 7a project only (412×915)
npm run test:e2e:desktop # 1280×800 Start smoke (B-desktop-start)
```

`npm run test:e2e:pixel` runs **only** the Pixel catalog (`tests/e2e/pixel.catalog.spec.ts`): B8–B15 plus C16–C19. Those cases are registered on the pixel project — they are not `test.skip` placeholders. The desktop project loads `desktop.catalog.spec.ts` (Start smoke only) and does not list C16–C19.

`test:e2e` builds `dist/` and starts `vite preview` at `http://127.0.0.1:4173/pacman/` unless `BASE_URL` is set. Failure screenshots land in `test-results/`.

## Live smoke (`BASE_URL`)

Default local preview: `http://127.0.0.1:4173/pacman/` (Vite `base` is `/pacman/`).

```bash
BASE_URL=https://playaddatest.duckdns.org/pacman/ npm run test:e2e
BASE_URL=https://playadda.duckdns.org/pacman/ npm run test:e2e
```

Playaddatest and production mount the game at `/pacman/` (see `deploy/nginx.pacman.conf`). When `BASE_URL` is set, Playwright does not start a local webServer.

## Catalog (A–C)

| id | Layer | Gate | Coverage |
|---|--------|------|----------|
| A1 | unit | optional | Ghost house exit timers / release order (Blinky out first; Pinky before Inky/Clyde; all out) |
| A2 | unit | optional | No wall-embed at the spawn gate; first-out parks on the corridor tile (13.5, 11.5) |
| A3 | unit | optional | Pac movement + pellet score increments |
| A4 | unit | optional | Energizer frightens edible ghosts and awards energizer + eat-ghost score |
| A5 | unit | optional | Life loss, then game-over when lives are exhausted |
| A6 | unit | optional | Beating Best writes `pacman.v1`; a new sim restores it |
| A7 | unit | optional | `VERSION` matches `package.json` / shipped UI tag |
| B8 | e2e | **block** | How-to-play before play; Start on the same screen |
| B9 | e2e | **block** | Version ID on HUD (`v1.x.x`) |
| B10 | e2e | optional | Best shown; updates without refresh after a beat; survives reload |
| B11 | e2e | **block** | All four ghosts leave the house cleanly |
| B12 | e2e | **block** | No ghost wall-embed at spawn / maze for the first ~18s |
| B13 | e2e | **block** | D-pad / keys move Pac; score increases |
| B14 | e2e | optional | Life / game-over path smoke |
| B15 | e2e | optional | Hard refresh does not brick Start or steering |
| C16 | pixel | **block** | Full maze + D-pad / HUD visible; no vertical / home-bar clip |
| C17 | pixel | **block** | Touch D-pad targets unclipped and ≥44px |
| C18 | pixel | **block** | Version + Best readable on 412×915 portrait |
| C19 | pixel | optional | Ghosts / Pac stay inside maze bounds; canvas unclipped on start |

`src/game/cases.test.ts` fails if a required id is missing or a block case is not `gate: "block"`.

## Manual-only (do not automate, not in JSON)

C16–C18 home-bar coverage in CI is a CSS `--sab` emulation (34px) plus Chromium 412×915. Still manual:

- Real Pixel 7a / Android Chrome gesture-bar and cutout.
- iPhone Safari-only visual quirks (dynamic toolbar, `visualViewport` dips, rubber-band).
- Early Game Over / difficulty feel (ghost pressure after the first few seconds).
- Subjective aesthetics beyond measurable clip, target size, and readable HUD chrome.
- Weekly prod / merge greenlights and sign-off rituals.

## Hooks

Stable `data-testid` attributes (`version`, `howto`, `start`, `hud`, `best`, `maze`, `dpad`, `dpad-up` / `-left` / `-right` / `-down`, `gameover`, …). Gameplay logic is unchanged. E2E also uses the existing `window.__pac` / `window.__controlsTest` probes.
