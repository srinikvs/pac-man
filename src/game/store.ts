import { create } from "zustand";
import type { PlayState } from "./types";

export interface HudSnap {
  state: PlayState;
  score: number;
  highScore: number;
  lives: number;
  level: number;
  muted: boolean;
  pelletsLeft: number;
}

interface HudStore extends HudSnap {
  patch: (p: Partial<HudSnap>) => void;
}

export const useHud = create<HudStore>((set) => ({
  state: "title",
  score: 0,
  highScore: 0,
  lives: 3,
  level: 1,
  muted: false,
  pelletsLeft: 0,
  patch: (p) => set(p),
}));
