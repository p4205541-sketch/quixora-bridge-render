// The Manhole world: one persistent city street (road, sidewalks, brick blocks, bakery,
// parked cars, lamps, trees) with the hero manhole at origin, the drop-test rig, the
// hydraulic press and the Nashua triangle corner. Plain two-tone Lambert materials via
// bridge lam() + real day lights (LIGHTS.day) — no composer anywhere. Colours are
// on-screen targets under the current PBR-Neutral tone map (untone pre-inversion).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, prop, quad, Kit } from "../bridge/build";
import { ctex, rep, facadeHD, cloudHD } from "../bridge/paint";
import { LIGHTS, LOOK } from "../bridge/lights";
import { TONE, CHAR, untone } from "../bridge/shade";
import { NOINK } from "../bridge/ink";
import { Pool, Actor, Fx } from "../bridge/cast";
import { stageManhole } from "./cast";
import {
  FPS, SHOTS, V3, smooth, lerp, camAt,
  heroLidAt, squareLidAt, roundRigAt, pressPlateY,
  HERO, RIG_AT, PRESS_AT, TRI_AT, VENT_AT, LID_R,
} from "./story";

// ---------------- assets ----------------
const KENNEY: [string, string][] = [
  ["roads", "construction-barrier"], ["roads", "construction-cone"], ["roads", "construction-fence"],
  ["roads", "construction-light"], ["roads", "dumpster"], ["roads", "electricity-pole"],
  ["roads", "light-curved"], ["roads", "light-square"], ["roads", "road-bend-sidewalk"],
  ["roads", "road-crossing"], ["roads", "road-intersection"], ["roads", "road-side-barrier"],
  ["roads", "road-side"], ["roads", "road-sign-empty"], ["roads", "road-sign-object-stop"], ["roads", "road-straight"],
  ["suburban", "building-type-a"], ["suburban", "building-type-c"], ["suburban", "building-type-f"],
  ["suburban", "building-type-h"], ["suburban", "driveway-short"], ["suburban", "fence"],
  ["suburban", "planter"], ["suburban", "tree-large"], ["suburban", "tree-small"],
  ["car", "cone"], ["car", "delivery"], ["car", "sedan"], ["car", "taxi"], ["car", "van"],
  ["nature", "flower_yellowA"], ["nature", "grass"], ["nature", "grass_large"],
  ["nature", "plant_bushDetailed"], ["nature", "plant_bushLarge"], ["nature", "tree_default"],
  ["nature", "tree_detailed"], ["nature", "tree_oak"], ["nature", "tree_pineDefaultA"],
  ["nature", "tree_pineRoundA"], ["nature", "tree_simple"],
];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map(([k, n]) => loader.loadAsync(staticFile(`manhole/kenney/${k}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- painted textures ----------------
const asphaltTex = () => ctex("mhAsphalt2", 1024, 1024, (g, r) => {
  g.fillStyle = "#3a3a3e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 14; i++) { // patches
    const x = r() * 1024, y = r() * 1024, w = 80 + r() * 200, h = 50 + r() * 120;
    g.fillStyle = "rgba(28,28,32,0.35)"; g.fillRect(x, y, w, h);
  }
  for (let i = 0; i < 9; i++) { // cracks
    g.strokeStyle = "rgba(15,15,18,0.6)"; g.lineWidth = 2;
    g.beginPath(); let x = r() * 1024, y = r() * 1024; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 90; y += (r() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }
  for (const z of [300, 724]) { // faint tyre wear bands
    g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, z, 1024, 90);
  }
});
const concreteTex = () => ctex("mhConcrete2", 512, 512, (g, r) => {
  g.fillStyle = "#9a9a94"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(60,60,58,0.55)"; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
});
const awningTex = () => ctex("mhAwning", 256, 128, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f2e6c8" : "#c23b2e"; g.fillRect(i * 32, 0, 32, 128); }
  g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, 112, 256, 16);
});
const bakeryTex = () => ctex("mhBakery", 512, 128, (g) => {
  g.fillStyle = "#3a2a1c"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#f2e6c8"; g.font = "bold 64px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("BAKERY", 256, 64);
  g.fillStyle = "#d9a441"; g.beginPath(); g.arc(52, 64, 22, 0, Math.PI * 2); g.fill();
});

// ---------------- world ----------------
type Mats = Record<string, THREE.Material>;
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

/** one round iron cover: cylinder + 2 ridge rings + 2 handle slots (static, merged into a group) */
const coverGroup = (r: number, detail: boolean) => {
  const g = new THREE.Group();
  const iron = lam("mhIron", () => ({ color: "#2b2b2e" }));
  const ironLight = lam("mhIronLight", () => ({ color: "#3d3d42" }));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 28), iron);
  disc.position.y = 0.025; disc.castShadow = true; disc.receiveShadow = true;
  g.add(disc);
  for (const rr of [r * 0.78, r * 0.5]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.012, 6, 28), ironLight);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.052; g.add(ring);
  }
  if (detail) {
    for (const s of [-1, 1]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.03), lam("mhHole", () => ({ color: "#0a0a0a" })));
      slot.position.set(s * 0.16, 0.052, 0); g.add(slot);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 16), ironLight);
    hub.position.y = 0.027; g.add(hub);
  }
  return g;
};

export class ManholeWorld {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#b8d0ec", 25, 300);
  private clouds: THREE.Mesh[] = [];
  private sunCache = new Map<number, THREE.Vector3>();
  private heroLid: THREE.Group; private heroTilt: THREE.Group; private heroMesh: THREE.Group;
  private squareLid: THREE.Group;
  private roundRigLid: THREE.Group;
  private pressPlate: THREE.Mesh; private pressPiston: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    const L = LIGHTS.day, K = LOOK.day;
    // ---- sky + lights ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemiI);
    this.sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0); // not used by the two-tone shading
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    // clouds
    const cloudT = cloudHD(1);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(36 + hh(i, 3) * 20, 9),
        new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.55, depthWrite: false, fog: false, color: "#fbf8f1" }));
      m.position.set(-60 + i * 28 + hh(i, 4) * 15, 58 + (i % 3) * 12, -70 - hh(i, 5) * 40);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    // ---- ground: road + sidewalks + markings (code-painted) ----
    const b = new Batch();
    const asphalt = lam("mhAsphalt2", () => ({ map: rep(asphaltTex(), 12, 1) }));
    const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 7.2), asphalt);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, 0); road.receiveShadow = true; R.add(road);
    const concrete = lam("mhConcrete2", () => ({ map: rep(concreteTex(), 12, 1) }));
    for (const s of [1, -1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(90, 0.12, 3.0), concrete);
      walk.position.set(0, 0.06, s * 5.1); walk.receiveShadow = true; R.add(walk);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(90, 0.14, 0.18), lam("mhCurb", () => ({ color: "#8a8a86" })));
      curb.position.set(0, 0.07, s * 3.68); curb.receiveShadow = true; R.add(curb);
    }
    // centre line (yellow dashes) + lane lines + zebra crossing
    const yellow = lam("mhYellow", () => ({ color: "#d8b13a" }));
    const white = lam("mhWhite", () => ({ color: "#e8e8e8" }));
    for (let x = -44; x < 45; x += 3) b.add(quad(V(x, 0.012, -0.06), V(x + 2, 0.012, -0.06), V(x + 2, 0.012, 0.06), V(x, 0.012, 0.06)), yellow);
    for (const s of [1, -1]) b.add(quad(V(-45, 0.012, s * 1.8 - 0.05), V(45, 0.012, s * 1.8 - 0.05), V(45, 0.012, s * 1.8 + 0.05), V(-45, 0.012, s * 1.8 + 0.05)), white);
    for (let i = 0; i < 8; i++) {
      const x = -20 + i * 1.1;
      b.add(quad(V(x, 0.012, -3.2), V(x + 0.55, 0.012, -3.2), V(x + 0.55, 0.012, 3.2), V(x, 0.012, 3.2)), white);
    }

    // ---- buildings: north brick blocks (code-built) + south Kenney houses ----
    const block = (cx: number, w: number, h: number, wall: string, si: number) => {
      const zF = 8.5, zB = 14.5, d = zB - zF;
      const body = lam("mhWall" + wall, () => ({ color: wall }));
      b.add(boxGeo(V(cx - w / 2, 0, zF), V(cx + w / 2, h, zB), 0), body);
      const front = lam(`mhFac${si}`, () => ({ map: facadeHD(`mhN${si}_${w}_${h}`, w, h, { wall, shutter: "#2f5f6a", brick: true, door: true }) }));
      b.add(quad(V(cx + w / 2, 0, zF), V(cx - w / 2, 0, zF), V(cx - w / 2, h, zF), V(cx + w / 2, h, zF)), front);
      const cap = lam("mhRoof", () => ({ color: "#5a5a60" }));
      b.add(boxGeo(V(cx - w / 2 - 0.2, h, zF - 0.2), V(cx + w / 2 + 0.2, h + 0.35, zB + 0.2), 0), cap);
      b.add(boxGeo(V(cx + w * 0.3, h + 0.35, zF + 1), V(cx + w * 0.3 + 0.8, h + 1.6, zF + 1.8), 0), lam("mhChim", () => ({ color: "#a85a44" })));
    };
    block(-24, 12, 9, "#c47a5c", 1);
    block(-9, 12, 11, "#d8a95f", 2);
    block(7, 12, 9, "#cc9a6c", 3);
    block(22, 12, 10, "#e2c49a", 4);
    // south code blocks between the Kenney houses
    const blockS = (cx: number, w: number, h: number, wall: string, si: number) => {
      const zF = -8.5, zB = -14.5;
      b.add(boxGeo(V(cx - w / 2, 0, zB), V(cx + w / 2, h, zF), 0), lam("mhWallS" + wall, () => ({ color: wall })));
      const front = lam(`mhFacS${si}`, () => ({ map: facadeHD(`mhS${si}_${w}_${h}`, w, h, { wall, shutter: "#3f6fb5", brick: true, door: true }) }));
      b.add(quad(V(cx - w / 2, 0, zF), V(cx + w / 2, 0, zF), V(cx + w / 2, h, zF), V(cx - w / 2, h, zF)), front);
      b.add(boxGeo(V(cx - w / 2 - 0.2, h, zB - 0.2), V(cx + w / 2 + 0.2, h + 0.35, zF + 0.2), 0), lam("mhRoof", () => ({ color: "#5a5a60" })));
    };
    blockS(-16, 8, 8, "#c47a5c", 5);
    blockS(17, 8, 9, "#d8a95f", 6);
    // bakery shop front (ground floor of the x=7 block): glass + awning + sign
    const glass = lam("mhGlass", () => ({ color: "#1c2836" }));
    b.add(quad(V(11, 0.3, 8.5), V(3, 0.3, 8.5), V(3, 2.6, 8.5), V(11, 2.6, 8.5)), glass);
    const awn = lam("mhAwning", () => ({ map: awningTex(), side: THREE.DoubleSide }));
    b.add(quad(V(3, 3.1, 8.5), V(11, 3.1, 8.5), V(11, 2.7, 7.3), V(3, 2.7, 7.3)), awn);
    const sign = lam("mhBakerySign", () => ({ map: bakeryTex() }));
    b.add(quad(V(11, 3.3, 8.5), V(3, 3.3, 8.5), V(3, 4.1, 8.5), V(11, 4.1, 8.5)), sign);
    // south Kenney houses
    prop(b, kit, "building-type-a", -25, 0, -11, 5, 0);
    prop(b, kit, "building-type-c", -8, 0, -11, 5.5, 0.2);
    prop(b, kit, "building-type-f", 8, 0, -11, 5, -0.2);
    prop(b, kit, "building-type-h", 25, 0, -11, 5.5, 0);

    // ---- street props (Kenney) ----
    for (const [x, z, yaw] of [[-20, 4.4, 0], [-5, -4.4, Math.PI], [10, 5.8, 0], [25, -4.4, Math.PI]] as const)
      prop(b, kit, "light-curved", x, 0, z, 4.5, yaw); // x=10 lamp moved to z=5.8: clear of the S16 sightline to Milo
    prop(b, kit, "light-square", -35, 0, 4.4, 4.2, 0);
    prop(b, kit, "light-square", 35, 0, -4.4, 4.2, Math.PI);
    for (const x of [-30, 0, 30]) prop(b, kit, "electricity-pole", x, 0, -4.4, 6, 0);
    prop(b, kit, "dumpster", 18, 0.12, 4.8, 1.3, 0.3); // east of the press camera (clear of the S16 frame)
    prop(b, kit, "construction-barrier", 1.5, 0.12, 4.0, 0.9, 0.2);
    prop(b, kit, "construction-barrier", 6.5, 0.12, 4.0, 0.9, -0.2);
    prop(b, kit, "construction-cone", 2.5, 0.12, 4.3, 0.5, 0);
    prop(b, kit, "construction-cone", 5.5, 0.12, 4.3, 0.5, 0);
    prop(b, kit, "construction-light", 6.8, 0.12, 4.6, 1.1, -0.4);
    prop(b, kit, "road-sign-object-stop", -18.5, 0.12, 4.4, 2.2, 0.3);
    prop(b, kit, "planter", -15, 0.12, 5.8, 0.7, 0);
    prop(b, kit, "planter", 15, 0.12, 5.8, 0.7, 0);
    // trees along both sidewalks (cartoon veg via prop's VEG path)
    for (const [x, z, n] of [[-35, 5.8, "tree_oak"], [-25, -5.8, "tree_default"], [-15, 5.8, "tree_detailed"], [15, -5.8, "tree_oak"], [25, 5.8, "tree_pineRoundA"], [35, -5.8, "tree_default"], [-8, -5.8, "plant_bushDetailed"], [8, 5.8, "plant_bushLarge"], [-32, -5.8, "tree_simple"], [32, 5.8, "tree_pineDefaultA"]] as const)
      prop(b, kit, n, x, 0.12, z, n.startsWith("plant") ? 1.1 : 3.2 + hh(x, 7) * 1.2, hh(x, 8) * 3);
    // parked cars (static, merged)
    prop(b, kit, "sedan", -12, 0, 2.4, 1.5, 0);
    prop(b, kit, "taxi", 10, 0, -2.4, 1.5, Math.PI);
    prop(b, kit, "van", 20, 0, 2.4, 1.6, 0);
    prop(b, kit, "delivery", -38, 0, -2.4, 1.8, Math.PI); // west of the Nashua corner (clear of the triangle sightline)

    // ---- code-built props: traffic lights, hydrant, bins, vent grate ----
    const ironDark = lam("mhIronDark", () => ({ color: "#3a3a40" }));
    const hydrantRed = lam("mhHydrant", () => ({ color: "#c23b2e" }));
    for (const [x, z, yaw] of [[-18, 4.4, 0], [18, -4.4, Math.PI]] as const) {
      b.add(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8).translate(x, 1.6, z), ironDark);
      const head = boxGeo(V(x - 0.16, 2.9, z - 0.14), V(x + 0.16, 3.8, z + 0.14), 0);
      b.add(head, ironDark);
      for (const [dy, col] of [[3.62, "#c23b2e"], [3.35, "#d9a441"], [3.08, "#4a9142"]] as const) {
        const lens = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12);
        lens.rotateX(Math.PI / 2);
        const m = new THREE.Matrix4().makeTranslation(x, dy, z + (yaw === 0 ? -0.15 : 0.15));
        b.add(lens, lam("mhLens" + col, () => ({ color: col })), m);
      }
    }
    // fire hydrant at (-8, 4.4)
    b.add(new THREE.CylinderGeometry(0.13, 0.15, 0.55, 10).translate(-8, 0.4, 4.4), hydrantRed);
    b.add(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(-8, 0.67, 4.4), hydrantRed);
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateZ(Math.PI / 2).translate(-8 + s * 0.16, 0.45, 4.4), hydrantRed);
    // trash bins beside the dumpster
    for (const [x, col] of [[16, "#3f6fb5"], [16.9, "#5a5a60"]] as const) {
      b.add(new THREE.CylinderGeometry(0.28, 0.24, 0.7, 10).translate(x, 0.47, 4.8), lam("mhBin" + col, () => ({ color: col })));
      b.add(boxGeo(V(x - 0.3, 0.82, 4.5), V(x + 0.3, 0.88, 5.1), 0), lam("mhBinLid" + col, () => ({ color: "#2b2b2e" })));
    }
    // steam vent grate at (-6, -1.5)
    b.add(boxGeo(V(-6.45, 0, -1.8), V(-5.55, 0.05, -1.2), 0), lam("mhGrate", () => ({ color: "#1c1c20" })));
    for (let i = 0; i < 4; i++) b.add(boxGeo(V(-6.4, 0.05, -1.72 + i * 0.15), V(-5.6, 0.07, -1.64 + i * 0.15), 0), ironDark);
    b.build(R);

    // ---- static manhole covers (hero is animated separately) ----
    for (const [x, z] of [[-20, 1.2], [-8, -1.2], [12, 1.2], [24, -1.2], [-30, 0.8], [-35, -1.0], [35, 1.0], [-14, 1.0], [18, -1.0]] as const) {
      const c = coverGroup(LID_R, false);
      c.position.set(x, 0, z); R.add(c);
    }
    // dark hole under the hero lid (visible while it is lifted)
    const hole = new THREE.Mesh(new THREE.CircleGeometry(LID_R + 0.02, 28), lam("mhHole", () => ({ color: "#0a0a0a" })));
    hole.rotation.x = -Math.PI / 2; hole.position.set(HERO[0], 0.006, HERO[2]); R.add(hole);

    // ---- hero lid (animated): group(yaw) -> tilt group -> lid mesh (spin) ----
    this.heroLid = new THREE.Group();
    this.heroTilt = new THREE.Group();
    this.heroMesh = coverGroup(LID_R, true);
    this.heroTilt.add(this.heroMesh);
    this.heroLid.add(this.heroTilt);
    R.add(this.heroLid);

    // ---- drop-test rig (transparent frame, open centre) ----
    const rig = new THREE.Group();
    const rigMat = lam("mhRig", () => ({ color: "#8a7a5c" }));
    const rigIron = lam("mhRigIron", () => ({ color: "#5a5e66" }));
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), rigMat);
      leg.position.set(dx, 0.25, dz); leg.castShadow = true; rig.add(leg);
    }
    for (const [w, d, x, z] of [[1.4, 0.12, 0, -0.64], [1.4, 0.12, 0, 0.64], [0.12, 1.16, -0.64, 0], [0.12, 1.16, 0.64, 0]] as const) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), rigIron);
      bar.position.set(x, 0.62, z); bar.castShadow = true; rig.add(bar);
    }
    // round-lid shelf on the rig's east side
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), rigMat);
    shelf.position.set(0.95, 0.42, 0); shelf.castShadow = true; rig.add(shelf);
    rig.position.set(RIG_AT[0], RIG_AT[1], RIG_AT[2]);
    R.add(rig);
    // square demo lid (animated: turn + drop) — diagonal ridge + corner dots on BOTH faces so it
    // reads as a lid, not a blank board, from either side when turned on edge
    this.squareLid = new THREE.Group();
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.68), lam("mhIron", () => ({ color: "#2b2b2e" })));
    sq.castShadow = true;
    const sqFaceMat = lam("mhIronMid", () => ({ color: "#55555e" }));
    for (const sign of [1, -1]) {
      const sqRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 6, 4), lam("mhIronLight", () => ({ color: "#3d3d42" })));
      sqRing.rotation.x = (Math.PI / 2) * sign; sqRing.rotation.z = Math.PI / 4; sqRing.position.y = 0.022 * sign; sq.add(sqRing);
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.014, 0.06), sqFaceMat);
      ridge.rotation.y = Math.PI / 4; ridge.position.y = 0.021 * sign; sq.add(ridge);
      for (const [cx, cz] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]] as const) {
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 10), sqFaceMat);
        dot.position.set(cx, 0.021 * sign, cz); sq.add(dot);
      }
    }
    this.squareLid.add(sq);
    R.add(this.squareLid);
    // round demo lid on the shelf (animated: spin)
    this.roundRigLid = coverGroup(LID_R, true);
    R.add(this.roundRigLid);

    // ---- hydraulic press ----
    const press = new THREE.Group();
    const pressMat = lam("mhPress", () => ({ color: "#c9a227" }));
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.1), pressMat);
    base.position.y = 0.05; base.castShadow = true; press.add(base);
    const pressSteel = lam("mhPressSteel", () => ({ color: "#5a5e66" }));
    for (const dx of [-0.45, 0.45]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), pressSteel);
      col.position.set(dx, 0.95, 0); col.castShadow = true; press.add(col);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.2), pressMat);
    beam.position.y = 1.9; beam.castShadow = true; press.add(beam);
    const pressCover = coverGroup(LID_R, false);
    pressCover.position.y = 0.1; press.add(pressCover);
    press.position.set(PRESS_AT[0], PRESS_AT[1], PRESS_AT[2]);
    R.add(press);
    this.pressPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), lam("mhPressPlate", () => ({ color: "#3a3a40" })));
    this.pressPlate.castShadow = true;
    R.add(this.pressPlate);
    this.pressPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 10), lam("mhPressPlate", () => ({ color: "#3a3a40" })));
    R.add(this.pressPiston);

    // ---- Nashua triangle covers (0.08 thick, lighter iron + thin light rim so they read on the road) ----
    for (const [x, z, yaw] of [[-28, -1.8, 0.3], [-29.5, -0.8, 1.1], [-30.5, -1.0, 2.0]] as const) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.42); shape.lineTo(0.4, -0.3); shape.lineTo(-0.4, -0.3); shape.closePath();
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }),
        lam("mhTriRim", () => ({ color: "#b9b9c0" })));
      rim.rotation.x = -Math.PI / 2; rim.rotation.z = yaw; rim.scale.set(1.3, 1.3, 1); rim.position.set(x, 0.04, z);
      rim.castShadow = true; rim.receiveShadow = true; R.add(rim);
      const tri = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }),
        lam("mhTriIron", () => ({ color: "#6a6a72" })));
      tri.rotation.x = -Math.PI / 2; tri.rotation.z = yaw; tri.position.set(x, 0.04, z);
      tri.castShadow = true; tri.receiveShadow = true; R.add(tri);
    }
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** camera-relative sun, frozen per shot (mean forward axis of the shot, LIGHTS.day az/el) */
  private shotSun(id: number) {
    let v = this.sunCache.get(id);
    if (v) return v;
    const s = SHOTS[id - 1];
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(LIGHTS.day.az), el = THREE.MathUtils.degToRad(LIGHTS.day.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS.day, K = LOOK.day;
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig (day): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const sunDir = this.shotSun(id);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    // manhole-local: LIGHTS.day shade/lift are blue-heavy and the lift term dominates on dark
    // asphalt, so building shadows read as a blue wash on the road. Neutralise the shade tint
    // (lit surfaces untouched; shadows stay visible, just grey instead of blue).
    TONE.uShadeCol.value.set(0.31, 0.30, 0.32); TONE.uShadeLift.value.set(0.07, 0.07, 0.08);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...LOOK.day.bounce); TONE.uSat.value = LOOK.day.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    this.clouds.forEach((m, i) => {
      m.position.x = -60 + i * 28 + ((t * 0.4 + i * 17) % 40);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
    });
    // ---- animated props ----
    const hl = heroLidAt(f);
    const rolling = f >= 967 && f < 1120;
    this.heroLid.position.set(hl.x, hl.y, hl.z);
    this.heroLid.rotation.y = rolling ? Math.atan2(-3.65, -4.45) : 0.6;
    this.heroTilt.rotation.z = -hl.tilt;
    this.heroMesh.rotation.y = hl.roll;
    const sq = squareLidAt(f);
    this.squareLid.visible = sq.visible;
    this.squareLid.position.set(RIG_AT[0], RIG_AT[1] + sq.y, RIG_AT[2]);
    this.squareLid.rotation.x = sq.angle;
    const rr = roundRigAt(f);
    this.roundRigLid.visible = rr.visible;
    this.roundRigLid.position.set(RIG_AT[0] + 0.95, RIG_AT[1] + 0.47, RIG_AT[2]);
    this.roundRigLid.rotation.y = rr.spin;
    const py = pressPlateY(f);
    this.pressPlate.position.set(PRESS_AT[0], PRESS_AT[1] + py, PRESS_AT[2]);
    this.pressPiston.position.set(PRESS_AT[0], PRESS_AT[1] + (1.9 + py) / 2, PRESS_AT[2]);
    this.pressPiston.scale.y = Math.max(0.05, 1.9 - py);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stageManhole(id, t, f, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = false;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
