import { DOWN, LEFT, RIGHT, UP, type Dir } from "./types";

export interface Actions {
  dir: Dir | null;
  pause: boolean;
  start: boolean;
  mute: boolean;
}

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "Enter",
  "KeyP",
  "KeyM",
  "Escape",
]);

export class Input {
  private keys = new Set<string>();
  private pressed: string[] = [];
  private prevPause = false;
  private prevStart = false;
  private prevMute = false;
  private swipeDir: Dir | null = null;
  private padDir: Dir | null = null;
  private startX = 0;
  private startY = 0;
  private pointerId: number | null = null;

  attach(el: HTMLElement): () => void {
    const down = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.push(e.code);
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const blur = () => {
      this.keys.clear();
      this.pressed = [];
    };
    const pd = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      this.pointerId = e.pointerId;
      this.startX = e.clientX;
      this.startY = e.clientY;
    };
    const pm = (e: PointerEvent) => {
      if (this.pointerId !== e.pointerId) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      if (Math.hypot(dx, dy) < 18) return;
      this.swipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
      this.startX = e.clientX;
      this.startY = e.clientY;
    };
    const pu = (e: PointerEvent) => {
      if (this.pointerId === e.pointerId) this.pointerId = null;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", blur);
    el.addEventListener("pointerdown", pd);
    el.addEventListener("pointermove", pm);
    el.addEventListener("pointerup", pu);
    el.addEventListener("pointercancel", pu);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", blur);
      el.removeEventListener("pointerdown", pd);
      el.removeEventListener("pointermove", pm);
      el.removeEventListener("pointerup", pu);
      el.removeEventListener("pointercancel", pu);
    };
  }

  setPadDir(dir: Dir | null): void {
    this.padDir = dir;
  }

  poll(): Actions {
    let dir: Dir | null = this.swipeDir ?? this.padDir;
    this.swipeDir = null;

    const latest = [...this.pressed].reverse();
    for (const code of latest) {
      const d = codeToDir(code);
      if (d !== null && this.keys.has(code)) {
        dir = d;
        break;
      }
    }
    if (dir === null) {
      for (const code of this.keys) {
        const d = codeToDir(code);
        if (d !== null) {
          dir = d;
          break;
        }
      }
    }

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        const b = pad.buttons;
        if (b[12]?.pressed) dir = UP;
        else if (b[13]?.pressed) dir = DOWN;
        else if (b[14]?.pressed) dir = LEFT;
        else if (b[15]?.pressed) dir = RIGHT;
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const m = Math.hypot(ax, ay);
        if (m > 0.35) {
          dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? RIGHT : LEFT) : ay > 0 ? DOWN : UP;
        }
        if (b[9]?.pressed || b[0]?.pressed) {
          /* start handled below via keys; treat A/start as start */
        }
      }
    }

    const pauseHeld = this.keys.has("KeyP") || this.keys.has("Escape");
    const startHeld = this.keys.has("Enter") || this.keys.has("Space");
    const muteHeld = this.keys.has("KeyM");
    const pause = pauseHeld && !this.prevPause;
    const start = startHeld && !this.prevStart;
    const mute = muteHeld && !this.prevMute;
    this.prevPause = pauseHeld;
    this.prevStart = startHeld;
    this.prevMute = muteHeld;

    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        if (pad.buttons[9]?.pressed && !this.prevPause) {
          /* start button as pause-or-start is handled by start edge via Space; skip */
        }
      }
    }

    this.pressed = this.pressed.filter((c) => this.keys.has(c));
    return { dir, pause, start, mute };
  }
}

function codeToDir(code: string): Dir | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return UP;
    case "ArrowLeft":
    case "KeyA":
      return LEFT;
    case "ArrowDown":
    case "KeyS":
      return DOWN;
    case "ArrowRight":
    case "KeyD":
      return RIGHT;
    default:
      return null;
  }
}
