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
  /** Last requested heading — latched until a new one arrives (arcade style). */
  private lastDir: Dir | null = null;
  private source: "key" | "pad" | "swipe" | "stick" = "stick";
  private startX = 0;
  private startY = 0;
  private pointerId: number | null = null;
  private onDir: ((dir: Dir) => void) | null = null;

  attach(el: HTMLElement, onDir?: (dir: Dir) => void): () => void {
    this.onDir = onDir ?? null;
    const emit = (dir: Dir, source: "key" | "pad" | "swipe") => {
      this.lastDir = dir;
      this.source = source;
      this.onDir?.(dir);
    };
    const down = (e: KeyboardEvent) => {
      const code = eventCode(e);
      if (GAME_KEYS.has(code) || GAME_KEYS.has(e.code)) e.preventDefault();
      const key = code || e.code;
      if (!this.keys.has(key)) this.pressed.push(key);
      this.keys.add(key);
      const d = codeToDir(key) ?? codeToDir(e.code) ?? keyToDir(e.key);
      if (d !== null) emit(d, "key");
    };
    const up = (e: KeyboardEvent) => {
      const key = eventCode(e) || e.code;
      this.keys.delete(key);
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
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
      this.swipeDir = dir;
      this.startX = e.clientX;
      this.startY = e.clientY;
      emit(dir, "swipe");
    };
    const pu = (e: PointerEvent) => {
      if (this.pointerId === e.pointerId) this.pointerId = null;
    };

    const vis = () => {
      if (document.visibilityState !== "visible") blur();
    };

    const keyOpts: AddEventListenerOptions = { capture: true };
    window.addEventListener("keydown", down, keyOpts);
    window.addEventListener("keyup", up, keyOpts);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    el.addEventListener("pointerdown", pd);
    el.addEventListener("pointermove", pm);
    el.addEventListener("pointerup", pu);
    el.addEventListener("pointercancel", pu);

    return () => {
      window.removeEventListener("keydown", down, keyOpts);
      window.removeEventListener("keyup", up, keyOpts);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      el.removeEventListener("pointerdown", pd);
      el.removeEventListener("pointermove", pm);
      el.removeEventListener("pointerup", pu);
      el.removeEventListener("pointercancel", pu);
    };
  }

  setPadDir(dir: Dir | null): void {
    this.padDir = dir;
    if (dir !== null) {
      this.lastDir = dir;
      this.source = "pad";
      this.onDir?.(dir);
    }
  }

  /** QA / controls-skill probe: hold these `event.code` values until the next call. */
  setHeld(codes: string[]): void {
    this.keys.clear();
    this.pressed = [];
    this.padDir = null;
    for (const code of codes) {
      this.keys.add(code);
      this.pressed.push(code);
      const d = codeToDir(code);
      if (d !== null) {
        this.lastDir = d;
        this.source = "key";
        this.onDir?.(d);
      }
    }
  }

  poll(): Actions {
    let dir: Dir | null = this.lastDir;

    if (this.source === "key") {
      const latest = [...this.pressed].reverse();
      let fromKey: Dir | null = null;
      for (const code of latest) {
        const d = codeToDir(code);
        if (d !== null && this.keys.has(code)) {
          fromKey = d;
          break;
        }
      }
      if (fromKey === null) {
        for (const code of this.keys) {
          const d = codeToDir(code);
          if (d !== null) {
            fromKey = d;
            break;
          }
        }
      }
      if (fromKey !== null) dir = fromKey;
    } else if (this.padDir !== null) {
      dir = this.padDir;
    } else if (this.swipeDir !== null) {
      dir = this.swipeDir;
    }

    this.swipeDir = null;

    try {
      const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
      if (pads) {
        for (const pad of Array.from(pads)) {
          if (!pad) continue;
          const b = pad.buttons;
          if (!b) continue;
          if (b[12]?.pressed) dir = UP;
          else if (b[13]?.pressed) dir = DOWN;
          else if (b[14]?.pressed) dir = LEFT;
          else if (b[15]?.pressed) dir = RIGHT;
          const ax = pad.axes[0] ?? 0;
          const ay = pad.axes[1] ?? 0;
          const m = Math.hypot(ax, ay);
          if (m > 0.45) {
            dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? RIGHT : LEFT) : ay > 0 ? DOWN : UP;
          }
        }
      }
    } catch {
      /* getGamepads is array-like / throws in some WebViews */
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

    if (dir !== null) this.lastDir = dir;
    this.pressed = this.pressed.filter((c) => this.keys.has(c));
    return { dir, pause, start, mute };
  }
}

function eventCode(e: KeyboardEvent): string {
  if (e.code && e.code !== "Unidentified") return e.code;
  return keyToCode(e.key);
}

function keyToCode(key: string): string {
  switch (key) {
    case "ArrowUp":
    case "Up":
      return "ArrowUp";
    case "ArrowLeft":
    case "Left":
      return "ArrowLeft";
    case "ArrowDown":
    case "Down":
      return "ArrowDown";
    case "ArrowRight":
    case "Right":
      return "ArrowRight";
    case "w":
    case "W":
      return "KeyW";
    case "a":
    case "A":
      return "KeyA";
    case "s":
    case "S":
      return "KeyS";
    case "d":
    case "D":
      return "KeyD";
    case "p":
    case "P":
      return "KeyP";
    case "m":
    case "M":
      return "KeyM";
    case " ":
    case "Spacebar":
      return "Space";
    case "Enter":
      return "Enter";
    case "Escape":
    case "Esc":
      return "Escape";
    default:
      return "";
  }
}

function keyToDir(key: string): Dir | null {
  return codeToDir(keyToCode(key));
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
