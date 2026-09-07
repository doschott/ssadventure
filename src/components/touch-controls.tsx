import type { InputSystem } from "@/game/input";
import type { SimSnapshot } from "@/game/types";

type Props = {
  input: InputSystem;
  snap: SimSnapshot;
};

function HoldBtn({
  label,
  onHold,
  onRelease,
}: {
  label: string;
  onHold: () => void;
  onRelease: () => void;
}) {
  return (
    <button
      type="button"
      className="min-h-11 min-w-11 rounded-lg bg-bezel/85 px-3 font-mono text-[11px] text-lcd"
      onPointerDown={(e) => {
        e.preventDefault();
        onHold();
      }}
      onPointerUp={onRelease}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
    >
      {label}
    </button>
  );
}

export function TouchControls({ input, snap }: Props) {
  return (
    <div data-ui className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 sm:hidden">
      <div className="pointer-events-auto flex items-end justify-between gap-2">
        <div className="flex gap-2">
          <HoldBtn
            label="Port"
            onHold={() => input.setSteer(1)}
            onRelease={() => input.setSteer(null)}
          />
          <HoldBtn
            label="Stbd"
            onHold={() => input.setSteer(-1)}
            onRelease={() => input.setSteer(null)}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <HoldBtn
            label="In"
            onHold={() => input.setSheet(1)}
            onRelease={() => input.setSheet(null)}
          />
          <HoldBtn
            label="Ease"
            onHold={() => input.setSheet(-1)}
            onRelease={() => input.setSheet(null)}
          />
          <button
            type="button"
            className="min-h-11 rounded-lg bg-bezel/85 px-3 font-mono text-[11px] text-lcd"
            onClick={() => input.tapAp()}
          >
            AP {snap.apMode === "standby" ? "off" : snap.apMode}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-bezel/85 px-3 font-mono text-[11px] text-lcd"
            onClick={() => input.tapReef()}
          >
            Reef
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-bezel/85 px-3 font-mono text-[11px] text-lcd"
            onClick={() => input.tapEngine()}
          >
            Eng
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-bezel/85 px-3 font-mono text-[11px] text-lcd"
            onClick={() => input.tapView()}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}
