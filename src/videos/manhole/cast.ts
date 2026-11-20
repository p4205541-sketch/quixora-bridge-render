// Manhole cast: Milo + Vera + background pedestrians as lit flat cards in the 3D city world.
// Construction (locked): huge round white head ~1/3 of figure height, no neck, tiny dot eyes,
// thick short brows, minimal mouth, extremely thin stick limbs, dot/stub hands, L-shaped feet,
// thin near-black outline. Outfits and colours are the plan.md locked blocks, exact.
// Cards reuse the bridge Pool/Actor/Fx machinery (canvas pool + cardShade + NOINK layer).
// Poses are joint triples in the 600 x 1000 design space (soles at y = 975), blended per shot.
import * as THREE from "three";
import { Pen, INK, fxPuff, fxContact } from "../bridge/toon";
import type { CamInfo, Stage } from "../bridge/cast";
import {
  FPS, V3, lerp, smooth, walkPhase,
} from "./story";

type P2 = [number, number];
type Limb = [P2, P2, P2];
type PoseDef = { aL: Limb; aR: Limb; lL: Limb; lR: Limb; crouch: number; lean: number };
type EyeK = "dot" | "happy" | "shock" | "down" | "dash";
type MouthK = "line" | "grin" | "open" | "smirk" | "flat" | "o" | "smile" | "none";
type FaceSpec = { tilt: number; raise: number; raiseL?: number; eye: EyeK; mouth: MouthK; look: number; glasses?: boolean };
type ExprName = "stern" | "watchful" | "determined" | "skeptical" | "grinning" | "surprised" | "satisfied" | "plain" | "shock" | "vindicated";

const FACES: Record<ExprName, FaceSpec> = {
  stern: { tilt: 12, raise: 0, eye: "dot", mouth: "line", look: 0 },
  watchful: { tilt: 2, raise: 6, eye: "dot", mouth: "line", look: 1 },
  determined: { tilt: 6, raise: 0, eye: "dot", mouth: "line", look: 0 },
  skeptical: { tilt: 0, raise: 0, raiseL: 8, eye: "dot", mouth: "smirk", look: 1, glasses: true },
  grinning: { tilt: -6, raise: 4, eye: "happy", mouth: "grin", look: 0 },
  surprised: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  satisfied: { tilt: -4, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  plain: { tilt: 0, raise: 0, eye: "dot", mouth: "none", look: 0 },
  shock: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  vindicated: { tilt: -4, raise: 4, eye: "happy", mouth: "smile", look: 1 },
};

// ---------------- pose library (design units; shoulders (205|395, 495), hips (268|332, 645)) ----------------
const HANG_L: Limb = [[205, 495], [178, 600], [188, 705]];
const HANG_R: Limb = [[395, 495], [422, 600], [412, 705]];
const LEG_L: Limb = [[268, 645], [262, 800], [258, 962]];
const LEG_R: Limb = [[332, 645], [338, 800], [342, 962]];
const P = (aL: Limb, aR: Limb, lL: Limb, lR: Limb, crouch = 0, lean = 0): PoseDef => ({ aL, aR, lL, lR, crouch, lean });
const POSES = {
  stand: P(HANG_L, HANG_R, LEG_L, LEG_R),
  stop: P(HANG_L, [[395, 495], [448, 415], [462, 295]] as Limb, LEG_L, LEG_R),
  pointUp: P(HANG_L, [[395, 495], [445, 400], [425, 275]] as Limb, LEG_L, LEG_R),
  pointAway: P(HANG_L, [[395, 495], [470, 520], [545, 540]] as Limb, LEG_L, LEG_R),
  pointAt: P(HANG_L, [[395, 495], [460, 560], [520, 600]] as Limb, LEG_L, LEG_R),
  reachDown: P(HANG_L, [[395, 495], [450, 590], [470, 700]] as Limb, LEG_L, LEG_R),
  crossArms: P([[205, 495], [300, 610], [385, 600]] as Limb, [[395, 495], [300, 610], [215, 600]] as Limb, LEG_L, LEG_R),
  lift: P([[205, 495], [165, 385], [205, 235]] as Limb, [[395, 495], [435, 385], [395, 235]] as Limb,
    [[268, 645], [250, 800], [235, 962]] as Limb, [[332, 645], [350, 800], [365, 962]] as Limb),
  crouch: P(HANG_L, HANG_R, [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 8),
  crouchReach: P([[205, 495], [280, 580], [350, 640]] as Limb, HANG_R,
    [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 10),
  leanIn: P(HANG_L, HANG_R, LEG_L, LEG_R, 0.25, 12),
  rollPush: P([[205, 495], [285, 575], [355, 650]] as Limb, [[395, 495], [465, 575], [535, 650]] as Limb,
    [[268, 645], [300, 800], [330, 962]] as Limb, [[332, 645], [300, 800], [270, 962]] as Limb, 0.35, 18), // arms forward/down PARALLEL (no X), torso leans into the push
  stepOver: P(HANG_L, HANG_R, LEG_L, [[332, 645], [420, 760], [470, 700]] as Limb, 0, 4),
  wave: P(HANG_L, [[395, 495], [445, 380], [470, 260]] as Limb, LEG_L, LEG_R),
  palmsUp: P([[205, 495], [150, 560], [110, 520]] as Limb, [[395, 495], [450, 560], [490, 520]] as Limb, LEG_L, LEG_R),
};
const lerpLimb = (a: Limb, b: Limb, k: number): Limb =>
  [0, 1, 2].map((i) => [lerp(a[i][0], b[i][0], k), lerp(a[i][1], b[i][1], k)] as P2) as Limb;
const blendPose = (a: PoseDef, b: PoseDef, k: number): PoseDef => ({
  aL: lerpLimb(a.aL, b.aL, k), aR: lerpLimb(a.aR, b.aR, k), lL: lerpLimb(a.lL, b.lL, k), lR: lerpLimb(a.lR, b.lR, k),
  crouch: lerp(a.crouch, b.crouch, k), lean: lerp(a.lean, b.lean, k),
});
/** procedural walk/run legs + pumping arms; phase 0..1, amp = stride px, lift = foot lift px */
const gait = (phase: number, amp: number, lift: number, lean: number): PoseDef => {
  const s = Math.sin(2 * Math.PI * phase), c = Math.cos(2 * Math.PI * phase);
  const leg = (side: 1 | -1, ph: number): Limb => {
    const sw = Math.sin(2 * Math.PI * ph), up = Math.max(0, Math.cos(2 * Math.PI * ph)) * lift;
    const hip: P2 = side < 0 ? [268, 645] : [332, 645];
    return [hip, [(hip[0] + (side < 0 ? 258 : 342) + sw * amp) / 2 + side * 8, 800 - up * 0.4], [(side < 0 ? 258 : 342) + sw * amp, 962 - up]];
  };
  const arm = (side: 1 | -1, ph: number): Limb => {
    const sw = Math.sin(2 * Math.PI * ph);
    const sh: P2 = side < 0 ? [205, 495] : [395, 495];
    return [sh, [sh[0] + side * 22 - sw * 30, 600], [sh[0] + side * 26 - sw * 55, 705 - Math.max(0, sw) * 20]];
  };
  return { aL: arm(-1, phase + 0.5), aR: arm(1, phase), lL: leg(-1, phase), lR: leg(1, phase + 0.5), crouch: 0, lean };
};

// ---------------- figure drawing ----------------
type OutfitSpec = {
  top: string; hem: number; stripe?: string; legCol: string; footCol: string;
  hair: "hardhat" | "bob" | "short" | "none"; hairCol: string; scale: number;
};
const OUTFITS = {
  milo: { top: "#e86a1c", hem: 735, stripe: "#e8e8e8", legCol: "#3a3a3f", footCol: "#2b2b2e", hair: "hardhat", hairCol: "#1c1c20", scale: 1 } as OutfitSpec,
  vera: { top: "#2e4057", hem: 720, legCol: "#2e4057", footCol: "#1c1c20", hair: "bob", hairCol: "#5a3b2a", scale: 0.97 } as OutfitSpec,
  pedA: { top: "#8a8378", hem: 720, legCol: "#6e675c", footCol: "#5a5148", hair: "short", hairCol: "#3a3630", scale: 0.95 } as OutfitSpec,
  pedB: { top: "#7a5a3c", hem: 720, legCol: "#4a4a4a", footCol: "#3a3630", hair: "short", hairCol: "#2b2b2e", scale: 0.97 } as OutfitSpec,
  pedC: { top: "#3f6fb5", hem: 720, legCol: "#2f2f33", footCol: "#2b2b2e", hair: "none", hairCol: "#1c1c20", scale: 0.95 } as OutfitSpec,
};
type CharName = keyof typeof OUTFITS;

const q = (v: number, n = 24) => Math.round(v * n) / n;
const poseKey = (po: PoseDef) =>
  [po.aL, po.aR, po.lL, po.lR].flat(2).map((v) => q(v, 12)).join(",") + `|${q(po.crouch, 12)}|${q(po.lean, 12)}`;

/** blink lids: 4-frame shut/half pattern, per-character offset, plus a blink across expression swaps */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, seed: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round(ts * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  const hh = (i: number, s: number) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  let s = Math.round(-60 * hh(seed, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(seed * 31 + n, 13));
  }
  return 0;
};

const face = (p: Pen, cx: number, cy: number, fs: FaceSpec, lid: number) => {
  const ex = 52, ey = cy - 8;
  for (const side of [-1, 1]) {
    const x = cx + side * ex + fs.look * 6, by = ey - 42;
    const raise = (side < 0 ? fs.raiseL ?? fs.raise : fs.raise) + fs.raise * 0;
    const tilt = fs.tilt * side;
    if (fs.mouth !== "none") {
      const bIn: P2 = [x - side * 24, by + tilt * 0.9 - raise], bOut: P2 = [x + side * 24, by - tilt * 0.4 - raise];
      p.stroke([bIn, bOut], 11, INK);
    }
    if (fs.glasses) { // round glasses: ring + bridge + temple arm
      p.ell(x, ey, 24, 24, null, 6);
      if (side < 0) p.stroke([[x + 24, ey], [cx + side * 24 - 24, ey]], 5, INK);
    }
    if (lid >= 0.75) { p.stroke([[x - 16, ey], [x + 16, ey]], 8, INK); continue; }
    switch (fs.eye) {
      case "dot": p.dot(x, ey, lid > 0 ? 8 : 12, INK); break;
      case "down": p.dot(x, ey + 8, 11, INK); break;
      case "dash": p.stroke([[x - 15, ey], [x + 15, ey]], 8, INK); break;
      case "happy": p.arc(x, ey + 6, 17, 12, 200, 340, 8, INK); break;
      case "shock":
        p.ell(x, ey, 20, 20, "#ffffff", 5); p.dot(x + fs.look * 3, ey + 2, 7, INK); break;
    }
  }
  const mx = cx + fs.look * 4, my = cy + 68;
  switch (fs.mouth) {
    case "line": p.stroke([[mx - 26, my], [mx + 26, my - 3]], 9, INK); break;
    case "flat": p.stroke([[mx - 18, my], [mx + 18, my]], 8, INK); break;
    case "smirk": p.arc(mx + 4, my - 12, 26, 14, 10, 150, 8, INK); break;
    case "smile": p.arc(mx, my - 12, 30, 16, 20, 160, 8, INK); break;
    case "grin":
      p.ell(mx, my - 6, 34, 22, "#5a1e28", 0, 0, 180);
      p.clip([[mx - 34, my - 6], [mx + 34, my - 6], [mx + 34, my + 2], [mx - 34, my + 2]], () => p.ell(mx, my - 6, 34, 22, "#ffffff", 0, 0, 180));
      p.ell(mx, my - 6, 34, 22, null, 8, 0, 180);
      break;
    case "open": p.ell(mx, my, 12, 14, "#5a1e28", 7); break;
    case "o": p.ell(mx, my + 4, 18, 22, "#5a1e28", 8); break;
    case "none": break;
  }
};

const stickFigure = (p: Pen, who: CharName, po: PoseDef, expr: ExprName, lid: number, extras: { tote?: boolean; gloves?: boolean }) => {
  const o = OUTFITS[who], fs = FACES[expr], dy = po.crouch * 130;
  const head: P2 = [300, 300 + dy], chinY = 458 + dy, hipY = 645 + dy;
  const sh = (side: number): P2 => [side < 0 ? 205 : 395, 495 + dy];
  const shift = (l: Limb): Limb => l.map(([x, y]) => [x, y + (y < 645 ? dy : 0)] as P2) as Limb;
  // ---- legs ----
  p.rot = null;
  for (const [leg, side] of [[po.lL, -1], [po.lR, 1]] as const) {
    const hip: P2 = [side < 0 ? 268 : 332, hipY];
    const [,, foot] = leg;
    const knee: P2 = [(hip[0] + foot[0]) / 2 + side * 6, (hipY + foot[1]) / 2 - 6];
    p.stroke([hip, knee, foot], 13, o.legCol);
    p.stroke([[foot[0] - side * 4, foot[1]], [foot[0] + side * 26, foot[1] + 2]], 13, o.footCol); // L foot
  }
  // ---- upper body: lean about the hips ----
  p.rot = po.lean ? [(po.lean * Math.PI) / 180, 300, hipY] : null;
  const hw = 100, hemW = 118;
  const top: P2[] = [[300 - hw, 470 + dy], [300 + hw, 470 + dy], [300 + hemW, o.hem + dy], [300 - hemW, o.hem + dy]];
  p.poly(top, o.top, 10);
  if (o.stripe) { // hi-vis reflective band across the vest
    p.clip(top, () => p.band([[300 - hemW + 8, 600 + dy], [300 + hemW - 8, 600 + dy]], o.stripe!, 18, 3));
  }
  // arms (over the body sides, thin sticks)
  for (const [arm, side] of [[shift(po.aL), -1], [shift(po.aR), 1]] as const) {
    const [s, e, h] = arm;
    const S = sh(side);
    p.stroke([S, e, h], 12, INK);
    p.dot(h[0], h[1], extras.gloves ? 13 : 11, extras.gloves ? "#2b2b2e" : INK); // work gloves
  }
  if (extras.tote) { // tote bag hanging from the left shoulder
    const h = shift(po.aL)[2];
    p.band([[300 - 60, 500 + dy], [h[0] + 10, h[1] - 30]], "#8a6a44", 8, 3, "round");
    p.poly([[h[0] - 30, h[1] - 30], [h[0] + 55, h[1] - 30], [h[0] + 45, h[1] + 70], [h[0] - 20, h[1] + 70]], "#c9a86a", 8);
  }
  // ---- head ----
  const [hx, hy] = head;
  p.ell(hx, hy, 148, 158, "#fdfdf8", 10);
  if (o.hair === "hardhat") { // yellow hard hat + curly black fringe under the brim
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 40], [hx - 148, hy - 40]], () => {
      p.ell(hx, hy - 96, 152, 78, "#f2c230", 0, 180, 360);
      p.poly([[hx - 152, hy - 104], [hx + 152, hy - 104], [hx + 152, hy - 84], [hx - 152, hy - 84]], "#f2c230", 0);
      for (let i = 0; i < 7; i++) p.dot(hx - 120 + i * 40, hy - 66, 12, "#1c1c20"); // curls
    });
    p.ell(hx, hy - 128, 60, 22, "#f2c230", 7, 180, 360); // hat crown ridge
  } else if (o.hair === "bob") { // shoulder-length brown hair, both sides
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 30], [hx - 148, hy - 30]], () =>
      p.ell(hx, hy - 78, 150, 92, o.hairCol, 0, 180, 360));
    p.poly([[hx - 148, hy - 60], [hx - 118, hy - 60], [hx - 128, hy + 60], [hx - 150, hy + 40]], o.hairCol, 7);
    p.poly([[hx + 148, hy - 60], [hx + 118, hy - 60], [hx + 128, hy + 60], [hx + 150, hy + 40]], o.hairCol, 7);
  } else if (o.hair === "short") { // plain short hair cap
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 60], [hx - 148, hy - 60]], () =>
      p.ell(hx, hy - 88, 148, 80, o.hairCol, 0, 180, 360));
  }
  face(p, hx, hy, fs, lid);
  p.rot = null;
};

// ---------------- placements ----------------
const tmp = new THREE.Vector3();
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1200, 2000, 2] : d < 6.5 ? [720, 1200, 1.2] : d < 16 ? [360, 600, 0.6] : [240, 400, 0.4];
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

type FigSpec = {
  who: CharName; x: number; y: number; z: number; pose: PoseDef; expr: ExprName; seed: number;
  swaps?: number[]; mirror?: boolean; scale?: number; tote?: boolean; gloves?: boolean; blob?: boolean;
};
const figureT = (cam: CamInfo, out: Stage, s: FigSpec, t: number) => {
  const d = cam.pos.distanceTo(tmp.set(s.x, s.y + 1.2, s.z));
  const [w, h, k] = tier(d / (s.scale ?? OUTFITS[s.who].scale));
  const lid = lidAt(t, s.seed, s.swaps);
  const key = `${s.who}|${poseKey(s.pose)}|${s.expr}|${lid}`;
  out.places.push({
    key, x: s.x, y: s.y, z: s.z, scale: s.scale ?? OUTFITS[s.who].scale, mirror: s.mirror,
    draw: (p) => stickFigure(p, s.who, s.pose, s.expr, lid, { tote: s.tote, gloves: s.gloves }),
    size: [w, h, k],
  });
  if (s.blob !== false) contactBlob(out, s.x, s.y, s.z, s.scale ?? OUTFITS[s.who].scale);
};

/** tight contact pool under a figure (multiply, warm grey day shadow) */
const contactBlob = (out: Stage, x: number, y: number, z: number, sc = 1) => {
  const cc = "#4a4238";
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc),
    x, y: y + 0.022, z, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot: 0 });
};

/** steam puff at (x, z) over frames [f0, f0+n) */
const steam = (out: Stage, f: number, f0: number, n: number, x: number, z: number, s: number) => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 30);
  out.fx.push({ key: `steam${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: 0.5 * s, z, w: 1.4 * s, h: 1.4 * s, soft: true });
};

// ---------------- staging ----------------
export const stageManhole = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const milo = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "milo", x, y, z, pose, expr, seed: 1, gloves: true, ...extra }, t);
  const vera = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "vera", x, y, z, pose, expr, seed: 2, tote: true, ...extra }, t);
  const ped = (who: CharName, x: number, y: number, z: number, pose: PoseDef, seed: number, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who, x, y, z, pose, expr: "plain", seed, ...extra }, t);
  switch (id) {
    case 1: { // Milo lifts the iron lid (shifted toward frame centre: card edge was out at f107)
      const liftU = smooth((f - 60) / 60);
      milo(0.25, 0, 0.77, blendPose(POSES.stand, POSES.lift, f < 60 ? 0 : liftU), "determined", { swaps: [2.0] });
      ped("pedA", -3.5, 0.12, 4.6, POSES.stand, 11);
      ped("pedB", 4.5, 0.12, -4.6, POSES.stand, 12, { mirror: true });
      break;
    }
    case 2: { // pedestrians walk over the manhole (tight formation: portrait frame fits ~1.4 m of lateral spread at 7 m)
      for (let i = 0; i < 3; i++) {
        const u = smooth((f - 144 - i * 2) / 51);
        const x = lerp(-3, 3, u), z = 0.3 + (i - 1) * 0.5;
        ped((["pedA", "pedB", "pedC"] as CharName[])[i], x, 0, z, gait(walkPhase(t * 1.4 + i * 0.25), 70, 80, 8), 20 + i, { mirror: i % 2 === 0 });
      }
      milo(0.9, 0, 1.0, POSES.stand, "watchful");
      break;
    }
    case 3: { // pull up — street full of manholes
      milo(0.8, 0, 1.0, POSES.pointAway, "determined");
      ped("pedA", -6, 0.12, 4.6, gait(walkPhase(t * 1.2), 60, 60, 6), 31);
      ped("pedB", 6, 0.12, -4.6, gait(walkPhase(t * 1.2 + 0.4), 60, 60, 6), 32, { mirror: true });
      ped("pedC", -12, 0.12, -4.6, POSES.stand, 33);
      break;
    }
    case 4: { // steam vent smoking (Milo leans in just past the vent, on the camera axis)
      milo(-6.2, 0, -1.9, POSES.leanIn, "surprised", { swaps: [11.0] });
      steam(out, f, 312, 90, -6, -1.5, 1.2);
      ped("pedA", 2, 0.12, 4.6, POSES.stand, 41);
      break;
    }
    case 5: { // Vera enters, skeptical (Milo watches from the camera side, on-axis)
      const u = smooth((f - 402) / 42);
      vera(lerp(2.2, 1.4, u), 0.12, lerp(5.6, 4.2, u), gait(walkPhase(t * 1.3), 60, 60, 6), "skeptical", { swaps: [13.5] });
      milo(2.2, 0, 3.0, POSES.stand, "watchful");
      break;
    }
    case 6: { // Vera gestures at the square lid (shifted toward frame centre: card edge was out)
      vera(4.6, 0.12, 4.9, POSES.pointAt, "skeptical", { swaps: [15.2] });
      milo(3.1, 0.12, 4.55, POSES.stand, "determined");
      break;
    }
    case 7: { // Milo turns the square lid on edge (both shifted toward frame centre)
      const turnU = smooth((f - 540) / 78);
      milo(3.2, 0.12, 4.5, blendPose(POSES.stand, POSES.crouchReach, turnU), "determined");
      vera(4.5, 0.12, 4.95, POSES.crossArms, "skeptical");
      break;
    }
    case 8: { // diagonal close-up (both stand behind the rig, on the camera axis; Milo nudged for the card-edge test)
      milo(3.7, 0.12, 5.9, POSES.crouch, "determined");
      vera(4.7, 0.12, 6.2, POSES.leanIn, "skeptical", { swaps: [21.5] });
      break;
    }
    case 9: { // square lid drops through (Milo nudged for the card-edge test)
      const shock = smooth((f - 745) / 8);
      milo(3.9, 0.12, 5.85, shock > 0.5 ? POSES.stand : POSES.leanIn, shock > 0.5 ? "surprised" : "watchful", { swaps: [24.9] });
      vera(4.7, 0.12, 6.2, POSES.stand, "surprised", { swaps: [24.9] });
      break;
    }
    case 10: { // round lid on the rig, turning (Milo nudged for the card-edge test)
      milo(3.8, 0.12, 4.6, POSES.crouchReach, "determined");
      vera(4.8, 0.12, 4.8, POSES.leanIn, "watchful");
      break;
    }
    case 11: { // round lid stays, cannot fall (both nudged for the card-edge test)
      milo(3.8, 0.12, 4.4, POSES.crossArms, "satisfied", { swaps: [30.5] });
      vera(4.7, 0.12, 4.9, POSES.stand, "skeptical");
      break;
    }
    case 12: { // Milo rolls the round lid (Vera watches from east of the track, clear of the camera path)
      const u = smooth((f - 967) / 70);
      const lx = lerp(3.8, 1.8, u), lz = lerp(4.6, 2.2, u);
      milo(lx + 0.3, lx > 2.5 ? 0.12 : 0, lz + 0.3, POSES.rollPush, "determined");
      vera(7.2, 0.12, 6.6, POSES.stand, "watchful");
      break;
    }
    case 13: { // rolling into place
      const u = smooth((f - 1038) / 82);
      const lx = lerp(1.8, 0.15, u), lz = lerp(2.2, 0.15, u);
      milo(lx + 0.3, 0, lz + 0.3, POSES.rollPush, "determined");
      break;
    }
    case 14: { // lid drops in, fits every time (both lean over the hole from the camera side)
      const setU = smooth((f - 1120) / 40);
      milo(0.9, 0, -0.4, blendPose(POSES.rollPush, POSES.crouch, setU), setU > 0.5 ? "satisfied" : "determined");
      vera(1.5, 0, -0.8, POSES.leanIn, "watchful");
      break;
    }
    case 15: { // Nashua flashback — triangle covers (Milo and Vera separated, no overlap; Vera nudged for the card-edge test)
      milo(-28.8, 0, -1.0, POSES.pointAway, "determined");
      vera(-26.6, 0, 0.9, POSES.crossArms, "skeptical", { swaps: [42.0] });
      ped("pedA", -31, 0, -2.5, POSES.stand, 51);
      break;
    }
    case 16: { // press/test rig — 40-tonne test (both west of the press, clear of the pulled-back camera; Milo nudged for the card-edge test)
      milo(7.0, 0.12, 4.9, POSES.leanIn, "determined");
      vera(7.2, 0.12, 5.8, POSES.crossArms, "skeptical", { swaps: [47.0] });
      break;
    }
    case 17: { // pedestrian steps over, Milo vindicated (Milo on the camera axis NW of the hole: head centred, card fits)
      const u = smooth((f - 1488) / 119);
      const x = lerp(-3.5, 3.5, u);
      const over = x > -0.6 && x < 0.6 ? 1 : 0;
      const po = over ? POSES.stepOver : gait(walkPhase(t * 1.4), 70, 80, 8);
      ped("pedC", x, 0, 0.3, po, 61);
      milo(-0.8, 0, 0.8, POSES.crossArms, "vindicated", { swaps: [50.5] });
      break;
    }
    case 18: { // CTA — pull up the street
      milo(0.8, 0, 1.0, POSES.wave, "vindicated");
      vera(-0.8, 0, 1.2, POSES.wave, "satisfied", { swaps: [54.5] });
      ped("pedA", -4, 0.12, 4.6, POSES.stand, 71);
      ped("pedB", 4, 0.12, -4.6, POSES.stand, 72, { mirror: true });
      break;
    }
  }
  return out;
};
