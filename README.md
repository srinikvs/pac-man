# Pac-Man v1.0.0

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

## Stack

- Vite + React 19 + TypeScript
- Canvas 2D maze, original-drawn sprites
- Procedural SFX (Web Audio)

## License

Use and modify freely for personal or commercial projects.
