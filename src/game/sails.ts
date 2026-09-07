import * as THREE from "three";
import { clamp } from "./math";
import type { GameTextures } from "./textures";
import type { SimSnapshot } from "./types";

export const SAIL_RIG = {
  mainTack: [0, 2.56, -1.12] as const,
  mainHead: [0, 16.44, -1.16] as const,
  mainClew: [0, 2.58, 4.34] as const,
  jibTack: [0, 1.24, -5.26] as const,
  jibHead: [0, 16.28, -1.24] as const,
  jibClew: [0, 2.28, -0.42] as const,
};

const _luff = new THREE.Vector3();
const _leech = new THREE.Vector3();
const _p = new THREE.Vector3();
const _out = new THREE.Vector3();
const _down = new THREE.Vector3();
const _chord = new THREE.Vector3();
const _nrm = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _side = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _axis = new THREE.Vector3();
const _sun = new THREE.Vector3();

function v3(a: readonly [number, number, number]) {
  return new THREE.Vector3(a[0], a[1], a[2]);
}

function relative(origin: THREE.Vector3, p: readonly [number, number, number]) {
  return new THREE.Vector3(p[0] - origin.x, p[1] - origin.y, p[2] - origin.z);
}

function camberCurve(u: number) {
  const a = 0.38;
  const x = u < a ? u / a : (1 - u) / Math.max(0.001, 1 - a);
  return x * (2 - x);
}

function camberX(u: number, v: number, fill: number, tack: number, draft: number) {
  const belly = camberCurve(u) * Math.pow(Math.sin(Math.PI * clamp(v, 0.02, 0.98)), 0.72);
  return belly * fill * tack * draft + u * v * v * fill * tack * 0.2;
}

function paramPoint(
  tack: THREE.Vector3,
  head: THREE.Vector3,
  clew: THREE.Vector3,
  u: number,
  v: number,
  roach: number,
  target: THREE.Vector3,
) {
  _luff.lerpVectors(tack, head, v);
  _leech.lerpVectors(clew, head, v);
  _out.subVectors(_leech, _luff);
  const chord = _out.length();
  if (chord > 1e-4 && roach !== 0) {
    _out.multiplyScalar((chord + roach * Math.sin(Math.PI * v)) / chord);
    _leech.copy(_luff).add(_out);
  }
  target.lerpVectors(_luff, _leech, u);
  return target;
}

function buildTriSail(
  tack: THREE.Vector3,
  head: THREE.Vector3,
  clew: THREE.Vector3,
  nu: number,
  nv: number,
  roach: number,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let j = 0; j < nv; j++) {
    const v = j / (nv - 1);
    paramPoint(tack, head, clew, 0, v, roach, _luff);
    paramPoint(tack, head, clew, 1, v, roach, _leech);
    for (let i = 0; i < nu; i++) {
      const u = i / (nu - 1);
      _p.lerpVectors(_luff, _leech, u);
      positions.push(_p.x, _p.y, _p.z);
      uvs.push(u, v);
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const sailVert = /* glsl */ `
  uniform float uLuff;
  uniform float uFill;
  uniform float uTime;
  uniform float uTack;
  uniform float uDraft;
  uniform float uTwist;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    float u = uv.x;
    float v = uv.y;
    float a = 0.38;
    float x = u < a ? u / a : (1.0 - u) / max(0.001, 1.0 - a);
    float curve = x * (2.0 - x);
    float span = pow(sin(3.14159265 * clamp(v, 0.02, 0.98)), 0.72);
    float belly = curve * span;
    float cam = belly * uFill * uTack * uDraft;
    cam += u * v * v * uFill * uTack * uTwist;
    p.x += cam;
    float flutter = uLuff * (1.0 - u * 0.65);
    p.x += sin(v * 24.0 + uTime * 17.0) * flutter * 0.2;
    p.z += sin(v * 13.0 + uTime * 11.4) * flutter * 0.11;
    p.y += sin(u * 9.0 + v * 7.0 + uTime * 8.0) * flutter * 0.05;
    p.x += sin(v * 28.0 + uTime * 9.5) * u * u * 0.045 * (0.22 + uLuff);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const sailFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uLuff;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec3 dpx = dFdx(vWorld);
    vec3 dpy = dFdy(vWorld);
    vec3 N = normalize(cross(dpx, dpy));
    if (!gl_FrontFacing) N = -N;
    vec3 L = normalize(uSunDir);
    float ndl = 0.55 + 0.5 * max(dot(N, L), 0.0);
    float back = 0.38 * max(dot(-N, L), 0.0);
    vec3 col = tex.rgb * (ndl + back + 0.12);
    col = mix(col, col * 0.78, uLuff * 0.55);
    float seam = step(0.96, fract(vUv.y * 8.0));
    col *= 1.0 - seam * 0.08;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeSailMat(map: THREE.Texture, draft: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uLuff: { value: 0 },
      uFill: { value: 0.75 },
      uTime: { value: 0 },
      uTack: { value: 1 },
      uDraft: { value: draft },
      uTwist: { value: 0.22 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.72, 0.28) },
    },
    vertexShader: sailVert,
    fragmentShader: sailFrag,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

type Yarn = {
  mesh: THREE.Mesh;
  positions: Float32Array;
  segs: number;
  u: number;
  v: number;
  side: number;
  phase: number;
  sail: "main" | "jib";
  role: "luff" | "leech";
  roach: number;
  draft: number;
};

function createYarn(color: string, segs = 12): Omit<Yarn, "u" | "v" | "side" | "phase" | "sail" | "role" | "roach" | "draft"> {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(segs * 2 * 3);
  const uvs = new Float32Array(segs * 2 * 2);
  const indices: number[] = [];
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    uvs[i * 4] = 0;
    uvs[i * 4 + 1] = t;
    uvs[i * 4 + 2] = 1;
    uvs[i * 4 + 3] = t;
    if (i < segs - 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return { mesh, positions, segs };
}

function writeYarn(
  yarn: Yarn,
  stream: number,
  luffAmt: number,
  time: number,
  fill: number,
  tackSign: number,
  tack: THREE.Vector3,
  head: THREE.Vector3,
  clew: THREE.Vector3,
  downLocal: THREE.Vector3,
) {
  paramPoint(tack, head, clew, yarn.u, yarn.v, yarn.roach, _pos);
  const cam = camberX(yarn.u, yarn.v, fill, tackSign, yarn.draft);
  _pos.x += cam + yarn.side * 0.028;

  paramPoint(tack, head, clew, 0, yarn.v, yarn.roach, _luff);
  paramPoint(tack, head, clew, 1, yarn.v, yarn.roach, _leech);
  _chord.subVectors(_leech, _luff);
  if (_chord.lengthSq() < 1e-6) _chord.set(0, 0, 1);
  else _chord.normalize();
  if (yarn.role === "leech") {
    _chord.copy(head).sub(clew);
    if (_chord.lengthSq() < 1e-6) _chord.set(0, 1, 0);
    else _chord.normalize();
  }
  _nrm.set(1, 0, 0);
  _bin.crossVectors(_chord, _nrm);
  if (_bin.lengthSq() < 1e-6) _bin.set(0, 1, 0);
  else _bin.normalize();

  const streamN = clamp(stream, 0, 1);
  const flutter = (1 - streamN) * (0.5 + 0.5 * luffAmt);
  const L = yarn.role === "leech" ? 0.55 : 0.72;
  const halfW = 0.02;
  const pos = yarn.positions;

  for (let i = 0; i < yarn.segs; i++) {
    const t = i / (yarn.segs - 1);
    const wave = Math.sin(time * (15 + yarn.phase * 7) + yarn.phase + t * 11) * flutter * t;
    const wave2 = Math.cos(time * (21 + yarn.phase * 5) + t * 8) * flutter * t;
    const along = L * t * (0.18 + 0.82 * streamN);
    const hang = L * t * (1 - streamN) * 0.9;
    _p.copy(_chord).multiplyScalar(along);
    _p.addScaledVector(downLocal, hang);
    _p.addScaledVector(_nrm, yarn.side * 0.01 + wave * 0.22 + (1 - streamN) * yarn.side * 0.04);
    _p.addScaledVector(_bin, wave2 * 0.2);
    _side.copy(_bin).addScaledVector(_nrm, 0.2).normalize().multiplyScalar(halfW * (1 - t * 0.35));
    const i6 = i * 6;
    pos[i6] = _p.x - _side.x;
    pos[i6 + 1] = _p.y - _side.y;
    pos[i6 + 2] = _p.z - _side.z;
    pos[i6 + 3] = _p.x + _side.x;
    pos[i6 + 4] = _p.y + _side.y;
    pos[i6 + 5] = _p.z + _side.z;
  }
  yarn.mesh.position.copy(_pos);
  const attr = yarn.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  attr.needsUpdate = true;
}

function makeWindex(chrome: THREE.Material) {
  const root = new THREE.Group();
  const vane = new THREE.Group();
  root.add(vane);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), chrome);
  shaft.position.y = 0.06;
  root.add(shaft);

  const armGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 5);
  const tabMat = new THREE.MeshBasicMaterial({ color: "#d8d2c6" });
  for (const sign of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, chrome);
    arm.rotation.z = (sign * 28 * Math.PI) / 180;
    arm.position.set(sign * 0.12, 0.18, 0);
    root.add(arm);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.012), tabMat);
    tab.position.set(sign * 0.26, 0.32, 0);
    root.add(tab);
  }

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: "#c45c4a" }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.28;
  vane.add(nose);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.16, 0.28),
    new THREE.MeshBasicMaterial({ color: "#efeae1" }),
  );
  tail.position.z = 0.22;
  vane.add(tail);
  const flyGeo = new THREE.PlaneGeometry(0.06, 0.42, 1, 6);
  flyGeo.translate(0, -0.21, 0);
  const fly = new THREE.Mesh(
    flyGeo,
    new THREE.MeshBasicMaterial({ color: "#c45c4a", side: THREE.DoubleSide }),
  );
  fly.position.set(0, 0.02, 0.38);
  fly.rotation.x = Math.PI / 2;
  vane.add(fly);

  return { root, vane, fly };
}

export function createSails(body: THREE.Group, tex: GameTextures, boom: THREE.Mesh) {
  const mainOrigin = v3(SAIL_RIG.mainTack);
  const jibOrigin = v3(SAIL_RIG.jibTack);
  const mainTackL = new THREE.Vector3(0, 0, 0);
  const mainHeadL = relative(mainOrigin, SAIL_RIG.mainHead);
  const mainClewL = relative(mainOrigin, SAIL_RIG.mainClew);
  const jibTackL = new THREE.Vector3(0, 0, 0);
  const jibHeadL = relative(jibOrigin, SAIL_RIG.jibHead);
  const jibClewL = relative(jibOrigin, SAIL_RIG.jibClew);

  const mainRig = new THREE.Group();
  mainRig.position.copy(mainOrigin);
  body.add(mainRig);

  const jibRig = new THREE.Group();
  jibRig.position.copy(jibOrigin);
  body.add(jibRig);

  mainRig.add(boom);
  boom.position.set(0, 0.04, 2.72);
  boom.rotation.set(Math.PI / 2, 0, 0);

  const mainMat = makeSailMat(tex.sail, 0.7);
  const jibMat = makeSailMat(tex.sail, 0.56);

  const main = new THREE.Mesh(buildTriSail(mainTackL, mainHeadL, mainClewL, 20, 28, 0.42), mainMat);
  mainRig.add(main);
  const jib = new THREE.Mesh(buildTriSail(jibTackL, jibHeadL, jibClewL, 16, 24, 0.16), jibMat);
  jibRig.add(jib);

  const yarns: Yarn[] = [];
  const port = "#b43c3c";
  const stbd = "#2f7a4a";
  const cream = "#e7dcc8";

  const jibLuffV = [0.28, 0.5, 0.72];
  for (const v of jibLuffV) {
    for (const side of [-1, 1]) {
      const y = createYarn(side < 0 ? port : stbd);
      yarns.push({
        ...y,
        u: 0.1,
        v,
        side,
        phase: v * 4 + side,
        sail: "jib",
        role: "luff",
        roach: 0.16,
        draft: 0.56,
      });
      jib.add(y.mesh);
    }
  }
  const mainLeechV = [0.32, 0.52, 0.74];
  for (const v of mainLeechV) {
    const y = createYarn(cream);
    yarns.push({
      ...y,
      u: 0.93,
      v,
      side: 0,
      phase: v * 3.1,
      sail: "main",
      role: "leech",
      roach: 0.42,
      draft: 0.7,
    });
    main.add(y.mesh);
  }
  const mainLuffV = [0.34, 0.58];
  for (const v of mainLuffV) {
    for (const side of [-1, 1]) {
      const y = createYarn(side < 0 ? port : stbd);
      yarns.push({
        ...y,
        u: 0.12,
        v,
        side,
        phase: 2 + v * 5 + side,
        sail: "main",
        role: "luff",
        roach: 0.42,
        draft: 0.7,
      });
      main.add(y.mesh);
    }
  }

  const windex = makeWindex(
    new THREE.MeshStandardMaterial({ color: "#c5cdd2", metalness: 0.85, roughness: 0.22 }),
  );
  windex.root.position.set(0, 16.82, -1.15);
  body.add(windex.root);

  const forestayAxis = v3(SAIL_RIG.jibHead).sub(jibOrigin).normalize();

  function update(st: SimSnapshot, t: number) {
    const tackSign = st.tack === "port" ? 1 : st.tack === "starboard" ? -1 : 0.12;
    const absAwa = Math.abs(st.awaDeg);
    const ideal = absAwa < 28 ? 0.92 : clamp(1.05 - absAwa / 105, 0.12, 0.95);
    const mainStall = clamp((st.mainSheet - ideal) * 2.2, 0, 1);
    const jibStall = clamp((st.jibSheet - ideal) * 2.2, 0, 1);
    const mainFill = (1 - st.luff) * (0.58 + 0.42 * (1 - mainStall));
    const jibFill = (1 - st.luff) * (0.55 + 0.45 * (1 - jibStall));
    const mainTwist = 0.14 + (1 - st.mainSheet) * 0.55;
    const jibTwist = 0.12 + (1 - st.jibSheet) * 0.62;

    _sun.set(
      Math.sin(st.sunAz) * Math.cos(st.sunEl),
      Math.sin(st.sunEl),
      -Math.cos(st.sunAz) * Math.cos(st.sunEl),
    );

    mainMat.uniforms.uLuff.value = st.luff;
    mainMat.uniforms.uFill.value = mainFill * (1 - st.reef * 0.18);
    mainMat.uniforms.uTime.value = t;
    mainMat.uniforms.uTack.value = tackSign;
    mainMat.uniforms.uTwist.value = mainTwist;
    mainMat.uniforms.uSunDir.value.copy(_sun);
    jibMat.uniforms.uLuff.value = st.luff;
    jibMat.uniforms.uFill.value = jibFill * (1 - st.furl * 0.35);
    jibMat.uniforms.uTime.value = t;
    jibMat.uniforms.uTack.value = tackSign;
    jibMat.uniforms.uTwist.value = jibTwist;
    jibMat.uniforms.uSunDir.value.copy(_sun);

    mainRig.rotation.y = tackSign * (0.06 + (1 - st.mainSheet) * 0.58);
    main.scale.y = 1 - st.reef * 0.22;

    _axis.copy(forestayAxis);
    jibRig.quaternion.setFromAxisAngle(_axis, tackSign * (0.1 + (1 - st.jibSheet) * 0.74));
    const furl = st.furl;
    jib.scale.set(1 - furl * 0.12, 1 - furl * 0.08, 1 - furl * 0.52);

    main.updateWorldMatrix(true, false);
    jib.updateWorldMatrix(true, false);

    windex.vane.rotation.y = (st.awaDeg * Math.PI) / 180;
    windex.fly.rotation.z = Math.sin(t * 14) * 0.18 * clamp(st.awsKn / 16, 0.15, 1);
    windex.fly.rotation.x = Math.PI / 2 + Math.sin(t * 9) * 0.08 * clamp(st.luff, 0, 1);

    const leechStream = clamp((1 - st.luff) * (1 - mainStall), 0, 1);
    _inv.copy(main.matrixWorld).invert();
    _down.set(0, -1, 0).transformDirection(_inv).normalize();
    for (const yarn of yarns) {
      if (yarn.sail !== "main") continue;
      const stream =
        yarn.role === "leech" ? leechStream : yarn.side < 0 ? st.telltalePort : st.telltaleStbd;
      writeYarn(yarn, stream, st.luff, t, mainFill, tackSign, mainTackL, mainHeadL, mainClewL, _down);
    }
    _inv.copy(jib.matrixWorld).invert();
    _down.set(0, -1, 0).transformDirection(_inv).normalize();
    for (const yarn of yarns) {
      if (yarn.sail !== "jib") continue;
      const stream = yarn.side < 0 ? st.telltalePort : st.telltaleStbd;
      writeYarn(yarn, stream, st.luff, t, jibFill, tackSign, jibTackL, jibHeadL, jibClewL, _down);
    }
  }

  return { update, mainRig, jibRig };
}

export type Sails = ReturnType<typeof createSails>;
