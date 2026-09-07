type TitleScreenProps = {
  onCastOff: () => void;
};

export function TitleScreen({ onCastOff }: TitleScreenProps) {
  return (
    <div
      data-ui
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10"
    >
      <header className="pointer-events-none max-w-xl">
        <p className="font-mono text-xs tracking-[0.28em] text-cream/70 uppercase">
          Morning · Straits of Mackinac
        </p>
        <h1 className="mt-3 font-display text-5xl leading-[0.92] text-cream sm:text-7xl">
          SS Adventure
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/80 sm:text-base">
          A Hallberg-Rassy 340 standing out of the island harbor. Southwest twelve.
          The bluff still holds the last of the night cool. Reef before it builds.
        </p>
      </header>

      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] tracking-wide text-cream/70 sm:text-xs">
          <li>A D · helm</li>
          <li>W S · sheet</li>
          <li>R · reef</li>
          <li>Shift R · shake out</li>
          <li>P · autopilot</li>
          <li>E · engine</li>
          <li>V · view</li>
          <li>Esc · pause</li>
        </ul>
        <button
          type="button"
          onClick={onCastOff}
          className="rounded-xl bg-cream px-8 py-3.5 font-display text-xl text-navy transition-transform duration-150 hover:bg-accent active:scale-[0.98]"
        >
          Cast Off
        </button>
      </div>
    </div>
  );
}
