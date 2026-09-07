import { create } from "zustand";
import type { SimSnapshot } from "./types";

export type Overlay = "title" | "play" | "pause";

type AdventureState = {
  snap: SimSnapshot | null;
  overlay: Overlay;
  muted: boolean;
  helmSide: number;
  instPage: number;
  setSnap: (snap: SimSnapshot) => void;
  setOverlay: (overlay: Overlay) => void;
  setMuted: (muted: boolean) => void;
  setMeta: (helmSide: number, instPage: number) => void;
};

export const useAdventure = create<AdventureState>((set) => ({
  snap: null,
  overlay: "title",
  muted: false,
  helmSide: 1,
  instPage: 0,
  setSnap: (snap) => set({ snap }),
  setOverlay: (overlay) => set({ overlay }),
  setMuted: (muted) => set({ muted }),
  setMeta: (helmSide, instPage) => set({ helmSide, instPage }),
}));
