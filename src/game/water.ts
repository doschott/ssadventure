import * as THREE from "three";
import { MACKINAC, ROUND } from "./constants";
import type { SimSnapshot } from "./types";

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uChop;
  uniform vec2 uDir;
  uniform vec2 uOrigin;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vFoam;

  vec3 gerstner(vec3 p, vec2 dir, float steep, float wl, float speed) {
    float k = 6.283185 / wl;
    float c = sqrt(9.8 / k) * speed;
    float f = k * (dir.x * p.x + dir.y * p.z - c * uTime);
    float a = steep / k;
    float sa = sin(f);
    float ca = cos(f);
    return vec3(dir.x * a * ca, a * sa, dir.y * a * ca);
  }

  void main() {
    vec3 p = position;
    vec3 wp = vec3(p.x + uOrigin.x, 0.0, p.z + uOrigin.y);
    vec2 d0 = normalize(uDir);
    vec2 d1 = normalize(vec2(d0.y, -d0.x) * 0.55 + d0 * 0.8);
    vec2 d2 = normalize(d0 + vec2(0.35, -0.2));
    vec3 g = vec3(0.0);
    g += gerstner(wp, d0, 0.32 * uAmp, 28.0, 1.0);
    g += gerstner(wp, d1, 0.18 * uAmp, 13.0, 1.15);
    g += gerstner(wp, d2, 0.10 * uChop, 6.5, 1.4);
    g += gerstner(wp, normalize(d0 + vec2(-0.4, 0.7)), 0.05 * uChop, 3.2, 1.7);
    p += g;
    vFoam = clamp(g.y / max(0.08, uAmp * 1.4), 0.0, 1.0);
    vec3 t = vec3(1.0, 0.0, 0.0);
    vec3 b = vec3(0.0, 0.0, 1.0);
    vec3 n = normalize(cross(b, t));
    n = normalize(n + vec3(-g.x * 0.8, 0.35, -g.z * 0.8));
    vN = n;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vFoam;
  uniform vec3 uSunDir;
  uniform vec3 uCam;
  uniform float uFog;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec2 uMackC;
  uniform vec2 uMackR;
  uniform vec2 uRoundC;
  uniform vec2 uRoundR;

  float ellDist(vec2 p, vec2 c, vec2 r) {
    vec2 d = (p - c) / r;
    return length(d) - 1.0;
  }

  void main() {
    vec3 n = normalize(vN);
    vec3 view = normalize(uCam - vWorld);
    float ndv = max(0.0, dot(n, view));
    float fres = pow(1.0 - ndv, 3.2);
    float dm = ellDist(vWorld.xz, uMackC, uMackR);
    float dr = ellDist(vWorld.xz, uRoundC, uRoundR);
    float shore = min(dm, dr);
    float shallow = 1.0 - smoothstep(0.0, 0.22, shore);
    vec3 water = mix(uDeep, uShallow, shallow);
    vec3 sky = vec3(0.62, 0.74, 0.82);
    vec3 col = mix(water, sky, fres * 0.55);
    float spec = pow(max(0.0, dot(reflect(-normalize(uSunDir), n), view)), 80.0);
    col += vec3(1.0, 0.95, 0.82) * spec * 0.85;
    float glitter = pow(max(0.0, dot(n, normalize(uSunDir))), 12.0) * 0.12;
    col += glitter;
    col = mix(col, vec3(0.92, 0.95, 0.96), vFoam * 0.35 * (1.0 - shallow * 0.4));
    col = mix(col, vec3(0.78, 0.84, 0.86), uFog * 0.45);
    float fogD = 1.0 - exp(-length(vWorld - uCam) * (0.000045 + uFog * 0.0005));
    col = mix(col, vec3(0.72, 0.80, 0.84), fogD * 0.65);
    gl_FragColor = vec4(col, 0.96);
  }
`;

function gerstnerY(
  px: number,
  pz: number,
  dx: number,
  dz: number,
  steep: number,
  wl: number,
  speed: number,
  t: number,
) {
  const k = 6.283185 / wl;
  const c = Math.sqrt(9.8 / k) * speed;
  const f = k * (dx * px + dz * pz - c * t);
  return (steep / k) * Math.sin(f);
}

/** World-space sea surface, matching the water vertex shader. */
export function seaHeight(x: number, z: number, t: number, amp: number, chop: number, dir: number) {
  const inv = 1 / (Math.hypot(Math.sin(dir), Math.cos(dir)) || 1);
  const d0x = Math.sin(dir) * inv;
  const d0z = -Math.cos(dir) * inv;
  let d1x = d0z * 0.55 + d0x * 0.8;
  let d1z = -d0x * 0.55 + d0z * 0.8;
  const i1 = 1 / (Math.hypot(d1x, d1z) || 1);
  d1x *= i1;
  d1z *= i1;
  let d2x = d0x + 0.35;
  let d2z = d0z - 0.2;
  const i2 = 1 / (Math.hypot(d2x, d2z) || 1);
  d2x *= i2;
  d2z *= i2;
  let d3x = d0x - 0.4;
  let d3z = d0z + 0.7;
  const i3 = 1 / (Math.hypot(d3x, d3z) || 1);
  d3x *= i3;
  d3z *= i3;
  return (
    gerstnerY(x, z, d0x, d0z, 0.32 * amp, 28, 1, t) +
    gerstnerY(x, z, d1x, d1z, 0.18 * amp, 13, 1.15, t) +
    gerstnerY(x, z, d2x, d2z, 0.1 * chop, 6.5, 1.4, t) +
    gerstnerY(x, z, d3x, d3z, 0.05 * chop, 3.2, 1.7, t)
  );
}

export function createWater(scene: THREE.Scene) {
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.28 },
    uChop: { value: 0.5 },
    uDir: { value: new THREE.Vector2(0.7, 0.7) },
    uOrigin: { value: new THREE.Vector2(0, 0) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.2) },
    uCam: { value: new THREE.Vector3() },
    uFog: { value: 0 },
    uDeep: { value: new THREE.Color("#12363c") },
    uShallow: { value: new THREE.Color("#3d7a72") },
    uMackC: { value: new THREE.Vector2(MACKINAC.cx, MACKINAC.cz) },
    uMackR: { value: new THREE.Vector2(MACKINAC.rx, MACKINAC.rz) },
    uRoundC: { value: new THREE.Vector2(ROUND.cx, ROUND.cz) },
    uRoundR: { value: new THREE.Vector2(ROUND.rx, ROUND.rz) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
  });

  const geo = new THREE.PlaneGeometry(2400, 2400, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const farGeo = new THREE.PlaneGeometry(18000, 18000, 8, 8);
  farGeo.rotateX(-Math.PI / 2);
  const farMat = new THREE.MeshLambertMaterial({
    color: "#1a4a56",
    transparent: true,
    opacity: 0.95,
  });
  const far = new THREE.Mesh(farGeo, farMat);
  far.position.y = -0.4;
  scene.add(far);

  function update(st: SimSnapshot, cam: THREE.Camera, t: number) {
    mesh.position.set(st.x, 0, st.z);
    far.position.set(st.x, -0.4, st.z);
    uniforms.uTime.value = t;
    uniforms.uAmp.value = st.waveAmp;
    uniforms.uChop.value = st.chop;
    uniforms.uDir.value.set(Math.sin(st.waveDir), -Math.cos(st.waveDir));
    uniforms.uOrigin.value.set(st.x, st.z);
    uniforms.uFog.value = st.fog;
    uniforms.uCam.value.copy(cam.position);
    const az = st.sunAz;
    const el = st.sunEl;
    uniforms.uSunDir.value.set(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    );
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
    farGeo.dispose();
    farMat.dispose();
    scene.remove(mesh);
    scene.remove(far);
  }

  return { update, dispose, mesh };
}
