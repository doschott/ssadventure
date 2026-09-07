import {
  BOAT,
  DEG,
  FIXED_DT,
  KN,
  MAG_VAR,
  MS_TO_KN,
  ORIGIN_LAT,
  ORIGIN_LON,
  START,
  WATER_TEMP,
} from "./constants";
import { angDiff, clamp, degDiff, lerp, noise2, wrap360, wrapPi } from "./math";
import type { ApMode, InputState, PointOfSail, SimSnapshot, WeatherKind } from "./types";
import { fetchMeters, landNormal, waterDepth, windExposure } from "./world-sdf";
import { seaHeight } from "./water";

const RHO_AIR = 1.225;
const MCOS = Math.cos((ORIGIN_LAT * Math.PI) / 180);
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * MCOS;

const SAIL_STEPS = [
  { reef: 0, furl: 0 },
  { reef: 0, furl: 0.28 },
  { reef: 1, furl: 0.28 },
  { reef: 1, furl: 0.5 },
  { reef: 2, furl: 0.55 },
  { reef: 2, furl: 0.78 },
];

type WeatherEvent = {
  kind: WeatherKind;
  t0: number;
  warnAt: number;
  radioAt: number;
  skyAt: number;
  hitAt: number;
  endAt: number;
  label: string;
  radio: string;
  twsTarget: number;
  twdTarget: number;
};

function pointOfSail(absAwa: number): PointOfSail {
  if (absAwa < 28) return "in-irons";
  if (absAwa < 50) return "close-hauled";
  if (absAwa < 75) return "close-reach";
  if (absAwa < 110) return "beam-reach";
  if (absAwa < 155) return "broad-reach";
  return "run";
}

function clCd(aoa: number, luff: number) {
  const a = Math.abs(aoa);
  let cl = 0;
  let cd = 0.12 + luff * 0.35;
  if (a < 8) {
    cl = (a / 8) * 0.35;
    cd += 0.08;
  } else if (a < 22) {
    cl = 0.35 + ((a - 8) / 14) * 1.05;
    cd += 0.04;
  } else if (a < 38) {
    cl = 1.4 - ((a - 22) / 16) * 0.55;
    cd += 0.1 + ((a - 22) / 16) * 0.35;
  } else {
    cl = 0.55 * Math.exp(-(a - 38) / 40);
    cd += 0.55;
  }
  cl *= 1 - luff * 0.85;
  return { cl, cd };
}

export function createSim() {
  const yaw0 = -START.headingDeg * DEG;
  const st: SimSnapshot = {
    x: START.x,
    z: START.z,
    y: 0.3,
    yaw: yaw0,
    headingTrue: START.headingDeg,
    headingMag: wrap360(START.headingDeg + MAG_VAR),
    speed: 5.8 * KN,
    sway: 0.15,
    yawRate: 0,
    heel: 8 * DEG,
    pitch: 0,
    heave: 0,
    rudder: 0,
    helm: 0,
    stwKn: 5.8,
    sogKn: 5.9,
    cog: START.headingDeg,
    awaDeg: 0,
    awsKn: 0,
    twaDeg: 0,
    twsKn: START.twsKn,
    twdDeg: START.twdDeg,
    depth: 22,
    waterTemp: WATER_TEMP,
    lat: ORIGIN_LAT,
    lon: ORIGIN_LON,
    currentKn: 0.35,
    heelDeg: 8,
    apMode: "standby",
    apHeading: START.headingDeg,
    apWindAngle: 60,
    reef: 0,
    furl: 0,
    mainSheet: 0.62,
    jibSheet: 0.58,
    sailStep: 0,
    pointOfSail: "close-reach",
    tack: "starboard",
    luff: 0,
    telltalePort: 1,
    telltaleStbd: 1,
    engineOn: false,
    rpm: 0,
    throttle: 0,
    alarm: null,
    vhfText: null,
    weatherKind: "steady",
    weatherLabel: "Southwest 12 knots, clear",
    warningPhase: 0,
    fog: 0,
    cloud: 0.18,
    rain: 0,
    sunAz: 98 * DEG,
    sunEl: 34 * DEG,
    timeHours: 8.15,
    waveAmp: 0.28,
    waveDir: 228 * DEG,
    chop: 0.5,
    windShadow: 1,
    fx: 0,
    fz: -1,
    lookYaw: 0,
    lookPitch: -0.04,
    view: "cinematic",
    playing: false,
    paused: false,
  };

  let time = 0;
  let currentAngle = 80 * DEG;
  let currentSpd = 0.32 * KN;
  let twsBase = START.twsKn * KN;
  let twdBase = START.twdDeg * DEG;
  let gust = 0;
  let event: WeatherEvent | null = null;
  let nextEventAt = 95 + Math.random() * 70;
  let headingAlarmT = 0;
  let depthAlarmT = 0;
  let windAlarmT = 0;
  let vhfHold = 0;
  let lastTws = twsBase;
  let apInt = 0;
  let helmSide = 1;
  let instPage = 0;
  let engineRpm = 0;

  function stormy() {
    return (
      st.weatherKind === "squall" ||
      (st.weatherKind === "building" && st.warningPhase >= 4) ||
      st.twsKn >= 22 ||
      st.rain > 0.35
    );
  }

  function pickEvent(now: number): WeatherEvent {
    const kinds: WeatherKind[] = ["building", "shift", "lee-calm", "fog", "squall", "glass-off"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const warn = now + 8;
    const radio = now + 18;
    const sky = now + 38;
    const hit = kind === "squall" ? now + 95 : now + 70;
    const end = hit + (kind === "squall" ? 90 : 140);
    const table: Record<WeatherKind, Omit<WeatherEvent, "kind" | "t0" | "warnAt" | "radioAt" | "skyAt" | "hitAt" | "endAt">> = {
      steady: {
        label: "Fair summer breeze",
        radio: "",
        twsTarget: 11,
        twdTarget: 228,
      },
      building: {
        label: "Building southwest breeze",
        radio:
          "This is NOAA Weather Radio. Small craft advisory for the Straits of Mackinac including Mackinac Island. Southwest winds 15 to 25 knots. Waves building to 3 feet. Mariners should prepare to reef.",
        twsTarget: 20,
        twdTarget: 236,
      },
      shift: {
        label: "Wind shifting west",
        radio:
          "This is NOAA Weather Radio. Straits of Mackinac. A cold front will shift winds from southwest to west-northwest 10 to 18 knots later this morning. Mariners should expect a veer of 40 to 60 degrees.",
        twsTarget: 14,
        twdTarget: 292,
      },
      "lee-calm": {
        label: "Calm hole developing in the lee",
        radio:
          "This is NOAA Weather Radio. Straits of Mackinac. Winds becoming light and variable in the lee of Mackinac Island. Open water southwest 8 to 12 knots.",
        twsTarget: 4,
        twdTarget: 210,
      },
      fog: {
        label: "Fog bank over the Straits",
        radio:
          "This is NOAA Weather Radio. Straits of Mackinac including Mackinac Island. Patchy dense fog developing. Visibility dropping below one nautical mile. Radar recommended.",
        twsTarget: 8,
        twdTarget: 200,
      },
      squall: {
        label: "Thunderstorm squall",
        radio:
          "This is NOAA Weather Radio. Severe weather warning for the Straits of Mackinac including Mackinac Island. A fast Great Lakes thunderstorm squall. Southwest winds 15 to 25 knots becoming north 30 knots with the gust front. Waves building to 4 feet. Mariners should reef now and stand by.",
        twsTarget: 28,
        twdTarget: 10,
      },
      "glass-off": {
        label: "Evening glass-off",
        radio:
          "This is NOAA Weather Radio. Straits of Mackinac. Winds becoming light this evening. Southwest 5 knots or less. Water going flat. Enjoy the glass-off.",
        twsTarget: 2.5,
        twdTarget: 240,
      },
    };
    return { kind, t0: now, warnAt: warn, radioAt: radio, skyAt: sky, hitAt: hit, endAt: end, ...table[kind] };
  }

  function weatherStep(dt: number) {
    time += dt;
    st.timeHours = 8.15 + time / 3600;
    if (!event && time > nextEventAt) {
      event = pickEvent(time);
      st.weatherKind = event.kind;
    }
    let phase = 0;
    if (event) {
      if (time >= event.warnAt) phase = 1;
      if (time >= event.radioAt) phase = 2;
      if (time >= event.skyAt) phase = 3;
      if (time >= event.hitAt) phase = 4;
      st.weatherLabel = event.label;
      if (phase >= 2 && vhfHold <= 0 && event.radio) {
        st.vhfText = event.radio;
        vhfHold = 28;
      }
      const k = event;
      if (time >= k.hitAt) {
        const u = clamp((time - k.hitAt) / 18, 0, 1);
        twsBase = lerp(twsBase, k.twsTarget * KN, 1 - Math.pow(1 - u, 2));
        twdBase = twdBase + wrapPi(k.twdTarget * DEG - twdBase) * 0.4 * dt;
        if (k.kind === "fog") st.fog = lerp(st.fog, 0.82, dt * 0.12);
        if (k.kind === "squall") {
          st.cloud = lerp(st.cloud, 0.92, dt * 0.2);
          st.rain = lerp(st.rain, 0.7, dt * 0.15);
        }
        if (k.kind === "building") st.cloud = lerp(st.cloud, 0.45, dt * 0.05);
        if (k.kind === "glass-off") {
          st.cloud = lerp(st.cloud, 0.08, dt * 0.04);
          st.timeHours = lerp(st.timeHours, 19.2, dt * 0.02);
        }
      } else if (time >= k.skyAt) {
        if (k.kind === "fog") st.fog = lerp(st.fog, 0.35, dt * 0.08);
        if (k.kind === "squall") st.cloud = lerp(st.cloud, 0.62, dt * 0.1);
        if (k.kind === "building") twsBase = lerp(twsBase, (k.twsTarget * 0.55) * KN, dt * 0.04);
      } else if (time >= k.warnAt) {
        if (k.kind === "building" || k.kind === "squall") {
          twsBase = lerp(twsBase, twsBase + 0.4 * KN, dt * 0.02);
        }
      }
      if (time > k.endAt) {
        event = null;
        nextEventAt = time + 80 + Math.random() * 90;
        st.weatherKind = "steady";
        st.weatherLabel = "Settling breeze";
        st.vhfText = null;
      }
    } else {
      twsBase = lerp(twsBase, START.twsKn * KN, dt * 0.02);
      twdBase = twdBase + wrapPi(START.twdDeg * DEG - twdBase) * 0.05 * dt;
      st.fog = lerp(st.fog, 0, dt * 0.04);
      st.cloud = lerp(st.cloud, 0.16, dt * 0.03);
      st.rain = lerp(st.rain, 0, dt * 0.08);
      st.weatherLabel = "Southwest breeze, clear morning";
    }
    st.warningPhase = phase;
    vhfHold = Math.max(0, vhfHold - dt);

    gust = lerp(gust, (noise2(time * 0.17, 2.2) - 0.5) * 2.4 * KN, dt * 1.8);
    const exp = windExposure(st.x, st.z, (twdBase * 180) / Math.PI);
    st.windShadow = exp;
    const tws = Math.max(0.2, (twsBase + gust) * exp);
    const twd = twdBase + (noise2(time * 0.05, 8) - 0.5) * 8 * DEG;
    st.twsKn = tws * MS_TO_KN;
    st.twdDeg = wrap360((twd * 180) / Math.PI);
    const fetch = fetchMeters(st.x, st.z, st.twdDeg);
    const amp = 0.028 * st.twsKn * clamp(fetch / 900, 0.25, 1.4);
    let targetAmp = amp * (0.7 + 0.3 * exp);
    if (!stormy()) targetAmp = Math.min(targetAmp, 0.42);
    st.waveAmp = lerp(st.waveAmp, targetAmp, dt * 0.4);
    st.chop = clamp(st.twsKn / 18, 0.15, 1) * clamp(fetch / 700, 0.3, 1);
    st.waveDir = twd;
    currentAngle += (noise2(time * 0.02, 4) - 0.5) * dt * 0.05;
    currentSpd = (0.25 + noise2(time * 0.01, 1.4) * 0.3) * KN;
    st.currentKn = currentSpd * MS_TO_KN;

    const hour = st.timeHours % 24;
    const solar = ((hour - 6) / 12) * Math.PI;
    st.sunEl = Math.max(4 * DEG, Math.sin(solar) * 58 * DEG);
    st.sunAz = (90 + (hour - 8) * 18) * DEG;
    lastTws = tws;
    void lastTws;
  }

  function applyInput(inp: InputState, dt: number) {
    if (inp.reefTap) st.sailStep = Math.min(SAIL_STEPS.length - 1, st.sailStep + inp.reefTap);
    if (inp.unreefTap) st.sailStep = Math.max(0, st.sailStep - inp.unreefTap);
    const step = SAIL_STEPS[st.sailStep]!;
    st.reef = step.reef;
    st.furl = step.furl;
    st.mainSheet = clamp(st.mainSheet + inp.sheet * dt * 0.28, 0.05, 1);
    st.jibSheet = clamp(st.jibSheet + inp.sheet * dt * 0.32, 0.05, 1);

    if (inp.apTap) {
      if (st.apMode === "standby") {
        st.apMode = "auto";
        st.apHeading = st.headingTrue;
        apInt = 0;
      } else if (st.apMode === "auto") {
        st.apMode = "wind";
        st.apWindAngle = st.awaDeg;
      } else {
        st.apMode = "standby";
      }
    }
    if (inp.engineTap) {
      st.engineOn = !st.engineOn;
      if (!st.engineOn) st.throttle = 0;
      else st.throttle = 0.45;
    }
    if (st.engineOn) st.throttle = clamp(st.throttle + inp.throttle * dt * 0.35, 0, 1);
    if (inp.helmSideTap) helmSide *= -1;
    if (inp.viewTap && st.playing) {
      st.view = st.view === "helm" ? "coaming" : st.view === "coaming" ? "chase" : "helm";
    }
    if (inp.cycleInstTap) instPage = (instPage + 1) % 3;
    if (st.playing && !st.paused) {
      st.lookYaw -= inp.lookX * 0.0022;
      st.lookPitch = clamp(st.lookPitch - inp.lookY * 0.002, -1.25, 0.95);
    }

    const helmTarget = st.apMode === "standby" ? inp.steer : st.helm;
    if (st.apMode === "standby") {
      st.helm = lerp(st.helm, helmTarget, 1 - Math.pow(0.001, dt));
    }
  }

  function autopilot(dt: number) {
    if (st.apMode === "standby") {
      apInt = 0;
      return;
    }
    let err = 0;
    if (st.apMode === "auto") {
      err = degDiff(st.apHeading, st.headingTrue) * DEG;
    } else {
      err = (st.apWindAngle - st.awaDeg) * DEG;
    }
    apInt = clamp(apInt + err * dt, -0.6, 0.6);
    const cmd = clamp(err * 1.6 + apInt * 0.4 + st.yawRate * 0.8, -1, 1);
    st.helm = lerp(st.helm, cmd, 1 - Math.pow(0.02, dt));
  }

  function physics(dt: number) {
    const tws = st.twsKn * KN;
    const twd = st.twdDeg * DEG;
    const windWx = -Math.sin(twd) * tws;
    const windWz = Math.cos(twd) * tws;
    const fx = -Math.sin(st.yaw);
    const fz = -Math.cos(st.yaw);
    st.fx = fx;
    st.fz = fz;
    const rx = Math.cos(st.yaw);
    const rz = -Math.sin(st.yaw);
    const bx = fx * st.speed + rx * st.sway;
    const bz = fz * st.speed + rz * st.sway;
    const appX = windWx - bx;
    const appZ = windWz - bz;
    const aws = Math.hypot(appX, appZ);
    const appHead = Math.atan2(-appX, -appZ);
    const awa = wrapPi(appHead - st.yaw);
    const twa = wrapPi(twd - st.yaw);
    st.awsKn = aws * MS_TO_KN;
    st.awaDeg = (awa * 180) / Math.PI;
    st.twaDeg = (twa * 180) / Math.PI;
    st.pointOfSail = pointOfSail(Math.abs(st.awaDeg));
    st.tack = Math.abs(st.awaDeg) < 20 ? "head" : st.awaDeg > 0 ? "port" : "starboard";

    const absAwa = Math.abs(awa);
    const sheetBlend = (st.mainSheet * 0.55 + st.jibSheet * 0.45);
    const idealSheet =
      absAwa < 0.5 ? 0.95 : clamp(1.05 - absAwa / (105 * DEG), 0.12, 0.95);
    const sheetErr = sheetBlend - idealSheet;
    const luff = clamp(
      (idealSheet - sheetBlend) * 2.4 + clamp((28 * DEG - absAwa) / (28 * DEG), 0, 1),
      0,
      1,
    );
    st.luff = lerp(st.luff, luff, 1 - Math.pow(0.02, dt));
    const stall = clamp(sheetErr * 2.2, 0, 1);
    const aoa = awa - Math.sign(awa || 1) * (0.18 + (1 - sheetBlend) * 0.7);
    const { cl, cd } = clCd((aoa * 180) / Math.PI, st.luff);

    const mainA = BOAT.mainArea * (1 - st.reef * 0.28) * (0.35 + 0.65 * st.mainSheet);
    const jibA = BOAT.jibArea * (1 - st.furl) * (0.35 + 0.65 * st.jibSheet);
    const area = mainA + jibA;
    const q = 0.5 * RHO_AIR * aws * aws;
    const lift = q * area * cl * (1 - stall * 0.45);
    const drag = q * area * cd * (1 + stall * 0.6);

    const windDirX = aws > 0.05 ? appX / aws : 0;
    const windDirZ = aws > 0.05 ? appZ / aws : 0;
    const liftDirX = -windDirZ * Math.sign(awa || 1);
    const liftDirZ = windDirX * Math.sign(awa || 1);
    const forceX = liftDirX * lift + windDirX * drag * 0.15;
    const forceZ = liftDirZ * lift + windDirZ * drag * 0.15;
    const drive = forceX * fx + forceZ * fz;
    const side = forceX * rx + forceZ * rz;

    const v = st.speed;
    const v2 = v * v;
    const v4 = v2 * v2;
    const hullDrag = 38 * v2 + 3.4 * v4 + st.chop * 40 * Math.abs(v);
    const extraHeelDrag = 90 * Math.abs(st.heel) * v2;
    const netF = drive - Math.sign(v || 1) * (hullDrag + extraHeelDrag);
    let acc = netF / BOAT.disp;

    if (st.engineOn) {
      engineRpm = lerp(engineRpm, 800 + st.throttle * 2000, dt * 1.4);
      acc += (st.throttle * 4200) / BOAT.disp;
    } else {
      engineRpm = lerp(engineRpm, 0, dt * 2);
    }
    st.rpm = engineRpm;

    st.speed += acc * dt;
    if (st.pointOfSail === "in-irons" && st.speed < 0.4 && !st.engineOn) {
      st.speed += -0.15 * dt;
    }
    st.speed = clamp(st.speed, -1.2, 9.2 * KN);

    const keelLift = 4200 * st.sway * Math.abs(v);
    const swayAcc = (side - keelLift - 1800 * st.sway) / BOAT.disp;
    st.sway = clamp(st.sway + swayAcc * dt, -1.4, 1.4);

    const hm = side * 6.4;
    const gm = 0.92;
    const rm = BOAT.disp * 9.81 * gm * Math.sin(st.heel);
    const heelAcc = (hm - rm - 18000 * st.heel * 0 - 14000 * (st as unknown as { heelVel?: number }).heelVel!) / 22000;
    void heelAcc;
    const targetHeel = clamp(Math.atan2(hm, BOAT.disp * 9.81 * gm), -38 * DEG, 38 * DEG);
    st.heel = lerp(st.heel, targetHeel, 1 - Math.pow(0.08, dt));
    st.heelDeg = (st.heel * 180) / Math.PI;

    const weather = st.heel * 0.4 * Math.sign(awa || 1);
    const speedAuth = clamp(Math.abs(st.speed) / (3.2 * KN), 0.35, 1.2);
    st.rudder = clamp(st.helm * 0.7 + weather * 0.22, -0.62, 0.62);
    const yawTorque = st.rudder * 4.4 * speedAuth - weather * 0.1;
    const windage = st.pointOfSail === "in-irons" ? -Math.sign(twa || 1) * 0.12 : 0;
    st.yawRate += (yawTorque + windage - st.yawRate * 1.55) * dt;
    st.yawRate = clamp(st.yawRate, -0.7, 0.7);
    st.yaw = wrapPi(st.yaw + st.yawRate * dt);

    const curX = -Math.sin(currentAngle) * currentSpd;
    const curZ = Math.cos(currentAngle) * currentSpd;
    const nfx = -Math.sin(st.yaw);
    const nfz = -Math.cos(st.yaw);
    const nrx = Math.cos(st.yaw);
    const nrz = -Math.sin(st.yaw);
    st.x += (nfx * st.speed + nrx * st.sway + curX) * dt;
    st.z += (nfz * st.speed + nrz * st.sway + curZ) * dt;

    const n = landNormal(st.x, st.z);
    const depth = waterDepth(st.x, st.z);
    st.depth = depth;
    if (n.d < 0.02 || depth < BOAT.draft * 0.85) {
      const push = Math.max(0.04 - n.d, BOAT.draft - depth + 0.2);
      st.x += n.x * push * 8 * dt * 12;
      st.z += n.z * push * 8 * dt * 12;
      const inward = Math.min(0, nfx * st.speed * n.x + nfz * st.speed * n.z);
      st.speed += -inward * 0.6;
      st.speed *= 0.86;
      if (depth < BOAT.draft * 0.7) {
        st.speed *= 0.5;
        depthAlarmT = 3;
      }
    }

    const sea = seaHeight(st.x, st.z, time, st.waveAmp, st.chop, st.waveDir);
    const FLOAT = 0.3;
    let sink = 0;
    if (stormy()) {
      const slam = 0.5 + 0.5 * Math.sin(time * 1.35 + st.z * 0.05);
      const power = clamp((st.twsKn - 16) / 14, 0.4, 1);
      sink = (0.55 + 0.9 * power) * Math.max(0, slam);
    }
    st.heave = sea - sink;
    st.pitch = Math.sin(time * 1.1 + st.z * 0.03) * st.chop * (stormy() ? 0.1 : 0.032);
    if (sink > 0.12) st.pitch -= 0.07 * Math.min(1, sink);
    st.y = FLOAT + st.heave;

    const vx = nfx * st.speed + nrx * st.sway + curX;
    const vz = nfz * st.speed + nrz * st.sway + curZ;
    st.stwKn = Math.abs(st.speed) * MS_TO_KN;
    st.sogKn = Math.hypot(vx, vz) * MS_TO_KN;
    st.cog = wrap360((Math.atan2(-vx, -vz) * 180) / Math.PI);
    st.headingTrue = wrap360((-st.yaw * 180) / Math.PI);
    st.headingMag = wrap360(st.headingTrue + MAG_VAR);
    st.lat = ORIGIN_LAT - st.z / M_PER_DEG_LAT;
    st.lon = ORIGIN_LON + st.x / M_PER_DEG_LON;

    const stream = 1 - st.luff;
    if (Math.abs(st.awaDeg) < 22) {
      st.telltalePort = lerp(st.telltalePort, 0.08, dt * 6);
      st.telltaleStbd = lerp(st.telltaleStbd, 0.08, dt * 6);
    } else if (st.awaDeg < 0) {
      st.telltaleStbd = lerp(st.telltaleStbd, stream * (1 - stall), dt * 5);
      st.telltalePort = lerp(st.telltalePort, st.luff > 0.42 ? 0.12 : stream * 0.95, dt * 5);
    } else {
      st.telltalePort = lerp(st.telltalePort, stream * (1 - stall), dt * 5);
      st.telltaleStbd = lerp(st.telltaleStbd, st.luff > 0.42 ? 0.12 : stream * 0.95, dt * 5);
    }

    if (Math.abs(degDiff(st.apMode === "auto" ? st.apHeading : st.headingTrue, st.headingTrue)) > 22 && st.apMode !== "standby") {
      headingAlarmT = 2;
    }
    if (st.twsKn - (twsBase * MS_TO_KN) > 8) windAlarmT = 2;
    headingAlarmT = Math.max(0, headingAlarmT - dt);
    depthAlarmT = Math.max(0, depthAlarmT - dt);
    windAlarmT = Math.max(0, windAlarmT - dt);
    st.alarm =
      depthAlarmT > 0
        ? "SHALLOW"
        : headingAlarmT > 0
          ? "OFF HEADING"
          : windAlarmT > 0
            ? "WIND"
            : Math.abs(st.heelDeg) > 28
              ? "OVERPOWERED"
              : null;
  }

  function step(dt: number, inp: InputState) {
    if (st.paused) return;
    applyInput(inp, dt);
    weatherStep(dt);
    autopilot(dt);
    physics(dt);
  }

  function begin() {
    st.playing = true;
    st.paused = false;
    if (st.view === "cinematic") st.view = "helm";
  }

  return {
    st,
    step,
    begin,
    togglePause() {
      if (!st.playing) return;
      st.paused = !st.paused;
    },
    setView(v: SimSnapshot["view"]) {
      st.view = v;
    },
    helmSide: () => helmSide,
    instPage: () => instPage,
    dt: FIXED_DT,
    now: () => time,
  };
}

export type Sim = ReturnType<typeof createSim>;
