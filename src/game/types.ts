export type ApMode = "standby" | "auto" | "wind";

export type PointOfSail =
  | "in-irons"
  | "close-hauled"
  | "close-reach"
  | "beam-reach"
  | "broad-reach"
  | "run";

export type WeatherKind =
  | "steady"
  | "building"
  | "shift"
  | "lee-calm"
  | "fog"
  | "squall"
  | "glass-off";

export type ViewMode = "cinematic" | "helm" | "coaming" | "chase";

export type SimSnapshot = {
  x: number;
  z: number;
  y: number;
  yaw: number;
  headingTrue: number;
  headingMag: number;
  speed: number;
  sway: number;
  yawRate: number;
  heel: number;
  pitch: number;
  heave: number;
  rudder: number;
  helm: number;
  stwKn: number;
  sogKn: number;
  cog: number;
  awaDeg: number;
  awsKn: number;
  twaDeg: number;
  twsKn: number;
  twdDeg: number;
  depth: number;
  waterTemp: number;
  lat: number;
  lon: number;
  currentKn: number;
  heelDeg: number;
  apMode: ApMode;
  apHeading: number;
  apWindAngle: number;
  reef: number;
  furl: number;
  mainSheet: number;
  jibSheet: number;
  sailStep: number;
  pointOfSail: PointOfSail;
  tack: "port" | "starboard" | "head";
  luff: number;
  telltalePort: number;
  telltaleStbd: number;
  engineOn: boolean;
  rpm: number;
  throttle: number;
  alarm: string | null;
  vhfText: string | null;
  weatherKind: WeatherKind;
  weatherLabel: string;
  warningPhase: number;
  fog: number;
  cloud: number;
  rain: number;
  sunAz: number;
  sunEl: number;
  timeHours: number;
  waveAmp: number;
  waveDir: number;
  chop: number;
  windShadow: number;
  fx: number;
  fz: number;
  lookYaw: number;
  lookPitch: number;
  view: ViewMode;
  playing: boolean;
  paused: boolean;
};

export type InputState = {
  steer: number;
  sheet: number;
  lookX: number;
  lookY: number;
  reefTap: number;
  unreefTap: number;
  apTap: boolean;
  viewTap: boolean;
  engineTap: boolean;
  helmSideTap: boolean;
  pauseTap: boolean;
  cycleInstTap: boolean;
  throttle: number;
  keys: Set<string>;
};

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __sim?: SimSnapshot;
    __ready?: boolean;
  }
}
