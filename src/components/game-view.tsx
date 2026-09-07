import { useEffect, useRef } from "react";
import { createEngine, type Engine } from "@/game/engine";
import { useAdventure } from "@/game/store";
import { Hud } from "./hud";
import { TitleScreen } from "./title-screen";
import { TouchControls } from "./touch-controls";

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const snap = useAdventure((s) => s.snap);
  const overlay = useAdventure((s) => s.overlay);
  const instPage = useAdventure((s) => s.instPage);
  const muted = useAdventure((s) => s.muted);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.audio.setMuted(muted);
  }, [muted]);

  const input = engineRef.current?.input;

  return (
    <div ref={rootRef} className="game-root" tabIndex={0}>
      <canvas ref={canvasRef} className="game-canvas" />
      {snap && overlay === "play" && input ? (
        <>
          <Hud snap={snap} instPage={instPage} input={input} />
          <TouchControls input={input} snap={snap} />
        </>
      ) : null}
      {overlay === "title" ? (
        <TitleScreen
          onCastOff={() => {
            engineRef.current?.begin();
            rootRef.current?.focus();
          }}
        />
      ) : null}
      {overlay === "pause" ? (
        <div data-ui className="absolute inset-0 z-30 flex items-center justify-center bg-navy/50">
          <div className="rounded-2xl bg-surface px-8 py-6 text-center">
            <p className="font-display text-3xl text-cream">Hove to</p>
            <p className="mt-2 text-sm text-muted">Esc to resume</p>
            <button
              type="button"
              className="mt-5 rounded-lg bg-cream px-5 py-2 font-medium text-navy"
              onClick={() => engineRef.current?.input.tapPause()}
            >
              Resume
            </button>
          </div>
        </div>
      ) : null}
      {snap && snap.rain > 0.05 ? <div className="rain-overlay" style={{ opacity: snap.rain * 0.55 }} /> : null}
      <button
        type="button"
        data-ui
        className="absolute top-3 right-3 z-40 min-h-11 rounded-lg bg-bezel/80 px-3 font-mono text-[11px] text-lcd"
        onClick={() => useAdventure.getState().setMuted(!muted)}
      >
        {muted ? "Sound off" : "Sound on"}
      </button>
    </div>
  );
}
