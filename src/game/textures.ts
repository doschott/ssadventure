import * as THREE from "three";

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function tex(c: HTMLCanvasElement, repeat = 8, linear = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.needsUpdate = true;
  if (!linear) t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeTeak() {
  const { c, ctx } = canvas(512);
  ctx.fillStyle = "#6d4e2e";
  ctx.fillRect(0, 0, 512, 512);
  const plank = 28;
  for (let y = 0; y < 512; y += plank) {
    const hue = 28 + (y % 5) * 2;
    const light = 38 + ((y * 13) % 17);
    ctx.fillStyle = `hsl(${hue}, 38%, ${light}%)`;
    ctx.fillRect(0, y + 1, 512, plank - 2);
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(0, y, 512, 1);
    for (let x = 0; x < 512; x += 90) {
      ctx.fillStyle = `rgba(40,24,10,${0.04 + ((x + y) % 7) * 0.01})`;
      ctx.fillRect(x, y + 3, 80, plank - 6);
    }
    ctx.strokeStyle = "rgba(90,60,30,0.18)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(0, y + 6 + i * 3);
      ctx.bezierCurveTo(120, y + 4 + i * 3, 300, y + 10 + i * 3, 512, y + 5 + i * 3);
      ctx.stroke();
    }
  }
  return tex(c, 6);
}

export function makeGelcoat() {
  const { c, ctx } = canvas(256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#f7f4ee");
  g.addColorStop(1, "#e8e2d6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return tex(c, 2);
}

export function makeSail() {
  const { c, ctx } = canvas(512);
  const g = ctx.createLinearGradient(0, 0, 520, 80);
  g.addColorStop(0, "#f4efe4");
  g.addColorStop(0.5, "#efe6d4");
  g.addColorStop(1, "#e7dcc6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(120,100,70,${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  ctx.strokeStyle = "rgba(90,70,45,0.22)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const y = (i / 8) * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(70,55,35,0.18)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 5) * 512, 0);
    ctx.lineTo((i / 5) * 512, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(60,48,32,0.45)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(6, 506);
  ctx.lineTo(6, 6);
  ctx.lineTo(506, 6);
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(6, 506);
  ctx.lineTo(506, 506);
  ctx.stroke();
  ctx.fillStyle = "rgba(70,55,40,0.16)";
  ctx.fillRect(0, 0, 36, 36);
  ctx.fillRect(476, 0, 36, 36);
  ctx.fillRect(0, 476, 48, 36);
  ctx.fillRect(464, 464, 48, 48);
  const t = tex(c, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  return t;
}

export function makeLimestone() {
  const { c, ctx } = canvas(512);
  ctx.fillStyle = "#c4b49a";
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 18) {
    const l = 62 + ((y * 3) % 14);
    ctx.fillStyle = `hsl(36, 18%, ${l}%)`;
    ctx.fillRect(0, y, 512, 16);
    ctx.fillStyle = "rgba(70,60,45,0.18)";
    ctx.fillRect(0, y + 15, 512, 1);
    for (let x = 0; x < 512; x += 40 + (y % 20)) {
      ctx.fillStyle = `rgba(90,70,50,${0.05 + ((x * y) % 5) * 0.01})`;
      ctx.fillRect(x, y, 8 + (x % 12), 14);
    }
  }
  return tex(c, 4);
}

export function makeForest() {
  const { c, ctx } = canvas(512);
  ctx.fillStyle = "#1c3a28";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 14;
    ctx.fillStyle = `hsla(${118 + Math.random() * 28}, ${35 + Math.random() * 25}%, ${16 + Math.random() * 18}%, 0.85)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return tex(c, 3);
}

export function makeGrass() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = "#3d6a3a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    ctx.strokeStyle = `rgba(20,60,20,${0.15 + Math.random() * 0.2})`;
    ctx.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y - 4 - Math.random() * 4);
    ctx.stroke();
  }
  return tex(c, 8);
}

export function makeClapboard() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = "#f2eee6";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(40,40,40,0.12)";
  for (let y = 0; y < 256; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  return tex(c, 3);
}

export function makeFlag() {
  const { c, ctx } = canvas(256);
  ctx.fillStyle = "#0055a4";
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "#fecc00";
  ctx.fillRect(0, 64, 256, 32);
  ctx.fillRect(88, 0, 32, 160);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeChart() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#cbbd93";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(60,80,90,0.18)";
  for (let i = 0; i < 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.fillStyle = "#d8c9a0";
  ctx.beginPath();
  ctx.ellipse(255, 200, 90, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3d6a40";
  ctx.beginPath();
  ctx.ellipse(255, 200, 82, 46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d8c9a0";
  ctx.beginPath();
  ctx.ellipse(268, 290, 28, 16, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f5530";
  ctx.beginPath();
  ctx.ellipse(268, 290, 24, 13, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a3344";
  ctx.font = "12px sans-serif";
  ctx.fillText("STRAITS OF MACKINAC", 170, 40);
  ctx.fillStyle = "#8b2a2a";
  ctx.beginPath();
  ctx.arc(255, 248, 4, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export type GameTextures = ReturnType<typeof makeTextures>;

export function makeTextures() {
  return {
    teak: makeTeak(),
    gelcoat: makeGelcoat(),
    sail: makeSail(),
    limestone: makeLimestone(),
    forest: makeForest(),
    grass: makeGrass(),
    clapboard: makeClapboard(),
    flag: makeFlag(),
    chart: makeChart(),
  };
}

export function disposeTextures(t: GameTextures) {
  Object.values(t).forEach((x) => x.dispose());
}
