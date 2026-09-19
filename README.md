# Pac-Man v1.0.3

Arcade maze chase from Playadda. Eat every pellet, grab the energizers, and stay ahead of four ghosts.

Original-inspired art and audio — canvas-drawn sprites, no trademarked assets.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173/pacman/`).

```bash
npx tsc -b
npm run build
npm run preview
```

Production assets are built with base `/pacman/` to match the Playadda path `https://playadda.duckdns.org/pacman/`.

Serve the SPA so client paths do not 404:

```nginx
location /pacman/ {
    try_files $uri $uri/ /pacman/index.html;
}
```

## Play

1. **Start** the game.
2. Steer with **arrows** or **WASD**. On a phone, swipe the maze or use the D-pad.
3. Eat pellets (10) and energizers (50). Blue ghosts are worth 200 / 400 / 800 / 1600.
4. Fruit appears twice per board. Extra life at 10,000.
5. Pause with **P**, mute with **M**. High score is kept in `localStorage`.

## Test

See [TESTING.md](TESTING.md). Cases live in `tests/cases/*.json` (source of truth).

```bash
npm test
npm run test:e2e
npm run test:e2e:pixel
```

`npm run test:e2e` builds this checkout and serves `http://127.0.0.1:4173/pacman/` (Jenkins `pacman-ci`: `CI=1 DEPLOY=false`). Live `BASE_URL` smoke is opt-in and needs a published build that includes the testid hooks — see [TESTING.md](TESTING.md).

## Stack

- Vite + React 19 + TypeScript
- Canvas 2D maze, original-drawn sprites
- Procedural SFX (Web Audio)

## License

Use and modify freely for personal or commercial projects.


## Changelog

### 1.0.3
- Ghost pathing: tile-center crossing instead of a near-center snap window, so ghosts leave intersections instead of gluing to them.
- House exit: Pinky / Inky / Clyde walk the door midline, then park on the corridor tile (13.5, 11.5). No more half-in-wall spawn gate.
- All four ghosts leave on a short stagger (Pinky immediately, Inky 0.55s, Clyde 1.2s) then scatter/chase. Inky and Clyde no longer wait 30/90 pellets.
- Playadda UX: visible version id, how-to-play + Start on the title screen, Best high score in the header (localStorage, live update).


### 1.0.1
- Fix spawn freeze: actors no longer snap back onto the tile center every sub-step, so Pac-Man keeps moving after READY.
- Keyboard (arrows/WASD, `e.key` fallback), D-pad tap-to-turn, and swipe all latch a heading. Finger-up does not stop Pac-Man.
