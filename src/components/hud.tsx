import { useEffect, useRef } from "react";
import { landD } from "@/game/world-sdf";
import type { InputSystem } from "@/game/input";
import type { SimSnapshot } from "@/game/types";
import { wrap360 } from "@/game/math";

type HudProps = {
  snap: SimSnapshot;
  instPage: number;
  input: InputSystem;
};

function fmt(n: number, d = 1) {
  return n.toFixed(d);
}

function Gauge({
  label,
  value,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
}) {
  const span = max - min;
  const t = Math.max(0, Math.min(1, (value - min) / span));
  const ang = -120 + t * 240;
  return (
    <div className="flex w-16 flex-col items-center sm:w-[72px]">
      <svg viewBox="0 0 100 88" className="h-auto w-full text-lcd">
        <circle cx="50" cy="48" r="38" fill="#12181c" stroke="currentColor" strokeOpacity="0.22" />
        <path
          d="M20 68 A34 34 0 1 1 80 68"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeOpacity="0.35"
        />
        <g transform={`rotate(${ang} 50 48)`}>
          <line x1="50" y1="48" x2="50" y2="18" stroke="#c45c4a" strokeWidth="2.4" />
        </g>
        <circle cx="50" cy="48" r="3" fill="#c45c4a" />
        <text x="50" y="80" textAnchor="middle" fill="currentColor" fontSize="9" fontFamily="IBM Plex Mono, monospace">
          {label}
        </text>
      </svg>
      <p className="font-mono text-[10px] tabular-nums text-lcd">
        {fmt(value, value >= 100 ? 0 : 1)}
        <span className="ml-1 text-faint">{unit}</span>
      </p>
    </div>
  );
}

function Compass({ heading }: { heading: number }) {
  const rot = -heading;
  return (
    <div className="flex w-16 flex-col items-center sm:w-[72px]">
      <svg viewBox="0 0 100 88" className="h-auto w-full text-lcd">
        <circle cx="50" cy="44" r="36" fill="#12181c" stroke="currentColor" strokeOpacity="0.3" />
        <g transform={`rotate(${rot} 50 44)`}>
          <text x="50" y="18" textAnchor="middle" fill="currentColor" fontSize="9">
            N
          </text>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
            <line
              key={d}
              x1="50"
              y1="10"
              x2="50"
              y2={d % 90 === 0 ? 16 : 13}
              stroke="currentColor"
              strokeWidth={d % 90 === 0 ? 2 : 1}
              transform={`rotate(${d} 50 44)`}
            />
          ))}
        </g>
        <polygon points="50,18 47,44 53,44" fill="#c45c4a" />
      </svg>
      <p className="font-mono text-[10px] tabular-nums text-lcd">
        {Math.round(wrap360(heading)).toString().padStart(3, "0")}°
      </p>
    </div>
  );
}

function Chart({ x, z, yaw }: { x: number; z: number; yaw: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.fillStyle = "#cbbd93";
    ctx.fillRect(0, 0, w, h);
    const scale = 16;
    for (let j = 0; j < h; j += 2) {
      for (let i = 0; i < w; i += 2) {
        const wx = x + (i - w / 2) * scale;
        const wz = z + (j - h / 2) * scale;
        if (landD(wx, wz) < 0) {
          ctx.fillStyle = "#355c38";
          ctx.fillRect(i, j, 2, 2);
        }
      }
    }
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(yaw);
    ctx.fillStyle = "#8b2a2a";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [x, z, yaw]);
  return <canvas ref={ref} width={120} height={120} className="h-20 w-20 rounded-md sm:h-24 sm:w-24" />;
}

function yarnEnd(stream: number, side: number) {
  const s = Math.max(0, Math.min(1, stream));
  const x = 84 + side * (5 + s * 5 + (1 - s) * 9);
  const y = 46 + s * 14 + (1 - s) * 5;
  return { x, y };
}

function WindDial({
  awaDeg,
  awsKn,
  twaDeg,
  luff,
  telltalePort,
  telltaleStbd,
}: {
  awaDeg: number;
  awsKn: number;
  twaDeg: number;
  luff: number;
  telltalePort: number;
  telltaleStbd: number;
}) {
  const drawing = luff < 0.35;
  const cx = 84;
  const cy = 52;
  const r = 34;
  const feathers = Math.min(5, Math.max(1, Math.round(awsKn / 5)));
  const portYarn = yarnEnd(telltalePort, -1);
  const stbdYarn = yarnEnd(telltaleStbd, 1);
  const sideLabel = Math.abs(awaDeg) < 12 ? "HEAD" : awaDeg > 0 ? "PORT" : "STBD";
  return (
    <div className="mt-1 flex flex-col items-center">
      <svg viewBox="0 0 168 96" className="h-[4.6rem] w-[10.5rem] text-lcd sm:h-20 sm:w-48">
        <circle cx={cx} cy={cy} r={r + 6} fill="#12181c" stroke="currentColor" strokeOpacity="0.28" />
        {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((d) => {
          const rad = ((-d - 90) * Math.PI) / 180;
          const inner = Math.abs(d) % 90 === 0 ? r - 6 : r - 3.5;
          const x1 = cx + Math.cos(rad) * inner;
          const y1 = cy + Math.sin(rad) * inner;
          const x2 = cx + Math.cos(rad) * r;
          const y2 = cy + Math.sin(rad) * r;
          return (
            <line
              key={d}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={d % 90 === 0 ? 1.8 : 1}
              strokeOpacity={0.45}
            />
          );
        })}
        <g transform={`rotate(${-twaDeg} ${cx} ${cy})`}>
          <polygon
            points={`${cx},${cy - r - 5} ${cx - 4},${cy - r + 3} ${cx + 4},${cy - r + 3}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
        </g>
        <g transform={`rotate(${-awaDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy - 8}
            x2={cx}
            y2={cy - r + 6}
            stroke={drawing ? "#7d9a78" : "#c45c4a"}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <polygon
            points={`${cx},${cy - r - 1} ${cx - 5.5},${cy - r + 9} ${cx + 5.5},${cy - r + 9}`}
            fill={drawing ? "#7d9a78" : "#c45c4a"}
          />
          {Array.from({ length: feathers }).map((_, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy - r + 14 + i * 4}
              x2={cx + 7}
              y2={cy - r + 11 + i * 4}
              stroke={drawing ? "#7d9a78" : "#c45c4a"}
              strokeWidth="1.4"
            />
          ))}
        </g>
        <polygon points="84,28 91,68 84,62 77,68" fill="#cfd8d0" fillOpacity="0.92" />
        <line
          x1="80"
          y1="46"
          x2={portYarn.x}
          y2={portYarn.y}
          stroke="#c45c4a"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="88"
          y1="46"
          x2={stbdYarn.x}
          y2={stbdYarn.y}
          stroke="#7d9a78"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <text x="84" y="16" textAnchor="middle" fill="currentColor" fontSize="8" fontFamily="IBM Plex Mono, monospace">
          APP WIND
        </text>
      </svg>
      <p className="font-mono text-[10px] tabular-nums text-lcd">
        {fmt(Math.abs(awaDeg), 0)}° {sideLabel}
        <span className="ml-1 text-faint">{fmt(awsKn, 1)} kn</span>
        <span className="ml-1 text-faint">{drawing ? "drawing" : "luffing"}</span>
      </p>
    </div>
  );
}

const POS_LABEL: Record<SimSnapshot["pointOfSail"], string> = {
  "in-irons": "In irons",
  "close-hauled": "Close hauled",
  "close-reach": "Close reach",
  "beam-reach": "Beam reach",
  "broad-reach": "Broad reach",
  run: "Run",
};

function trimLabel(snap: SimSnapshot) {
  if (snap.luff > 0.45) return "yarns fluttering";
  if (snap.telltalePort < 0.4 || snap.telltaleStbd < 0.4) return "windward stalled";
  return "yarns streaming";
}

export function Hud({ snap, instPage, input }: HudProps) {
  const pos = POS_LABEL[snap.pointOfSail];
  return (
    <div data-ui className="pointer-events-none absolute inset-0 z-10 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-lg bg-bezel/80 px-3 py-2 text-lcd">
          <p className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">SS Adventure</p>
          <p className="font-mono text-[11px] tabular-nums text-lcd">
            {snap.lat.toFixed(3)} N {Math.abs(snap.lon).toFixed(3)} W
          </p>
          <p className="mt-0.5 max-w-[14rem] font-sans text-[11px] text-muted">{snap.weatherLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 pr-20">
          {snap.alarm ? (
            <div className="rounded-md bg-alarm px-3 py-1 font-mono text-xs tracking-widest text-cream">
              {snap.alarm}
            </div>
          ) : null}
          <div className="rounded-md bg-bezel/80 px-2 py-1 font-mono text-[11px] text-lcd">
            AP {snap.apMode.toUpperCase()}
            {snap.engineOn ? ` · ENG ${Math.round(snap.rpm)}` : ""}
          </div>
        </div>
      </div>

      {snap.vhfText ? (
        <div className="pointer-events-none absolute top-24 right-4 left-4 mx-auto max-w-md rounded-xl border border-border bg-bezel/90 p-3 sm:right-6 sm:left-auto">
          <p className="font-mono text-[10px] tracking-[0.22em] text-ap uppercase">VHF 16 · NOAA</p>
          <p className="mt-2 font-sans text-sm leading-relaxed text-cream">{snap.vhfText}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-3 bottom-24 left-3 sm:bottom-4">
        <div className="pointer-events-auto absolute bottom-0 left-0 hidden rounded-lg bg-bezel/80 p-1.5 sm:block">
          <Chart x={snap.x} z={snap.z} yaw={snap.yaw} />
        </div>
        <div className="flex flex-col items-center">
          <div className="flex flex-col items-center rounded-xl bg-bezel/80 px-2 py-1.5 sm:px-3">
            <div className="flex items-end gap-0.5 sm:gap-1">
              {instPage === 0 ? (
                <>
                  <Gauge label="AWS" value={snap.awsKn} min={0} max={30} unit="kn" />
                  <Compass heading={snap.headingMag} />
                  <Gauge label="STW" value={snap.stwKn} min={0} max={10} unit="kn" />
                </>
              ) : instPage === 1 ? (
                <>
                  <Gauge label="TWS" value={snap.twsKn} min={0} max={30} unit="kn" />
                  <Compass heading={snap.twdDeg} />
                  <Gauge label="SOG" value={snap.sogKn} min={0} max={10} unit="kn" />
                </>
              ) : (
                <>
                  <Gauge label="DEPTH" value={snap.depth} min={0} max={40} unit="m" />
                  <Compass heading={snap.cog} />
                  <Gauge label="HEEL" value={Math.abs(snap.heelDeg)} min={0} max={35} unit="°" />
                </>
              )}
            </div>
            <WindDial
              awaDeg={snap.awaDeg}
              awsKn={snap.awsKn}
              twaDeg={snap.twaDeg}
              luff={snap.luff}
              telltalePort={snap.telltalePort}
              telltaleStbd={snap.telltaleStbd}
            />
          </div>
          <div className="mt-1 flex max-w-[92vw] flex-wrap items-center justify-center gap-x-2 rounded-md bg-bezel/70 px-2 py-0.5 font-mono text-[10px] text-lcd">
            <span>{pos}</span>
            <span className="text-faint">·</span>
            <span>{snap.tack === "head" ? "head to wind" : `${snap.tack} tack`}</span>
            <span className="text-faint">·</span>
            <span>AWA {fmt(snap.awaDeg, 0)}°</span>
            <span className="text-faint">·</span>
            <span>{trimLabel(snap)}</span>
            <button
              type="button"
              className="pointer-events-auto ml-1 text-muted underline-offset-2 hover:underline"
              onClick={() => input.tapInst()}
            >
              C
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
