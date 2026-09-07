import { MACKINAC, ROUND, BOAT } from "./constants";
import { clamp, fbm, noise2 } from "./math";

function ellipseD(x: number, z: number, cx: number, cz: number, rx: number, rz: number) {
  const dx = (x - cx) / rx;
  const dz = (z - cz) / rz;
  return Math.sqrt(dx * dx + dz * dz) - 1;
}

function harborNotch(x: number, z: number) {
  const dx = x / 210;
  const dz = (z + 30) / 170;
  return Math.sqrt(dx * dx + dz * dz) - 1;
}

function britishLanding(x: number, z: number) {
  const dx = (x + 400) / 280;
  const dz = (z + 3400) / 160;
  return Math.sqrt(dx * dx + dz * dz) - 1;
}

/** Negative = inside land. */
export function mackinacD(x: number, z: number) {
  const n = (fbm(x * 0.00035, z * 0.00035, 5) - 0.5) * 0.18;
  let d = ellipseD(x, z, MACKINAC.cx, MACKINAC.cz, MACKINAC.rx, MACKINAC.rz) + n;
  const east = ellipseD(x, z, 2400, -1700, 900, 700);
  d = Math.min(d, east + n * 0.4);
  const west = ellipseD(x, z, -2800, -1600, 1100, 800);
  d = Math.min(d, west);
  const southBluff = ellipseD(x, z, -200, -500, 1600, 480);
  d = Math.min(d, southBluff + 0.02);
  const h = harborNotch(x, z);
  if (h < 0) d = Math.max(d, -h * 0.85);
  const bl = britishLanding(x, z);
  if (bl < 0) d = Math.max(d, -bl * 0.5);
  return d;
}

export function roundD(x: number, z: number) {
  const n = (fbm(x * 0.0008, z * 0.0008, 3) - 0.5) * 0.12;
  return ellipseD(x, z, ROUND.cx, ROUND.cz, ROUND.rx, ROUND.rz) + n;
}

export function landD(x: number, z: number) {
  return Math.min(mackinacD(x, z), roundD(x, z));
}

export function isLand(x: number, z: number) {
  return landD(x, z) < 0;
}

export function landNormal(x: number, z: number) {
  const e = 6;
  const d0 = landD(x, z);
  const dx = landD(x + e, z) - d0;
  const dz = landD(x, z + e) - d0;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len, d: d0 };
}

export function landHeight(x: number, z: number) {
  const dm = mackinacD(x, z);
  const dr = roundD(x, z);
  if (dm >= 0 && dr >= 0) return 0;
  if (dr < dm) {
    const inland = clamp(-dr, 0, 1);
    const h = 8 + inland * 18 + fbm(x * 0.004, z * 0.004, 4) * 6;
    return h * clamp(inland * 4, 0, 1);
  }
  const inland = clamp(-dm, 0, 1);
  const south = clamp((-z - 200) / 800, 0, 1);
  const bluff = Math.pow(clamp(-dm * 3.2, 0, 1), 0.55);
  const plateau = 18 + inland * 28 + fbm(x * 0.0012, z * 0.0012, 5) * 10;
  const cliff = 22 + (1 - south) * 18;
  let h = lerp(cliff, plateau, clamp(inland * 1.6, 0, 1));
  h *= bluff;
  if (z > -80 && Math.abs(x) < 240) h *= 0.15;
  return Math.max(0, h);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function waterDepth(x: number, z: number) {
  const d = landD(x, z);
  if (d < 0) return 0;
  const near = 2 + d * 28 + fbm(x * 0.001, z * 0.001, 3) * 6;
  const passage = 22 + noise2(x * 0.0004, z * 0.0004) * 10;
  const open = 40 + noise2(x * 0.0002, z * 0.0002) * 18;
  const fetch = clamp(d / 0.35, 0, 1);
  let depth = lerp(near, lerp(passage, open, fetch), clamp(d * 2, 0, 1));
  if (z > 80 && z < 1100 && x > -900 && x < 600) depth = Math.max(depth, 18);
  return clamp(depth, 0.4, 70);
}

export function grounded(x: number, z: number) {
  return waterDepth(x, z) < BOAT.draft * 0.92;
}

/** 1 = full wind, 0.25 = deep lee. */
export function windExposure(x: number, z: number, twdDeg: number) {
  const twd = (twdDeg * Math.PI) / 180;
  const ux = Math.sin(twd);
  const uz = -Math.cos(twd);
  let exp = 1;
  for (const dist of [180, 420, 800, 1400]) {
    const px = x + ux * dist;
    const pz = z + uz * dist;
    if (isLand(px, pz)) {
      const h = landHeight(px, pz);
      const atten = clamp(h / 28, 0.2, 1) * clamp(1.1 - dist / 1800, 0.2, 1);
      exp *= 1 - 0.55 * atten;
    }
  }
  const lane = 0.82 + 0.18 * noise2(x * 0.0011 + twdDeg * 0.01, z * 0.0011);
  return clamp(exp * lane, 0.22, 1.08);
}

export function fetchMeters(x: number, z: number, twdDeg: number) {
  const twd = (twdDeg * Math.PI) / 180;
  const ux = Math.sin(twd);
  const uz = -Math.cos(twd);
  for (let s = 80; s <= 2400; s += 120) {
    if (isLand(x + ux * s, z + uz * s)) return s;
  }
  return 2600;
}
