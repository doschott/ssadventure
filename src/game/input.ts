import type { InputState } from "./types";

export function createInput() {
  const keys = new Set<string>();
  const injected = new Set<string>();
  let steerInject: number | null = null;
  let sheetInject: number | null = null;
  const look = { x: 0, y: 0 };
  const taps = {
    reef: 0,
    unreef: 0,
    ap: false,
    view: false,
    engine: false,
    helmSide: false,
    pause: false,
    inst: false,
  };
  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;

  function down(code: string) {
    return keys.has(code) || injected.has(code);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) {
      keys.add(e.code);
      return;
    }
    keys.add(e.code);
    if (e.code === "KeyR" && (e.shiftKey || e.altKey)) taps.unreef += 1;
    else if (e.code === "KeyR") taps.reef += 1;
    if (e.code === "KeyP" || e.code === "Space") {
      e.preventDefault();
      taps.ap = true;
    }
    if (e.code === "KeyV") taps.view = true;
    if (e.code === "KeyE") taps.engine = true;
    if (e.code === "KeyH" && !e.metaKey && !e.ctrlKey) taps.helmSide = true;
    if (e.code === "Escape") taps.pause = true;
    if (e.code === "KeyC") taps.inst = true;
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function onBlur() {
    keys.clear();
  }

  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement) {
      look.x += e.movementX;
      look.y += e.movementY;
      return;
    }
    if (!pointerDown) return;
    look.x += e.clientX - lastX;
    look.y += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerDown(e: PointerEvent) {
    const t = e.target as HTMLElement | null;
    if (t && t.closest("[data-ui]")) return;
    pointerDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onPointerUp() {
    pointerDown = false;
  }

  function attach(el: HTMLElement) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onBlur);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }

  function poll(): InputState {
    let steer = 0;
    if (down("KeyA") || down("ArrowLeft")) steer += 1;
    if (down("KeyD") || down("ArrowRight")) steer -= 1;
    if (steerInject !== null) steer = steerInject;
    let sheet = 0;
    if (down("KeyW") || down("ArrowUp")) sheet += 1;
    if (down("KeyS") || down("ArrowDown")) sheet -= 1;
    if (sheetInject !== null) sheet = sheetInject;
    let throttle = 0;
    if (down("Equal") || down("NumpadAdd")) throttle += 1;
    if (down("Minus") || down("NumpadSubtract")) throttle -= 1;
    const state: InputState = {
      steer,
      sheet,
      lookX: look.x,
      lookY: look.y,
      reefTap: taps.reef,
      unreefTap: taps.unreef,
      apTap: taps.ap,
      viewTap: taps.view,
      engineTap: taps.engine,
      helmSideTap: taps.helmSide,
      pauseTap: taps.pause,
      cycleInstTap: taps.inst,
      throttle,
      keys,
    };
    look.x = 0;
    look.y = 0;
    taps.reef = 0;
    taps.unreef = 0;
    taps.ap = false;
    taps.view = false;
    taps.engine = false;
    taps.helmSide = false;
    taps.pause = false;
    taps.inst = false;
    return state;
  }

  return {
    attach,
    poll,
    down,
    keys,
    injected,
    setKeys(codes: string[]) {
      injected.clear();
      for (const c of codes) injected.add(c);
    },
    setSteer(v: number | null) {
      steerInject = v;
    },
    setSheet(v: number | null) {
      sheetInject = v;
    },
    clearSteer() {
      steerInject = null;
    },
    tapReef() {
      taps.reef += 1;
    },
    tapUnreef() {
      taps.unreef += 1;
    },
    tapAp() {
      taps.ap = true;
    },
    tapView() {
      taps.view = true;
    },
    tapEngine() {
      taps.engine = true;
    },
    tapHelmSide() {
      taps.helmSide = true;
    },
    tapPause() {
      taps.pause = true;
    },
    tapInst() {
      taps.inst = true;
    },
  };
}

export type InputSystem = ReturnType<typeof createInput>;
