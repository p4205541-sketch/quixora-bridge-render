// Flying Thunder cast: V1 stick figures as lit flat cards in the 3D night world.
// Construction (characters.md, locked): huge round white head ~1/3 of figure height, no neck,
// tiny dot eyes, thick short brows, minimal mouth, extremely thin stick limbs, dot/stub hands,
// L-shaped feet, thin near-black outline. Outfits and colours are the V1 locked blocks, exact.
// Cards reuse the bridge Pool/Actor/Fx machinery (canvas pool + cardShade + NOINK layer).
// Poses are joint triples in the 600 x 1000 design space (soles at y = 975), blended per shot.
import * as THREE from "three";
import { Pen, INK, fxPuff, fxContact } from "../bridge/toon";
import type { CamInfo, Stage } from "../bridge/cast";
import {
  FPS, V3, lerp, walkPhase, blastAge, smooth,
} from "./story";

type P2 = [number, number];
type Limb = [P2, P2, P2];
type PoseDef = { aL: Limb; aR: Limb; lL: Limb; lR: Limb; crouch: number; lean: number };
type EyeK = "dot" | "happy" | "shock" | "down" | "dash";
type MouthK = "line" | "grin" | "open" | "smirk" | "flat" | "o" | "smile" | "none";
type FaceSpec = { tilt: number; raise: number; raiseL?: number; eye: EyeK; mouth: MouthK; look: number };
type ExprName = "stern" | "watchful" | "silent" | "urgent" | "grinning" | "scoffing" | "sheepish" | "awed"
  | "sharp" | "relieved" | "plain" | "shock";

const FACES: Record<ExprName, FaceSpec> = {
  stern: { tilt: 12, raise: 0, eye: "dot", mouth: "line", look: 0 },
  watchful: { tilt: 2, raise: 6, eye: "dot", mouth: "line", look: 1 },
  silent: { tilt: 0, raise: 0, eye: "dot", mouth: "flat", look: 0 },
  urgent: { tilt: 18, raise: 2, eye: "dot", mouth: "open", look: 0 },
  grinning: { tilt: -6, raise: 4, eye: "happy", mouth: "grin", look: 0 },
  scoffing: { tilt: 0, raise: 0, raiseL: 8, eye: "dot", mouth: "smirk", look: 1 },
  sheepish: { tilt: 0, raise: 3, eye: "down", mouth: "flat", look: -1 },
  awed: { tilt: 0, raise: 10, eye: "shock", mouth: "o", look: 0 },
  sharp: { tilt: 10, raise: 0, eye: "dot", mouth: "line", look: 1 },
  relieved: { tilt: 0, raise: 2, eye: "happy", mouth: "smile", look: 0 },
  plain: { tilt: 0, raise: 0, eye: "dot", mouth: "none", look: 0 },
  shock: { tilt: 0, raise: 9, eye: "shock", mouth: "o", look: 0 },
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
  reachLeft: P([[205, 495], [140, 570], [70, 650]] as Limb, HANG_R, LEG_L, LEG_R),
  reachDown: P(HANG_L, [[395, 495], [450, 590], [470, 700]] as Limb, LEG_L, LEG_R),
  grabWrist: P([[205, 495], [290, 560], [360, 600]] as Limb, HANG_R, LEG_L, LEG_R, 0.35, 6),
  crossArms: P([[205, 495], [300, 610], [385, 600]] as Limb, [[395, 495], [300, 610], [215, 600]] as Limb, LEG_L, LEG_R),
  kickWind: P([[205, 495], [150, 450], [120, 380]] as Limb, [[395, 495], [450, 450], [480, 380]] as Limb,
    LEG_L, [[332, 645], [380, 760], [350, 860]] as Limb),
  kick: P([[205, 495], [150, 450], [120, 380]] as Limb, [[395, 495], [450, 450], [480, 380]] as Limb,
    LEG_L, [[332, 645], [430, 720], [525, 745]] as Limb, 0, -4),
  lift: P([[205, 495], [165, 385], [205, 235]] as Limb, [[395, 495], [435, 385], [395, 235]] as Limb,
    [[268, 645], [250, 800], [235, 962]] as Limb, [[332, 645], [350, 800], [365, 962]] as Limb),
  stumble: P([[205, 495], [140, 430], [100, 340]] as Limb, [[395, 495], [460, 430], [500, 340]] as Limb,
    [[268, 645], [240, 800], [210, 962]] as Limb, [[332, 645], [380, 790], [430, 950]] as Limb, 0, -8),
  drag: P(HANG_L, [[395, 495], [470, 560], [535, 600]] as Limb, LEG_L, LEG_R, 0.15, 8),
  palmsUp: P([[205, 495], [150, 560], [110, 520]] as Limb, [[395, 495], [450, 560], [490, 520]] as Limb, LEG_L, LEG_R),
  hold: P([[205, 495], [320, 520], [430, 530]] as Limb, [[395, 495], [420, 515], [448, 522]] as Limb, LEG_L, LEG_R), // both hands cradle the bomb at the card's right edge
  crouch: P(HANG_L, HANG_R, [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 8),
  crouchReach: P([[205, 495], [280, 580], [350, 640]] as Limb, HANG_R,
    [[268, 645], [225, 790], [258, 962]] as Limb, [[332, 645], [375, 790], [342, 962]] as Limb, 0.9, 10),
  leanIn: P(HANG_L, HANG_R, LEG_L, LEG_R, 0.25, 12),
  flagPoint: P([[205, 495], [170, 420], [150, 320]] as Limb, [[395, 495], [340, 570], [300, 640]] as Limb, LEG_L, LEG_R),
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
  robe: string; hem: number; belt?: string; sash?: string; cord?: string; legCol: string; footCol: string;
  hair: "headband" | "strawhat" | "ponytail" | "none"; scale: number;
};
const OUTFITS = {
  jiro: { robe: "#A83C2A", hem: 735, belt: "#2B2B2E", cord: "#F2E6C8", legCol: "#2B2B2E", footCol: "#C9A86A", hair: "headband", scale: 1 } as OutfitSpec,
  taro: { robe: "#D9A441", hem: 625, belt: "#C23B2E", legCol: "#8A8A8A", footCol: "#C9A86A", hair: "strawhat", scale: 1 } as OutfitSpec,
  aki: { robe: "#3A3A3F", hem: 685, sash: "#F2F2F2", legCol: "#2E4057", footCol: "#C9A86A", hair: "ponytail", scale: 0.92 } as OutfitSpec,
  man: { robe: "#8A8378", hem: 720, belt: "#3A3630", legCol: "#6E675C", footCol: "#8A7A5C", hair: "none", scale: 0.95 } as OutfitSpec,
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

const stickFigure = (p: Pen, who: CharName, po: PoseDef, expr: ExprName, lid: number, extras: { baton?: boolean; flag?: boolean; sword?: boolean }) => {
  const o = OUTFITS[who], fs = FACES[expr], dy = po.crouch * 130;
  const head: P2 = [300, 300 + dy], chinY = 458 + dy, hipY = 645 + dy;
  const sh = (side: number): P2 => [side < 0 ? 205 : 395, 495 + dy];
  const shift = (l: Limb): Limb => l.map(([x, y]) => [x, y + (y < 645 ? dy : 0)] as P2) as Limb;
  // ---- legs (unrotated) ----
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
  // robe / jacket: A-line polygon, shoulders -> hem
  const hw = 100, hemW = who === "taro" ? 88 : 118;
  const robe: P2[] = [[300 - hw, 470 + dy], [300 + hw, 470 + dy], [300 + hemW, o.hem + dy], [300 - hemW, o.hem + dy]];
  p.poly(robe, o.robe, 10);
  p.clip(robe, () => {
    if (o.cord) p.band([[300 - hw + 8, 478 + dy], [300 + hemW - 20, o.hem - 30 + dy]], o.cord, 16, 4); // cream shoulder cord
    if (o.belt) p.band([[300 - hemW + 6, 640 + dy], [300 + hemW - 6, 640 + dy]], o.belt, 18, 3);
    if (o.sash) p.band([[300 - hemW + 6, 636 + dy], [300 + hemW - 6, 636 + dy]], o.sash, 20, 3);
  });
  if (extras.sword) { // plain short sword at the belt, never drawn
    p.band([[300 - 70, 640 + dy], [300 - 128, 720 + dy]], "#3A3A3F", 12, 3, "round");
    p.dot(300 - 66, 636 + dy, 8, "#2B2B2E");
  }
  // arms (behind robe edge? no — arms over the robe sides, thin sticks)
  for (const [arm, side] of [[shift(po.aL), -1], [shift(po.aR), 1]] as const) {
    const [s, e, h] = arm;
    const S = sh(side);
    p.stroke([S, e, h], 12, INK);
    p.dot(h[0], h[1], 11, INK);
  }
  if (extras.baton) { // short wooden signal baton in the right hand
    const h = shift(po.aR)[2];
    p.band([[h[0] - 8, h[1] + 26], [h[0] + 8, h[1] - 30]], "#8a5a34", 10, 3, "round");
    p.dot(h[0], h[1], 11, INK);
  }
  if (extras.flag) { // white signal flag on a bamboo pole in the left hand; streams LEFT and ABOVE the head (head is drawn after, would cover it)
    const h = shift(po.aL)[2];
    p.band([[h[0], h[1] + 40], [h[0] - 12, h[1] - 240]], "#C9B184", 8, 3, "round");
    p.poly([[h[0] - 12, h[1] - 240], [h[0] - 118, h[1] - 214], [h[0] - 12, h[1] - 182]], "#F2F2F2", 6);
    p.dot(h[0], h[1], 11, INK);
  }
  // ---- head ----
  const [hx, hy] = head;
  p.ell(hx, hy, 148, 158, "#fdfdf8", 10);
  // hair / headgear
  if (o.hair === "headband") {
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 40], [hx - 148, hy - 40]], () => {
      p.poly([[hx - 150, hy - 118], [hx + 150, hy - 118], [hx + 150, hy - 84], [hx - 150, hy - 84]], "#1c1c20", 0);
      for (let i = 0; i < 7; i++) p.poly([[hx - 120 + i * 40, hy - 84], [hx - 100 + i * 40, hy - 84], [hx - 110 + i * 40, hy - 58]], "#1c1c20", 0); // fringe
    });
    p.stroke([[hx + 148, hy - 100], [hx + 178, hy - 84], [hx + 170, hy - 62]], 8, "#1c1c20"); // knot tails
  } else if (o.hair === "strawhat") {
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 60], [hx - 148, hy - 60]], () => {
      for (let i = 0; i < 8; i++) p.poly([[hx - 130 + i * 37, hy - 96], [hx - 108 + i * 37, hy - 96], [hx - 119 + i * 37, hy - 66]], "#1c1c20", 0); // tousled hair
    });
    p.ell(hx + 10, hy - 148, 118, 26, "#D9B36A", 8, 0, 360, -10); // pushed-back straw disc
    p.ell(hx + 10, hy - 158, 52, 20, "#C9A45C", 7, 180, 360, -10);
    p.stroke([[hx + 118, hy - 138], [hx + 132, hy - 60]], 4, "#8a7a5c"); // loose chin cord
  } else if (o.hair === "ponytail") {
    p.clip([[hx - 148, hy - 158], [hx + 148, hy - 158], [hx + 148, hy - 30], [hx - 148, hy - 30]], () =>
      p.ell(hx, hy - 78, 150, 92, "#1c1c20", 0, 180, 360));
    p.poly([[hx + 120, hy - 90], [hx + 185, hy - 30], [hx + 175, hy + 90], [hx + 128, hy + 40]], "#1c1c20", 7); // ponytail
    p.dot(hx + 128, hy - 78, 10, "#F2F2F2"); // white cord
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
  swaps?: number[]; mirror?: boolean; scale?: number; baton?: boolean; flag?: boolean; sword?: boolean; blob?: boolean;
};
// figure with time (blink): the draw closure captures t
const figureT = (cam: CamInfo, out: Stage, s: FigSpec, t: number) => {
  const d = cam.pos.distanceTo(tmp.set(s.x, s.y + 1.2, s.z));
  const [w, h, k] = tier(d / (s.scale ?? OUTFITS[s.who].scale));
  const lid = lidAt(t, s.seed, s.swaps);
  const key = `${s.who}|${poseKey(s.pose)}|${s.expr}|${lid}`;
  out.places.push({
    key, x: s.x, y: s.y, z: s.z, scale: s.scale ?? OUTFITS[s.who].scale, mirror: s.mirror,
    draw: (p) => stickFigure(p, s.who, s.pose, s.expr, lid, { baton: s.baton, flag: s.flag, sword: s.sword }),
    size: [w, h, k],
  });
  if (s.blob !== false) contactBlob(out, s.x, s.y, s.z, s.scale ?? OUTFITS[s.who].scale);
};

/** tight contact pool under a figure (multiply, blue-violet night shadow; no long tail — moon is high) */
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

/** Taro's rock: rises with strain shake, held, dropped when Jiro yanks him (shot 10) */
const rockAt = (f: number): { x: number; y: number; z: number; held: boolean } => {
  if (f < 729) return { x: 0.6, y: 0.12, z: 0.4, held: false };
  if (f < 770) { const u = smooth((f - 729) / 41); return { x: 0.6, y: 0.12 + 1.9 * u, z: 0.4, held: true }; }
  if (f < 798) return { x: 0.6 + 0.02 * Math.sin(f * 1.7), y: 2.02 + 0.02 * Math.sin(f * 2.3), z: 0.4, held: true };
  const n = f - 798, tl = Math.min(n / FPS, 0.55);
  return { x: 0.6 + 0.3 * tl, y: Math.max(0.12, 2.02 - 4.9 * tl * tl), z: 0.4, held: false };
};
const rockDraw = (p: Pen) => {
  p.poly([[60, 230], [90, 120], [180, 70], [250, 130], [240, 220], [150, 255]], "#8A8A92", 9);
  p.dot(130, 150, 9, "#6E6E76"); p.dot(190, 190, 7, "#6E6E76"); p.dot(110, 205, 6, "#9A9AA2");
};
const spearDraw = (p: Pen) => {
  p.band([[60, 590], [60, 90]], "#C9B184", 12, 4, "round");
  for (const y of [180, 300, 420]) p.stroke([[52, y], [68, y]], 4, "#8a7a5c");
  p.poly([[60, 90], [46, 30], [74, 30]], "#8d949c", 5);
};

// ---------------- staging ----------------
/** line of background men; x spread, shared z, shared pose/expr */
const menLine = (cam: CamInfo, out: Stage, t: number, xs: number[], z: number, pose: PoseDef, expr: ExprName, seed0 = 40, y = 0) =>
  xs.forEach((x, i) => figureT(cam, out, { who: "man", x, y, z: z + (hh(i, 3) - 0.5) * 0.3, pose, expr, seed: seed0 + i, mirror: i % 2 === 0 }, t));

export const stageThunder = (id: number, t: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  switch (id) {
    case 1: break; // bomb ECU: world carries the bomb + ember
    case 2:
      figureT(cam, out, { who: "jiro", x: -0.7, y: 0, z: -0.6, pose: blendPose(POSES.crouch, POSES.stop, smooth((f - 48) / 10)), expr: "urgent", seed: 1, swaps: [1.7], sword: true, baton: true }, t);
      break;
    case 3: {
      figureT(cam, out, { who: "jiro", x: -0.5, y: 0, z: -0.5, pose: POSES.pointAway, expr: "urgent", seed: 1, sword: true }, t);
      for (let i = 0; i < 4; i++) {
        const u = smooth((f - 90 - i * 3) / 34);
        const x = -1.6 + i * 0.9, z = lerp(-0.6, 3.6, u);
        figureT(cam, out, { who: "man", x, y: 0, z, pose: gait(walkPhase(t * 1.4 + i * 0.25), 70, 80, 8), expr: "plain", seed: 10 + i, mirror: i % 2 === 0 }, t);
        dust(out, f, 96 + i * 4, 10, x, z - 0.3, 0.7);
      }
      break;
    }
    case 4: break; // fleet aerial: world carries it
    case 5: {
      const u = smooth((f - 259) / 30);
      const tx = lerp(2.2, 0.6, u);
      const reach = smooth((f - 290) / 12);
      figureT(cam, out, { who: "taro", x: tx, y: 0, z: 0.4, pose: blendPose(gait(walkPhase(t * 1.2), 55, 60, 4), POSES.reachLeft, reach), expr: "grinning", seed: 2, swaps: [8.7] }, t);
      figureT(cam, out, { who: "jiro", x: -0.6, y: 0, z: -0.5, pose: POSES.crossArms, expr: "stern", seed: 1, sword: true }, t);
      out.fx.push({ key: "spear", cw: 120, ch: 600, draw: spearDraw, x: 1.3, y: 0, z: 0.8, w: 0.24, h: 1.2 });
      break;
    }
    case 6: {
      const grab = smooth((f - 340) / 6); // Jiro seizes the wrist ~11.3 s, 0.3 s hold beat
      figureT(cam, out, { who: "taro", x: 0.65, y: 0, z: -0.15, pose: blendPose(POSES.crouchReach, POSES.crouchReach, 1), expr: grab > 0.5 ? "sheepish" : "grinning", seed: 2, swaps: [11.3] }, t);
      figureT(cam, out, { who: "jiro", x: -0.65, y: 0, z: -0.35, pose: blendPose(POSES.crouch, POSES.grabWrist, grab), expr: "stern", seed: 1, sword: true }, t);
      break;
    }
    case 7: {
      figureT(cam, out, { who: "jiro", x: -0.6, y: 0, z: -0.5, pose: POSES.pointUp, expr: "stern", seed: 1, swaps: [12.9], sword: true, baton: true }, t);
      const sheep = smooth((f - 440) / 15);
      figureT(cam, out, { who: "taro", x: 0.6, y: 0, z: -0.3, pose: POSES.stand, expr: sheep > 0.5 ? "sheepish" : "scoffing", seed: 2, swaps: [14.6] }, t);
      out.fx.push({ key: "spear", cw: 120, ch: 600, draw: spearDraw, x: 1.5, y: 0, z: -0.2, w: 0.24, h: 1.2 });
      break;
    }
    case 8: {
      const u = smooth((f - 487) / 60);
      const r = lerp(2.6, 1.9, u);
      figureT(cam, out, { who: "jiro", x: -1.1, y: 0, z: -0.9, pose: POSES.crossArms, expr: "watchful", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: 1.2, y: 0, z: 0.5, pose: POSES.stand, expr: "grinning", seed: 2 }, t);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.6;
        figureT(cam, out, { who: "man", x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, pose: POSES.stand, expr: "plain", seed: 20 + i, mirror: i % 2 === 0 }, t);
      }
      break;
    }
    case 9: {
      // kick 1 at f648, kick 2 (harder) at f696: wind-up -> extend -> recover
      const kickPose = (f0: number, f1: number) => {
        if (f < f0 - 12) return POSES.stand;
        if (f < f0) return blendPose(POSES.stand, POSES.kickWind, (f - (f0 - 12)) / 12);
        if (f < f0 + 5) return POSES.kick;
        if (f < f1) return blendPose(POSES.kick, POSES.stand, smooth((f - (f0 + 5)) / 14));
        return POSES.stand;
      };
      const po = f < 672 ? kickPose(648, 672) : kickPose(696, 729);
      figureT(cam, out, { who: "taro", x: 0.55, y: 0, z: 0.3, pose: po, expr: "grinning", seed: 2, swaps: [21.6, 23.2] }, t);
      figureT(cam, out, { who: "jiro", x: -0.65, y: 0, z: -0.5, pose: POSES.crossArms, expr: "stern", seed: 1, sword: true }, t);
      menLine(cam, out, t, [-2.2, 2.2], -1.6, POSES.stand, "plain", 30);
      dust(out, f, 648, 16, 0.1, 0.1, 0.9);
      dust(out, f, 696, 20, 0.1, 0.1, 1.2);
      break;
    }
    case 10: {
      const liftU = smooth((f - 729) / 41), yank = smooth((f - 775) / 10), rec = smooth((f - 800) / 12);
      const po = yank < 1
        ? blendPose(POSES.stand, POSES.lift, liftU)
        : blendPose(POSES.stumble, POSES.stand, rec);
      const tx = 0.6 + yank * 0.55;
      figureT(cam, out, { who: "taro", x: tx, y: 0, z: 0.3, pose: po, expr: yank < 1 ? "grinning" : "sheepish", seed: 2, swaps: [25.9] }, t);
      figureT(cam, out, { who: "jiro", x: -0.7 + yank * 0.3, y: 0, z: -0.4, pose: yank < 1 ? POSES.stand : POSES.drag, expr: "urgent", seed: 1, sword: true }, t);
      const rk = rockAt(f);
      out.fx.push({ key: "rock", cw: 300, ch: 300, draw: rockDraw, x: rk.x, y: rk.y - 0.14, z: rk.z, w: 0.34, h: 0.34, rot: 0.15 });
      dust(out, f, 800, 18, 0.8, 0.4, 1.1);
      break;
    }
    case 11: {
      const x = lerp(-4, 1.5, smooth((f - 815) / 55));
      figureT(cam, out, { who: "aki", x, y: 0, z: 1.2, pose: gait(walkPhase(t * 1.6), 75, 90, 10), expr: "urgent", seed: 3, flag: true }, t);
      break;
    }
    case 12: {
      figureT(cam, out, { who: "aki", x: -0.35, y: 0, z: -0.3, pose: POSES.flagPoint, expr: "sharp", seed: 3, flag: true }, t);
      figureT(cam, out, { who: "jiro", x: 0.15, y: 0, z: -0.6, pose: POSES.leanIn, expr: "watchful", seed: 1, sword: true }, t);
      break;
    }
    case 13: break; // cord macro: world carries the cord + creeping ember
    case 14: {
      figureT(cam, out, { who: "jiro", x: -0.5, y: 0, z: -0.7, pose: POSES.crouch, expr: "watchful", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: 0.5, y: 0, z: -0.6, pose: POSES.crouchReach, expr: "awed", seed: 2 }, t);
      break;
    }
    case 15: {
      figureT(cam, out, { who: "jiro", x: 0, y: 0, z: -0.5, pose: POSES.hold, expr: "silent", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: 0.55, y: 0, z: -1.3, pose: POSES.stand, expr: "awed", seed: 2 }, t);
      menLine(cam, out, t, [-0.45], -1.4, POSES.stand, "plain", 34);
      break;
    }
    case 16: {
      const setU = smooth((f - 1282) / 23);
      figureT(cam, out, { who: "jiro", x: 0, y: 0, z: -0.4, pose: blendPose(POSES.hold, POSES.crouch, setU), expr: "silent", seed: 1, sword: true }, t);
      menLine(cam, out, t, [-1.3, -1.9], -1.7, POSES.leanIn, "plain", 36);
      figureT(cam, out, { who: "taro", x: -0.6, y: 0, z: -1.1, pose: POSES.leanIn, expr: "sheepish", seed: 2 }, t);
      break;
    }
    case 17: {
      if (f < 1386) break; // distant rock flash: world carries it
      const u = smooth((f - 1396) / 60);
      figureT(cam, out, { who: "man", x: lerp(3.2, 1.5, u), y: 0, z: lerp(1.5, 0.6, u), pose: gait(walkPhase(t * 0.9), 45, 40, 3), expr: "plain", seed: 44 }, t);
      figureT(cam, out, { who: "jiro", x: 0.2, y: 0, z: -0.8, pose: POSES.crossArms, expr: "watchful", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: -0.6, y: 0, z: -0.5, pose: POSES.stand, expr: "sheepish", seed: 2 }, t);
      break;
    }
    case 18: {
      const back = smooth((f - 1515) / 22); // the line steps back in unison ~50.5 s
      figureT(cam, out, { who: "jiro", x: -0.7, y: 0, z: -0.4, pose: POSES.stand, expr: "silent", seed: 1, sword: true, baton: true }, t);
      const zp = lerp(1.0, 1.5, back);
      figureT(cam, out, { who: "taro", x: 0.9, y: 0, z: zp, pose: back > 0.05 && back < 1 ? blendPose(POSES.stand, POSES.palmsUp, Math.sin(back * Math.PI)) : POSES.stand, expr: "sheepish", seed: 2 }, t);
      const arc: [number, number][] = [[-1.1, 0.9], [-0.4, 1.4], [0.3, 1.4], [1.0, 0.9]];
      arc.forEach(([ax, az], i) => figureT(cam, out, { who: "man", x: ax, y: 0, z: az + back * 0.5, pose: POSES.stand, expr: "plain", seed: 50 + i, mirror: i % 2 === 0 }, t));
      break;
    }
    case 19: {
      const flinch = blastAge(f) > 0 ? Math.exp(-blastAge(f) * 3) : 0;
      const fl = (base: PoseDef): PoseDef => ({ ...base, lean: base.lean - flinch * 10 });
      figureT(cam, out, { who: "jiro", x: -0.75, y: 0, z: 0.6, pose: fl(POSES.stand), expr: blastAge(f) > 0 ? "shock" : "silent", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: 0.75, y: 0, z: 0.6, pose: fl(POSES.palmsUp), expr: "awed", seed: 2 }, t);
      menLine(cam, out, t, [-0.9, 0.9], -0.6, fl(POSES.stand), "plain", 54);
      break;
    }
    case 20: {
      const dy = 1.15; // dune top
      figureT(cam, out, { who: "jiro", x: -0.75, y: dy, z: 9, pose: POSES.stand, expr: "silent", seed: 1, sword: true }, t);
      figureT(cam, out, { who: "taro", x: 0.3, y: dy, z: 9.2, pose: POSES.stand, expr: "relieved", seed: 2 }, t);
      figureT(cam, out, { who: "aki", x: 1.2, y: dy, z: 8.8, pose: POSES.flagPoint, expr: "relieved", seed: 3, flag: true }, t);
      break;
    }
  }
  return out;
};
