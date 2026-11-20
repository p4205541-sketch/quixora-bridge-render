// "Why Manhole Covers Are Always Round": 18 shots timed to the voiceover
// (~/workspace/quixora_short_manhole/audio/timings.json, 58.29 s speech, 59.0 s total).
// Shot boundaries are the sentence boundaries x 30 fps (CTA holds to TOTAL).
// Camera grammar: ONE continuous camera down a single city street (manhole at origin),
// bridge-style CAMERA_TRANSITIONS (position lerps, look direction slerps, lifted arcs).
// NO composer/DOF anywhere in this composition (EffectComposer outputs zero pixels under
// SwiftShader — proven, all configs); dofAt/focusAt exist only for the depth-pass export.
export const FPS = 30;
export const TOTAL = 1770; // 59.0 s
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
/** reference camera ease: symmetric smootherstep (attack = release) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const T = (f: number) => f / FPS;

// ---------------- world layout (metres, ground y = 0, hero manhole at origin) ----------------
export const HERO: V3 = [0, 0, 0]; // hero manhole centre, road centre
export const RIG_AT: V3 = [4, 0.12, 5.2]; // drop-test rig on the north sidewalk
export const PRESS_AT: V3 = [8.5, 0.12, 5.2]; // hydraulic press, north sidewalk
export const TRI_AT: V3 = [-29, 0, -1.5]; // Nashua triangle-cover corner (west end)
export const VENT_AT: V3 = [-6, 0, -1.5]; // smoking steam vent
export const LID_R = 0.35; // round cover radius (0.7 m diameter, 24-28 in class)

// ---------------- shots ----------------
export type ShotDef = { id: number; a: number; b: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 144 },     // wide street, Milo lifts the iron lid (hook)
  { id: 2, a: 144, b: 201 },   // pedestrians walk over the manhole
  { id: 3, a: 201, b: 312 },   // pull up — street full of manholes
  { id: 4, a: 312, b: 402 },   // steam vent smoking manhole
  { id: 5, a: 402, b: 445 },   // Vera enters, skeptical
  { id: 6, a: 445, b: 540 },   // Vera gestures at a square lid
  { id: 7, a: 540, b: 618 },   // Milo turns the square lid on edge at the rig
  { id: 8, a: 618, b: 731 },   // diagonal close-up, square lid + 1.414x
  { id: 9, a: 731, b: 812 },   // square lid drops through the rig
  { id: 10, a: 812, b: 898 },  // round lid on the rig, turning
  { id: 11, a: 898, b: 967 },  // round lid stays, cannot fall
  { id: 12, a: 967, b: 1038 }, // Milo rolls the round lid
  { id: 13, a: 1038, b: 1120 },// rolling into place
  { id: 14, a: 1120, b: 1228 },// lid drops in, fits every time
  { id: 15, a: 1228, b: 1378 },// Nashua flashback — triangle covers on a side corner
  { id: 16, a: 1378, b: 1488 },// press/test rig — 40-tonne test
  { id: 17, a: 1488, b: 1608 },// pedestrian steps over the manhole, Milo vindicated
  { id: 18, a: 1608, b: TOTAL },// CTA — camera pulls up the street
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- story physics ----------------
/** 2 steps/s walk cycle, footfalls at phase 0 and 0.5 */
export const walkPhase = (t: number) => ((t % 1) + 1) % 1;

/** hero lid state: seated -> lifted + set aside (shot 1) -> rolled back (shots 12-13) -> drops in (shot 14) */
export const heroLidAt = (f: number): { x: number; y: number; z: number; tilt: number; roll: number } => {
  if (f < 60) return { x: 0, y: 0.02, z: 0, tilt: 0, roll: 0 };
  if (f < 120) { // lift: rise + tilt, move to the aside spot
    const u = smooth((f - 60) / 60);
    return { x: lerp(0, 0.9, u), y: lerp(0.02, 0.35, u), z: lerp(0, 0.7, u), tilt: lerp(0, 1.22, u), roll: 0 };
  }
  if (f < 967) return { x: 0.9, y: 0.35, z: 0.7, tilt: 1.22, roll: 0 }; // leaning on edge beside the hole
  if (f < 1120) { // rolled back along the path (3.8,4.6) -> (1.8,2.2) -> (0.15,0.15)
    const u = smooth((f - 967) / 153);
    const path: [number, number][] = [[3.8, 4.6], [1.8, 2.2], [0.15, 0.15]];
    const seg = u < 0.55 ? 0 : 1, k = u < 0.55 ? u / 0.55 : (u - 0.55) / 0.45;
    const [x0, z0] = path[seg], [x1, z1] = path[seg + 1];
    const x = lerp(x0, x1, k), z = lerp(z0, z1, k);
    const gy = Math.abs(z) > 3.6 ? 0.12 : 0;
    return { x, y: gy + LID_R, z, tilt: Math.PI / 2, roll: u * 14 };
  }
  if (f < 1160) { // drops into the hole
    const u = smooth((f - 1120) / 40);
    return { x: lerp(0.15, 0, u), y: lerp(LID_R, 0.02, u), z: lerp(0.15, 0, u), tilt: lerp(Math.PI / 2, 0, u), roll: 14 };
  }
  return { x: 0, y: 0.02, z: 0, tilt: 0, roll: 14 };
};
/** square demo lid on the rig: flat -> turned on edge (shot 7) -> drops through (shot 9) */
export const squareLidAt = (f: number): { angle: number; y: number; visible: boolean } => {
  if (f < 445) return { angle: 0, y: 0.68, visible: false };
  if (f < 540) return { angle: 0, y: 0.68, visible: true }; // flat on the rig frame (frame top 0.66 + half thickness 0.02)
  if (f < 618) return { angle: lerp(0, 1.35, smooth((f - 540) / 78)), y: 0.68, visible: true }; // turned on edge
  if (f < 731) return { angle: 1.35, y: 0.68, visible: true }; // held on edge, diagonal on show
  if (f < 811) { // slips straight through the frame
    const u = smooth((f - 731) / 80);
    return { angle: 1.35, y: lerp(0.68, 0.16, u * u), visible: true };
  }
  return { angle: 1.35, y: 0.16, visible: true }; // resting under the rig
};
/** round demo lid on the rig: turning in place (shots 10-11) */
export const roundRigAt = (f: number): { spin: number; visible: boolean } => {
  if (f < 445) return { spin: 0, visible: false };
  if (f < 812) return { spin: 0, visible: true }; // waiting flat on the rig platform
  if (f < 967) return { spin: (f - 812) * 0.02, visible: true }; // turned however you like
  return { spin: 155 * 0.02, visible: true };
};
/** hydraulic press plate height (shot 16): descends onto the cover, holds, lifts slightly */
export const pressPlateY = (f: number): number => {
  if (f < 1378) return 1.6;
  if (f < 1440) return lerp(1.6, 0.55, smooth((f - 1378) / 62));
  if (f < 1460) return 0.55; // pressing — 40 tonnes of force
  if (f < 1488) return lerp(0.55, 0.9, smooth((f - 1460) / 28));
  return 1.6;
};
/** steam vent strength (shot 4) */
export const steamK = (f: number) => {
  if (f < 312) return 0;
  if (f < 330) return (f - 312) / 18;
  if (f < 385) return 1;
  if (f < 402) return 1 - (f - 385) / 17;
  return 0;
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

// ---- framings (one continuous journey down the street; manhole at origin) ----
const S1 = (f: number) => dolly([2.5, 2.4, -6.5], [0, 0.7, 0], pushK(f, 0, 0.004), { fov: 44 }); // wide street, lid lift (south side, looking north)
const S2 = (f: number) => dolly([-2.5, 2.2, -6.5], [0, 0.9, 0], pushK(f, 144, 0.003), { fov: 40 }); // pedestrians over the hole
const S3 = (f: number) => dolly([-14, 6, 0.5], [10, 0, 0], pullK(f, 201, 0.002), { fov: 46 }); // elevated wide down the road, manholes everywhere
const S4 = (f: number) => dolly([-4.5, 1.6, -4.5], [-6, 0.6, -1.5], pushK(f, 312, 0.003), { fov: 38 }); // steam vent CU (south side)
const S5 = (f: number) => dolly([3.5, 2.0, -2.5], [1.8, 1.0, 4.5], pushK(f, 402, 0.003), { fov: 40 }); // Vera walks in
const S6 = (f: number) => dolly([0.5, 2.3, -1.0], [4, 0.9, 5.2], pushK(f, 445, 0.002), { fov: 42 }); // Vera + square lid at rig
const S7 = (f: number) => dolly([1.0, 2.1, -0.5], [4, 0.7, 5.2], pushK(f, 540, 0.002), { fov: 40 }); // Milo turns the lid
const S8 = (f: number) => dolly([2.0, 1.9, 1.0], [4, 0.55, 5.2], pushK(f, 618, 0.002), { fov: 38 }); // diagonal CU
const S9 = (f: number) => dolly([2.2, 2.0, 0.8], [4, 0.5, 5.2], pushK(f, 731, 0.0015), { fov: 40 }); // the drop
const S10 = (f: number) => dolly([1.2, 2.1, -0.2], [4.6, 0.7, 5.2], pushK(f, 812, 0.002), { fov: 40 }); // round lid turns
const S11 = (f: number) => dolly([1.6, 2.0, 0.2], [4.4, 0.6, 5.2], pushK(f, 898, 0.002), { fov: 38 }); // round lid stays
const S12 = (f: number) => { // tracking the rolling lid from the rig toward the hole (camera SE of the lid)
  const u = smooth((f - 967) / 70);
  const lx = lerp(3.8, 1.8, u), lz = lerp(4.6, 2.2, u);
  return { pos: [lerp(8.3, 6.3, u), 2.0, lerp(0.1, -2.3, u)] as V3, look: [lx, 0.5, lz] as V3, fov: 40, roll: 0 };
};
const S13 = (f: number) => { // rolling into place (continues the S12 track)
  const u = smooth((f - 1038) / 82);
  const lx = lerp(1.8, 0.15, u), lz = lerp(2.2, 0.15, u);
  return { pos: [lerp(6.3, 4.65, u), 2.0, lerp(-2.3, -4.35, u)] as V3, look: [lx, 0.4, lz] as V3, fov: 40, roll: 0 };
};
const S14 = (f: number) => dolly([4.8, 2.2, -2.0], [0, 0.3, 0], pushK(f, 1120, 0.002), { fov: 40 }); // drops in, fits
const S15 = (f: number) => dolly([-24, 2.1, 4.8], [-29, 0.4, -1.5], pullK(f, 1228, 0.0015), { fov: 40 }); // Nashua corner
const S16 = (f: number) => dolly([12.5, 2.2, 6.2], [8.5, 0.9, 5.2], pushK(f, 1378, 0.002), { fov: 44 }); // press test (from the east, rig in the background)
const S17 = (f: number) => dolly([3.0, 2.2, -3.0], [0, 0.9, 0], pushK(f, 1488, 0.002), { fov: 42 }); // step over, vindicated
const S18 = (f: number) => dolly([0, 9, 13], [0, 0.5, -2], pullK(f, 1608, 0.0015), { fov: 46 }); // CTA pull-up

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1 }], 2: [{ f: 144, s: S2 }], 3: [{ f: 201, s: S3 }], 4: [{ f: 312, s: S4 }],
  5: [{ f: 402, s: S5 }], 6: [{ f: 445, s: S6 }], 7: [{ f: 540, s: S7 }], 8: [{ f: 618, s: S8 }],
  9: [{ f: 731, s: S9 }], 10: [{ f: 812, s: S10 }], 11: [{ f: 898, s: S11 }], 12: [{ f: 967, s: S12 }],
  13: [{ f: 1038, s: S13 }], 14: [{ f: 1120, s: S14 }], 15: [{ f: 1228, s: S15 }], 16: [{ f: 1378, s: S16 }],
  17: [{ f: 1488, s: S17 }], 18: [{ f: 1608, s: S18 }],
};

type CameraTransition = { f: number; dur: number; from: number; to: number; lift?: number };
const CAMERA_TRANSITIONS: CameraTransition[] = [
  { f: 144, dur: 30, from: 1, to: 2, lift: 1.5 },
  { f: 201, dur: 54, from: 2, to: 3, lift: 3 },
  { f: 312, dur: 72, from: 3, to: 4, lift: 2 },
  { f: 402, dur: 30, from: 4, to: 5, lift: 1.5 },
  { f: 445, dur: 30, from: 5, to: 6, lift: 1.5 },
  { f: 540, dur: 24, from: 6, to: 7, lift: 1 },
  { f: 618, dur: 24, from: 7, to: 8, lift: 1 },
  { f: 731, dur: 24, from: 8, to: 9, lift: 1 },
  { f: 812, dur: 24, from: 9, to: 10, lift: 1 },
  { f: 898, dur: 24, from: 10, to: 11, lift: 1 },
  { f: 967, dur: 48, from: 11, to: 12, lift: 1.5 },
  { f: 1038, dur: 24, from: 12, to: 13, lift: 1 },
  { f: 1120, dur: 24, from: 13, to: 14, lift: 1 },
  { f: 1228, dur: 72, from: 14, to: 15, lift: 3 },
  { f: 1378, dur: 48, from: 15, to: 16, lift: 3 },
  { f: 1488, dur: 48, from: 16, to: 17, lift: 2 },
  { f: 1608, dur: 72, from: 17, to: 18, lift: 4 },
];

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
 * One global camera path for the whole short. `id` is retained for API compatibility, but the active shot is
 * resolved from the global frame so crossfade layers cannot render different camera poses. At each former cut,
 * the camera eases from the outgoing framing to the incoming framing over a defined travel window.
 */
export const camAt = (_id: number, f: number): Cam => {
  const active = shotAt(Math.max(0, Math.min(TOTAL - 1, f))).id;
  const tr = CAMERA_TRANSITIONS.find((x) => f >= x.f - x.dur / 2 && f <= x.f + x.dur / 2);
  if (!tr) return rawCamAt(active, f);
  const start = tr.f - tr.dur / 2, end = tr.f + tr.dur / 2;
  const from = rawCamAt(tr.from, start), to = rawCamAt(tr.to, end);
  const u = glide((f - start) / Math.max(1, end - start));
  const c = travelMix(from, to, u);
  const distance = Math.hypot(to.pos[0] - from.pos[0], to.pos[1] - from.pos[1], to.pos[2] - from.pos[2]);
  const arc = tr.lift ?? Math.min(8, Math.max(0.5, distance * 0.08));
  c.pos = [c.pos[0], c.pos[1] + Math.sin(Math.PI * u) * arc, c.pos[2]];
  return c;
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Focus = the active subject per shot (the depth-pass export reads this). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // hook wide: whole street sharp
  { f: 144, cInf: 8, focus: () => [0, 1.0, 0] }, // pedestrians over the hole
  { f: 201, cInf: 0 }, // elevated wide, manholes everywhere
  { f: 312, cInf: 12, focus: () => [-6, 0.5, -1.5] }, // steam vent CU
  { f: 402, cInf: 8, focus: () => [0.5, 1.2, 2.8] }, // Vera enters
  { f: 445, cInf: 10, focus: () => [4, 0.9, 5.2] }, // rig + square lid
  { f: 540, cInf: 14, focus: () => [4, 0.7, 5.2] }, // turning the square lid
  { f: 618, cInf: 15, focus: () => [4, 0.55, 5.2] }, // diagonal CU
  { f: 731, cInf: 14, focus: () => [4, 0.5, 5.2] }, // the drop
  { f: 812, cInf: 12, focus: () => [4, 0.7, 5.2] }, // round lid turns
  { f: 898, cInf: 15, focus: () => [4, 0.5, 5.2] }, // round lid stays
  { f: 967, cInf: 10, focus: (f) => { const l = heroLidAt(f); return [l.x, l.y, l.z]; } }, // rolling lid
  { f: 1038, cInf: 10, focus: (f) => { const l = heroLidAt(f); return [l.x, l.y, l.z]; } }, // rolling into place
  { f: 1120, cInf: 15, focus: () => [0, 0.15, 0] }, // drops in, fits
  { f: 1228, cInf: 5, focus: () => [-29, 0.4, -1.5] }, // Nashua triangles
  { f: 1378, cInf: 14, focus: () => [8.5, 0.8, 5.2] }, // press test
  { f: 1488, cInf: 8, focus: () => [0, 0.9, 0] }, // step over, vindicated
  { f: 1608, cInf: 0 }, // CTA pull-up
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
