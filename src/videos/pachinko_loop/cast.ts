// Pachinko cast: plan.md characters as lit flat cards in the 3D night world.
// Construction (locked): huge round white head ~1/3 of figure height, no neck,
// tiny dot eyes, minimal mouth, extremely thin stick limbs, L-shaped feet, thin
// near-black outline. Outfits and colours are the plan.md blocks, exact.
// Cards reuse the bridge Pool/Actor/Fx machinery (canvas pool + cardShade + NOINK layer).
// Poses are joint triples in the 600 x 1000 design space (soles at y = 975), blended per shot.
import * as THREE from "three";
import { Pen, INK, fxPuff, fxContact } from "../bridge/toon";
import type { CamInfo, Stage } from "../bridge/cast";
import {
  FPS, V3, lerp, walkPhase, smooth, LAUGH_F,
} from "./story";

type P2 = [number, number];
type Limb = [P2, P2, P2];
type PoseDef = { aL: Limb; aR: Limb; lL: Limb; lR: Limb; crouch: number; lean: number };
type EyeK = "dot" | "happy" | "shock" | "down" | "dash";
type MouthK = "line" | "grin" | "open" | "smirk" | "flat" | "o" | "smile" | "none" | "frown";
type FaceSpec = { tilt: number; raise: number; raiseL?: number; eye: EyeK; mouth: MouthK; look: number };
type ExprName = "hopeful" | "confused" | "laugh" | "determined" | "smile" | "polite" | "politeL" | "politeR"
  | "stern" | "smirk" | "shock" | "plain" | "happy" | "watchful" | "grin" | "frown";

const FACES: Record<ExprName, FaceSpec> = {
  hopeful: { tilt: 0, raise: 6, eye: "dot", mouth: "smile", look: 0 },
  confused: { tilt: 10, raise: 4, raiseL: 10, eye: "dot", mouth: "flat", look: 1 },
  laugh: { tilt: -8, raise: 2, eye: "happy", mouth: "grin", look: 0 },
  determined: { tilt: 6, raise: 0, eye: "dot", mouth: "line", look: 0 },
  smile: { tilt: 0, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  polite: { tilt: 0, raise: 3, eye: "dot", mouth: "smile", look: 0 },
  politeL: { tilt: -9, raise: 3, eye: "dot", mouth: "smile", look: 0 },
  politeR: { tilt: 9, raise: 3, eye: "dot", mouth: "smile", look: 0 },
  stern: { tilt: 12, raise: 0, eye: "dot", mouth: "line", look: 0 },
  smirk: { tilt: 0, raise: 0, raiseL: 8, eye: "dot", mouth: "smirk", look: 1 },
  shock: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
  plain: { tilt: 0, raise: 0, eye: "dot", mouth: "none", look: 0 },
  happy: { tilt: 0, raise: 4, eye: "happy", mouth: "grin", look: 0 },
  watchful: { tilt: 2, raise: 6, eye: "dot", mouth: "line", look: 1 },
  grin: { tilt: -4, raise: 3, eye: "happy", mouth: "grin", look: 0 },
  frown: { tilt: 8, raise: 0, eye: "dot", mouth: "frown", look: 0 },
};

// ---------------- pose library (design units; shoulders (205|395, 495), hips (268|332, 645)) ----------------
const HANG_L: Limb = [[205, 495], [178, 600], [188, 705]];
const HANG_R: Limb = [[395, 495], [422, 600], [412, 705]];
const LEG_L: Limb = [[268, 645], [262, 800], [258, 962]];
const LEG_R: Limb = [[332, 645], [338, 800], [342, 962]];
const P = (aL: Limb, aR: Limb, lL: Limb, lR: Limb, crouch = 0, lean = 0): PoseDef => ({ aL, aR, lL, lR, crouch, lean });
const POSES = {
  stand: P(HANG_L, HANG_R, LEG_L, LEG_R),
  ask: P([[205, 495], [150, 420], [130, 330]] as Limb, [[395, 495], [450, 560], [490, 520]] as Limb, LEG_L, LEG_R),
  laughPose: P([[205, 495], [140, 420], [110, 330]] as Limb, [[395, 495], [460, 420], [490, 330]] as Limb, LEG_L, LEG_R, 0, -6),
  holdBucket: P([[205, 495], [230, 580], [245, 650]] as Limb, [[395, 495], [370, 580], [355, 650]] as Limb, LEG_L, LEG_R),
  reachShelf: P(HANG_L, [[395, 495], [460, 420], [500, 330]] as Limb, LEG_L, LEG_R, 0, 4),
  point: P(HANG_L, [[395, 495], [470, 520], [545, 540]] as Limb, LEG_L, LEG_R),
  holdUp: P(HANG_L, [[395, 495], [465, 370], [500, 215]] as Limb, LEG_L, LEG_R),
  slump: P(HANG_L, HANG_R, LEG_L, LEG_R, 0.55, 14),
  carryBox: P([[205, 495], [250, 560], [255, 610]] as Limb, [[395, 495], [350, 560], [345, 610]] as Limb, LEG_L, LEG_R),
  slideArm: P(HANG_L, [[395, 495], [460, 570], [530, 610]] as Limb, LEG_L, LEG_R, 0.2, 8),
  leanIn: P(HANG_L, HANG_R, LEG_L, LEG_R, 0.25, 12),
  crossArms: P([[205, 495], [300, 610], [385, 600]] as Limb, [[395, 495], [300, 610], [215, 600]] as Limb, LEG_L, LEG_R),
};
const lerpLimb = (a: Limb, b: Limb, k: number): Limb =>
  [0, 1, 2].map((i) => [lerp(a[i][0], b[i][0], k), lerp(a[i][1], b[i][1], k)] as P2) as Limb;
const blendPose = (a: PoseDef, b: PoseDef, k: number): PoseDef => ({
  aL: lerpLimb(a.aL, b.aL, k), aR: lerpLimb(a.aR, b.aR, k), lL: lerpLimb(a.lL, b.lL, k), lR: lerpLimb(a.lR, b.lR, k),
  crouch: lerp(a.crouch, b.crouch, k), lean: lerp(a.lean, b.lean, k),
});
/** procedural walk/run legs + pumping arms; phase 0..1, amp = stride px, lift = foot lift px */
const gait = (phase: number, amp: number, lift: number, lean: number): PoseDef => {
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
type HairK = "buzz" | "slickGrey" | "bob" | "bun" | "cap" | "messy" | "flatTop";
type TopK = "hoodie" | "tracksuit" | "vest" | "cardigan" | "suit" | "uniform" | "tee";
type OutfitSpec = {
  top: TopK; topCol: string; underCol: string; hem: number; legCol: string; footCol: string;
  hair: HairK; hairCol: string; scale: number; chain?: boolean; tiePin?: boolean; gloves?: boolean;
  freckles?: boolean; specs?: boolean; toothpick?: boolean; stripeCol?: string;
};
const OUTFITS = {
  hero: { top: "hoodie", topCol: "#D9A441", underCol: "#B8892E", hem: 730, legCol: "#2E3440", footCol: "#F2F2F2", hair: "buzz", hairCol: "#1c1c20", scale: 1, freckles: true } as OutfitSpec,
  regular: { top: "tracksuit", topCol: "#1E8A8A", underCol: "#177070", hem: 720, legCol: "#177070", footCol: "#F2F2F2", hair: "slickGrey", hairCol: "#9A9AA2", scale: 1, chain: true, toothpick: true, stripeCol: "#F2F2F2" } as OutfitSpec,
  clerk: { top: "vest", topCol: "#6B3A6B", underCol: "#F2F2F2", hem: 725, legCol: "#3A3A3F", footCol: "#2B2B2E", hair: "bob", hairCol: "#C9C9D2", scale: 0.96 } as OutfitSpec,
  windowClerk: { top: "cardigan", topCol: "#7A2E3A", underCol: "#E8E0D0", hem: 735, legCol: "#3A3A3F", footCol: "#2B2B2E", hair: "bun", hairCol: "#B8B8C0", scale: 0.92, specs: true } as OutfitSpec,
  wholesaler: { top: "suit", topCol: "#22304F", underCol: "#F2F2F2", hem: 730, legCol: "#1B2538", footCol: "#16161A", hair: "flatTop", hairCol: "#1c1c20", scale: 1.08, tiePin: true, gloves: true } as OutfitSpec,
  officer: { top: "uniform", topCol: "#2A3A5E", underCol: "#2A3A5E", hem: 725, legCol: "#232F4C", footCol: "#16161A", hair: "cap", hairCol: "#232F4C", scale: 1.02 } as OutfitSpec,
  playerA: { top: "tee", topCol: "#C23B2E", underCol: "#C23B2E", hem: 715, legCol: "#3A3A3F", footCol: "#8A7A5C", hair: "messy", hairCol: "#3A2A1A", scale: 0.98 } as OutfitSpec,
  playerB: { top: "tee", topCol: "#3E6FB0", underCol: "#3E6FB0", hem: 715, legCol: "#2E3440", footCol: "#F2F2F2", hair: "buzz", hairCol: "#1c1c20", scale: 1 } as OutfitSpec,
  playerC: { top: "tee", topCol: "#7A5A9E", underCol: "#7A5A9E", hem: 715, legCol: "#4A4A50", footCol: "#2B2B2E", hair: "bob", hairCol: "#2A2018", scale: 0.95 } as OutfitSpec,
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

const face = (p: Pen, cx: number, cy: number, fs: FaceSpec, lid: number, o: OutfitSpec) => {
  const ex = 52, ey = cy - 8;
  for (const side of [-1, 1]) {
    const x = cx + side * ex + fs.look * 6, by = ey - 42;
    const raise = (side < 0 ? fs.raiseL ?? fs.raise : fs.raise);
    const tilt = fs.tilt * side;
    if (fs.mouth !== "none") {
      const bIn: P2 = [x - side * 24, by + tilt * 0.9 - raise], bOut: P2 = [x + side * 24, by - tilt * 0.4 - raise];
      p.stroke([bIn, bOut], 11, INK);
    }
    if (lid >= 0.75) { p.stroke([[x - 16, ey], [x + 16, ey]], 8, INK); }
    else {
      switch (fs.eye) {
        case "dot": p.dot(x, ey, lid > 0 ? 8 : 12, INK); break;
        case "down": p.dot(x, ey + 8, 11, INK); break;
        case "dash": p.stroke([[x - 15, ey], [x + 15, ey]], 8, INK); break;
        case "happy": p.arc(x, ey + 6, 17, 12, 200, 340, 8, INK); break;
        case "shock":
          p.ell(x, ey, 20, 20, "#ffffff", 5); p.dot(x + fs.look * 3, ey + 2, 7, INK); break;
      }
    }
    if (o.specs) { // half-moon spectacles under the eyes
      p.arc(x, ey + 6, 24, 14, 0, 180, 5, INK);
      if (side < 0) p.stroke([[x + 24, ey + 6], [cx + ex - 24 + fs.look * 6, ey + 6]], 5, INK);
    }
  }
  if (o.freckles) for (const side of [-1, 1]) for (let i = 0; i < 3; i++)
    p.dot(cx + side * (78 + i * 12), cy + 26 + (i % 2) * 10, 4, "#8a6a4a");
  const mx = cx + fs.look * 4, my = cy + 68;
  switch (fs.mouth) {
    case "line": p.stroke([[mx - 26, my], [mx + 26, my - 3]], 9, INK); break;
    case "flat": p.stroke([[mx - 18, my], [mx + 18, my]], 8, INK); break;
    case "smirk": p.arc(mx + 4, my - 12, 26, 14, 10, 150, 8, INK); break;
    case "smile": p.arc(mx, my - 12, 30, 16, 20, 160, 8, INK); break;
    case "frown": p.arc(mx, my + 14, 26, 14, 200, 340, 8, INK); break;
    case "grin":
      p.ell(mx, my - 6, 34, 22, "#5a1e28", 0, 0, 180);
      p.clip([[mx - 34, my - 6], [mx + 34, my - 6], [mx + 34, my + 2], [mx - 34, my + 2]], () => p.ell(mx, my - 6, 34, 22, "#ffffff", 0, 0, 180));
      p.ell(mx, my - 6, 34, 22, null, 8, 0, 180);
      break;
    case "open": p.ell(mx, my, 12, 14, "#5a1e28", 7); break;
    case "o": p.ell(mx, my + 4, 18, 22, "#5a1e28", 8); break;
    case "none": break;
  }
  if (o.toothpick) p.stroke([[mx + 22, my - 4], [mx + 54, my - 14]], 5, "#D9B36A");
};

type Extras = { bucket?: boolean; bucketFull?: boolean; clipboard?: boolean; briefcase?: boolean; cardUp?: boolean; box?: boolean };

const stickFigure = (p: Pen, who: CharName, po: PoseDef, expr: ExprName, lid: number, extras: Extras) => {
  const o = OUTFITS[who], fs = FACES[expr], dy = po.crouch * 130;
  const head: P2 = [300, 300 + dy], hipY = 645 + dy;
  const sh = (side: number): P2 => [side < 0 ? 205 : 395, 495 + dy];
  const shift = (l: Limb): Limb => l.map(([x, y]) => [x, y + (y < 645 ? dy : 0)] as P2) as Limb;
  const handCol = o.gloves ? "#F2F2F2" : INK;
  // ---- legs (unrotated) ----
  p.rot = null;
  for (const [leg, side] of [[po.lL, -1], [po.lR, 1]] as const) {
    const hip: P2 = [side < 0 ? 268 : 332, hipY];
    const [,, foot] = leg;
    const knee: P2 = [(hip[0] + foot[0]) / 2 + side * 6, (hipY + foot[1]) / 2 - 6];
    p.stroke([hip, knee, foot], 13, o.legCol);
    p.stroke([[foot[0] - side * 4, foot[1]], [foot[0] + side * 26, foot[1] + 2]], 13, o.footCol); // L foot
    if (o.top === "tracksuit" && o.stripeCol) p.stroke([[hip[0] + side * 4, hipY + 30], [foot[0] + side * 4, foot[1] - 20]], 4, o.stripeCol);
  }
  // ---- upper body: lean about the hips ----
  p.rot = po.lean ? [(po.lean * Math.PI) / 180, 300, hipY] : null;
  const hw = 100, hemW = 118;
  const body: P2[] = [[300 - hw, 470 + dy], [300 + hw, 470 + dy], [300 + hemW, o.hem + dy], [300 - hemW, o.hem + dy]];
  // hoodie hood behind the head
  if (o.top === "hoodie") p.ell(300, 420 + dy, 128, 92, o.underCol, 9, 180, 360);
  p.poly(body, o.top === "vest" ? o.underCol : o.topCol, 10);
  p.clip(body, () => {
    if (o.top === "hoodie") {
      p.poly([[250, o.hem - 78 + dy], [350, o.hem - 78 + dy], [342, o.hem - 8 + dy], [258, o.hem - 8 + dy]], o.underCol, 6); // kangaroo pocket
      p.stroke([[282, 500 + dy], [278, 560 + dy]], 6, "#F2F2F2");
      p.stroke([[318, 500 + dy], [322, 560 + dy]], 6, "#F2F2F2");
    }
    if (o.top === "tracksuit" && o.stripeCol) {
      p.band([[300 - hw + 14, 480 + dy], [300 - hemW + 16, o.hem - 10 + dy]], o.stripeCol, 10, 2);
      p.band([[300 + hw - 14, 480 + dy], [300 + hemW - 16, o.hem - 10 + dy]], o.stripeCol, 10, 2);
      p.stroke([[300, 478 + dy], [300, o.hem - 8 + dy]], 5, o.underCol);
    }
    if (o.top === "vest") {
      p.poly([[300 - hw, 470 + dy], [300 - 34, 470 + dy], [300 - 44, o.hem + dy], [300 - hemW, o.hem + dy]], o.topCol, 6);
      p.poly([[300 + 34, 470 + dy], [300 + hw, 470 + dy], [300 + hemW, o.hem + dy], [300 + 44, o.hem + dy]], o.topCol, 6);
    }
    if (o.top === "cardigan") {
      p.stroke([[300, 478 + dy], [300, o.hem - 8 + dy]], 5, o.underCol);
      for (const yy of [540, 590, 640]) p.dot(306, yy + dy, 5, o.underCol);
    }
    if (o.top === "suit") {
      p.poly([[300, 472 + dy], [268, 472 + dy], [300, 580 + dy]], o.underCol, 5); // shirt V
      p.poly([[300, 472 + dy], [332, 472 + dy], [300, 580 + dy]], o.underCol, 5);
      p.poly([[292, 500 + dy], [308, 500 + dy], [304, 560 + dy], [296, 560 + dy]], "#8A1E2E", 4); // tie
    }
    if (o.top === "uniform") {
      p.band([[300 - hemW + 8, 636 + dy], [300 + hemW - 8, 636 + dy]], "#1B2538", 16, 3);
      p.dot(300, 636 + dy, 8, "#C9A86A");
    }
  });
  if (o.chain) { // gold chain + pendant
    p.arc(300, 500 + dy, 62, 44, 20, 160, 7, "#E8C45A");
    p.dot(300, 552 + dy, 9, "#E8C45A");
  }
  if (o.tiePin) p.dot(312, 528 + dy, 7, "#E8C45A");
  if (o.top === "uniform") p.dot(348, 520 + dy, 9, "#E8C45A"); // badge
  // arms (thin sticks over the body sides)
  for (const [arm, side] of [[shift(po.aL), -1], [shift(po.aR), 1]] as const) {
    const [, e, h] = arm;
    const S = sh(side);
    p.stroke([S, e, h], 12, INK);
    p.dot(h[0], h[1], 11, handCol);
  }
  // ---- extras (in front of the body, behind the head) ----
  if (extras.bucket || extras.bucketFull) {
    const b: P2[] = [[228, 640], [372, 640], [352, 786], [248, 786]];
    p.poly(b, "#1c1c20", 8);
    p.stroke([[228, 640], [372, 640]], 8, "#3A3A3F");
    if (extras.bucketFull) {
      p.ell(300, 636, 72, 26, "#C9CCD2", 6, 180, 360); // overflowing mound of steel balls
      for (let i = 0; i < 9; i++) p.dot(246 + (i % 5) * 27, 622 + Math.floor(i / 5) * 12, 8, "#E8EAEE");
    } else {
      for (let i = 0; i < 5; i++) p.dot(258 + i * 21, 634, 7, "#C9CCD2");
    }
  }
  if (extras.box) {
    p.poly([[218, 556], [382, 556], [382, 684], [218, 684]], "#A8743F", 8);
    p.stroke([[218, 592], [382, 592]], 5, "#7A4F33");
    p.stroke([[300, 556], [300, 684]], 4, "#7A4F33");
  }
  if (extras.clipboard) {
    p.poly([[118, 596], [196, 596], [196, 706], [118, 706]], "#F2F2F2", 7);
    p.dot(157, 596, 8, "#8A8A92");
    for (const yy of [624, 646, 668]) p.stroke([[132, yy], [182, yy]], 4, "#8A8A92");
  }
  if (extras.briefcase) {
    p.poly([[398, 706], [502, 706], [502, 806], [398, 806]], "#16161A", 8);
    p.stroke([[432, 706], [432, 690], [468, 690], [468, 706]], 6, INK);
    p.dot(450, 730, 5, "#C9A86A");
  }
  if (extras.cardUp) { // gold card held high in the raised right hand
    p.poly([[462, 158], [566, 158], [566, 232], [462, 232]], "#E8C45A", 8);
    p.poly([[474, 170], [554, 170], [554, 220], [474, 220]], "#F5D67A", 0);
    p.stroke([[474, 196], [554, 178]], 6, "#FFF2B8");
    p.dot(500, 208, 6, "#B8892E");
  }
  // ---- head ----
  const [hx, hy] = head;
  p.ell(hx, hy, 152, 164, "#fdfdf8", 10);
  // hair / headgear
  if (o.hair === "buzz") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy - 100], [hx - 152, hy - 100]], () =>
      p.ell(hx, hy - 108, 154, 64, o.hairCol, 0, 180, 360));
  } else if (o.hair === "slickGrey") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy - 96], [hx - 152, hy - 96]], () => {
      p.ell(hx, hy - 104, 154, 68, o.hairCol, 0, 180, 360);
      for (let i = 0; i < 6; i++) p.stroke([[hx - 110 + i * 36, hy - 150], [hx - 96 + i * 36, hy - 122]], 4, "#7A7A82");
    });
  } else if (o.hair === "bob") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy + 40], [hx - 152, hy + 40]], () => {
      p.ell(hx, hy - 70, 156, 104, o.hairCol, 0, 180, 360);
      p.poly([[hx - 156, hy - 60], [hx - 128, hy - 60], [hx - 128, hy + 10], [hx - 156, hy + 10]], o.hairCol, 0);
      p.poly([[hx + 128, hy - 60], [hx + 156, hy - 60], [hx + 156, hy + 10], [hx + 128, hy + 10]], o.hairCol, 0);
    });
  } else if (o.hair === "bun") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy - 80], [hx - 152, hy - 80]], () =>
      p.ell(hx, hy - 94, 154, 80, o.hairCol, 0, 180, 360));
    p.ell(hx, hy - 168, 46, 34, o.hairCol, 8);
  } else if (o.hair === "flatTop") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy - 104], [hx - 152, hy - 104]], () =>
      p.poly([[hx - 118, hy - 164], [hx + 118, hy - 164], [hx + 128, hy - 104], [hx - 128, hy - 104]], o.hairCol, 0));
  } else if (o.hair === "messy") {
    p.clip([[hx - 152, hy - 164], [hx + 152, hy - 164], [hx + 152, hy - 60], [hx - 152, hy - 60]], () => {
      for (let i = 0; i < 8; i++) p.poly([[hx - 130 + i * 37, hy - 96], [hx - 108 + i * 37, hy - 96], [hx - 119 + i * 37, hy - 62]], o.hairCol, 0);
    });
  } else if (o.hair === "cap") {
    p.ell(hx, hy - 138, 130, 44, o.hairCol, 8, 180, 360);
    p.ell(hx, hy - 132, 168, 22, "#1B2538", 8, 0, 180);
    p.dot(hx, hy - 158, 10, "#E8C45A");
  }
  face(p, hx, hy, fs, lid, o);
  p.rot = null;
};

// ---------------- placements ----------------
const tmp = new THREE.Vector3();
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1200, 2000, 2] : d < 6.5 ? [720, 1200, 1.2] : d < 16 ? [360, 600, 0.6] : [240, 400, 0.4];
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

type FigSpec = {
  who: CharName; x: number; y: number; z: number; pose: PoseDef; expr: ExprName; seed: number;
  swaps?: number[]; mirror?: boolean; scale?: number; extras?: Extras; blob?: boolean;
};
const figureT = (cam: CamInfo, out: Stage, s: FigSpec, t: number) => {
  const d = cam.pos.distanceTo(tmp.set(s.x, s.y + 1.2, s.z));
  const [w, h, k] = tier(d / (s.scale ?? OUTFITS[s.who].scale));
  const lid = lidAt(t, s.seed, s.swaps);
  const ex = s.extras ?? {};
  const key = `${s.who}|${poseKey(s.pose)}|${s.expr}|${lid}|${ex.bucket ? 1 : 0}${ex.bucketFull ? 1 : 0}${ex.clipboard ? 1 : 0}${ex.briefcase ? 1 : 0}${ex.cardUp ? 1 : 0}${ex.box ? 1 : 0}`;
  out.places.push({
    key, x: s.x, y: s.y, z: s.z, scale: s.scale ?? OUTFITS[s.who].scale, mirror: s.mirror,
    draw: (p) => stickFigure(p, s.who, s.pose, s.expr, lid, ex),
    size: [w, h, k],
  });
  if (s.blob !== false) contactBlob(out, s.x, s.y, s.z, s.scale ?? OUTFITS[s.who].scale);
};

/** tight contact pool under a figure (multiply, blue-violet night shadow) */
const contactBlob = (out: Stage, x: number, y: number, z: number, sc = 1) => {
  const cc = "#2a3350";
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc),
    x, y: y + 0.022, z, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot: 0 });
};

/** dust puff at (x, z) over frames [f0, f0+n) */
const dust = (out: Stage, f: number, f0: number, n: number, x: number, z: number, s: number) => {
  if (f < f0 || f >= f0 + n) return;
  const u = q((f - f0) / n, 30);
  out.fx.push({ key: `puff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: 0.25 * s, z, w: 1.1 * s, h: 1.1 * s, soft: true });
};

// ---------------- staging ----------------
export const stagePachinko = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  switch (id) {
    case 1: break; // macro card: world carries it
    case 2: {
      const u = smooth((f - 143) / 59);
      figureT(cam, out, { who: "hero", x: lerp(-2, 2, u), y: 0, z: 7.5, pose: gait(walkPhase(t * 1.2), 55, 55, 4), expr: "hopeful", seed: 1, extras: { bucket: true } }, t);
      figureT(cam, out, { who: "regular", x: lerp(-4, 1, u), y: 0, z: 6.8, pose: gait(walkPhase(t * 1.2 + 0.3), 55, 55, 4), expr: "grin", seed: 2, extras: { bucketFull: true } }, t);
      figureT(cam, out, { who: "playerA", x: lerp(-6, -2, u), y: 0, z: 8.0, pose: gait(walkPhase(t * 1.1 + 0.6), 50, 50, 4), expr: "happy", seed: 11, extras: { bucket: true } }, t);
      figureT(cam, out, { who: "playerB", x: lerp(1, 5, u), y: 0, z: 6.2, pose: gait(walkPhase(t * 1.15 + 0.1), 50, 50, 4), expr: "plain", seed: 12, extras: { bucket: true } }, t);
      break;
    }
    case 3: {
      const laughing = f >= LAUGH_F;
      const bounce = laughing ? Math.abs(Math.sin((f - LAUGH_F) * 0.35)) * 0.06 : 0;
      figureT(cam, out, { who: "hero", x: -0.6, y: 0, z: -6.4, pose: laughing ? blendPose(POSES.ask, POSES.stand, smooth((f - LAUGH_F) / 12)) : POSES.ask, expr: laughing ? "confused" : "hopeful", seed: 1, swaps: [8.89], extras: { bucket: true } }, t);
      figureT(cam, out, { who: "regular", x: 0.5, y: bounce, z: -6.2, pose: laughing ? POSES.laughPose : POSES.stand, expr: laughing ? "laugh" : "smirk", seed: 2, swaps: [8.89], extras: { bucketFull: true } }, t);
      break;
    }
    case 4: {
      const walkers: [CharName, number, number, number][] = [["hero", -1.2, 4.0, 1], ["regular", 1.0, 4.6, 2], ["playerA", -2.2, 5.2, 11], ["playerB", 2.2, 3.8, 12], ["playerC", 0.2, 5.8, 13]];
      walkers.forEach(([who, x0, z, seed]) => {
        const x = x0 + Math.sin(t * 0.4 + seed) * 0.8;
        figureT(cam, out, { who, x, y: 0, z, pose: gait(walkPhase(t * 0.9 + seed * 0.2), 50, 45, 3), expr: "plain", seed, extras: { bucket: true } }, t);
      });
      break;
    }
    case 5: {
      const win = smooth((f - 450) / 20);
      figureT(cam, out, { who: "hero", x: -0.4, y: 0, z: -6.7, pose: POSES.holdBucket, expr: win > 0.5 ? "determined" : "hopeful", seed: 1, swaps: [15.0], extras: { bucketFull: win > 0.5 } }, t);
      dust(out, f, 450, 18, -0.4, -6.9, 0.8);
      break;
    }
    case 6: {
      const slump = smooth((f - 620) / 30);
      const shake: ExprName = Math.floor(f / 8) % 2 === 0 ? "politeL" : "politeR";
      figureT(cam, out, { who: "hero", x: -0.15, y: 0, z: -10.2, pose: blendPose(POSES.stand, POSES.slump, slump), expr: "confused", seed: 1, extras: { bucket: true } }, t);
      figureT(cam, out, { who: "clerk", x: 0.3, y: 0, z: -11.9, pose: POSES.stand, expr: shake, seed: 3, extras: { clipboard: true } }, t);
      break;
    }
    case 7: {
      const reach = smooth((f - 800) / 25);
      figureT(cam, out, { who: "hero", x: 4.3, y: 0, z: -11.3, pose: blendPose(POSES.stand, POSES.reachShelf, reach), expr: "hopeful", seed: 1 }, t);
      figureT(cam, out, { who: "clerk", x: 4.7, y: 0, z: -12.2, pose: POSES.point, expr: "polite", seed: 3, extras: { clipboard: true } }, t);
      break;
    }
    case 8: {
      const walk = smooth((f - 880) / 80);
      const hx = lerp(-0.2, 8.4, walk), hz = lerp(-0.5, 7.4, walk);
      const stepBack = smooth((f - 960) / 40);
      const rx = lerp(lerp(1.6, 9.2, walk), 8.6, stepBack), rz = lerp(lerp(0.6, 6.0, walk), 4.8, stepBack);
      const moving = walk < 1;
      const rMoving = moving || stepBack < 1;
      figureT(cam, out, { who: "hero", x: hx, y: 0, z: hz, pose: moving ? gait(walkPhase(t * 1.3), 60, 60, 5) : POSES.stand, expr: "watchful", seed: 1, extras: { bucket: true } }, t);
      const slide = smooth((f - 956) / 20);
      figureT(cam, out, { who: "regular", x: rx, y: 0, z: rz, pose: rMoving && stepBack < 0.05 ? gait(walkPhase(t * 1.3 + 0.4), 60, 60, 5) : stepBack > 0.05 ? blendPose(POSES.slideArm, POSES.stand, stepBack) : blendPose(POSES.stand, POSES.slideArm, slide), expr: "grin", seed: 2 }, t);
      figureT(cam, out, { who: "windowClerk", x: 10.15, y: 0, z: 6.0, pose: POSES.stand, expr: "stern", seed: 4 }, t);
      break;
    }
    case 9: {
      figureT(cam, out, { who: "windowClerk", x: 10.15, y: 0, z: 6.0, pose: POSES.stand, expr: "stern", seed: 4 }, t);
      break;
    }
    case 10: {
      // wholesaler: van -> window (1111-1140), carry box back (1140-1190), load + stand
      const toWin = smooth((f - 1111) / 29), back = smooth((f - 1140) / 50);
      let wx: number, wz: number, wpose: PoseDef, wex: Extras = {};
      if (toWin < 1) { wx = lerp(9.1, 9.4, toWin); wz = lerp(6.6, 6.2, toWin); wpose = gait(walkPhase(t * 1.1), 55, 50, 4); }
      else if (back < 1) { wx = lerp(9.4, 9.1, back); wz = lerp(6.2, 6.6, back); wpose = POSES.carryBox; wex = { box: true }; }
      else { wx = 9.1; wz = 6.6; wpose = POSES.stand; wex = { briefcase: true }; }
      figureT(cam, out, { who: "wholesaler", x: wx, y: 0, z: wz, pose: wpose, expr: "stern", seed: 5, extras: wex }, t);
      figureT(cam, out, { who: "windowClerk", x: 10.15, y: 0, z: 6.0, pose: POSES.stand, expr: "stern", seed: 4 }, t);
      break;
    }
    case 11: {
      const set = smooth((f - 1240) / 30);
      figureT(cam, out, { who: "wholesaler", x: -9.0, y: 0, z: 6.0, pose: set < 1 ? POSES.carryBox : POSES.stand, expr: "stern", seed: 5, extras: set < 1 ? { box: true } : { briefcase: true } }, t);
      break;
    }
    case 12: {
      figureT(cam, out, { who: "clerk", x: 0.1, y: 0, z: -0.6, pose: POSES.holdUp, expr: "polite", seed: 3 }, t);
      figureT(cam, out, { who: "wholesaler", x: 4.3, y: 0, z: 2.4, pose: POSES.stand, expr: "stern", seed: 5, extras: { briefcase: true } }, t);
      figureT(cam, out, { who: "hero", x: -0.35, y: 0, z: -0.4, pose: POSES.stand, expr: "watchful", seed: 1 }, t);
      break;
    }
    case 13: {
      const up = smooth((f - 1400) / 30);
      figureT(cam, out, { who: "playerA", x: 0.55, y: 0, z: -10.5, pose: blendPose(POSES.stand, POSES.holdUp, up), expr: "happy", seed: 11 }, t);
      figureT(cam, out, { who: "clerk", x: 0.1, y: 0, z: -11.9, pose: POSES.point, expr: "polite", seed: 3, extras: { clipboard: true } }, t);
      figureT(cam, out, { who: "hero", x: -0.35, y: 0, z: -10.7, pose: POSES.stand, expr: "smile", seed: 1, swaps: [46.0] }, t);
      break;
    }
    case 14: break; // aerial: world carries the loop
    case 15: {
      const bob = Math.abs(Math.sin(t * 2.4)) * 0.03;
      figureT(cam, out, { who: "hero", x: 0, y: bob, z: 4.5, pose: POSES.holdUp, expr: "smile", seed: 1, extras: { cardUp: true } }, t);
      figureT(cam, out, { who: "regular", x: -0.7, y: 0, z: 3.6, pose: POSES.laughPose, expr: "laugh", seed: 2, extras: { bucketFull: true } }, t);
      figureT(cam, out, { who: "playerB", x: 0.7, y: 0, z: 3.4, pose: POSES.stand, expr: "happy", seed: 12, extras: { bucket: true } }, t);
      const ox15 = lerp(-0.5, 1.0, smooth((f - 1619) / 167)); // officer cameo: strolls past behind, nods
      figureT(cam, out, { who: "officer", x: ox15, y: 0, z: 2.0, pose: gait(walkPhase(t * 0.9), 45, 40, 3), expr: "polite", seed: 6 }, t);
      break;
    }
  }
  return out;
};
