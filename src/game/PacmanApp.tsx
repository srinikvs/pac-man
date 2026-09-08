import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { VERSION, VIEW_H, VIEW_W } from "./constants";
import { Dpad } from "./Dpad";
import { Input } from "./input";
import { drawFrame } from "./render";
import { PacmanSim } from "./sim";
import { useHud } from "./store";
import type { Dir } from "./types";
import { GHOST_COLOR, GHOST_NICK } from "./constants";
import type { GhostId } from "./types";

function formatScore(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function PacmanApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<PacmanSim | null>(null);
  const inputRef = useRef(new Input());

  const hud = useHud();

  useEffect(() => {
    const sim = new PacmanSim();
    simRef.current = sim;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const input = inputRef.current;
    const stage = stageRef.current!;
    const detach = input.attach(stage, (dir) => sim.setDir(dir));

    const probe = {
      getSpeed: () => (sim.state === "playing" ? 1 : 0),
      getYaw: () => sim.pac.dir,
      getX: () => sim.pac.x,
      getY: () => sim.pac.y,
      getState: () => sim.state,
      getScore: () => sim.score,
      getHigh: () => sim.highScore,
      getGhosts: () =>
        sim.ghosts.map((g) => ({
          id: g.id,
          x: +g.x.toFixed(2),
          y: +g.y.toFixed(2),
          phase: g.phase,
          dir: g.dir,
        })),
      setKeys: (codes: string[]) => input.setHeld(codes),
      setDir: (dir: Dir) => sim.setDir(dir),
    };
    const w = window as unknown as {
      __pac: PacmanSim;
      __controlsTest: typeof probe;
    };
    w.__pac = sim;
    w.__controlsTest = probe;

    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const actions = input.poll();
      if (actions.dir !== null) sim.setDir(actions.dir);
      if (actions.mute) sim.toggleMute();
      if (actions.pause) {
        if (sim.state === "title") sim.startGame();
        else if (sim.state === "gameover") sim.startGame();
        else sim.togglePause();
      }
      if (actions.start) {
        if (sim.state === "title" || sim.state === "gameover") sim.startGame();
        else if (sim.state === "paused") sim.togglePause();
      }
      sim.update(dt);
      ctx.imageSmoothingEnabled = false;
      drawFrame(ctx, sim);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const vis = () => {
      if (document.visibilityState === "visible") sim.audio.resume();
    };
    document.addEventListener("visibilitychange", vis);

    return () => {
      cancelAnimationFrame(raf);
      detach();
      document.removeEventListener("visibilitychange", vis);
      sim.audio.stopSiren();
    };
  }, []);

  const onPad = useCallback((dir: Dir | null) => {
    inputRef.current.setPadDir(dir);
    if (dir !== null) simRef.current?.setDir(dir);
  }, []);

  const start = useCallback(() => {
    simRef.current?.startGame();
    stageRef.current?.focus();
  }, []);

  const togglePause = useCallback(() => {
    simRef.current?.togglePause();
  }, []);

  const toggleMute = useCallback(() => {
    simRef.current?.toggleMute();
  }, []);

  const showTitle = hud.state === "title";
  const showPause = hud.state === "paused";
  const showOver = hud.state === "gameover";
  const inPlay = !showTitle;

  return (
    <div className="cabinet">
      <header className="cabinet-top">
        <div className="brand">
          <h1 className="wordmark">Pac-Man</h1>
          <p className="ver-id" aria-label={`Version ${VERSION}`}>
            v{VERSION}
          </p>
        </div>
        <p className="best-chip" aria-live="polite">
          <span className="best-label">Best</span>
          <span className="best-value">{formatScore(hud.highScore)}</span>
        </p>
        <div className="cabinet-actions">
          <IconBtn label={hud.muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {hud.muted ? <VolumeX className="icon-sm" /> : <Volume2 className="icon-sm" />}
          </IconBtn>
          {inPlay && !showOver && (
            <IconBtn label={showPause ? "Resume" : "Pause"} onClick={togglePause}>
              {showPause ? <Play className="icon-sm" /> : <Pause className="icon-sm" />}
            </IconBtn>
          )}
        </div>
      </header>

      <div ref={stageRef} className="stage" tabIndex={0}>
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="stage-canvas"
        />

        {showTitle && <TitleOverlay highScore={hud.highScore} onStart={start} />}
        {showPause && <PauseOverlay onResume={togglePause} />}
        {showOver && (
          <OverOverlay score={hud.score} highScore={hud.highScore} onRetry={start} />
        )}
      </div>

      <Dpad onDir={onPad} />

      <p className="hint">
        Arrows or WASD to steer. Swipe the maze on a phone. Eat every pellet. Power pellets turn the tables.
      </p>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

const HOW_TO = [
  "Steer with arrows, WASD, swipe, or the D-pad.",
  "Eat every pellet. Energizers turn ghosts blue — eat them for a bonus.",
  "Don't get caught. Extra life at 10,000.",
];

function TitleOverlay({ highScore, onStart }: { highScore: number; onStart: () => void }) {
  const ghosts: GhostId[] = ["blinky", "pinky", "inky", "clyde"];
  return (
    <div className="overlay overlay-title">
      <p className="overlay-kicker">Best {formatScore(highScore)}</p>
      <h2 className="overlay-logo">Pac-Man</h2>
      <p className="overlay-tag">Maze chase. One life at a time.</p>
      <section className="howto" aria-labelledby="howto-title">
        <h3 id="howto-title" className="howto-title">
          How to play
        </h3>
        <ol className="howto-list">
          {HOW_TO.map((step, i) => (
            <li key={step}>
              <span className="howto-n">{i + 1}</span>
              <span className="howto-t">{step}</span>
            </li>
          ))}
        </ol>
      </section>
      <ul className="ghost-strip" aria-label="Ghosts">
        {ghosts.map((id) => (
          <li key={id} className="ghost-chip">
            <GhostMark color={GHOST_COLOR[id]} />
            <span>{GHOST_NICK[id].name}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="start-btn" onClick={onStart}>
        Start
      </button>
      <p className="overlay-fine">v{VERSION} · Enter or tap · P pause · M mute</p>
    </div>
  );
}

function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="overlay overlay-modal">
      <div className="modal">
        <p className="modal-kicker">Paused</p>
        <h2 className="modal-title">Take a breath</h2>
        <p className="modal-copy">Ghosts wait. Pellets don't wander off.</p>
        <button type="button" className="start-btn" onClick={onResume}>
          Resume
        </button>
      </div>
    </div>
  );
}

function OverOverlay({
  score,
  highScore,
  onRetry,
}: {
  score: number;
  highScore: number;
  onRetry: () => void;
}) {
  const best = score >= highScore && score > 0;
  return (
    <div className="overlay overlay-modal">
      <div className="modal">
        <p className="modal-kicker">{best ? "New high score" : "Game over"}</p>
        <h2 className="modal-title">{formatScore(score)}</h2>
        <p className="modal-copy">Best {formatScore(highScore)}</p>
        <p className="overlay-fine">v{VERSION}</p>
        <button type="button" className="start-btn" onClick={onRetry}>
          Play again
        </button>
      </div>
    </div>
  );
}

function GhostMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" className="ghost-mark" aria-hidden>
      <path
        fill={color}
        d="M1 8a7 7 0 0 1 14 0v6l-1.75-1.2L11.5 14 9.75 12.8 8 14 6.25 12.8 4.5 14 2.75 12.8 1 14V8z"
      />
      <circle cx="5.5" cy="7.5" r="1.4" fill="#f2efe6" />
      <circle cx="10.5" cy="7.5" r="1.4" fill="#f2efe6" />
      <circle cx="6" cy="7.7" r="0.7" fill="#2121de" />
      <circle cx="11" cy="7.7" r="0.7" fill="#2121de" />
    </svg>
  );
}
