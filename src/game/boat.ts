import * as THREE from "three";
import { BOAT } from "./constants";
import { createSails, SAIL_RIG } from "./sails";
import type { GameTextures } from "./textures";
import type { SimSnapshot } from "./types";

function hullGeometry() {
  const ST = 28;
  const SEC = 10;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const loa = BOAT.loa;
  const half = BOAT.beam * 0.5;

  for (let i = 0; i < ST; i++) {
    const s = i / (ST - 1);
    const z = (s - 0.47) * loa;
    const bow = Math.pow(Math.min(s / 0.2, 1), 0.7);
    const env = Math.min(bow, s > 0.9 ? 0.84 : 1);
    const yKeel = -0.48;
    const yDeck = 1.08 + (1 - s) * 0.42;
    for (let j = 0; j < SEC; j++) {
      const t = (j / (SEC - 1)) * 2 - 1;
      const k = Math.abs(t);
      const y = yKeel + (yDeck - yKeel) * Math.pow(k, 1.15);
      const x = Math.sign(t || 1) * half * env * Math.pow(Math.max(k, 0.02), 0.58);
      positions.push(x, y, z);
      uvs.push(s * 4, k);
      const stripe = y > 0.42 && y < 0.62 ? 1 : 0;
      const boot = y < -0.22 ? 1 : 0;
      colors.push(
        stripe ? 0.05 : boot ? 0.08 : 0.93,
        stripe ? 0.12 : boot ? 0.16 : 0.91,
        stripe ? 0.22 : boot ? 0.22 : 0.86,
      );
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < ST - 1; i++) {
    for (let j = 0; j < SEC - 1; j++) {
      const a = i * SEC + j;
      const b = a + 1;
      const c = a + SEC;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createBoat(scene: THREE.Scene, tex: GameTextures) {
  const root = new THREE.Group();
  const heeler = new THREE.Group();
  const body = new THREE.Group();
  root.add(heeler);
  heeler.add(body);
  scene.add(root);

  const gelcoat = new THREE.MeshStandardMaterial({
    map: tex.gelcoat,
    vertexColors: true,
    roughness: 0.28,
    metalness: 0.04,
  });
  const hull = new THREE.Mesh(hullGeometry(), gelcoat);
  body.add(hull);

  const teakMat = new THREE.MeshStandardMaterial({
    map: tex.teak,
    roughness: 0.72,
    metalness: 0.0,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.05, 9.6), teakMat);
  deck.position.set(0, 1.12, 0.2);
  body.add(deck);

  const cabinMat = new THREE.MeshStandardMaterial({
    color: "#efeae1",
    roughness: 0.4,
    map: tex.gelcoat,
  });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.82, 4.1), cabinMat);
  cabin.position.set(0, 1.55, -0.85);
  body.add(cabin);

  const glassMat = new THREE.MeshStandardMaterial({
    color: "#1a2a32",
    roughness: 0.08,
    metalness: 0.4,
    transparent: true,
    opacity: 0.72,
  });
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 0.08), glassMat);
  screen.position.set(0, 2.05, 1.48);
  screen.rotation.x = -0.18;
  body.add(screen);

  const canvasMat = new THREE.MeshStandardMaterial({
    color: "#1c3140",
    roughness: 0.85,
  });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.08, 1.15), canvasMat);
  hood.position.set(0, 2.32, 1.05);
  body.add(hood);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.55, 2.7), teakMat);
  cockpit.position.set(0, 0.88, 3.15);
  body.add(cockpit);

  const seatL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 2.5), teakMat);
  seatL.position.set(-1.05, 1.22, 3.15);
  const seatR = seatL.clone();
  seatR.position.x = 1.05;
  body.add(seatL, seatR);

  const transom = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.35, 0.2), gelcoat);
  transom.position.set(0, 0.55, 5.42);
  body.add(transom);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), teakMat);
  platform.position.set(0, 0.28, 5.75);
  body.add(platform);

  const chrome = new THREE.MeshStandardMaterial({
    color: "#c5cdd2",
    metalness: 0.85,
    roughness: 0.22,
  });
  const keel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 2.6), chrome);
  keel.position.set(0, -1.15, 0.4);
  body.add(keel);

  const rudderGeo = new THREE.BoxGeometry(0.08, 1.15, 0.55);
  const rudder = new THREE.Mesh(rudderGeo, chrome);
  rudder.position.set(0, -0.55, 5.15);
  body.add(rudder);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.05, 10), chrome);
  pedestal.position.set(0, 1.55, 3.55);
  body.add(pedestal);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 22), chrome);
  wheel.position.set(0, 2.12, 3.55);
  body.add(wheel);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5), chrome);
    spoke.rotation.z = (i / 5) * Math.PI;
    spoke.position.copy(wheel.position);
    body.add(spoke);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 15.4, 10), chrome);
  mast.position.set(0, 9.0, -1.15);
  body.add(mast);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 5.6, 8), chrome);

  const spreader = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6), chrome);
  spreader.rotation.z = Math.PI / 2;
  spreader.position.set(0, 8.2, -1.15);
  body.add(spreader);
  const spreader2 = spreader.clone();
  spreader2.position.y = 11.2;
  spreader2.scale.set(0.75, 1, 1);
  body.add(spreader2);

  const tack = new THREE.Vector3(...SAIL_RIG.jibTack);
  const head = new THREE.Vector3(...SAIL_RIG.jibHead);
  const stayDir = head.clone().sub(tack);
  const stayLen = stayDir.length();
  const forestay = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, stayLen, 4), chrome);
  forestay.position.copy(tack).add(head).multiplyScalar(0.5);
  forestay.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stayDir.normalize());
  body.add(forestay);

  const sails = createSails(body, tex, boom);

  const bimini = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 1.4), canvasMat);
  bimini.position.set(0, 2.92, 2.55);
  body.add(bimini);

  for (const x of [-1.55, 1.55]) {
    for (let z = -4.2; z <= 4.8; z += 1.15) {
      const stanch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 5), chrome);
      stanch.position.set(x, 1.5, z);
      body.add(stanch);
    }
  }

  const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), chrome);
  const w1 = winch.clone();
  w1.position.set(-1.15, 1.28, 2.35);
  const w2 = winch.clone();
  w2.position.set(1.15, 1.28, 2.35);
  body.add(w1, w2);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.45, 0.28),
    new THREE.MeshBasicMaterial({ map: tex.flag, side: THREE.DoubleSide }),
  );
  flag.position.set(0.02, 2.55, 5.2);
  body.add(flag);

  const bowNum = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.18, 0.7),
    new THREE.MeshBasicMaterial({ color: "#1a2540" }),
  );
  bowNum.position.set(1.42, 0.82, -3.8);
  body.add(bowNum);

  const helmMount = new THREE.Object3D();
  helmMount.position.set(0.22, 2.22, 3.85);
  body.add(helmMount);
  const coamingMount = new THREE.Object3D();
  coamingMount.position.set(1.2, 1.85, 3.15);
  body.add(coamingMount);

  function update(st: SimSnapshot, t: number) {
    root.position.set(st.x, st.y, st.z);
    root.rotation.order = "YXZ";
    root.rotation.y = st.yaw;
    heeler.rotation.z = -st.heel;
    body.rotation.x = st.pitch * 0.85;

    sails.update(st, t);

    rudder.rotation.y = -st.rudder * 0.9;
    wheel.rotation.z = -st.helm * 2.4;
    flag.rotation.y = 0.2 + Math.sin(t * 3.2) * 0.15 * Math.min(1, st.awsKn / 12);
  }

  function dispose() {
    scene.remove(root);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }

  return { root, body, helmMount, coamingMount, update, dispose };
}

export type Boat = ReturnType<typeof createBoat>;
