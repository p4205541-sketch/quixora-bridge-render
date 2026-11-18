// Timeline of the Flying Thunder 3D rebuild: 20 shots timed to the V1 voiceover
// (~/workspace/flying_thunder_short/audio/timings.json, 61.26 s speech, 62.0 s total).
// Shot boundaries are the V1 cut boundaries (qa_notes.md) x 30 fps. Camera grammar follows
// the bridge story: symmetric smootherstep glides, push-ins on holds, hard cuts for big
// reframes, impact kicks that flip sign every frame. NO composer/DOF anywhere in this
// composition (EffectComposer outputs zero pixels under SwiftShader — proven, all configs).
export const FPS = 30;
export const TOTAL = 1860; // 62.0 s
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** reference camera ease: symmetric smootherstep (attack = release) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const T = (f: number) => f / FPS;

// ---------------- world layout (metres, ground y = 0, camp centre at origin) ----------------
export const BOMB_HOME: V3 = [0, 0, 0]; // sand patch centre; bomb sphere centre sits at y 0.16
export const BOMB_R = 0.16;
export const FIRE_AT: V3 = [3.2, 0, -2.5];
export const TENTS: [number, number, number][] = [[-4.5, -3.5, 0.4], [5.5, -4.5, -0.3], [-6, 2.5, 0.9], [6.5, 3, 2.4]];
export const BANNERS: [number, number][] = [[-3, -5], [3.5, -5.5]];
export const TORCHES: [number, number][] = [[-2, -1.5], [2.5, 1.5]];
export const ROCK_AT: V3 = [-8, 0, -6]; // distant rock for the short-fuse flash (shot 17)
export const DUNE_AT: V3 = [0, 0, 9]; // shot 20 viewing mound
export const SHORE_Z = 18; // water beyond z = 18

// ---------------- shots ----------------
export type Light = "night" | "dawn";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 48, light: "night" },     // ECU bomb + ember
  { id: 2, a: 48, b: 90, light: "night" },    // Jiro crouched, STOP palm
  { id: 3, a: 90, b: 134, light: "night" },   // men run back
  { id: 4, a: 134, b: 259, light: "night" },  // fleet aerial
  { id: 5, a: 259, b: 316, light: "night" },  // Taro laughs, reaches
  { id: 6, a: 316, b: 385, light: "night" },  // CU hands: grab the wrist
  { id: 7, a: 385, b: 487, light: "night" },  // two-shot: the rule
  { id: 8, a: 487, b: 635, light: "night" },  // orbit: men gather round
  { id: 9, a: 635, b: 729, light: "night" },  // Taro kicks, twice
  { id: 10, a: 729, b: 815, light: "night" }, // rock lift + belt-drag
  { id: 11, a: 815, b: 870, light: "night" }, // Aki sprints in
  { id: 12, a: 870, b: 990, light: "night" }, // ECU smoke thread
  { id: 13, a: 990, b: 1094, light: "night" },// cord: ember creeps
  { id: 14, a: 1094, b: 1178, light: "night" },// stub vs long cord
  { id: 15, a: 1178, b: 1282, light: "night" },// Jiro holds the bomb up
  { id: 16, a: 1282, b: 1328, light: "night" },// set down gently
  { id: 17, a: 1328, b: 1469, light: "night" },// contrast: flash far, walk up near
  { id: 18, a: 1469, b: 1588, light: "night" }, // step back, still night
  { id: 19, a: 1588, b: 1708, light: "night" }, // blast at night
  { id: 20, a: 1708, b: TOTAL, light: "dawn" },// CTA: dune, smoke column, dawn breaks
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

/** night -> dawn re-light: 0 through shot 19 (the blast stays night), ramps over the first 3 s of shot 20 */
export const dawnU = (f: number) => smooth((f - 1708) / 90);

// ---------------- story physics ----------------
/** 2 steps/s walk cycle, footfalls at phase 0 and 0.5 */
export const walkPhase = (t: number) => ((t % 1) + 1) % 1;

/** blast ignition frame: 30 f into shot 19 (smoke stops, sand jumps, then thunder) */
export const BLAST_F = 1618;
/** blast age in seconds since ignition (0 before) */
export const blastAge = (f: number) => Math.max(0, (f - BLAST_F) / FPS);
/** fireball life 0..1 over the first 1.5 s after ignition */
export const blastU = (f: number) => clamp01(blastAge(f) / 1.5);
/** warm flash intensity: spikes at ignition, decays over ~0.4 s, small secondary bump */
export const flashK = (f: number) => {
  const a = blastAge(f);
  if (a <= 0) return 0;
  return Math.exp(-a * 7) + 0.35 * Math.exp(-Math.max(0, a - 0.25) * 6);
};
/** thin smoke thread from the fuse hole: appears in shot 12, dies just before the blast */
export const smokeK = (f: number) => {
  if (f < 870) return 0;
  if (f < 900) return (f - 870) / 30;
  if (f < 1595) return 1;
  if (f < 1605) return 1 - (f - 1595) / 10;
  return 0;
};
/** ember glow at the fuse hole: faint in shot 1, smoking in 12, creeping 13-14, glowing 15, gone at the blast */
export const emberK = (f: number) => {
  if (f < 48) return 0.35 + 0.15 * Math.sin(T(f) * 5);
  if (f < 870) return 0.25;
  if (f < 1178) return 0.55 + 0.15 * Math.sin(T(f) * 6);
  if (f < 1282) return 0.9;
  if (f < 1618) return 0.5;
  return 0;
};
/** bomb wobble (radians of rock) after Taro's kicks: kick 1 ~21.6 s, kick 2 ~23.2 s, damped */
export const wobble = (f: number) => {
  let w = 0;
  for (const [kf, amp] of [[648, 0.16], [696, 0.24]] as const) {
    const n = f - kf;
    if (n >= 0) w += amp * Math.exp(-n / 14) * Math.sin((n / 3.2) * Math.PI);
  }
  return w;
};
/** fuse-cord ember progress 0..1 across shot 13 (visible creep), held in 14 */
export const fuseU = (f: number) => {
  if (f < 990) return 0;
  if (f < 1094) return (f - 990) / 104;
  if (f < 1178) return 1;
  return 0;
};
/** short-fuse stub in shot 14: last spark dying over the first half of the shot */
export const stubK = (f: number) => (f >= 1094 && f < 1178 ? Math.max(0, 1 - (f - 1094) / 45) : 0);
/** distant short-fuse flash in shot 17: fires at ~45.6 s, 0.35 s life */
export const farFlashK = (f: number) => {
  const a = (f - 1368) / FPS;
  return a >= 0 && a < 0.35 ? Math.exp(-a * 9) : 0;
};

// ---------------- fuse cord on the sand (shots 13-14) ----------------
/** cord path: from the far end on the sand to the bomb's fuse hole. Illustrative only (see script.md C13 note). */
export const CORD_PTS: V3[] = [[2.0, 0.04, 0.9], [1.45, 0.04, 0.55], [0.85, 0.04, 0.42], [0.4, 0.04, 0.22], [0.08, 0.3, 0.03]];
export const cordPoint = (u: number): V3 => {
  const pts = CORD_PTS, segs = pts.length - 1, x = clamp01(u) * segs, i = Math.min(segs - 1, Math.floor(x)), k = x - i;
  const a = pts[i], b = pts[i + 1];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
};
/** burnt-out short stub beside the long cord (shot 14) — kept close so both fit the 9:16 frame */
export const STUB_PTS: V3[] = [[-0.7, 0.04, 0.5], [-0.45, 0.04, 0.38], [-0.2, 0.04, 0.4]];

// ---------------- bomb placement ----------------
/** bomb centre per shot/frame (home, wobble, held at arm's length in 15, set down in 16) */
export const bombAt = (id: number, f: number): V3 => {
  if (id === 15) {
    // held at arm's length, fuse hole toward camera; slow turn across the shot
    const u = (f - 1178) / 104, a = -0.35 + 0.7 * u;
    return [0.42 + 0.08 * Math.sin(a * 2), 1.02, -0.15 + 0.1 * u];
  }
  if (id === 16) {
    // lowered gently from the hold to the sand over the first half of the shot
    const u = smooth((f - 1282) / 23);
    return [lerp(0.42, 0, u), lerp(1.02, BOMB_R, u), lerp(-0.05, 0, u)];
  }
  if (id === 19 || id === 20) return [0, BOMB_R, 0];
  return [0, BOMB_R + Math.abs(wobble(f)) * 0.02, 0];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0: the subject grows ~rate per frame */
const pushK = (f: number, f0: number, rate: number) => Math.exp(-rate * Math.max(0, f - f0));
/** pull-back factor since f0 */
const pullK = (f: number, f0: number, rate: number) => Math.exp(rate * Math.max(0, f - f0));
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// ---- framings ----
const S1 = (f: number) => dolly([0.55, 0.55, 1.15], [0, 0.18, 0], pushK(f, 0, 0.006), { fov: 36 }); // ECU bomb, fast push-in
const S2a = (f: number) => dolly([1.6, 1.2, 3.4], [-0.3, 0.7, -0.3], 1, { fov: 38 });
const S2b = (f: number) => dolly([0.9, 1.0, 2.6], [-0.3, 0.7, -0.3], pushK(f, 56, 0.002), { fov: 38 }); // whip-pan in (8 f glide)
const S3 = (f: number) => dolly([2.2, 1.7, 4.8], [0, 0.8, -1], pullK(f, 90, 0.004), { fov: 44 }); // fast pull-back
const S4a = (f: number) => dolly([0, 11, 2], [0, 1.5, 56], 1, { fov: 46 }); // low aerial: horizon + sky in frame, fleet mid-frame (was 24 m up, 40 deg down: frame was all dark water)
const S4b = (f: number) => dolly([3, 10, 6], [0, 1.5, 59], 1, { fov: 46 }); // slow glide over the water
const S5a = (f: number) => dolly([-0.6, 1.5, 5.6], [0, 1.0, 0], pushK(f, 259, 0.0015), { fov: 38 });
const S5b = (f: number) => zoom([-0.3, 1.3, 4.4], [0.15, 0.9, 0.15], 38, pushK(f, 296, 0.004), {}); // snap zoom on the hand
const S6 = (f: number) => dolly([0, 0.5, 1.7], [0, 0.28, -0.2], pushK(f, 316, 0.0015), { fov: 34 }); // CU hands + bomb
const S7 = (f: number) => dolly([0, 1.5, 5.4], [0, 1.1, -0.4], pushK(f, 385, 0.0018), { fov: 38 }); // two-shot, slow push-in
const S8 = (f: number) => { // slow orbit arc around the bomb (~50 deg)
  const u = (f - 487) / 148, a = 0.5 + u * 0.9, r = 4.4;
  return { pos: [Math.sin(a) * r, 1.6, Math.cos(a) * r] as V3, look: [0, 1.0, 0] as V3, fov: 40, roll: 0 };
};
const S9 = (f: number) => dolly([0, 1.4, 4.8], [0, 1.0, 0], pushK(f, 635, 0.0012), { fov: 38 });
const S10 = (f: number) => dolly([0, 1.6, 5.2], [0, 1.3, 0], pushK(f, 729, 0.0012), { fov: 38 });
const S11 = (f: number) => { // tracking Aki's sprint (she runs +x at z 1.2)
  const x = lerp(-4, 1.5, smooth((f - 815) / 55));
  return { pos: [x - 1.2, 1.3, 4.4] as V3, look: [x + 0.4, 1.0, 0.6] as V3, fov: 40, roll: 0 };
};
const S12 = (f: number) => dolly([0, 1.0, 3.6], [-0.1, 0.85, 0], pushK(f, 870, 0.002), { fov: 40 }); // smoke thread + Aki flag-point + Jiro
const S13 = (f: number) => { // track the creeping ember along the cord
  const e = cordPoint(fuseU(f));
  return { pos: [e[0] + 0.5, 0.55, e[2] + 1.1] as V3, look: [e[0], 0.12, e[2]] as V3, fov: 36, roll: 0 };
};
const S14 = (f: number) => dolly([0, 1.3, 3.8], [0, 0.35, 0.35], pushK(f, 1094, 0.0015), { fov: 38 }); // stub vs cord comparison
const S15 = (f: number) => dolly([0.3, 1.3, 2.8], [0.1, 1.1, -0.3], pushK(f, 1178, 0.0018), { fov: 36 });
const S16 = (f: number) => dolly([1.4, 1.0, 2.6], [-0.2, 0.5, -0.3], pushK(f, 1282, 0.0015), { fov: 38 });
const S17a = (f: number) => dolly([-5.5, 1.2, -2.5], [-8, 0.5, -6], 1, { fov: 38 }); // distant rock flash
const S17b = (f: number) => dolly([3.0, 1.5, 3.8], [1.0, 0.9, 0.5], pushK(f, 1396, 0.0015), { fov: 38 }); // man walks up
const S18 = (f: number) => dolly([0, 1.6, 7.5], [0, 1.1, 0.1], pullK(f, 1469, 0.0018), { fov: 44 }); // slow pull-back
const S19 = (f: number) => dolly([0, 1.35, 5.6], [0, 1.05, 0], pushK(f, 1588, 0.002), { fov: 42 }); // wide to close through the blast
const S20 = (f: number) => dolly([0.2, 2.5, 16.0], [0.2, 2.5, 8.8], pushK(f, 1708, 0.0016), { fov: 42 }); // continuous push-in

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1 }],
  2: [{ f: 48, s: S2a }, { f: 56, dur: 8, s: S2b }],
  3: [{ f: 90, s: S3 }],
  4: [{ f: 134, s: S4a }, { f: 150, dur: 100, s: S4b }],
  5: [{ f: 259, s: S5a }, { f: 296, dur: 8, s: S5b }],
  6: [{ f: 316, s: S6 }],
  7: [{ f: 385, s: S7 }],
  8: [{ f: 487, s: S8 }],
  9: [{ f: 635, s: S9 }],
  10: [{ f: 729, s: S10 }],
  11: [{ f: 815, s: S11 }],
  12: [{ f: 870, s: S12 }],
  13: [{ f: 990, s: S13 }],
  14: [{ f: 1094, s: S14 }],
  15: [{ f: 1178, s: S15 }],
  16: [{ f: 1282, s: S16 }],
  17: [{ f: 1328, s: S17a }, { f: 1386, dur: 10, s: S17b }], // whip-pan across the contrast
  18: [{ f: 1469, s: S18 }],
  19: [{ f: 1588, s: S19 }],
  20: [{ f: 1708, s: S20 }],
};

// impact kicks: the image offset flips sign every frame, decays in 7 f. Blast shake is
// bigger and longer (2-3 f of hard shake, then a decaying rumble through the shot).
const KICKS: [number, number][] = [[648, 0.4], [696, 0.55], [800, 0.5]]; // [frame, gain]: kick 1, kick 2, rock drop
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) {
    const n = f - f0;
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  const nb = f - BLAST_F;
  if (nb >= 0 && nb < 40) a += 2.2 * (nb % 2 ? -1 : 1) * Math.exp(-nb / 9);
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
