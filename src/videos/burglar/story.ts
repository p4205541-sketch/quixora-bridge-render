// "Why A Burglar Fixed Their House": 15 shots timed to the voiceover
// (~/workspace/quixora_short_burglar/audio/timings.json — REAL timings, 55.26 s,
// 213 words @ 237.5 wpm speech, 1679 frames; remapped from the provisional
// 1650-frame boundaries when the re-recorded voice landed 20 Nov 23:57 IST).
// Reference 14 grammar: continuous camera with ~5 HARD CUTS for setup changes
// (exterior <-> interior jumps are hard cuts, like the reference; the rest glide).
// NO composer/DOF anywhere (EffectComposer outputs zero pixels under SwiftShader — proven);
// NO depth-pass export for this video (Manhole proved DOF blurs captions unreadable).
// NO CTA: Reference 14 has none; hard stop on the punchline final image (Matching Rules Rule 9).
export const FPS = 30;
export const TOTAL = 1679; // 55.26 s (213 words @ 237.5 wpm speech)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** reference camera ease: symmetric smootherstep (attack = release) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const T = (f: number) => f / FPS;

// ---------------- world layout (metres, ground y = 0) ----------------
// House front wall at z = 0 (door at x = 0, number plate "16" beside it).
// Living room x -4..2, z 0..5; kitchen x 2..6, z 0..5; hallway z 5..7; bathroom x 5..6.5, z 5..7.
// Neighbour's house across the street at z = -12 (number "61").
export const DOOR_AT: V3 = [0, 0, 0]; // front door centre (hinge at x +0.45)
export const HINGE_AT: V3 = [0.45, 1.05, 0];
export const COUCH_AT: V3 = [-3.2, 0, 2.4];
export const TABLE_AT: V3 = [4.2, 0, 2.4]; // kitchen table (the wobbly one, now steady)
export const SINK_AT: V3 = [4.6, 0, 4.9]; // kitchen sink cabinet (catch scene)
export const PAINT_AT: V3 = [0, 1.6, 6.6]; // hallway painting (now straight)
export const BULB_AT: V3 = [5.8, 1.9, 6.4]; // bathroom bulb (now steady)
export const TOOLBOX_AT: V3 = [-0.5, 0.62, 2.6]; // red toolbox on the coffee table (shot 14)
export const PLATE16_AT: V3 = [0.85, 1.5, -0.02];
export const HOUSE61_AT: V3 = [-3, 0, -12];

// ---------------- shots (from the real voice timings, 20 Nov 23:57 IST) ----------------
export type ShotDef = { id: number; a: number; b: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 63 },      // ECU hinge oiled at night (hook)
  { id: 2, a: 63, b: 129 },    // wide night exterior, handyman at door
  { id: 3, a: 129, b: 182 },   // morning, dad pushes door — swings silently
  { id: 4, a: 182, b: 258 },   // dad at the hinge: six years of squeak, gone
  { id: 5, a: 258, b: 396 },   // kitchen, table steady, mom's coffee doesn't spill
  { id: 6, a: 396, b: 565 },   // pan: painting straight -> bulb steady
  { id: 7, a: 565, b: 600 },   // dad at night, worried: haunted, by a helpful ghost
  { id: 8, a: 600, b: 738 },   // priest blesses living room, kitchen, squeaky door
  { id: 9, a: 738, b: 794 },   // night, hinge oiled again (mirror of shot 1)
  { id: 10, a: 794, b: 972 },  // security-camera monitor insert, 03:00, handyman fixing door
  { id: 11, a: 972, b: 1062 }, // dad hides behind couch with flashlight
  { id: 12, a: 1062, b: 1177 },// under the sink: caught! wrong house
  { id: 13, a: 1177, b: 1414 },// house numbers: sixteen, looking for sixty-one
  { id: 14, a: 1414, b: 1546 },// morning, dad tapes note to the toolbox
  { id: 15, a: 1546, b: TOTAL },// handyman smiles with the note — hard stop, no CTA
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- story physics ----------------
/** 2 steps/s walk cycle, footfalls at phase 0 and 0.5 */
export const walkPhase = (t: number) => ((t % 1) + 1) % 1;

/** front door swing (radians, 0 = closed). Opens as dad pushes it in shot 3,
 *  closes again during the 3->4 glide; shut everywhere else. */
export const doorAngle = (f: number): number => {
  if (f < 141) return 0;
  if (f < 165) return lerp(0, 1.4, smooth((f - 141) / 24)); // dad pushes it open
  if (f < 182) return 1.4;
  if (f < 212) return lerp(1.4, 0, smooth((f - 182) / 30)); // closes during the glide
  return 0;
};
/** oil drop falling from the hinge (shots 1 and 9): loops every 18 frames while the shot runs */
export const oilDropY = (f: number): number | null => {
  const inShot = (f >= 0 && f < 63) || (f >= 738 && f < 794);
  if (!inShot) return null;
  const local = f < 63 ? f : f - 738;
  const u = (local % 18) / 18;
  return 1.05 - u * u * 0.35; // accelerating fall from the hinge
};
/** bathroom bulb: steady glow (already fixed). Returns glow strength 0..1. */
export const bulbGlow = (f: number): number => (f >= 396 && f < 565 ? 1 : 0.35);
/** flashlight on in shots 11-12 (dad's flashlight). Returns beam target or null. */
export const flashTarget = (f: number): V3 | null => {
  if (f >= 972 && f < 1062) return [-3.2, 0.8, 2.4]; // beam on the couch/door
  if (f >= 1062 && f < 1177) return [4.6, 0.5, 4.9]; // beam under the sink
  return null;
};
/** night shots: 1, 2, 7, 9, 10, 11, 12. Day shots: the rest. */
export const isNight = (f: number): boolean => {
  const id = shotAt(f).id;
  return id === 1 || id === 2 || id === 7 || id === 9 || id === 10 || id === 11 || id === 12;
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
const S1 = (f: number) => dolly([0.9, 1.3, -1.6], HINGE_AT, pushK(f, 0, 0.004), { fov: 38 }); // ECU hinge, oil drop
const S2 = (f: number) => dolly([7, 3.2, -11], [0, 1.6, 0], pushK(f, 63, 0.003), { fov: 46 }); // wide night exterior
const S3 = (f: number) => dolly([3.0, 1.9, 4.2], [0, 1.2, 0], pushK(f, 129, 0.003), { fov: 42 }); // dad pushes the silent door
const S4 = (f: number) => dolly([2.0, 1.6, 2.6], [0.55, 1.0, 0.7], pushK(f, 182, 0.003), { fov: 40 }); // dad at the hinge (look centred on dad+hinge, not the door centre)
const S5 = (f: number) => dolly([5.6, 2.0, 4.4], [4.2, 0.8, 2.4], pushK(f, 258, 0.002), { fov: 42 }); // kitchen table, mom's coffee (camera IN the kitchen — the old living-room camera looked through the partition wall)
const S6 = (f: number) => { // FIXED camera at the hallway's west end, look pans painting -> bulb
  // (the old tracking shot swung the view ~70 deg and put the painting behind the camera;
  // from the west end both subjects sit ~east, so the pan is only ~8 deg of view swing)
  const u = smooth((f - 396) / 169);
  return {
    pos: [-3.5, 1.9, 6.0] as V3,
    look: [lerp(0, 5.8, u), lerp(1.6, 1.9, u), lerp(6.6, 6.4, u)] as V3,
    fov: 42, roll: 0,
  };
};
const S7 = (f: number) => dolly([-0.2, 1.9, 4.6], [-3.2, 1.0, 2.4], pushK(f, 565, 0.003), { fov: 42 }); // dad worried on the couch, night (camera by the hallway doorway, looking west at the couch)
const S8 = (f: number) => dolly([1.5, 1.8, 0.8], [0, 1.2, 3.2], pushK(f, 600, 0.002), { fov: 42 }); // priest blesses the rooms (camera IN the living room, centred on the priest)
const S9 = (f: number) => dolly([-0.9, 1.4, -1.8], HINGE_AT, pushK(f, 738, 0.004), { fov: 38 }); // hinge oiled again, mirror of S1
const S10 = (f: number) => dolly([2.8, 3.1, -2.2], [0.4, 1.0, -0.4], pushK(f, 794, 0.002), { fov: 44 }); // CCTV high corner on the door (look shifted toward the handyman so his card fits)
const S11 = (f: number) => dolly([3.6, 1.7, 0.8], [-2.6, 0.8, 2.8], pushK(f, 972, 0.003), { fov: 42 }); // dad behind the couch, flashlight (look shifted toward dad)
const S12 = (f: number) => dolly([1.2, 1.5, 2.2], [4.6, 0.5, 4.9], pushK(f, 1062, 0.003), { fov: 40 }); // under the sink (camera pulled back — the old close camera cropped both figures' cards)
const S13 = (f: number) => { // house numbers: fixed street camera, look pans plate 16 -> plate 61
  // (the old pull-back pan moved the look off the plate in the first quarter and put both
  // houses out of frame; the pan now holds on the plate for the first 40%, then whips to 61)
  const u = smooth((f - 1177) / 237);
  const u2 = smooth(Math.max(0, (u - 0.4) / 0.6));
  return {
    pos: [3.0, 1.8, -3.5] as V3,
    look: [lerp(0.85, -2.1, u2), 1.5, lerp(-0.02, -9.4, u2)] as V3,
    fov: 44, roll: 0,
  };
};
const S14 = (f: number) => dolly([2.2, 1.8, 0.2], [-0.5, 0.9, 2.2], pushK(f, 1414, 0.003), { fov: 40 }); // note taped to the toolbox (camera pulled back, look centred on dad so his card fits)
const S15 = (f: number) => dolly([1.2, 1.8, 0.6], [-1.2, 1.2, 3.0], pushK(f, 1546, 0.002), { fov: 40 }); // handyman smiles — hard stop

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1 }], 2: [{ f: 63, s: S2 }], 3: [{ f: 129, s: S3 }], 4: [{ f: 182, s: S4 }],
  5: [{ f: 258, s: S5 }], 6: [{ f: 396, s: S6 }], 7: [{ f: 565, s: S7 }], 8: [{ f: 600, s: S8 }],
  9: [{ f: 738, s: S9 }], 10: [{ f: 794, s: S10 }], 11: [{ f: 972, s: S11 }], 12: [{ f: 1062, s: S12 }],
  13: [{ f: 1177, s: S13 }], 14: [{ f: 1414, s: S14 }], 15: [{ f: 1546, s: S15 }],
};

type CameraTransition = { f: number; dur: number; from: number; to: number; lift?: number; cut?: boolean };
const CAMERA_TRANSITIONS: CameraTransition[] = [
  { f: 63, dur: 24, from: 1, to: 2, lift: 1 },
  { f: 129, dur: 1, from: 2, to: 3, cut: true }, // hard cut: exterior -> interior
  { f: 182, dur: 24, from: 3, to: 4, lift: 1 },
  { f: 258, dur: 30, from: 4, to: 5, lift: 1 },
  { f: 396, dur: 1, from: 5, to: 6, cut: true }, // hard cut: kitchen -> hallway (the glide would swing ~127 deg and cross the z=5 wall)
  { f: 565, dur: 1, from: 6, to: 7, cut: true }, // hard cut: hallway pan (looking east) -> couch (looking west), ~170 deg swing
  { f: 600, dur: 1, from: 7, to: 8, cut: true }, // hard cut: dad worried -> priest arrives (time jump, ~75 deg swing; shot 7 is only 35f)
  { f: 738, dur: 1, from: 8, to: 9, cut: true }, // hard cut: day -> night (the glide would graze the wall top)
  { f: 794, dur: 1, from: 9, to: 10, cut: true }, // hard cut: hinge ECU -> CCTV high corner (~85 deg swing)
  { f: 972, dur: 1, from: 10, to: 11, cut: true }, // hard cut: CCTV -> interior
  { f: 1062, dur: 1, from: 11, to: 12, cut: true }, // hard cut: couch -> under the sink (the glide would cross the partition)
  { f: 1177, dur: 1, from: 12, to: 13, cut: true }, // hard cut: interior -> exterior
  { f: 1414, dur: 1, from: 13, to: 14, cut: true }, // hard cut: exterior -> interior
  { f: 1546, dur: 30, from: 14, to: 15, lift: 1 },
]; // 10 hard cuts; the 4 remaining glides (1->2, 3->4, 4->5, 14->15) swing 11-25 deg only

const rawCamAt = (id: number, f: number): Cam => run(CAMS[id], f);
/** Interpolate camera position and optical axis separately; linearly blending look points can make the lens
 *  point through itself when the outgoing/incoming view directions are very different. */
const travelMix = (a: Cam, b: Cam, u: number): Cam => {
  const pos = a.pos.map((v, i) => v + (b.pos[i] - v) * u) as V3;
  const da = a.look.map((v, i) => v - a.pos[i]) as V3;
  const db = b.look.map((v, i) => v - b.pos[i]) as V3;
  const la = Math.hypot(...da), lb = Math.hypot(...db);
  const va = da.map((v) => v / Math.max(la, 1e-6)) as V3;
  const vb = db.map((v) => v / Math.max(lb, 1e-6)) as V3;
  const dot = Math.max(-0.9999, Math.min(0.9999, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot), sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - u) * omega) / sinOmega, wb = Math.sin(u * omega) / sinOmega;
  const dir = [va[0] * wa + vb[0] * wb, va[1] * wa + vb[1] * wb, va[2] * wa + vb[2] * wb] as V3;
  const dn = Math.hypot(...dir) || 1;
  const distance = la + (lb - la) * u;
  return {
    pos,
    look: [pos[0] + (dir[0] / dn) * distance, pos[1] + (dir[1] / dn) * distance, pos[2] + (dir[2] / dn) * distance],
    fov: a.fov + (b.fov - a.fov) * u,
    roll: a.roll + (b.roll - a.roll) * u,
  };
};

/**
 * One global camera path for the whole short. Hard-cut transitions (cut: true) switch instantly
 * at the shot boundary; glides ease between framings over the travel window with a lifted arc.
 */
export const camAt = (_id: number, f: number): Cam => {
  const active = shotAt(Math.max(0, Math.min(TOTAL - 1, f))).id;
  const tr = CAMERA_TRANSITIONS.find((x) => f >= x.f - x.dur / 2 && f <= x.f + x.dur / 2);
  if (!tr) return rawCamAt(active, f);
  if (tr.cut) return rawCamAt(active, f);
  const start = tr.f - tr.dur / 2, end = tr.f + tr.dur / 2;
  const from = rawCamAt(tr.from, start), to = rawCamAt(tr.to, end);
  const u = glide((f - start) / Math.max(1, end - start));
  const c = travelMix(from, to, u);
  const distance = Math.hypot(to.pos[0] - from.pos[0], to.pos[1] - from.pos[1], to.pos[2] - from.pos[2]);
  const arc = tr.lift ?? Math.min(8, Math.max(0.5, distance * 0.08));
  c.pos = [c.pos[0], c.pos[1] + Math.sin(Math.PI * u) * arc, c.pos[2]];
  return c;
};
