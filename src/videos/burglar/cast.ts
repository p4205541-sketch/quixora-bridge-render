// Burglar cast: Dad + Mom + Handyman + Priest as lit flat cards in the 3D house world.
// Construction (locked): huge round white head ~1/3 of figure height, no neck, tiny dot eyes,
// thick short brows, minimal mouth, extremely thin stick limbs, dot/stub hands, L-shaped feet,
// thin near-black outline. Outfits and colours are the plan.md locked blocks, exact.
// Cards reuse the bridge Pool/Actor/Fx machinery (canvas pool + cardShade + NOINK layer).
// Poses are joint triples in the 600 x 1000 design space (soles at y = 975), blended per shot.
import * as THREE from "three";
import { Pen, INK, fxContact } from "../bridge/toon";
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
type ExprName = "stern" | "watchful" | "determined" | "skeptical" | "grinning" | "surprised" | "satisfied" | "plain" | "shock" | "vindicated" | "confused" | "suspicious" | "worried" | "apologetic" | "serene" | "focused" | "amused" | "scared" | "relieved" | "puzzled" | "calm";

const FACES: Record<ExprName, FaceSpec> = {
  stern: { tilt: 12, raise: 0, eye: "dot", mouth: "line", look: 0 },
  watchful: { tilt: 2, raise: 6, eye: "dot", mouth: "line", look: 1 },
  determined: { tilt: 6, raise: 0, eye: "dot", mouth: "line", look: 0 },
  skeptical: { tilt: 0, raise: 0, raiseL: 8, eye: "dot", mouth: "smirk", look: 1 },
  grinning: { tilt: -6, raise: 4, eye: "happy", mouth: "grin", look: 0 },
  surprised: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  satisfied: { tilt: -4, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  plain: { tilt: 0, raise: 0, eye: "dot", mouth: "none", look: 0 },
  shock: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  vindicated: { tilt: -4, raise: 4, eye: "happy", mouth: "smile", look: 1 },
  confused: { tilt: 4, raise: 6, eye: "dot", mouth: "flat", look: 0, glasses: true },
  suspicious: { tilt: 6, raise: 0, raiseL: 8, eye: "dot", mouth: "smirk", look: 1, glasses: true },
  worried: { tilt: 0, raise: 9, eye: "shock", mouth: "line", look: 0 },
  apologetic: { tilt: 8, raise: 0, eye: "down", mouth: "flat", look: -1 },
  serene: { tilt: -4, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  focused: { tilt: 8, raise: 0, eye: "dot", mouth: "line", look: 0 },
  amused: { tilt: -6, raise: 4, eye: "happy", mouth: "smile", look: 0 },
  scared: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  relieved: { tilt: -4, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  puzzled: { tilt: 4, raise: 6, eye: "dot", mouth: "flat", look: 1 },
  calm: { tilt: 0, raise: 0, eye: "dot", mouth: "none", look: 0 },
};

// ---------------- pose library (design units; shoulders (205|395, 495), hips (268|332, 645)) ----------------
const HANG_L: Limb = [[205, 495], [178, 600], [188, 705]];
const HANG_R: Limb = [[395, 495], [422, 600], [412, 705]];
const LEG_L: Limb = [[268, 645], [262, 800], [258, 962]];
const LEG_R: Limb = [[332, 645], [338, 800], [342, 962]];
const P = (aL: Limb, aR: Limb, lL: Limb, lR: Limb, crouch = 0, lean = 0): PoseDef => ({ aL, aR, lL, lR, crouch, lean });
const POSES = {
  stand: P(HANG_L, HANG_R, LEG_L, LEG_R),
  pointUp: P(HANG_L, [[395, 495], [445, 400], [425, 275]] as Limb, LEG_L, LEG_R),
  pointAway: P(HANG_L, [[395, 495], [470, 520], [545, 540]] as Limb, LEG_L, LEG_R),
  pointAt: P(HANG_L, [[395, 495], [460, 560], [520, 600]] as Limb, LEG_L, LEG_R),
  reachDown: P(HANG_L, [[395, 495], [450, 590], [470, 700]] as Limb, LEG_L, LEG_R),
  crossArms: P([[205, 495], [300, 610], [385, 600]] as Limb, [[395, 495], [300, 610], [215, 600]] as Limb, LEG_L, LEG_R),
  crouch: P(HANG_L, HANG_R, [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 8),
  crouchReach: P([[205, 495], [280, 580], [350, 640]] as Limb, HANG_R,
    [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 10),
  leanIn: P(HANG_L, HANG_R, LEG_L, LEG_R, 0.25, 12),
  wave: P(HANG_L, [[395, 495], [445, 380], [470, 260]] as Limb, LEG_L, LEG_R),
  palmsUp: P([[205, 495], [150, 560], [110, 520]] as Limb, [[395, 495], [450, 560], [490, 520]] as Limb, LEG_L, LEG_R),
  // kneeling, both arms forward-down working on something low (hinge, sink)
  kneelFix: P([[205, 495], [280, 590], [340, 660]] as Limb, [[395, 495], [320, 590], [260, 660]] as Limb,
    [[268, 645], [200, 800], [258, 962]] as Limb, [[332, 645], [400, 800], [342, 962]] as Limb, 0.9, 14),
  // crouched low behind cover, peeking (dad hiding behind the couch)
  hideCrouch: P([[205, 495], [240, 580], [260, 640]] as Limb, [[395, 495], [440, 560], [470, 500]] as Limb,
    [[268, 645], [220, 790], [258, 962]] as Limb, [[332, 645], [380, 790], [342, 962]] as Limb, 1.0, 10),
  // one arm forward holding a flashlight (beam comes from the hand)
  holdFlash: P(HANG_L, [[395, 495], [470, 540], [540, 560]] as Limb, LEG_L, LEG_R),
  // both arms raised in blessing (priest)
  bless: P([[205, 495], [150, 420], [120, 320]] as Limb, [[395, 495], [450, 420], [480, 320]] as Limb, LEG_L, LEG_R),
  // holding a small note/paper up to read
  holdNote: P(HANG_L, [[395, 495], [430, 400], [415, 300]] as Limb, LEG_L, LEG_R),
  // taping a note down onto a surface (arm forward-down, other arm bracing)
  tapeNote: P([[205, 495], [280, 590], [350, 650]] as Limb, HANG_R, LEG_L, LEG_R, 0.3, 10),
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
  hair: "beanie" | "bob" | "short" | "beard" | "none"; hairCol: string; scale: number;
};
const OUTFITS = {
  dad: { top: "#d9a441", hem: 735, legCol: "#3a3a3f", footCol: "#2b2b2e", hair: "short", hairCol: "#1c1c20", scale: 1 } as OutfitSpec,
  mom: { top: "#9b7ec2", hem: 720, legCol: "#3a3a3f", footCol: "#2b2b2e", hair: "bob", hairCol: "#1c1c20", scale: 0.97 } as OutfitSpec,
  handyman: { top: "#6a6a72", hem: 735, stripe: "#3a3a3f", legCol: "#3a3a3f", footCol: "#2b2b2e", hair: "beanie", hairCol: "#2b3a67", scale: 1 } as OutfitSpec,
  priest: { top: "#f2f2f2", hem: 920, legCol: "#f2f2f2", footCol: "#8a8a86", hair: "beard", hairCol: "#9a9a94", scale: 1.02 } as OutfitSpec,
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

const stickFigure = (p: Pen, who: CharName, po: PoseDef, expr: ExprName, lid: number, extras: { belt?: boolean }) => {
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
  if (o.stripe) { // tool belt band across the jacket
    p.clip(top, () => p.band([[300 - hemW + 8, 640 + dy], [300 + hemW - 8, 640 + dy]], o.stripe!, 16, 3));
  }
  // arms (over the body sides, thin sticks)
  for (const [arm, side] of [[shift(po.aL), -1], [shift(po.aR), 1]] as const) {
    const [s, e, h] = arm;
    const S = sh(side);
    p.stroke([S, e, h], 12, INK);
    p.dot(h[0], h[1], 11, INK);
  }
  // ---- head ----
  const [hx, hy] = head;
  p.ell(hx, hy, 148, 158, "#fdfdf8", 10);
  if (o.hair === "beanie") { // navy beanie + small brim
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 40], [hx - 148, hy - 40]], () => {
      p.ell(hx, hy - 96, 152, 78, o.hairCol, 0, 180, 360);
      p.poly([[hx - 152, hy - 104], [hx + 152, hy - 104], [hx + 152, hy - 84], [hx - 152, hy - 84]], o.hairCol, 0);
    });
    p.ell(hx, hy - 130, 46, 18, o.hairCol, 7, 180, 360); // beanie top knot
  } else if (o.hair === "bob") { // short black bob, both sides
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 30], [hx - 148, hy - 30]], () =>
      p.ell(hx, hy - 78, 150, 92, o.hairCol, 0, 180, 360));
    p.poly([[hx - 148, hy - 60], [hx - 118, hy - 60], [hx - 128, hy + 60], [hx - 150, hy + 40]], o.hairCol, 7);
    p.poly([[hx + 148, hy - 60], [hx + 118, hy - 60], [hx + 128, hy + 60], [hx + 150, hy + 40]], o.hairCol, 7);
  } else if (o.hair === "short") { // plain short hair cap
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 60], [hx - 148, hy - 60]], () =>
      p.ell(hx, hy - 88, 148, 80, o.hairCol, 0, 180, 360));
  } else if (o.hair === "beard") { // grey hair cap + full grey beard over the lower face
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 60], [hx - 148, hy - 60]], () =>
      p.ell(hx, hy - 88, 148, 80, o.hairCol, 0, 180, 360));
    p.ell(hx, hy + 78, 96, 84, o.hairCol, 8); // beard (mouth is "none" for the priest)
  }
  face(p, hx, hy, fs, lid);
  p.rot = null;
};

// ---------------- placements ----------------
const tmp = new THREE.Vector3();
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1200, 2000, 2] : d < 6.5 ? [720, 1200, 1.2] : d < 16 ? [360, 600, 0.6] : [240, 400, 0.4];

type FigSpec = {
  who: CharName; x: number; y: number; z: number; pose: PoseDef; expr: ExprName; seed: number;
  swaps?: number[]; mirror?: boolean; scale?: number; belt?: boolean; blob?: boolean;
};
const figureT = (cam: CamInfo, out: Stage, s: FigSpec, t: number) => {
  const d = cam.pos.distanceTo(tmp.set(s.x, s.y + 1.2, s.z));
  const [w, h, k] = tier(d / (s.scale ?? OUTFITS[s.who].scale));
  const lid = lidAt(t, s.seed, s.swaps);
  const key = `${s.who}|${poseKey(s.pose)}|${s.expr}|${lid}`;
  out.places.push({
    key, x: s.x, y: s.y, z: s.z, scale: s.scale ?? OUTFITS[s.who].scale, mirror: s.mirror,
    draw: (p) => stickFigure(p, s.who, s.pose, s.expr, lid, { belt: s.belt }),
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

// ---------------- staging ----------------
export const stageBurglar = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const dad = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "dad", x, y, z, pose, expr, seed: 1, ...extra }, t);
  const mom = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "mom", x, y, z, pose, expr, seed: 2, ...extra }, t);
  const handyman = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "handyman", x, y, z, pose, expr, seed: 3, belt: true, ...extra }, t);
  const priest = (x: number, y: number, z: number, pose: PoseDef, expr: ExprName, extra: Partial<FigSpec> = {}) =>
    figureT(cam, out, { who: "priest", x, y, z, pose, expr, seed: 4, ...extra }, t);
  switch (id) {
    case 1: { // ECU hinge: handyman kneeling at the door, oiling (night)
      handyman(0.9, 0, -0.9, POSES.kneelFix, "focused");
      break;
    }
    case 2: { // wide night exterior: handyman at the door
      handyman(0.6, 0, -1.2, POSES.stand, "focused");
      break;
    }
    case 3: { // morning: dad pushes the door — it swings silently
      const u = smooth((f - 141) / 24);
      dad(0.8, 0, 1.2, blendPose(POSES.stand, POSES.reachDown, u), "confused", { swaps: [5.0] });
      mom(1.2, 0, 1.8, POSES.stand, "puzzled"); // by the door, on the camera axis (the old spot at (2.5, 3.5) was 0.7m from the lens)
      break;
    }
    case 4: { // dad crouches at the hinge: six years of squeak, gone
      dad(0.6, 0, 0.8, POSES.crouchReach, "suspicious", { swaps: [7.5] });
      break;
    }
    case 5: { // kitchen: table steady, mom's coffee doesn't spill (both on the north side of the table, on the camera axis)
      mom(3.4, 0, 1.4, POSES.reachDown, "calm");
      dad(3.9, 0, 2.2, POSES.stand, "confused", { swaps: [10.0] });
      break;
    }
    case 6: { // pan: painting straight -> bulb steady; mom points at the painting, dad walks to the bulb
      const u = smooth((f - 396) / 169);
      mom(-0.8, 0, 6.2, POSES.pointAt, "puzzled"); // by the painting, on the back wall
      dad(lerp(2.0, 5.2, u), 0, 6.2, POSES.leanIn, "confused"); // walks east along the back wall
      break;
    }
    case 7: { // dad at night by the couch, worried: haunted, by a helpful ghost
      dad(-1.9, 0, 3.4, POSES.leanIn, "worried", { swaps: [20.0] }); // on the camera axis (the old spot was 0.56m off-axis)
      break;
    }
    case 8: { // priest blesses the rooms (tight group on the camera axis — the old 3m-wide line didn't fit the 24 deg frame)
      priest(0, 0, 3.0, POSES.bless, "serene");
      dad(-1.0, 0, 4.0, POSES.stand, "worried");
      mom(-0.3, 0, 4.3, POSES.stand, "worried");
      break;
    }
    case 9: { // hinge oiled again (mirror of shot 1)
      handyman(0.9, 0, -0.9, POSES.kneelFix, "focused");
      break;
    }
    case 10: { // CCTV: handyman fixing the door at 03:00
      handyman(0.9, 0, -0.9, POSES.kneelFix, "focused");
      break;
    }
    case 11: { // dad hides behind the couch with a flashlight
      dad(-2.2, 0, 3.2, POSES.hideCrouch, "scared", { swaps: [33.5] });
      break;
    }
    case 12: { // under the sink: caught!
      dad(3.8, 0, 4.2, POSES.crouchReach, "surprised", { swaps: [36.5] });
      handyman(4.6, 0, 4.9, POSES.crouch, "surprised", { swaps: [36.5] });
      break;
    }
    case 13: { // house numbers: sixteen, looking for sixty-one (static, on the street camera's axis)
      handyman(1.0, 0, -0.8, POSES.pointAt, "apologetic");
      dad(1.9, 0, -1.8, POSES.stand, "surprised"); // on the street camera's axis (the old spot put his card's edge out of frame)
      break;
    }
    case 14: { // dad tapes the note to the toolbox
      dad(-0.4, 0, 2.2, POSES.tapeNote, "amused"); // on the camera axis (the old spot put his card's edge out of frame at the dolly's end)
      mom(-1.5, 0, 3.0, POSES.stand, "relieved"); // west of the toolbox, in frame (the old spot was behind the camera)
      break;
    }
    case 15: { // handyman smiles with the note — hard stop
      handyman(-1.2, 0, 3.0, POSES.holdNote, "grinning", { swaps: [52.5] });
      dad(-2.0, 0, 3.8, POSES.stand, "amused"); // on the camera axis (the old spot was behind the camera's view)
      mom(-0.4, 0, 2.2, POSES.stand, "relieved");
      break;
    }
  }
  return out;
};
