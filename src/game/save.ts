import { SAVE_KEY, SAVE_VERSION } from "./constants";

interface SaveV1 {
  version: number;
  highScore: number;
  muted: boolean;
}

const defaults: SaveV1 = { version: SAVE_VERSION, highScore: 0, muted: false };

function migrate(raw: unknown): SaveV1 {
  if (!raw || typeof raw !== "object") return { ...defaults };
  const s = raw as Partial<SaveV1>;
  return {
    version: SAVE_VERSION,
    highScore: typeof s.highScore === "number" && s.highScore >= 0 ? Math.floor(s.highScore) : 0,
    muted: Boolean(s.muted),
  };
}

export function loadSave(): SaveV1 {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...defaults };
    return migrate(JSON.parse(raw));
  } catch {
    return { ...defaults };
  }
}

export function writeSave(next: Partial<SaveV1>): SaveV1 {
  const cur = loadSave();
  const merged: SaveV1 = {
    version: SAVE_VERSION,
    highScore: next.highScore ?? cur.highScore,
    muted: next.muted ?? cur.muted,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(merged));
  } catch {
    /* private mode / quota */
  }
  return merged;
}
