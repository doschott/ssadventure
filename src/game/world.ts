import * as THREE from "three";
import {
  BRIDGE,
  FORT,
  GRAND,
  HARBOR,
  MACKINAC,
  PASSAGE_LIGHT,
  ROUND,
  ROUND_LIGHT,
  TOWN,
} from "./constants";
import { hash2, noise2 } from "./math";
import type { GameTextures } from "./textures";
import { landHeight, landNormal, mackinacD, roundD } from "./world-sdf";

function islandMesh(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  nx: number,
  nz: number,
  which: "mack" | "round",
) {
  const xs = nx + 1;
  const zs = nz + 1;
  const positions = new Float32Array(xs * zs * 3);
  const colors = new Float32Array(xs * zs * 3);
  const uvs = new Float32Array(xs * zs * 2);
  const heights = new Float32Array(xs * zs);

  for (let j = 0; j < zs; j++) {
    for (let i = 0; i < xs; i++) {
      const x = x0 + (i / nx) * (x1 - x0);
      const z = z0 + (j / nz) * (z1 - z0);
      const h = landHeight(x, z);
      const idx = j * xs + i;
      heights[idx] = h;
      const p = idx * 3;
      positions[p] = x;
      positions[p + 1] = h;
      positions[p + 2] = z;
      uvs[idx * 2] = (i / nx) * 10;
      uvs[idx * 2 + 1] = (j / nz) * 10;
      const d = which === "mack" ? mackinacD(x, z) : roundD(x, z);
      const sand = h < 2.4 || d > -0.04;
      const cliff = h > 10 && Math.abs(d) < 0.08;
      const r = sand ? 0.76 : cliff ? 0.72 : 0.28;
      const g = sand ? 0.68 : cliff ? 0.64 : 0.42 + noise2(x * 0.01, z * 0.01) * 0.08;
      const b = sand ? 0.52 : cliff ? 0.48 : 0.24;
      colors[p] = r;
      colors[p + 1] = g;
      colors[p + 2] = b;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * xs + i;
      const b = a + 1;
      const c = a + xs;
      const d = c + 1;
      if (heights[a]! <= 0.04 && heights[b]! <= 0.04 && heights[c]! <= 0.04 && heights[d]! <= 0.04) {
        continue;
      }
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

export function createWorld(scene: THREE.Scene, tex: GameTextures) {
  const group = new THREE.Group();
  scene.add(group);

  const groundMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    map: tex.grass,
  });
  groundMat.map!.repeat.set(8, 8);

  const mackGeo = islandMesh(
    MACKINAC.cx - MACKINAC.rx - 80,
    MACKINAC.cz - MACKINAC.rz - 80,
    MACKINAC.cx + MACKINAC.rx + 80,
    MACKINAC.cz + MACKINAC.rz + 80,
    168,
    96,
    "mack",
  );
  const mack = new THREE.Mesh(mackGeo, groundMat);
  group.add(mack);

  const roundGeo = islandMesh(
    ROUND.cx - ROUND.rx - 40,
    ROUND.cz - ROUND.rz - 40,
    ROUND.cx + ROUND.rx + 40,
    ROUND.cz + ROUND.rz + 40,
    56,
    36,
    "round",
  );
  const round = new THREE.Mesh(roundGeo, groundMat);
  group.add(round);

  const stone = new THREE.MeshStandardMaterial({
    map: tex.limestone,
    roughness: 0.86,
    color: "#d2c4a8",
  });
  const clap = new THREE.MeshStandardMaterial({
    map: tex.clapboard,
    roughness: 0.78,
    color: "#efeae2",
  });
  const clap2 = new THREE.MeshStandardMaterial({
    map: tex.clapboard,
    roughness: 0.78,
    color: "#d9c9ae",
  });
  const clap3 = new THREE.MeshStandardMaterial({
    map: tex.clapboard,
    roughness: 0.78,
    color: "#cfd8d4",
  });
  const roof = new THREE.MeshStandardMaterial({ color: "#5c4030", roughness: 0.9 });
  const roofRed = new THREE.MeshStandardMaterial({ color: "#8b2e24", roughness: 0.82 });
  const white = new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: "#243038", roughness: 0.5 });
  const teak = new THREE.MeshStandardMaterial({ map: tex.teak, roughness: 0.8 });

  const village = new THREE.Group();
  group.add(village);
  const palettes = [clap, clap2, clap3, white];
  for (let i = 0; i < 18; i++) {
    const along = (i / 17) * 340 - 170;
    const x = TOWN.x + along;
    const z = TOWN.z - 8 + (hash2(i, 2) - 0.5) * 18;
    const h = Math.max(landHeight(x, z), 1.6);
    const w = 7 + hash2(i, 3) * 6;
    const d = 8 + hash2(i, 4) * 5;
    const ht = 4.5 + hash2(i, 5) * 3.5;
    const mat = palettes[i % palettes.length]!;
    box(village, mat, w, ht, d, x, h + ht / 2, z, (hash2(i, 6) - 0.5) * 0.15);
    box(village, roof, w + 0.6, 0.45, d + 0.6, x, h + ht + 0.2, z);
  }

  const pier = new THREE.Group();
  group.add(pier);
  box(pier, teak, 8, 0.28, 48, HARBOR.x, 0.55, HARBOR.z + 10);
  box(pier, teak, 6, 0.28, 22, HARBOR.x + 18, 0.55, HARBOR.z + 4, 0.4);
  box(pier, teak, 5.5, 0.28, 18, HARBOR.x - 16, 0.55, HARBOR.z + 2, -0.3);
  for (const px of [-3, 3, -16, 18]) {
    for (const pz of [0, 12, 24]) {
      box(pier, teak, 0.22, 1.1, 0.22, HARBOR.x + px, 0.1, HARBOR.z + pz);
    }
  }

  const hotel = new THREE.Group();
  group.add(hotel);
  const hx = GRAND.x;
  const hz = GRAND.z;
  const hy = Math.max(landHeight(hx, hz), GRAND.y * 0.4);
  box(hotel, white, 92, 14, 22, hx, hy + 7, hz, 0.12);
  box(hotel, roof, 96, 1.2, 26, hx, hy + 14.4, hz, 0.12);
  for (let i = 0; i < 18; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 9.5, 8), white);
    const t = (i / 17 - 0.5) * 80;
    col.position.set(hx + Math.cos(0.12) * t, hy + 4.8, hz + 12 + Math.sin(0.12) * t);
    hotel.add(col);
  }
  box(hotel, white, 18, 8, 18, hx - 40, hy + 18, hz, 0.12);

  const fort = new THREE.Group();
  group.add(fort);
  const fx = FORT.x;
  const fz = FORT.z;
  const fy = Math.max(landHeight(fx, fz), 18);
  box(fort, stone, 48, 6, 38, fx, fy + 3, fz);
  box(fort, stone, 10, 9, 10, fx - 22, fy + 6, fz - 16);
  box(fort, stone, 10, 9, 10, fx + 20, fy + 6, fz - 15);
  box(fort, stone, 10, 9, 10, fx - 20, fy + 6, fz + 16);
  box(fort, stone, 10, 8, 10, fx + 21, fy + 5.5, fz + 15);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 12, 6), dark);
  pole.position.set(fx, fy + 12, fz);
  fort.add(pole);
  const us = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.2),
    new THREE.MeshBasicMaterial({ color: "#3c3a8a", side: THREE.DoubleSide }),
  );
  us.position.set(fx + 1.1, fy + 16.5, fz);
  fort.add(us);

  const light = new THREE.Group();
  group.add(light);
  const lx = ROUND_LIGHT.x;
  const lz = ROUND_LIGHT.z;
  const ly = Math.max(landHeight(lx, lz), 2.5);
  box(light, stone, 8, 3.2, 10, lx, ly + 1.6, lz);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 14, 8), white);
  tower.position.set(lx, ly + 10, lz);
  light.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.6, 8), roofRed);
  cap.position.set(lx, ly + 18.2, lz);
  light.add(cap);
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: "#f0e6c0", emissive: "#f2d48a", emissiveIntensity: 0.55 }),
  );
  lantern.position.set(lx, ly + 16.6, lz);
  light.add(lantern);
  box(light, white, 7, 4.2, 6, lx + 5.5, ly + 3.4, lz + 1.2);

  const pLight = new THREE.Group();
  group.add(pLight);
  const plx = PASSAGE_LIGHT.x;
  const plz = PASSAGE_LIGHT.z;
  const tower2 = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 8), white);
  tower2.position.set(plx, 5.5, plz);
  pLight.add(tower2);
  const cap2 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.4, 8), roofRed);
  cap2.position.set(plx, 10.6, plz);
  pLight.add(cap2);

  const buoyMatR = new THREE.MeshStandardMaterial({ color: "#b43a32", roughness: 0.5 });
  const buoyMatG = new THREE.MeshStandardMaterial({ color: "#2f6b46", roughness: 0.5 });
  const buoys = new THREE.Group();
  group.add(buoys);
  const channel: { x: number; z: number; red: boolean }[] = [
    { x: 90, z: 80, red: true },
    { x: -70, z: 90, red: false },
    { x: 110, z: 260, red: true },
    { x: -40, z: 280, red: false },
    { x: 80, z: 520, red: true },
    { x: -20, z: 540, red: false },
    { x: 40, z: 760, red: true },
    { x: -90, z: 740, red: false },
    { x: 160, z: -40, red: true },
    { x: -120, z: -20, red: false },
  ];
  const buoyMeshes: THREE.Object3D[] = [];
  for (const b of channel) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      b.red ? new THREE.ConeGeometry(0.7, 1.8, 6) : new THREE.CylinderGeometry(0.55, 0.65, 1.7, 8),
      b.red ? buoyMatR : buoyMatG,
    );
    body.position.y = 0.7;
    g.add(body);
    g.position.set(b.x, 0, b.z);
    buoys.add(g);
    buoyMeshes.push(g);
  }

  const trunkMat = new THREE.MeshLambertMaterial({ color: "#3a2a1c" });
  const leafMat = new THREE.MeshLambertMaterial({ color: "#244a32" });
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 5);
  trunkGeo.translate(0, 1.2, 0);
  const leafGeo = new THREE.ConeGeometry(1.55, 4.4, 6);
  leafGeo.translate(0, 4.4, 0);
  const treeCount = 720;
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let n = 0; n < 9000 && placed < treeCount; n++) {
    const u = hash2(n, 1);
    const v = hash2(n, 7);
    const x = MACKINAC.cx + (u - 0.5) * 2 * MACKINAC.rx * 0.92;
    const z = MACKINAC.cz + (v - 0.5) * 2 * MACKINAC.rz * 0.92;
    const h = landHeight(x, z);
    if (h < 7) continue;
    if (z > -90 && Math.abs(x) < 280) continue;
    const nrm = landNormal(x, z);
    if (Math.abs(nrm.x) + Math.abs(nrm.z) > 1.35) continue;
    const s = 0.7 + hash2(n, 9) * 1.4;
    dummy.position.set(x, h, z);
    dummy.rotation.y = hash2(n, 11) * Math.PI * 2;
    dummy.scale.set(s, s * (0.85 + hash2(n, 13) * 0.4), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    leaves.setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trunks.count = placed;
  leaves.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  group.add(trunks, leaves);

  const roundTrees = 80;
  const rt = new THREE.InstancedMesh(trunkGeo, trunkMat, roundTrees);
  const rl = new THREE.InstancedMesh(leafGeo, leafMat, roundTrees);
  let rp = 0;
  for (let n = 0; n < 400 && rp < roundTrees; n++) {
    const x = ROUND.cx + (hash2(n, 21) - 0.5) * 2 * ROUND.rx * 0.7;
    const z = ROUND.cz + (hash2(n, 22) - 0.5) * 2 * ROUND.rz * 0.7;
    const h = landHeight(x, z);
    if (h < 4) continue;
    dummy.position.set(x, h, z);
    dummy.rotation.y = hash2(n, 23) * 6;
    const s = 0.55 + hash2(n, 24) * 0.8;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    rt.setMatrixAt(rp, dummy.matrix);
    rl.setMatrixAt(rp, dummy.matrix);
    rp += 1;
  }
  rt.count = rp;
  rl.count = rp;
  rt.instanceMatrix.needsUpdate = true;
  rl.instanceMatrix.needsUpdate = true;
  group.add(rt, rl);

  const bridge = new THREE.Group();
  group.add(bridge);
  const bx = BRIDGE.x;
  const bz = BRIDGE.z;
  const towerA = new THREE.Mesh(new THREE.BoxGeometry(18, 160, 14), dark);
  towerA.position.set(bx - 280, 80, bz);
  const towerB = towerA.clone();
  towerB.position.set(bx + 280, 80, bz);
  bridge.add(towerA, towerB);
  box(bridge, dark, 720, 6, 18, bx, 72, bz);
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 620, 5),
    new THREE.MeshStandardMaterial({ color: "#9aa4aa", metalness: 0.6, roughness: 0.35 }),
  );
  cable.rotation.z = Math.PI / 2;
  cable.position.set(bx, 150, bz);
  bridge.add(cable);

  const ferry = new THREE.Group();
  const ferryHull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.2, 22), white);
  ferryHull.position.y = 0.4;
  ferry.add(ferryHull);
  const ferryCabin = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 10), white);
  ferryCabin.position.set(0, 2.2, -1);
  ferry.add(ferryCabin);
  const ferryTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.2, 5), dark);
  ferryTop.position.set(0, 3.8, -2);
  ferry.add(ferryTop);
  group.add(ferry);

  const docked: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 8.5), white);
    h.position.y = 0.3;
    g.add(h);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 3.2), clap2);
    c.position.set(0, 1.15, -0.6);
    g.add(c);
    g.position.set(HARBOR.x - 22 + i * 9, 0, HARBOR.z - 6);
    g.rotation.y = Math.PI * 0.5;
    group.add(g);
    docked.push(g);
  }

  function update(t: number) {
    const ft = t * 0.04;
    const path = (Math.sin(ft) + 1) * 0.5;
    ferry.position.set(-80 + path * 900, 0.2, 420 - path * 160);
    ferry.rotation.y = Math.cos(ft) >= 0 ? -0.4 : Math.PI - 0.4;
    for (let i = 0; i < buoyMeshes.length; i++) {
      const b = buoyMeshes[i]!;
      b.position.y = Math.sin(t * 1.4 + i) * 0.12;
      b.rotation.z = Math.sin(t * 0.9 + i * 0.7) * 0.08;
    }
  }

  function dispose() {
    scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.InstancedMesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else (m as THREE.Material).dispose();
      }
    });
  }

  return { update, dispose, group };
}
