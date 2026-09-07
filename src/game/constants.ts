/** 1 world unit = 1 meter. +X east, +Y up, +Z south. yaw 0 faces north (−Z). */

export const KN = 0.514444;
export const MS_TO_KN = 1.94384;
export const DEG = Math.PI / 180;
export const MAG_VAR = 6.2; // west, Straits of Mackinac

export const ORIGIN_LAT = 45.8472;
export const ORIGIN_LON = -84.6169;

export const BOAT = {
  loa: 10.95,
  hull: 10.36,
  lwl: 10.1,
  beam: 3.47,
  draft: 1.9,
  disp: 5980,
  ballast: 2300,
  airDraft: 16.42,
  hullSpeedKn: 7.7,
  cockpit: 2.83,
  mainArea: 34.5,
  jibArea: 28.4,
};

export const START = {
  x: 70,
  z: 340,
  headingDeg: 166,
  twsKn: 11.5,
  twdDeg: 228,
};

export const MACKINAC = {
  cx: -640,
  cz: -1980,
  rx: 3180,
  rz: 1680,
};

export const ROUND = {
  cx: 180,
  cz: 1280,
  rx: 780,
  rz: 420,
};

export const FORT = { x: 220, z: -420, y: 42 };
export const GRAND = { x: -920, z: -380, y: 38 };
export const TOWN = { x: 40, z: -160 };
export const HARBOR = { x: 0, z: -40 };

export const ROUND_LIGHT = { x: -40, z: 980 };
export const PASSAGE_LIGHT = { x: -620, z: 720 };

export const BRIDGE = { x: -9200, z: 3600 };

export const FIXED_DT = 1 / 60;
export const WATER_TEMP = 17.4;
