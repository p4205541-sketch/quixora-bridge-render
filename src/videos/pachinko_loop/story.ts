// Timeline of the Pachinko Gold Card 3D build: 15 shots timed to the FINAL voiceover
// (~/workspace/quixora_short_pachinko/audio/timings.json, 58.81 s speech, 59.53 s total).
// Shot boundaries are ceil(unit-start * 30); shot 1 starts at frame 0. Camera grammar follows
// the thunder story: symmetric smootherstep glides, push-ins on holds, fast glides for
// whips, hard cuts between shots. NO composer/DOF anywhere (EffectComposer outputs zero
// pixels under SwiftShader — proven, all configs); grade is a local ffmpeg post step.
export const FPS = 30;
export const TOTAL = 1786; // 59.53 s = speech 58.81 s + 0.7 s tail
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** reference camera ease: symmetric smootherstep (attack = release) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const T = (f: number) => f / FPS;

// ---------------- world layout (metres, ground y = 0) ----------------
// Hall interior: x in [-9, 9], z in [-14, -1]. Counter z = -11.2, machines z = -8,
// prize shelf x = 4.5, doors z = -1. Street/plaza: z in [0, 14]. Window wall x = 10,
// warehouse door x = -10, both at z = 6. The gold loop is an ellipse around the block.
export const CARD_MACRO: V3 = [0, 1.2, 3.0];
export const COUNTER_AT: V3 = [0, 0, -11.2];
export const SHELF_AT: V3 = [4.5, 0, -12.4];
export const MACHINE_ROW_Z = -8;
export const WINDOW_AT: V3 = [9.8, 1.02, 6.0]; // ledge / box home
export const WAREHOUSE_AT: V3 = [-10, 0, 6];
export const LOOP_C: [number, number] = [0, 6];
export const LOOP_RX = 9.5, LOOP_RZ = 7;
export const loopPoint = (u: number): [number, number] => {
  const a = -Math.PI / 2 + clamp01(u) * Math.PI * 2; // starts at the hall door, runs to the window first
  return [LOOP_C[0] + Math.cos(a) * LOOP_RX, LOOP_C[1] + Math.sin(a) * LOOP_RZ];
};
/** 2 steps/s walk cycle, footfalls at phase 0 and 0.5 */
export const walkPhase = (t: number) => ((t % 1) + 1) % 1;

// ---------------- shots ----------------
export type Light = "night" | "dawn";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 143, light: "night" },     // MACRO gold card + flare
  { id: 2, a: 143, b: 202, light: "night" },   // WHIP to neon street, winners
  { id: 3, a: 202, b: 343, light: "night" },   // HALL FLOOR: hero asks, regular LAUGHS
  { id: 4, a: 343, b: 435, light: "night" },   // SCALE pull-back over halls
  { id: 5, a: 435, b: 573, light: "night" },   // MACHINE: win, BALL CASCADE
  { id: 6, a: 573, b: 742, light: "night" },   // COUNTER: head-shake, NO CASH
  { id: 7, a: 742, b: 880, light: "night" },   // PRIZE SHELF: snacks -> shampoo -> gold card
  { id: 8, a: 880, b: 1029, light: "night" },  // FOLLOW to window, card/cash slide
  { id: 9, a: 1029, b: 1111, light: "night" }, // PIVOT: camera stays with card, box closes
  { id: 10, a: 1111, b: 1221, light: "dawn" }, // DAWN: wholesaler + van collect box
  { id: 11, a: 1221, b: 1299, light: "dawn" }, // WAREHOUSE: boxes, loop ignites
  { id: 12, a: 1299, b: 1367, light: "dawn" }, // RETURN: van to hall, clerk stocks card
  { id: 13, a: 1367, b: 1464, light: "dawn" }, // CONTRAST + hero's silent smile
  { id: 14, a: 1464, b: 1619, light: "dawn" }, // AERIAL: loop closes into a circle
  { id: 15, a: 1619, b: TOTAL, light: "dawn" },// CTA: hero holds the card up
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

/** night -> dawn re-light: 0 through shot 9, ramps across shots 10-13, held for 14-15 */
export const dawnU = (f: number) => smooth((f - 1111) / 353);

/** gold loop-line reveal 0..1: ignites hall->window in shot 8, extends each act, closes in shot 13 */
export const loopU = (f: number) => {
  if (f < 880) return 0;
  if (f < 1029) return 0.3 * smooth((f - 880) / 149);
  if (f < 1221) return 0.3 + 0.25 * smooth((f - 1029) / 192);
  if (f < 1299) return 0.55 + 0.25 * smooth((f - 1221) / 78);
  if (f < 1367) return 0.8 + 0.2 * smooth((f - 1299) / 68);
  return 1;
};

/** shot 1: gold card flip (radians of yaw) — one slow flip with a settle, flare at the turn */
export const cardFlip = (f: number) => {
  if (f >= 143) return 0;
  const u = f / 143;
  return Math.sin(u * Math.PI) * 1.1 + smooth(u) * 0.35;
};
/** shot 1: flare intensity — peaks as the card turns broadside (~1.4 s) */
export const flareK = (f: number) => {
  if (f >= 143) return 0;
  const a = (f - 42) / 30;
  return Math.max(0, 1 - Math.abs(a) * 1.4) * 0.9 + 0.25 * Math.max(0, Math.sin(T(f) * 2.2));
};
/** shot 5: ball cascade on (frames 435-573, ramps in over 8 f) */
export const cascadeK = (f: number) => (f < 435 || f >= 573 ? 0 : smooth((f - 435) / 8));
/** shot 8: card slides through the window (956-990), cash slides back (990-1024) */
export const cardSlideU = (f: number) => smooth((f - 956) / 34);
export const cashSlideU = (f: number) => smooth((f - 990) / 34);
/** shot 9: box lid closes over the first 1.5 s of the shot */
export const lidU = (f: number) => smooth((f - 1029) / 45);
/** regular's laugh starts 8.89 s = frame 267 */
export const LAUGH_F = 267;

// ---------------- gold card prop placement (world prop; shot 1 uses the big macro card) ----------------
/** small gold card centre per shot/frame (shelf -> hand -> window -> box -> van -> counter -> winner) */
export const cardAt = (id: number, f: number): { p: V3; vis: boolean; spin: number } => {
  switch (id) {
    case 7: { // on the shelf, then lifted into the hero's hand in the last third
      const u = smooth((f - 830) / 30);
      return { p: [lerp(4.5, 4.25, u), lerp(1.25, 1.15, u), lerp(-12.2, -10.9, u)], vis: true, spin: u * 0.5 };
    }
    case 8: { // hero carries it to the window, then it slides through
      const carry = smooth((f - 880) / 76);
      const x = lerp(4.25, 9.3, carry), z = lerp(-10.9, 6.0, carry);
      const s = cardSlideU(f);
      return { p: [lerp(x, 10.1, s), 1.06, lerp(z, 6.0, s)], vis: true, spin: 0 };
    }
    case 9: return { p: [9.8, 1.06, 6.0], vis: f < 1074, spin: 0 }; // drops into the box, lid covers it
    case 10: { // inside the box the wholesaler carries to the van: ride the box
      const u = smooth((f - 1140) / 50);
      return { p: [lerp(9.8, 7.6, u), 1.0, lerp(6.0, 6.6, u)], vis: false, spin: 0 };
    }
    case 12: return { p: [0.4, 1.5, -0.6], vis: true, spin: 0.3 }; // clerk stocks it at the door
    case 13: { // winner holds it up at the counter
      const u = smooth((f - 1400) / 30);
      return { p: [lerp(0.3, 1.05, u), lerp(1.15, 1.5, u), lerp(-11.0, -10.5, u)], vis: true, spin: 0.2 };
    }
    default: return { p: [0, -5, 0], vis: false, spin: 0 };
  }
};
/** cash notes centre (shot 8 only): slide back from the window toward the regular */
export const cashAt = (f: number): { p: V3; vis: boolean } => {
  const u = cashSlideU(f);
  if (f < 990 || f >= 1029) return { p: [10.1, 1.06, 6.3], vis: f >= 990 && f < 1029 };
  return { p: [lerp(10.1, 9.0, u), 1.06, 6.3], vis: true };
};
/** wooden box centre (window ledge -> wholesaler carry -> van -> warehouse stack) */
export const boxAt = (id: number, f: number): { p: V3; vis: boolean } => {
  if (id === 8 || id === 9) return { p: [9.8, 1.12, 6.35], vis: true };
  if (id === 10) {
    const u = smooth((f - 1140) / 50);
    return { p: [lerp(9.8, 7.9, u), lerp(1.12, 0.95, u), lerp(6.35, 7.4, u)], vis: true };
  }
  if (id === 11) return { p: [-9.2, 0.55, 5.2], vis: true };
  return { p: [9.8, 1.12, 6.35], vis: false };
};
/** van centre + yaw per shot (visible shots 10-12) */
export const vanAt = (id: number, f: number): { p: V3; yaw: number; vis: boolean } => {
  if (id === 10) return { p: [6.2, 0, 7.6], yaw: Math.PI / 2, vis: true }; // parked west of the window, clear of the carry path
  if (id === 11) return { p: [0, 0, 0], yaw: 0, vis: false }; // van stays out of the warehouse frame (9:16 has no room for van + door)
if (id === 12) return { p: [2.8, 0, 1.8], yaw: Math.PI / 2, vis: true }; // nose toward the hall door, read in the first half of the shot
  return { p: [0, 0, 0], yaw: 0, vis: false };
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

// ---- framings ----
const S1 = (f: number) => dolly([0.32, 1.34, 4.4], [0, 1.2, 3.0], pushK(f, 0, 0.005), { fov: 34 }); // macro card, fast push-in
const S2a = (f: number) => ({ pos: [-8, 2.4, 15] as V3, look: [0, 1.5, 2] as V3, fov: 44 });
const S2b = (f: number) => ({ pos: [3, 1.9, 9] as V3, look: [0, 1.4, -1] as V3, fov: 44 }); // street fly-through (59 f glide)
const S3 = (f: number) => dolly([-0.1, 1.5, -2.8], [-0.1, 1.05, -6.8], pushK(f, 202, 0.0015), { fov: 42 }); // hall floor two-shot, straight-on (9:16 fit checked)
const S4 = (f: number) => { // scale pull-back + rise over the hall row (south buildings stay behind the lens)
  const u = (f - 343) / 92;
  return { pos: [0, lerp(18, 22, u), lerp(18, 22, u)] as V3, look: [0, 0, -2] as V3, fov: 48, roll: 0 };
};
const S5 = (f: number) => dolly([-0.3, 1.4, -3.2], [-0.3, 1.05, -7.5], pushK(f, 435, 0.0018), { fov: 38 }); // machine + cascade, full figure + bucket in frame
const S6 = (f: number) => dolly([0, 1.5, -8.2], [0, 1.15, -11.2], pushK(f, 573, 0.0015), { fov: 38 }); // counter refusal, straight-on
const S7 = (f: number) => dolly([4.3, 1.45, -8.8], [4.3, 1.25, -12.2], pushK(f, 742, 0.0015), { fov: 36 }); // prize shelf, straight-on
const S8a = (f: number) => { // track the walk: doors -> street -> window corner
  const u = smooth((f - 880) / 80);
  return { pos: [lerp(-1.5, 5.2, u), 1.6, lerp(2.5, 8.6, u)] as V3, look: [lerp(0.5, 8.6, u), 1.1, lerp(0, 6.0, u)] as V3, fov: 40, roll: 0 };
};
const S8b = (f: number) => dolly([6.6, 1.5, 6.3], [10, 1.1, 6.0], pushK(f, 960, 0.002), { fov: 38 }); // window close-up (pulled back: regular + clerk + box all fit)
const S9 = (f: number) => dolly([8.1, 1.45, 7.3], [9.8, 1.02, 6.1], pushK(f, 1029, 0.002), { fov: 34 }); // pivot: the box
const S10 = (f: number) => dolly([6.0, 1.8, 11.5], [9.2, 1.1, 6.2], pushK(f, 1111, 0.0012), { fov: 40 }); // wholesaler + window (van stays left of frame)
const S11 = (f: number) => dolly([-5.0, 1.8, 6.0], [-10.5, 1.2, 6.0], pushK(f, 1221, 0.0012), { fov: 40 }); // warehouse door, straight-on
const S12a = (f: number) => dolly([4.6, 1.6, 4.6], [2.8, 1.1, 1.8], 1, { fov: 40 }); // van + wholesaler
const S12b = (f: number) => dolly([1.0, 1.55, 4.0], [0.1, 1.2, -0.6], pushK(f, 1333, 0.0015), { fov: 40 }); // glide to the clerk at the door
const S13 = (f: number) => dolly([0.2, 1.5, -7.0], [0.2, 1.15, -11.2], pushK(f, 1367, 0.0015), { fov: 42 }); // contrast at counter, pulled back for three figures
const S14 = (f: number) => { const u = (f - 1464) / 155; return { pos: [lerp(0, 1.5, u), 33, 29] as V3, look: [0, 0, 5] as V3, fov: 46, roll: 0 }; }; // aerial drift: the full loop stays framed
const S15 = (f: number) => dolly([0.7, 1.5, 8.2], [0, 1.25, 4.5], pushK(f, 1619, 0.0022), { fov: 38 }); // CTA push-in

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1 }],
  2: [{ f: 143, s: S2a }, { f: 143, dur: 59, s: S2b }],
  3: [{ f: 202, s: S3 }],
  4: [{ f: 343, s: S4 }],
  5: [{ f: 435, s: S5 }],
  6: [{ f: 573, s: S6 }],
  7: [{ f: 742, s: S7 }],
  8: [{ f: 880, s: S8a }, { f: 960, dur: 8, s: S8b }], // whip-glide into the window close-up
  9: [{ f: 1029, s: S9 }],
  10: [{ f: 1111, s: S10 }],
  11: [{ f: 1221, s: S11 }],
  12: [{ f: 1299, s: S12a }, { f: 1299, dur: 68, s: S12b }],
  13: [{ f: 1367, s: S13 }],
  14: [{ f: 1464, s: S14 }],
  15: [{ f: 1619, s: S15 }],
};

// impact kicks: the image offset flips sign every frame, decays in 7 f.
// Kicks land on the laugh (267), the cascade burst (450), the box lid (1074).
const KICKS: [number, number][] = [[267, 0.35], [450, 0.5], [1074, 0.4]];
export const kickAt = (f: number) => {
  let a = 0;
  for (const [f0, g] of KICKS) {
    const n = f - f0;
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
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
