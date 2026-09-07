import * as THREE from "three";
import type { SimSnapshot } from "./types";

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uSunDir;
  uniform float uCloud;
  uniform float uFog;
  uniform float uTime;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
               mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
  }

  void main() {
    vec3 dir = normalize(vWorld);
    float h = dir.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(-0.05, 0.85, h));
    float sun = pow(max(0.0, dot(dir, normalize(uSunDir))), 180.0);
    float glow = pow(max(0.0, dot(dir, normalize(uSunDir))), 8.0);
    col += vec3(1.0, 0.92, 0.75) * sun * 2.2;
    col += vec3(1.0, 0.78, 0.45) * glow * 0.35;
    float n = noise(dir.xz * 4.0 + vec2(uTime * 0.003, 0.0));
    n += 0.5 * noise(dir.xz * 9.0);
    float clouds = smoothstep(0.55, 0.85, n) * uCloud * smoothstep(0.05, 0.4, h);
    col = mix(col, vec3(0.85, 0.88, 0.9) * (1.0 - uCloud * 0.25), clouds);
    col = mix(col, vec3(0.55, 0.62, 0.68), uFog * 0.35 * (1.0 - h));
    if (h < 0.0) {
      col = mix(uHorizon * 0.55, vec3(0.05, 0.12, 0.16), clamp(-h, 0.0, 1.0));
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky(scene: THREE.Scene) {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0.6, 0.5, 0.2) },
    uCloud: { value: 0.18 },
    uFog: { value: 0 },
    uTime: { value: 0 },
    uHorizon: { value: new THREE.Color("#d7e4ee") },
    uZenith: { value: new THREE.Color("#3e74a8") },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(18000, 32, 20), mat);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(90, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#fff3d0", fog: false }),
  );
  scene.add(sun);

  const hemi = new THREE.HemisphereLight("#9ec4dc", "#3d5c52", 0.55);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight("#fff1d6", 2.15);
  dir.position.set(40, 60, 20);
  scene.add(dir);
  const fill = new THREE.DirectionalLight("#8fb7c8", 0.28);
  fill.position.set(-30, 20, -40);
  scene.add(fill);

  function update(st: SimSnapshot, t: number) {
    const az = st.sunAz;
    const el = st.sunEl;
    const s = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      -Math.cos(az) * Math.cos(el),
    );
    uniforms.uSunDir.value.copy(s);
    uniforms.uCloud.value = st.cloud;
    uniforms.uFog.value = st.fog;
    uniforms.uTime.value = t;
    const dark = st.cloud * 0.45 + st.fog * 0.2;
    uniforms.uZenith.value.set("#3e74a8").lerp(new THREE.Color("#2a3d52"), dark);
    uniforms.uHorizon.value.set("#d7e4ee").lerp(new THREE.Color("#9aa8b0"), dark + (st.timeHours > 17 ? 0.4 : 0));
    sun.position.copy(s).multiplyScalar(14000);
    dir.position.copy(s).multiplyScalar(80);
    dir.intensity = 2.15 * (1 - dark * 0.7) * Math.max(0.2, Math.sin(el));
    hemi.intensity = 0.55 * (1 - dark * 0.4);
    scene.fog = new THREE.FogExp2(
      st.fog > 0.3 ? 0xb8c4cc : 0xc5d5e0,
      0.000045 + st.fog * 0.00055 + st.cloud * 0.00002,
    );
  }

  return { update, dir, hemi };
}
