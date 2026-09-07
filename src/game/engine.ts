import * as THREE from "three";
import { createAudio } from "./audio";
import { createBoat } from "./boat";
import { createInput, type InputSystem } from "./input";
import { createSim, type Sim } from "./sim";
import { createSky } from "./sky";
import { useAdventure } from "./store";
import { disposeTextures, makeTextures } from "./textures";
import { createWater } from "./water";
import { createWorld } from "./world";

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _helm = new THREE.Vector3();
const _lookDir = new THREE.Vector3();
const _rightLook = new THREE.Vector3();

export type Engine = {
  begin: () => void;
  dispose: () => void;
  sim: Sim;
  input: InputSystem;
  audio: ReturnType<typeof createAudio>;
};

export function createEngine(canvas: HTMLCanvasElement): Engine {
  const sim = createSim();
  const input = createInput();
  const audio = createAudio();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9ec4dc");
  const camera = new THREE.PerspectiveCamera(62, 1, 0.15, 24000);
  camera.position.set(sim.st.x + 18, 12.5, sim.st.z + 20);

  const tex = makeTextures();
  const sky = createSky(scene);
  const water = createWater(scene);
  const world = createWorld(scene, tex);
  const boat = createBoat(scene, tex);

  const detach = input.attach(canvas.parentElement || canvas);

  let acc = 0;
  let last = performance.now();
  let hudT = 0;
  let running = true;
  let cineT = 0;
  let lastFov = 62;
  const chasePos = new THREE.Vector3(sim.st.x + 18, 12.5, sim.st.z + 20);

  const onResize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);
  onResize();

  const onVis = () => {
    if (document.visibilityState === "visible") audio.unlock();
  };
  document.addEventListener("visibilitychange", onVis);

  function publishHud() {
    const { setSnap, setMeta } = useAdventure.getState();
    setSnap({ ...sim.st });
    setMeta(sim.helmSide(), sim.instPage());
  }

  function setFov(fov: number) {
    if (Math.abs(fov - lastFov) < 0.1) return;
    lastFov = fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  function placeCamera(dt: number) {
    const st = sim.st;
    _fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
    _right.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw));

    if (!st.playing || st.view === "cinematic") {
      cineT += dt * 0.11;
      const dist = 28;
      _desired.set(
        st.x + Math.sin(cineT) * dist,
        12.2 + Math.sin(cineT * 0.35) * 1.8,
        st.z + Math.cos(cineT) * dist,
      );
      chasePos.lerp(_desired, 1 - Math.exp(-dt * 1.2));
      camera.position.copy(chasePos);
      camera.lookAt(st.x, 5.8 + st.heave, st.z);
      setFov(58);
      return;
    }

    if (st.view === "chase") {
      _desired.copy(boat.root.position);
      _desired.addScaledVector(_up, 6.4);
      _desired.addScaledVector(_fwd, -18);
      _desired.addScaledVector(_right, st.lookYaw * 2);
      chasePos.lerp(_desired, 1 - Math.exp(-dt * 3.4));
      camera.position.copy(chasePos);
      _look.set(st.x, 2.2 + st.heave, st.z);
      camera.lookAt(_look);
      setFov(58);
      return;
    }

    setFov(70);
    const side = sim.helmSide();
    if (st.view === "coaming") {
      boat.coamingMount.getWorldPosition(_helm);
      _helm.addScaledVector(_right, side * 0.15);
    } else {
      boat.helmMount.getWorldPosition(_helm);
      _helm.addScaledVector(_right, (side - 1) * 0.32);
    }
    _helm.y += 0.12;
    chasePos.lerp(_helm, 1 - Math.exp(-dt * 8));
    camera.position.copy(chasePos);

    _lookDir.copy(_fwd);
    _lookDir.applyAxisAngle(_up, st.lookYaw);
    _rightLook.crossVectors(_lookDir, _up).normalize();
    _lookDir.applyAxisAngle(_rightLook, st.lookPitch);
    _look.copy(camera.position).add(_lookDir);
    camera.lookAt(_look);
  }

  function frame(now: number) {
    if (!running) return;
    const raw = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += raw;
    const inp = input.poll();

    if (inp.pauseTap && sim.st.playing) {
      sim.togglePause();
      useAdventure.getState().setOverlay(sim.st.paused ? "pause" : "play");
    }

    const steps = Math.min(4, Math.floor(acc / sim.dt));
    for (let i = 0; i < steps; i++) {
      sim.step(sim.dt, inp);
      acc -= sim.dt;
    }

    const t = now / 1000;
    boat.update(sim.st, t);
    water.update(sim.st, camera, sim.now());
    sky.update(sim.st, t);
    world.update(t);
    placeCamera(raw);
    audio.update(sim.st);

    renderer.render(scene, camera);

    hudT += raw;
    if (hudT > 0.1) {
      hudT = 0;
      publishHud();
    }

    window.__sim = sim.st;
    window.__ready = true;
    window.__controlsTest = {
      getYaw: () => sim.st.yaw,
      getSpeed: () => sim.st.speed,
      setSteer: (v: number) => input.setSteer(v),
      setKeys: (codes: string[]) => input.setKeys(codes),
    };
  }

  renderer.setAnimationLoop(frame);
  publishHud();

  return {
    sim,
    input,
    audio,
    begin() {
      audio.unlock();
      sim.begin();
      if (window.innerWidth < 720) sim.setView("chase");
      useAdventure.getState().setOverlay("play");
      cineT = 0;
    },
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      detach();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      boat.dispose();
      world.dispose();
      water.dispose();
      disposeTextures(tex);
      renderer.dispose();
      audio.dispose();
    },
  };
}
