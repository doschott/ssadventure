import type { SimSnapshot } from "./types";

type AudioHandle = {
  unlock: () => void;
  update: (st: SimSnapshot) => void;
  setMuted: (muted: boolean) => void;
  dispose: () => void;
};

export function createAudio(): AudioHandle {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let windG: GainNode | null = null;
  let waveG: GainNode | null = null;
  let luffG: GainNode | null = null;
  let engG: GainNode | null = null;
  let alarmG: GainNode | null = null;
  let windFilter: BiquadFilterNode | null = null;
  let engOsc: OscillatorNode | null = null;
  let engOsc2: OscillatorNode | null = null;
  let alarmOsc: OscillatorNode | null = null;
  let muted = false;
  let lastAlarm = "";
  let alarmT = 0;

  function noiseBuffer(c: AudioContext, seconds: number, color: "white" | "brown") {
    const n = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  function loopSource(c: AudioContext, buf: AudioBuffer, dest: AudioNode) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(dest);
    src.start();
    return src;
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);

    const brown = noiseBuffer(ctx, 3, "brown");
    const white = noiseBuffer(ctx, 2, "white");

    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    windG = ctx.createGain();
    windG.gain.value = 0;
    loopSource(ctx, brown, windFilter);
    windFilter.connect(windG);
    windG.connect(master);

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = "lowpass";
    waveFilter.frequency.value = 280;
    waveG = ctx.createGain();
    waveG.gain.value = 0;
    loopSource(ctx, brown, waveFilter);
    waveFilter.connect(waveG);
    waveG.connect(master);

    const luffFilter = ctx.createBiquadFilter();
    luffFilter.type = "highpass";
    luffFilter.frequency.value = 900;
    luffG = ctx.createGain();
    luffG.gain.value = 0;
    loopSource(ctx, white, luffFilter);
    luffFilter.connect(luffG);
    luffG.connect(master);

    engOsc = ctx.createOscillator();
    engOsc.type = "sawtooth";
    engOsc.frequency.value = 40;
    engOsc2 = ctx.createOscillator();
    engOsc2.type = "square";
    engOsc2.frequency.value = 80;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = "lowpass";
    engFilter.frequency.value = 240;
    engG = ctx.createGain();
    engG.gain.value = 0;
    engOsc.connect(engFilter);
    engOsc2.connect(engFilter);
    engFilter.connect(engG);
    engG.connect(master);
    engOsc.start();
    engOsc2.start();

    alarmOsc = ctx.createOscillator();
    alarmOsc.type = "square";
    alarmOsc.frequency.value = 880;
    alarmG = ctx.createGain();
    alarmG.gain.value = 0;
    alarmOsc.connect(alarmG);
    alarmG.connect(master);
    alarmOsc.start();
  }

  function ramp(node: GainNode | null, v: number, t = 0.08) {
    if (!node || !ctx) return;
    node.gain.setTargetAtTime(v, ctx.currentTime, t);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    setMuted(m: boolean) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.04);
    },
    update(st: SimSnapshot) {
      if (!ctx || !windG) return;
      if (ctx.state === "suspended") return;
      const tws = st.twsKn;
      ramp(windG, Math.min(0.22, 0.012 + tws * 0.008 + st.awsKn * 0.002));
      if (windFilter) {
        windFilter.frequency.setTargetAtTime(280 + tws * 28, ctx.currentTime, 0.1);
      }
      ramp(waveG, Math.min(0.18, 0.02 + st.waveAmp * 0.22 + st.sogKn * 0.006));
      ramp(luffG, st.luff * 0.09 * Math.min(1, st.awsKn / 14));
      if (st.engineOn) {
        ramp(engG, 0.03 + st.throttle * 0.05);
        engOsc?.frequency.setTargetAtTime(36 + st.rpm * 0.04, ctx.currentTime, 0.08);
        engOsc2?.frequency.setTargetAtTime(72 + st.rpm * 0.08, ctx.currentTime, 0.08);
      } else {
        ramp(engG, 0, 0.12);
      }
      const now = ctx.currentTime;
      if (st.alarm && st.alarm !== lastAlarm) {
        lastAlarm = st.alarm;
        alarmT = now + 0.18;
        if (alarmG && alarmOsc) {
          alarmOsc.frequency.setValueAtTime(st.alarm === "SHALLOW" ? 620 : 880, now);
          alarmG.gain.setTargetAtTime(0.07, now, 0.01);
        }
      }
      if (alarmT && now > alarmT) {
        ramp(alarmG, 0, 0.05);
        alarmT = 0;
        if (!st.alarm) lastAlarm = "";
      }
      if (!st.alarm) lastAlarm = "";
    },
    dispose() {
      void ctx?.close();
      ctx = null;
    },
  };
}
