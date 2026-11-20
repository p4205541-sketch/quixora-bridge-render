// The Burglar world: one persistent suburban house (exterior + living room + kitchen +
// hallway + bathroom corner) with the front door at origin, the neighbour's house across
// the street, and the kitchen sink cabinet. Plain two-tone Lambert materials via
// bridge lam() + real day/night lights — no composer anywhere. Day shots use LIGHTS.day;
// night shots use the NIGHT preset below (saturated blue moonlight + warm lamp glow).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function).
// MANHOLE LESSONS APPLIED: no speckles in any canvas texture (they alias into a blink);
// ground covers EVERYTHING (lawn plane under the whole set, floors under every room) so
// no bare gap can show sky through; props are code-built or Kenney furniture GLBs.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, boxGeo, V, lam, prop, quad, Kit } from "../bridge/build";
import { ctex, rep, cloudHD } from "../bridge/paint";
import { LIGHTS, LOOK, LightPreset } from "../bridge/lights";
import { TONE, CHAR, untone } from "../bridge/shade";
import { NOINK } from "../bridge/ink";
import { Pool, Actor, Fx } from "../bridge/cast";
import { stageBurglar } from "./cast";
import {
  FPS, SHOTS, V3, smooth, lerp, camAt, isNight,
  doorAngle, oilDropY, bulbGlow, flashTarget,
  DOOR_AT, HINGE_AT, COUCH_AT, TABLE_AT, SINK_AT, PAINT_AT, BULB_AT, TOOLBOX_AT,
} from "./story";

// ---------------- night preset (same shape as LightPreset; saturated blue moonlight) ----------------
const NIGHT: LightPreset = {
  az: 200, el: 35,
  lit: [0.32, 0.38, 0.68], shade: [0.1, 0.12, 0.26], lift: [0.03, 0.04, 0.09], lambert: 0.35, sideK: 0.84, term: 0.2,
  charTint: [0.85, 0.88, 1.0], charShade: 0.8, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.85, 0.87, 1.0],
  blob: [0.3, 0.32, 0.45], actorShadow: false,
  top: "#0a1230", hor: "#1a2a6b", skyCurve: [0.0, 0.5, 0.6], fog: "#16224d", fogNear: 25, fogFar: 300, sunDisc: "#e8ecff",
  sunCol: "#8fa8ff", sunI: 0.9, sky: "#2a3a6b", ground: "#1c2440", hemiI: 0.35,
  bias: -0.00025, normalBias: 0.015,
};
const NIGHT_SKY = { c: ["#060a1e", "#0d1533", "#1a2a6b", "#24377d", "#2c448f"], e: [-10, 5, 20, 45, 90] };

// ---------------- assets ----------------
const KENNEY: [string, string][] = [
  ["furniture", "loungeSofa"], ["furniture", "loungeSofaLong"], ["furniture", "table"],
  ["furniture", "chair"], ["furniture", "kitchenFridge"], ["furniture", "kitchenSink"],
  ["furniture", "kitchenStove"], ["furniture", "kitchenCabinet"], ["furniture", "lampRoundFloor"],
  ["furniture", "lampRoundTable"], ["furniture", "sideTable"], ["furniture", "bookcaseOpen"],
  ["furniture", "cabinetTelevision"], ["furniture", "televisionModern"], ["furniture", "tableCoffee"],
  ["furniture", "rugRectangle"], ["furniture", "bedSingle"], ["furniture", "bathroomSink"],
  ["furniture", "doorway"], ["furniture", "coatRack"], ["furniture", "pottedPlant"],
  ["furniture", "plantSmall1"],
  ["suburban", "building-type-a"], ["suburban", "building-type-c"],
  ["nature", "tree_simple"], ["nature", "plant_bushDetailed"], ["nature", "grass"],
];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map(([k, n]) => loader.loadAsync(staticFile(`burglar/kenney/${k}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- painted textures (NO speckles — they alias into a blink) ----------------
const woodTex = () => ctex("bgWood", 512, 512, (g) => {
  g.fillStyle = "#b98a5a"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(90,60,30,0.5)"; g.lineWidth = 3;
  for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.fillStyle = "rgba(255,220,170,0.10)";
  for (let i = 0; i < 6; i++) g.fillRect(0, i * 86 + 10, 512, 22);
});
const tileTex = () => ctex("bgTile", 512, 512, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? "#2f7f7a" : "#eef4f2"; g.fillRect(x * 128, y * 128, 128, 128);
  }
});
const lawnTex = () => ctex("bgLawn", 512, 512, (g) => {
  g.fillStyle = "#6a9a4e"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 10; i++) { // large soft patches only, no speckles
    g.fillStyle = "rgba(40,90,30,0.18)";
    g.beginPath(); g.ellipse((i * 97) % 512, (i * 61) % 512, 60 + (i % 3) * 30, 40 + (i % 2) * 20, 0, 0, Math.PI * 2); g.fill();
  }
});
const paintTex = () => ctex("bgPainting", 256, 192, (g) => {
  g.fillStyle = "#f2e6c8"; g.fillRect(0, 0, 256, 192); // frame mat
  g.fillStyle = "#7fb2d9"; g.fillRect(16, 16, 224, 110); // sky
  g.fillStyle = "#e8d27a"; g.beginPath(); g.arc(200, 50, 22, 0, Math.PI * 2); g.fill(); // sun
  g.fillStyle = "#5a8a4e"; g.fillRect(16, 100, 224, 26); // hills
  g.fillStyle = "#8a5a3c"; g.fillRect(16, 126, 224, 50); // field
});
const plateTex = (txt: string) => ctex("bgPlate" + txt, 128, 96, (g) => {
  g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, 128, 96);
  g.fillStyle = "#1c1c20"; g.font = "bold 64px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(txt, 64, 50);
});

// ---------------- world ----------------
type Mats = Record<string, THREE.Material>;
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export class BurglarWorld {
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
  private door: THREE.Group;
  private doorGlass: THREE.Mesh;
  private winGlass: THREE.Mesh[] = [];
  private oilDrop: THREE.Mesh;
  private toolbox: THREE.Group;
  private note: THREE.Mesh;
  private flash: THREE.SpotLight;
  private flashCone: THREE.Mesh;
  private lampLights: THREE.PointLight[] = [];
  private bulbLight: THREE.PointLight;
  private bulbMesh: THREE.Mesh;
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
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    // clouds
    const cloudT = cloudHD(1);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(36 + hh(i, 3) * 20, 9),
        new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.55, depthWrite: false, fog: false, color: "#fbf8f1" }));
      m.position.set(-60 + i * 28 + hh(i, 4) * 15, 58 + (i % 3) * 12, -70 - hh(i, 5) * 40);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    // night lamp point lights (intensity set per shot in update)
    for (const [x, y, z] of [[-3.5, 1.7, 3.6], [4.2, 2.3, 2.4], [1, 2.5, 6.0]] as const) {
      const pl = new THREE.PointLight("#ffb45e", 0, 9, 2);
      pl.position.set(x, y, z); R.add(pl); this.lampLights.push(pl);
    }
    // flashlight spotlight (shots 11-12)
    this.flash = new THREE.SpotLight("#fff2cc", 0, 14, 0.32, 0.5, 1.6);
    R.add(this.flash, this.flash.target);
    this.flashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: "#fff2cc", transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.flashCone.layers.set(NOINK); R.add(this.flashCone);
    // bathroom bulb light (shot 6)
    this.bulbLight = new THREE.PointLight("#ffd9a0", 0, 6, 2);
    this.bulbLight.position.set(BULB_AT[0], BULB_AT[1], BULB_AT[2]); R.add(this.bulbLight);

    const b = new Batch();
    // ---- ground: lawn everywhere (no bare gaps) + street + path ----
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), lam("bgLawn", () => ({ map: rep(lawnTex(), 8, 8) })));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -2); lawn.receiveShadow = true; R.add(lawn);
    const asphalt = lam("bgAsphalt", () => ({ color: "#3a3a3e" }));
    const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 5), asphalt);
    street.rotation.x = -Math.PI / 2; street.position.set(0, 0.01, -8.5); street.receiveShadow = true; R.add(street);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(120, 0.1, 1.6), lam("bgWalk", () => ({ color: "#9a9a94" })));
    walk.position.set(0, 0.05, -5.8); walk.receiveShadow = true; R.add(walk);
    for (let i = 0; i < 5; i++) { // stepping stones door -> street
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.7), lam("bgStone", () => ({ color: "#b8b8b0" })));
      st.position.set(0, 0.04, -1.2 - i * 1.0); st.receiveShadow = true; R.add(st);
    }

    // ---- house shell: sage-green walls, pitched roof (castShadow OFF so sun reaches interiors) ----
    const wallCol = "#8fa98a", trimCol = "#f2e6c8";
    const wall = lam("bgWall", () => ({ color: wallCol }));
    const trim = lam("bgTrim", () => ({ color: trimCol }));
    // front wall z=0: segments around the door (x -0.45..0.45, y 0..2.2) and two windows
    // (win1 x 1.8..3.4, win2 x -3.3..-1.7, both y 1.1..2.1) — sills + headers, no bare holes
    b.add(boxGeo(V(-4, 0, -0.15), V(-3.3, 3.2, 0.15), 0), wall);
    b.add(boxGeo(V(-3.3, 0, -0.15), V(-1.7, 1.1, 0.15), 0), wall);
    b.add(boxGeo(V(-3.3, 2.1, -0.15), V(-1.7, 3.2, 0.15), 0), wall);
    b.add(boxGeo(V(-1.7, 0, -0.15), V(-0.45, 3.2, 0.15), 0), wall);
    b.add(boxGeo(V(-0.45, 2.2, -0.15), V(0.45, 3.2, 0.15), 0), wall); // lintel over door
    b.add(boxGeo(V(0.45, 0, -0.15), V(1.8, 3.2, 0.15), 0), wall);
    b.add(boxGeo(V(1.8, 0, -0.15), V(3.4, 1.1, 0.15), 0), wall);
    b.add(boxGeo(V(1.8, 2.1, -0.15), V(3.4, 3.2, 0.15), 0), wall);
    b.add(boxGeo(V(3.4, 0, -0.15), V(6, 3.2, 0.15), 0), wall);
    // back wall z=7, side walls x=-4 / x=6 (left wall has a window opening z 2.8..4.2, y 1.1..2.1)
    b.add(boxGeo(V(-4, 0, 6.85), V(6, 3.2, 7.15), 0), wall);
    b.add(boxGeo(V(-4.15, 0, 0), V(-3.85, 3.2, 2.8), 0), wall);
    b.add(boxGeo(V(-4.15, 0, 2.8), V(-3.85, 1.1, 4.2), 0), wall);
    b.add(boxGeo(V(-4.15, 2.1, 2.8), V(-3.85, 3.2, 4.2), 0), wall);
    b.add(boxGeo(V(-4.15, 0, 4.2), V(-3.85, 3.2, 7), 0), wall);
    b.add(boxGeo(V(5.85, 0, 0), V(6.15, 3.2, 7), 0), wall);
    // living room / kitchen partition x=2 (doorway gap z 2.2..3.4 — the 4->5 glide passes through it)
    b.add(boxGeo(V(2, 0, -0.15), V(2.15, 3.2, 2.2), 0), wall);
    b.add(boxGeo(V(2, 0, 3.4), V(2.15, 3.2, 5), 0), wall);
    // hallway wall z=5 (doorway gaps x -1.2..0.2 living->hall, x 4.6..5.6 kitchen->bathroom)
    b.add(boxGeo(V(-4, 0, 4.85), V(-1.2, 3.2, 5.15), 0), wall);
    b.add(boxGeo(V(0.2, 0, 4.85), V(4.6, 3.2, 5.15), 0), wall);
    b.add(boxGeo(V(5.6, 0, 4.85), V(6, 3.2, 5.15), 0), wall);
    // NO bathroom partition: the bathroom is an open alcove off the hallway, so the shot-6 pan
    // (painting -> bulb) and dad's walk (x 2.0 -> 5.2 at z 5.8) have a clear line of sight.
    // pitched roof: two slopes + gable triangles (castShadow OFF — sun reaches interiors)
    // The ridge runs north-south along x=1 (apex y=5.0, eaves y=3.2 at x=-4 and x=6), so the
    // slopes descend EAST-WEST (rotation about Z). The old boxes were rotated about X and
    // formed a VALLEY (high at the front/back edges, low in the middle) — wrong vs the gables.
    const roofMat = lam("bgRoof", () => ({ color: "#7a4a3c" }));
    const slopeW = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 7.4), roofMat);
    slopeW.position.set(-1.5, 4.1, 3.5); slopeW.rotation.z = 0.346; R.add(slopeW);
    const slopeE = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 7.4), roofMat);
    slopeE.position.set(3.5, 4.1, 3.5); slopeE.rotation.z = -0.346; R.add(slopeE);
    // gable triangles (extruded): front/back walls above 3.2m up to the ridge 5.0m
    const gableMat = lam("bgGable", () => ({ color: wallCol }));
    for (const z of [0, 7]) {
      const shape = new THREE.Shape();
      shape.moveTo(-4, 3.2); shape.lineTo(6, 3.2); shape.lineTo(1, 5.0); shape.closePath();
      const g = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), gableMat);
      g.position.set(0, 0, z - 0.15); R.add(g);
    }
    // ---- floors (cover the whole footprint; no bare ground inside) ----
    const wood = lam("bgWoodF", () => ({ map: rep(woodTex(), 4, 3) }));
    const livFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), wood);
    livFloor.rotation.x = -Math.PI / 2; livFloor.position.set(-1, 0.02, 2.5); livFloor.receiveShadow = true; R.add(livFloor);
    const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 2), wood);
    hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(1, 0.02, 6); hallFloor.receiveShadow = true; R.add(hallFloor);
    const tile = lam("bgTileF", () => ({ map: rep(tileTex(), 2, 2) }));
    const kitFloor = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), tile);
    kitFloor.rotation.x = -Math.PI / 2; kitFloor.position.set(4, 0.02, 2.5); kitFloor.receiveShadow = true; R.add(kitFloor);
    const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2), tile);
    bathFloor.rotation.x = -Math.PI / 2; bathFloor.position.set(5.4, 0.02, 6); bathFloor.receiveShadow = true; R.add(bathFloor);

    // ---- front door (animated swing; hinge at x = +0.45 per story.ts HINGE_AT, panel swings INWARD) ----
    this.door = new THREE.Group();
    const doorMat = lam("bgDoor", () => ({ color: "#2f6f6a" }));
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.08), doorMat);
    doorPanel.position.set(-0.45, 1.1, 0); doorPanel.castShadow = true; this.door.add(doorPanel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lam("bgBrass", () => ({ color: "#d9a441" })));
    knob.position.set(-0.78, 1.05, 0.07); this.door.add(knob);
    this.door.position.set(0.45, 0, 0); // hinge at x = +0.45
    R.add(this.door);
    // door glass peephole (small warm window in the door)
    this.doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshBasicMaterial({ color: "#3a4a6b" }));
    this.doorGlass.position.set(-0.45, 1.7, 0.05); this.door.add(this.doorGlass);
    // windows: frames + glass (DoubleSide so the warm night glow reads from outside too)
    const glassMat = new THREE.MeshBasicMaterial({ color: "#3a4a6b", side: THREE.DoubleSide });
    for (const [x, y, z, w, h, yaw] of [
      [2.6, 1.6, 0, 1.6, 1.0, 0], [-2.5, 1.6, 0, 1.6, 1.0, 0], [-4, 1.6, 3.5, 1.4, 1.0, Math.PI / 2],
    ] as const) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(yaw ? 0.1 : w + 0.16, h + 0.16, yaw ? w + 0.16 : 0.1), trim);
      frame.position.set(x, y, z); R.add(frame);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
      gl.position.set(x, y, z); gl.rotation.y = yaw; R.add(gl); this.winGlass.push(gl);
    }
    // house number plates (diegetic text props; plate 16 sits just outside the front wall face z=-0.15)
    const plate16 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), lam("bgPlate16", () => ({ map: plateTex("16") })));
    plate16.position.set(0.85, 1.5, -0.16); plate16.rotation.y = Math.PI; R.add(plate16);
    // porch light beside the door (warm at night)
    const porch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffd9a0" }));
    porch.position.set(-0.85, 2.4, -0.2); R.add(porch);

    // ---- interior furniture (Kenney GLBs) ----
    prop(b, kit, "loungeSofa", COUCH_AT[0], 0, COUCH_AT[2], 1.6, Math.PI / 2); // couch faces east (+x)
    prop(b, kit, "tableCoffee", -0.5, 0, 2.6, 1.0, 0); // coffee table (toolbox sits here in shot 14)
    prop(b, kit, "lampRoundFloor", -3.6, 0, 3.8, 1.2, 0);
    prop(b, kit, "sideTable", -3.6, 0, 0.8, 1.0, 0);
    prop(b, kit, "lampRoundTable", -3.6, 0.62, 0.8, 1.0, 0);
    prop(b, kit, "bookcaseOpen", -3.8, 0, 4.6, 1.2, Math.PI / 2);
    prop(b, kit, "cabinetTelevision", 1.6, 0, 1.2, 1.2, -Math.PI / 2);
    prop(b, kit, "televisionModern", 1.6, 0.75, 1.2, 1.0, -Math.PI / 2);
    prop(b, kit, "rugRectangle", -1.5, 0.03, 2.6, 2.2, 0);
    prop(b, kit, "table", TABLE_AT[0], 0, TABLE_AT[2], 1.4, 0); // the wobbly kitchen table
    prop(b, kit, "chair", 3.4, 0, 2.4, 1.0, Math.PI / 2);
    prop(b, kit, "chair", 5.0, 0, 2.4, 1.0, -Math.PI / 2);
    prop(b, kit, "kitchenFridge", 5.5, 0, 0.4, 1.2, Math.PI);
    prop(b, kit, "kitchenSink", SINK_AT[0], 0, SINK_AT[2], 1.2, Math.PI);
    prop(b, kit, "kitchenStove", 3.2, 0, 0.4, 1.2, Math.PI);
    prop(b, kit, "kitchenCabinet", 2.6, 0, 4.7, 1.2, 0);
    prop(b, kit, "lampRoundFloor", 5.6, 0, 3.6, 1.0, 0);
    prop(b, kit, "bathroomSink", 5.8, 0, 6.9, 1.0, Math.PI);
    prop(b, kit, "coatRack", -1.6, 0, 6.6, 1.0, 0);
    prop(b, kit, "pottedPlant", 1.8, 0, 4.6, 1.0, 0);
    prop(b, kit, "plantSmall1", 5.9, 0.8, 2.0, 1.0, 0);
    // hallway painting (framed canvas, straight — already fixed; on the BACK wall per PAINT_AT z=6.6)
    const paintFrame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.06), lam("bgPaintFrame", () => ({ color: "#5a3b2a" })));
    paintFrame.position.set(PAINT_AT[0], PAINT_AT[1], 6.95); R.add(paintFrame);
    const painting = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.58), lam("bgPainting", () => ({ map: paintTex() })));
    painting.position.set(PAINT_AT[0], PAINT_AT[1], 6.91); painting.rotation.y = Math.PI; R.add(painting);
    // bathroom bulb (glows in shot 6)
    this.bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffe9c0" }));
    this.bulbMesh.position.set(BULB_AT[0], BULB_AT[1], BULB_AT[2]); R.add(this.bulbMesh);
    // bathroom mirror above the sink
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), lam("bgMirror", () => ({ color: "#b8d0dc" })));
    mirror.position.set(5.8, 1.7, 6.92); mirror.rotation.y = Math.PI; R.add(mirror);

    // ---- exterior: neighbour's house (brick-red, number 61) + trees + bushes ----
    prop(b, kit, "building-type-a", -3, 0, -12, 5, 0);
    prop(b, kit, "building-type-c", 8, 0, -13, 5, 0.3);
    const plate61 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), lam("bgPlate61", () => ({ map: plateTex("61") })));
    plate61.position.set(-2.1, 1.5, -9.4); R.add(plate61);
    for (const [x, z, n] of [[-8, -4.5, "tree_simple"], [10, -4.5, "tree_simple"], [-6, 5.5, "plant_bushDetailed"], [4, 6.5, "plant_bushDetailed"], [8, -4.5, "grass"], [-10, -4.5, "grass"]] as const)
      prop(b, kit, n, x, 0, z, n.startsWith("plant") ? 1.1 : 3.0 + hh(x, 7), hh(x, 8) * 3);
    // security camera above the front door (justifies the CCTV shot)
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.3), lam("bgCam", () => ({ color: "#2b2b2e" })));
    camBody.position.set(1.8, 2.8, -0.35); camBody.rotation.x = 0.5; R.add(camBody);
    b.build(R);

    // ---- oil drop (shots 1 + 9) ----
    this.oilDrop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: "#1c1c20" }));
    this.oilDrop.visible = false; R.add(this.oilDrop);
    // ---- red toolbox (at the handyman's feet, then on the coffee table) ----
    this.toolbox = new THREE.Group();
    const tbMat = lam("bgToolbox", () => ({ color: "#c23b2e" }));
    const tbBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.24, 0.24), tbMat);
    tbBox.position.y = 0.12; tbBox.castShadow = true; this.toolbox.add(tbBox);
    const tbHandle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12, Math.PI), lam("bgTbHandle", () => ({ color: "#2b2b2e" })));
    tbHandle.position.y = 0.24; this.toolbox.add(tbHandle);
    R.add(this.toolbox);
    // note taped to the toolbox (shot 14)
    this.note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshBasicMaterial({ color: "#fdfdf8" }));
    this.note.rotation.x = -Math.PI / 2; this.note.position.set(0, 0.245, 0); this.note.visible = false;
    this.toolbox.add(this.note);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** camera-relative sun, frozen per shot (mean forward axis of the shot, LIGHTS.day az/el) */
  private shotSun(id: number, night: boolean) {
    const key = id * 2 + (night ? 1 : 0);
    let v = this.sunCache.get(key);
    if (v) return v;
    const s = SHOTS[id - 1];
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const P = night ? NIGHT : LIGHTS.day;
    const az = THREE.MathUtils.degToRad(P.az), el = THREE.MathUtils.degToRad(P.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(key, v);
    return v;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1];
    const night = isNight(f);
    const P = night ? NIGHT : LIGHTS.day;
    const K = LOOK.day;
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig: camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const sunDir = this.shotSun(id, night);
    this.hemi.color.set(P.sky); this.hemi.groundColor.set(P.ground); this.hemi.intensity = P.hemiI;
    this.sun.color.set(P.sunCol); this.sun.intensity = P.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = P.bias; this.sun.shadow.normalBias = P.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...P.lit); TONE.uShadeCol.value.set(...P.shade); TONE.uShadeLift.value.set(...P.lift);
    TONE.uLambert.value = P.lambert; TONE.uSideK.value = P.sideK; TONE.uTerm.value = P.term;
    TONE.uBounce.value.set(...LOOK.day.bounce); TONE.uSat.value = LOOK.day.sat;
    CHAR.uCharTint.value.set(...P.charTint); CHAR.uCharShade.value = P.charShade; CHAR.uGrad.value = P.charGrad;
    CHAR.uBodyGrad.value = P.bodyGrad; CHAR.uSideTint.value.set(...P.sideTint);
    // ---- sky, fog, clouds ----
    const su = this.skyMat.uniforms;
    const skyStops = night ? NIGHT_SKY.c : K.sky.c;
    skyStops.forEach((h, i) => untone(h, su["c" + i].value));
    const e = (night ? NIGHT_SKY.e : K.sky.e).map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(P.fog, this.fog.color); this.fog.near = P.fogNear; this.fog.far = P.fogFar;
    scene.fog = this.fog; scene.background = null;
    this.clouds.forEach((m, i) => {
      m.position.x = -60 + i * 28 + ((t * 0.4 + i * 17) % 40);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).opacity = night ? 0.25 : 0.55;
    });
    // ---- windows: warm glow at night, dark glass by day ----
    const glassCol = night ? "#ffca7a" : "#3a4a6b";
    for (const g of this.winGlass) (g.material as THREE.MeshBasicMaterial).color.set(glassCol);
    (this.doorGlass.material as THREE.MeshBasicMaterial).color.set(glassCol);
    // ---- night lamp lights (warm pools in the rooms) ----
    for (const pl of this.lampLights) pl.intensity = night ? 14 : 0;
    // ---- animated props ----
    this.door.rotation.y = doorAngle(f);
    const dropY = oilDropY(f);
    this.oilDrop.visible = dropY !== null;
    if (dropY !== null) this.oilDrop.position.set(HINGE_AT[0], dropY, HINGE_AT[2] - 0.06);
    // toolbox: at the handyman's feet (shots 1, 2, 9, 10), on the coffee table (14, 15), hidden else
    const tbAtFeet = id === 1 || id === 2 || id === 9 || id === 10;
    const tbOnTable = id === 14 || id === 15;
    this.toolbox.visible = tbAtFeet || tbOnTable;
    if (tbAtFeet) this.toolbox.position.set(1.3, 0, -0.5);
    if (tbOnTable) this.toolbox.position.set(TOOLBOX_AT[0], TOOLBOX_AT[1] - 0.12, TOOLBOX_AT[2]); // group origin = table top (~0.5); TOOLBOX_AT is the box centre (0.62)
    this.note.visible = id === 14 || id === 15;
    // bathroom bulb glow (shot 6)
    const glow = bulbGlow(f);
    this.bulbLight.intensity = glow > 0.9 ? 7 : 0;
    (this.bulbMesh.material as THREE.MeshBasicMaterial).color.set(glow > 0.9 ? "#ffe9c0" : "#c8b898");
    // flashlight (shots 11-12): spotlight + translucent cone from dad's hand to the target
    const ft = flashTarget(f);
    const flashOn = ft !== null;
    this.flash.intensity = flashOn ? 32 : 0;
    (this.flashCone.material as THREE.MeshBasicMaterial).opacity = flashOn ? 0.10 : 0;
    if (flashOn) {
      const hand: V3 = id === 11 ? [-1.9, 1.0, 3.0] : [4.0, 1.0, 4.4];
      this.flash.position.set(...hand);
      this.flash.target.position.set(...ft);
      const dir = new THREE.Vector3(ft[0] - hand[0], ft[1] - hand[1], ft[2] - hand[2]);
      const len = dir.length();
      this.flashCone.position.set(hand[0] + dir.x / 2, hand[1] + dir.y / 2, hand[2] + dir.z / 2);
      this.flashCone.scale.set(1, len, 1);
      this.flashCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize().negate());
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stageBurglar(id, t, f, { pos: cam.position, right });
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
