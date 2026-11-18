// The Thunder world: one persistent night camp (shore, tents, palisade, fire, bay, fleet)
// re-lit to dawn for the payoff. Plain Lambert/Phong materials + real lights (moon, fire,
// dawn sun) — no two-tone shader, no composer anywhere. Colours are on-screen targets
// measured from the verified V1 backgrounds / style lock (sky #0e1a30-#1c2a4a, firelight
// #e8862e-#f5a83d, blue-lifted blacks, no vignette, no ink on world geometry).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function).
import * as THREE from "three";
import { ctex, rep, beam } from "../bridge/paint";
import { V } from "../bridge/build";
import { NOINK } from "../bridge/ink";
import { CHAR, untone } from "../bridge/shade";
import { Pool, Actor, Fx } from "../bridge/cast";
import { stageThunder } from "./cast";
import {
  FPS, SHOTS, V3, clamp01, smooth, lerp, dawnU, blastAge, blastU, flashK, smokeK, emberK,
  wobble, fuseU, stubK, farFlashK, bombAt, cordPoint, CORD_PTS, STUB_PTS, BOMB_R, BOMB_HOME,
  FIRE_AT, TENTS, BANNERS, TORCHES, ROCK_AT, DUNE_AT, SHORE_Z, camAt,
} from "./story";

const SKY_NIGHT = ["#3f6d9f", "#2c4a72", "#1c2a4a", "#141f38", "#0e1a30"]; // horizon -> zenith
const SKY_DAWN = ["#f0d9a8", "#c5cfe0", "#aebfd6", "#9db2cc", "#8fa8c4"];
const SKY_E = [0, 3, 8, 16, 40];
const FOG_NIGHT = "#2c4a72", FOG_DAWN = "#b8c4d4";

const glowTex = (key: string, inner: string, outer: string) => ctex(key, 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const smokeTex = () => ctex("thunderSmoke", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 120);
  gr.addColorStop(0, "rgba(200,200,210,0.85)"); gr.addColorStop(0.55, "rgba(180,180,190,0.5)"); gr.addColorStop(1, "rgba(170,170,180,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (const [x, y, r] of [[90, 110, 42], [160, 140, 48], [130, 90, 36]] as const) {
    const g2 = g.createRadialGradient(x, y, 4, x, y, r);
    g2.addColorStop(0, "rgba(215,215,225,0.5)"); g2.addColorStop(1, "rgba(215,215,225,0)");
    g.fillStyle = g2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
});
const flameTex = () => ctex("thunderFlame", 128, 256, (g) => {
  const gr = g.createRadialGradient(64, 170, 8, 64, 150, 110);
  gr.addColorStop(0, "rgba(255,240,180,1)"); gr.addColorStop(0.35, "rgba(245,168,61,0.95)");
  gr.addColorStop(0.7, "rgba(232,134,46,0.55)"); gr.addColorStop(1, "rgba(200,80,20,0)");
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(64, 8);
  g.bezierCurveTo(108, 80, 112, 150, 88, 210);
  g.bezierCurveTo(70, 240, 40, 240, 30, 200);
  g.bezierCurveTo(14, 150, 24, 80, 64, 8);
  g.fill();
});
const dirtTex = () => ctex("thunderDirt", 1024, 1024, (g, r) => {
  g.fillStyle = "#6e5f4c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? "rgba(60,50,38,0.25)" : "rgba(150,135,110,0.22)";
    g.fillRect(r() * 1024, r() * 1024, 2 + r() * 4, 2 + r() * 4);
  }
  for (let i = 0; i < 26; i++) { // soft patches
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 130;
    const gr = g.createRadialGradient(x, y, 4, x, y, rad);
    gr.addColorStop(0, r() < 0.5 ? "rgba(90,78,60,0.35)" : "rgba(120,106,84,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 60; i++) { // small stones
    const x = r() * 1024, y = r() * 1024;
    g.fillStyle = "#8d8a86"; g.beginPath(); g.ellipse(x, y, 4 + r() * 7, 3 + r() * 5, r() * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(x - 2, y - 2, 2, 1.5, 0, 0, Math.PI * 2); g.fill();
  }
});
const bannerTex = () => ctex("thunderBanner", 128, 256, (g) => {
  g.fillStyle = "#1c1c20"; g.fillRect(0, 0, 64, 256);
  g.fillStyle = "#e8e4da"; g.fillRect(64, 0, 64, 256);
  g.fillStyle = "#1c1c20"; g.beginPath(); g.arc(64, 108, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e8e4da"; g.beginPath(); g.arc(64, 108, 22, 0, Math.PI * 2); g.fill();
});
const moonPathTex = () => ctex("thunderMoonPath", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(220,235,255,0.85)"); gr.addColorStop(1, "rgba(220,235,255,0.05)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  g.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 24; i++) g.fillRect(14 + Math.random() * 36, Math.random() * 256, 12 + Math.random() * 22, 2);
});
const canvasTex = () => ctex("thunderCanvas", 256, 256, (g, r) => {
  g.fillStyle = "#3d4442"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 42) { g.fillStyle = "rgba(20,24,22,0.5)"; g.fillRect(x, 0, 3, 256); }
  for (let i = 0; i < 400; i++) { g.fillStyle = "rgba(255,255,255,0.03)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
});

type Mats = Record<string, THREE.Material>;
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export class ThunderWorld {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private sun: THREE.DirectionalLight;
  private fireLight: THREE.PointLight;
  private torchLights: THREE.PointLight[] = [];
  private blastLight: THREE.PointLight;
  private farFlashLight: THREE.PointLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#2c4a72", 45, 280);
  private moonDisc: THREE.Sprite; private moonHalo: THREE.Sprite; private sunGlow: THREE.Sprite;
  private stars: THREE.Points; private starMat: THREE.PointsMaterial;
  private clouds: THREE.Mesh[] = [];
  private bomb: THREE.Group; private ember: THREE.Sprite; private thread: THREE.Sprite[] = [];
  private cord: THREE.Group; private cordEmber: THREE.Sprite; private stubSpark: THREE.Sprite;
  private farBomb: THREE.Group; private farFlash: THREE.Sprite;
  private fireFlames: THREE.Mesh[] = []; private fireGlow: THREE.Sprite;
  private explosion: THREE.Group;
  private fireball: THREE.Sprite[] = [];
  private boomSmoke: { s: THREE.Sprite; dir: THREE.Vector3; sp: number; ph: number }[] = [];
  private sparks: THREE.Points; private sparkMat: THREE.PointsMaterial;
  private sparkVel: Float32Array; private sparkPos: Float32Array;
  private ring: THREE.Mesh; private ringMat: THREE.MeshBasicMaterial;
  private column: THREE.Sprite[] = [];
  private fleet: THREE.Group[] = [];
  private glints: THREE.Mesh[] = [];
  private waterMat: THREE.MeshPhongMaterial;
  private bannerMeshes: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor() {
    const R = this.root, M: Mats = {};
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
    const discT = glowTex("thunderMoonDisc", "rgba(255,255,255,1)", "rgba(255,255,255,1)");
    this.moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discT, color: new THREE.Color(1.6, 1.6, 1.55), fog: false, depthWrite: false }));
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderHalo", "rgba(200,215,240,0.55)", "rgba(200,215,240,0.25)"), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderSunGlow", "rgba(255,200,120,0.9)", "rgba(255,160,80,0.4)"), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    for (const m of [this.moonDisc, this.moonHalo, this.sunGlow]) { m.frustumCulled = false; m.layers.set(NOINK); m.renderOrder = -0.5; R.add(m); }
    // stars
    {
      const n = 420, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = hh(i, 1) * Math.PI * 2, el = 0.12 + hh(i, 2) * 1.3, d = 950;
        pos.set([Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(a) * Math.cos(el) * d], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.starMat = new THREE.PointsMaterial({ color: "#dfe8ff", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
      this.stars = new THREE.Points(g, this.starMat);
      this.stars.frustumCulled = false; this.stars.layers.set(NOINK); R.add(this.stars);
    }
    this.hemi = new THREE.HemisphereLight("#8aa3cc", "#4a4238", 0.42);
    this.moon = new THREE.DirectionalLight("#b8cdea", 0.9);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    this.sun = new THREE.DirectionalLight("#ffb35e", 0);
    R.add(this.hemi, this.moon, this.moon.target, this.sun, this.sun.target);
    this.fireLight = new THREE.PointLight("#f5a83d", 26, 14, 2);
    this.fireLight.position.set(FIRE_AT[0], 0.7, FIRE_AT[2]);
    R.add(this.fireLight);
    for (const [x, z] of TORCHES) {
      const pl = new THREE.PointLight("#f5a83d", 7, 7, 2);
      pl.position.set(x, 1.9, z); R.add(pl); this.torchLights.push(pl);
    }
    const lantern = new THREE.PointLight("#f5c86e", 5, 6, 2);
    lantern.position.set(-1.8, 1.7, -2.2); R.add(lantern);
    this.blastLight = new THREE.PointLight("#ffd9a0", 0, 45, 2);
    this.blastLight.position.set(0, 0.6, 0); R.add(this.blastLight);
    this.farFlashLight = new THREE.PointLight("#ffd9a0", 0, 25, 2);
    this.farFlashLight.position.set(ROCK_AT[0], 0.8, ROCK_AT[2]); R.add(this.farFlashLight);

    // ---- ground, sand, dune, shore ----
    const dirt = new THREE.MeshLambertMaterial({ map: rep(dirtTex(), 42, 22) });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 338), dirt);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, SHORE_Z - 169);
    ground.receiveShadow = true; R.add(ground);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(1.5, 28), new THREE.MeshLambertMaterial({ map: rep(dirtTex(), 2, 2), color: "#a89880" }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.012, 0); sand.receiveShadow = true; R.add(sand);
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(640, 5), new THREE.MeshLambertMaterial({ color: "#7a6c54" }));
    shore.rotation.x = -Math.PI / 2; shore.position.set(0, 0.008, SHORE_Z - 2); shore.receiveShadow = true; R.add(shore);
    const dune = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 5, 1.15, 28), new THREE.MeshLambertMaterial({ map: rep(dirtTex(), 3, 1) }));
    dune.position.set(DUNE_AT[0], 0.575, DUNE_AT[2]); dune.castShadow = true; dune.receiveShadow = true; R.add(dune);
    // grass tufts
    {
      const tuft = new THREE.ConeGeometry(0.045, 0.22, 5);
      const tm = new THREE.MeshLambertMaterial({ color: "#4a5a3a" });
      const inst = new THREE.InstancedMesh(tuft, tm, 150);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < 150; i++) {
        const a = hh(i, 5) * Math.PI * 2, d = 2.8 + hh(i, 6) * 12.4;
        const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8 - 1;
        if (z > SHORE_Z - 1) continue;
        e.set((hh(i, 7) - 0.5) * 0.3, 0, (hh(i, 8) - 0.5) * 0.3); q.setFromEuler(e);
        m4.compose(V(x, 0.11, z), q, V(1, 0.7 + hh(i, 9) * 0.9, 1));
        inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true; R.add(inst);
    }

    // ---- water + moon path + glints ----
    this.waterMat = new THREE.MeshPhongMaterial({ color: "#16283f", specular: "#7a96b8", shininess: 90 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(640, 220), this.waterMat);
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.15, SHORE_Z + 110); R.add(water);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(7, 110),
      new THREE.MeshBasicMaterial({ map: moonPathTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false }));
    path.rotation.x = -Math.PI / 2; path.position.set(-1, -0.1, SHORE_Z + 55); path.layers.set(NOINK); R.add(path);
    for (let i = 0; i < 8; i++) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + hh(i, 11) * 0.8, 0.12),
        new THREE.MeshBasicMaterial({ color: "#dfe8ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6, fog: false }));
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(-4 + hh(i, 12) * 8, -0.08, SHORE_Z + 8 + hh(i, 13) * 80);
      gl.layers.set(NOINK); this.glints.push(gl); R.add(gl);
    }

    // ---- mountains (smooth domes) + clouds ----
    const mtnMat = new THREE.MeshLambertMaterial({ color: "#2a3a55" });
    for (const [x, z, rx, ry] of [[-120, -150, 70, 18], [-30, -175, 85, 24], [60, -160, 75, 20], [150, -150, 65, 16], [-190, -170, 60, 14]] as const) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mtnMat);
      m.scale.set(rx, ry, 30); m.position.set(x, -2, z); R.add(m);
    }
    const cloudT = smokeTex();
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 7),
        new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, opacity: 0.4, depthWrite: false, fog: false, color: "#6a7fa8" }));
      m.position.set(-140 + i * 55 + hh(i, 14) * 20, 62 + (i % 3) * 14, -160 + hh(i, 15) * 60);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }

    // ---- tents, palisade, banners, trees ----
    M.canvas = new THREE.MeshLambertMaterial({ map: canvasTex() });
    M.wood = new THREE.MeshLambertMaterial({ map: beam(), color: "#a89a86" }); // muted + cooled for night
    M.woodDark = new THREE.MeshLambertMaterial({ color: "#5a4230" });
    for (const [x, z, yaw] of TENTS) {
      const tent = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.7, 4), M.canvas);
      cone.rotation.y = Math.PI / 4; cone.position.y = 1.35; cone.castShadow = true; cone.receiveShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), M.woodDark);
      pole.position.y = 1.65; pole.castShadow = true;
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshLambertMaterial({ color: "#22262a" }));
      door.position.set(0, 0.55, 1.36); door.rotation.x = -0.18;
      tent.add(cone, pole, door);
      for (const s of [-1, 1]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 4), M.woodDark);
        rope.position.set(s * 1.5, 1.35, 0.9); rope.rotation.z = s * 0.7; rope.rotation.x = -0.4;
        tent.add(rope);
      }
      tent.position.set(x, 0, z); tent.rotation.y = yaw;
      R.add(tent);
    }
    { // palisade arc behind the camp
      const log = new THREE.CylinderGeometry(0.09, 0.11, 2.3, 6);
      const inst = new THREE.InstancedMesh(log, M.wood, 26);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < 26; i++) {
        const a = -0.85 + (i / 25) * 1.7, r = 9.5;
        const x = Math.sin(a) * r, z = 2 - Math.cos(a) * r;
        q.setFromEuler(new THREE.Euler((hh(i, 16) - 0.5) * 0.06, 0, (hh(i, 17) - 0.5) * 0.06));
        m4.compose(V(x, 1.15, z), q, V(1, 0.9 + hh(i, 18) * 0.25, 1));
        inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true; inst.castShadow = true; inst.receiveShadow = true; R.add(inst);
    }
    const bTex = bannerTex();
    for (const [x, z] of BANNERS) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6), M.woodDark);
      pole.position.set(x, 1.7, z); pole.castShadow = true; R.add(pole);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.9),
        new THREE.MeshLambertMaterial({ map: bTex, side: THREE.DoubleSide }));
      b.position.set(x + 0.4, 2.35, z); b.castShadow = true;
      this.bannerMeshes.push(b); R.add(b);
    }
    const trunkM = new THREE.MeshLambertMaterial({ color: "#4a3828" });
    const leafM = new THREE.MeshLambertMaterial({ color: "#2d4a2e" });
    const leafM2 = new THREE.MeshLambertMaterial({ color: "#35582f" });
    for (const [x, z, s] of [[-11, -8, 1.2], [-9, 4, 1], [10, -7, 1.3], [12, 3, 0.9], [-14, 0, 1.1], [14, -2, 1.2], [-7, -12, 1.4], [8, -11, 1.1], [0, -14, 1.3]] as const) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.7, 7), trunkM);
      trunk.position.y = 0.85; trunk.castShadow = true;
      const c1 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10), leafM);
      c1.position.y = 2.4; c1.scale.set(1, 0.85, 1); c1.castShadow = true;
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 9), leafM2);
      c2.position.set(0.7, 3.0, 0.3); c2.castShadow = true;
      tree.add(trunk, c1, c2);
      tree.position.set(x, 0, z); tree.scale.setScalar(s);
      R.add(tree);
    }

    // ---- campfire, torches, lantern pole ----
    {
      const stoneM = new THREE.MeshLambertMaterial({ color: "#6a7080" });
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), stoneM);
        st.position.set(FIRE_AT[0] + Math.cos(a) * 0.55, 0.1, FIRE_AT[2] + Math.sin(a) * 0.55);
        st.castShadow = true; R.add(st);
      }
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), M.woodDark);
        log.position.set(FIRE_AT[0], 0.16, FIRE_AT[2]);
        log.rotation.set(Math.PI / 2 - 0.35, (i / 3) * Math.PI, 0);
        R.add(log);
      }
      const bed = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), new THREE.MeshBasicMaterial({ color: "#ff7a20" }));
      bed.rotation.x = -Math.PI / 2; bed.position.set(FIRE_AT[0], 0.06, FIRE_AT[2]); R.add(bed);
      const fTex = flameTex();
      for (const ry of [0, Math.PI / 2]) {
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.15),
          new THREE.MeshBasicMaterial({ map: fTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        fl.position.set(FIRE_AT[0], 0.62, FIRE_AT[2]); fl.rotation.y = ry; fl.layers.set(NOINK);
        this.fireFlames.push(fl); R.add(fl);
      }
      this.fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderFireGlow", "rgba(255,170,70,0.7)", "rgba(255,120,30,0.3)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      this.fireGlow.position.set(FIRE_AT[0], 0.7, FIRE_AT[2]); this.fireGlow.scale.setScalar(2.6);
      this.fireGlow.layers.set(NOINK); R.add(this.fireGlow);
    }
    for (const [x, z] of TORCHES) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), M.woodDark);
      pole.position.set(x, 0.95, z); pole.castShadow = true; R.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.45),
        new THREE.MeshBasicMaterial({ map: flameTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      fl.position.set(x, 2.1, z); fl.layers.set(NOINK); this.fireFlames.push(fl); R.add(fl);
    }
    { // lantern pole (shot 2 background)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), M.woodDark);
      pole.position.set(-1.8, 1.1, -2.2); pole.castShadow = true; R.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M.woodDark);
      arm.rotation.z = Math.PI / 2; arm.position.set(-1.58, 2.15, -2.2); R.add(arm);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: "#ffd98a" }));
      lamp.position.set(-1.36, 1.92, -2.2); R.add(lamp);
    }

    // ---- the bomb (callback object) ----
    this.bomb = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BOMB_R, 24, 18),
      new THREE.MeshPhongMaterial({ color: "#1a1c20", specular: "#9a9aa2", shininess: 60 }));
    ball.castShadow = true;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10),
      new THREE.MeshBasicMaterial({ color: "#050507" }));
    hole.position.set(0.03, 0.15, 0.02); // flush disc at the sphere's apex, not a protruding knob
    this.ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderEmber", "rgba(255,190,90,1)", "rgba(255,110,20,0.6)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.ember.position.set(0.03, BOMB_R + 0.02, 0.02); this.ember.scale.setScalar(0.14);
    this.ember.layers.set(NOINK);
    this.bomb.add(ball, hole, this.ember);
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, opacity: 0.4, color: "#e2e5ec", fog: false }));
      sp.layers.set(NOINK); this.thread.push(sp); this.bomb.add(sp);
    }
    R.add(this.bomb);

    // ---- fuse cord + stub (shots 13-14) ----
    this.cord = new THREE.Group();
    const cordCurve = new THREE.CatmullRomCurve3(CORD_PTS.map((p) => V(...p)));
    const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 32, 0.022, 6),
      new THREE.MeshLambertMaterial({ color: "#8a6a44" }));
    const stubCurve = new THREE.CatmullRomCurve3(STUB_PTS.map((p) => V(...p)));
    const stubMesh = new THREE.Mesh(new THREE.TubeGeometry(stubCurve, 12, 0.022, 6),
      new THREE.MeshLambertMaterial({ color: "#7a6248" }));
    this.cordEmber = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderCordEmber", "rgba(255,190,90,1)", "rgba(255,110,20,0.6)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.cordEmber.scale.setScalar(0.16); this.cordEmber.layers.set(NOINK);
    this.stubSpark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderStub", "rgba(255,170,80,0.9)", "rgba(255,100,20,0.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.stubSpark.scale.setScalar(0.1); this.stubSpark.layers.set(NOINK);
    this.cord.add(cordMesh, stubMesh, this.cordEmber, this.stubSpark);
    R.add(this.cord);

    // ---- distant short-fuse bomb at the rock (shot 17) ----
    this.farBomb = new THREE.Group();
    const fb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshPhongMaterial({ color: "#1a1c20", specular: "#8a8a8a", shininess: 50 }));
    fb.position.y = 0.14;
    this.farFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderFarFlash", "rgba(255,240,200,1)", "rgba(255,160,60,0.6)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.farFlash.position.y = 0.35; this.farFlash.scale.setScalar(1.6); this.farFlash.layers.set(NOINK);
    this.farBomb.add(fb, this.farFlash);
    this.farBomb.position.set(ROCK_AT[0], 0, ROCK_AT[2]);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshLambertMaterial({ color: "#5a5e66" }));
    rock.position.set(ROCK_AT[0] - 0.6, 0.3, ROCK_AT[2] - 0.4); rock.scale.set(1.3, 0.8, 1); rock.castShadow = true; R.add(rock);
    R.add(this.farBomb);

    // ---- fleet ----
    for (let i = 0; i < 12; i++) {
      const ship = new THREE.Group();
      const sc = 0.8 + hh(i, 21) * 0.6;
      const hullM = new THREE.MeshLambertMaterial({ color: "#10141c" });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 1.8), hullM);
      hull.position.y = 0.4;
      const bow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), hullM);
      bow.position.set(3.4, 0.35, 0); bow.rotation.z = -0.3;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 5.5, 6), new THREE.MeshLambertMaterial({ color: "#232a36" }));
      mast.position.y = 3.4;
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), new THREE.MeshLambertMaterial({ color: "#232c3c", side: THREE.DoubleSide }));
      sail.position.set(0, 4.2, 0.15);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("thunderShipLamp", "rgba(255,190,90,1)", "rgba(255,150,50,0.5)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      lamp.position.set(-2.6, 1.6, 0); lamp.scale.setScalar(1.1); lamp.layers.set(NOINK);
      ship.add(hull, bow, mast, sail, lamp);
      ship.position.set(-70 + hh(i, 22) * 140, -0.1, 42 + hh(i, 23) * 53);
      ship.rotation.y = (hh(i, 24) - 0.5) * 0.5;
      ship.scale.setScalar(sc);
      this.fleet.push(ship); R.add(ship);
    }

    // ---- explosion group ----
    this.explosion = new THREE.Group();
    this.explosion.position.set(BOMB_HOME[0], 0.3, BOMB_HOME[2]);
    const fbCols: [string, string][] = [["rgba(255,250,230,1)", "rgba(255,220,140,0.7)"], ["rgba(255,180,70,0.95)", "rgba(255,110,25,0.55)"], ["rgba(230,90,25,0.8)", "rgba(160,40,15,0.4)"]];
    fbCols.forEach(([a, b], i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(`thunderFire${i}`, a, b), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      sp.layers.set(NOINK); sp.visible = false; this.fireball.push(sp); this.explosion.add(sp);
    });
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, opacity: 0, color: "#8f929e", fog: false }));
      sp.layers.set(NOINK);
      const a = hh(i, 31) * Math.PI * 2;
      this.boomSmoke.push({ s: sp, dir: V(Math.cos(a), 0.6 + hh(i, 32) * 0.9, Math.sin(a)), sp: 1.6 + hh(i, 33) * 2.2, ph: hh(i, 34) });
      this.explosion.add(sp);
    }
    { // sparks / debris with gravity
      const n = 120;
      this.sparkVel = new Float32Array(n * 3); this.sparkPos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = hh(i, 41) * Math.PI * 2, el = hh(i, 42) * 1.2 + 0.25, sp = 3 + hh(i, 43) * 7;
        this.sparkVel.set([Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3));
      this.sparkMat = new THREE.PointsMaterial({ color: "#ffb35e", size: 0.09, map: glowTex("thunderSpark", "rgba(255,255,255,1)", "rgba(255,180,90,0)"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      this.sparks = new THREE.Points(g, this.sparkMat);
      this.sparks.frustumCulled = false; this.sparks.layers.set(NOINK);
      this.explosion.add(this.sparks);
    }
    this.ringMat = new THREE.MeshBasicMaterial({ color: "#ffd9a0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = -0.24; this.ring.layers.set(NOINK);
    this.explosion.add(this.ring);
    for (let i = 0; i < 7; i++) { // smoke column (late shot 19 + shot 20)
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, opacity: 0, color: "#9aa0ac", fog: false }));
      sp.layers.set(NOINK); this.column.push(sp); this.explosion.add(sp);
    }
    R.add(this.explosion);
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], du = dawnU(f), age = blastAge(f);
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- lights: night -> dawn ramp + blast flash ----
    const fk = flashK(f);
    this.hemi.color.set("#8aa3cc").lerp(new THREE.Color("#cfd8e8"), du);
    this.hemi.groundColor.set("#4a4238").lerp(new THREE.Color("#8a8078"), du);
    this.hemi.intensity = lerp(0.42, 0.85, du) + fk * 0.6;
    const moonDir = V(-0.35, 0.75, -0.55).normalize();
    this.moon.color.set("#b8cdea");
    this.moon.intensity = lerp(0.9, 0.15, du) + fk * 0.8;
    this.moon.position.copy(focus).addScaledVector(moonDir, 220);
    this.moon.target.position.copy(focus);
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 40);
    const sc = this.moon.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 150; sc.far = 320; sc.updateProjectionMatrix();
    this.moon.shadow.bias = -0.0003; this.moon.shadow.normalBias = 0.03;
    const sunDir = V(0.85, 0.18, -0.4).normalize();
    this.sun.position.copy(focus).addScaledVector(sunDir, 220);
    this.sun.target.position.copy(focus);
    this.sun.intensity = lerp(0, 2.4, du);
    this.sun.castShadow = du > 0.6;
    // fire flicker
    const fl = 1 + 0.22 * Math.sin(t * 11) + 0.14 * Math.sin(t * 23 + 1);
    this.fireLight.intensity = 26 * fl;
    this.torchLights.forEach((pl, i) => { pl.intensity = 7 * (1 + 0.2 * Math.sin(t * 13 + i * 2.4)); });
    this.blastLight.intensity = fk * 500;
    this.farFlashLight.intensity = farFlashK(f) * 160;
    // character card uniforms: cool moonlit tint at night, warming to dawn
    CHAR.uCharTint.value.set(lerp(0.88, 1.0, du), lerp(0.94, 0.94, du), lerp(1.06, 0.92, du));
    CHAR.uCharShade.value = lerp(0.78, 0.86, du);
    CHAR.uGrad.value = 0.07; CHAR.uBodyGrad.value = 0.2;
    CHAR.uSideTint.value.set(lerp(0.85, 0.92, du), lerp(0.88, 0.9, du), lerp(1.0, 0.96, du));
    // ---- sky, fog, moon, stars, clouds ----
    const su = this.skyMat.uniforms;
    const cA = new THREE.Color(), cB = new THREE.Color();
    SKY_NIGHT.forEach((h, i) => {
      cA.set(h); cB.set(SKY_DAWN[i]); cA.lerp(cB, du);
      untone(cA, su["c" + i].value as THREE.Color);
    });
    const e = SKY_E.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(cA.set(FOG_NIGHT).lerp(cB.set(FOG_DAWN), du), this.fog.color);
    this.fog.near = lerp(45, 60, du); this.fog.far = lerp(280, 330, du);
    scene.fog = this.fog; scene.background = null;
    const mDir = V(-0.35, 0.55, -0.72).normalize();
    this.moonDisc.position.copy(cam.position).addScaledVector(mDir, 900);
    this.moonDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(2.1)));
    (this.moonDisc.material as THREE.SpriteMaterial).opacity = 1 - du;
    this.moonDisc.visible = du < 1;
    this.moonHalo.position.copy(this.moonDisc.position);
    this.moonHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(7)));
    (this.moonHalo.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - du);
    this.moonHalo.visible = du < 1;
    this.sunGlow.position.copy(cam.position).addScaledVector(sunDir, 880);
    this.sunGlow.scale.setScalar(2 * 880 * Math.tan(THREE.MathUtils.degToRad(9)));
    (this.sunGlow.material as THREE.SpriteMaterial).opacity = du * 0.85;
    this.sunGlow.visible = du > 0;
    this.stars.position.copy(cam.position);
    this.starMat.opacity = 0.85 * (1 - du);
    this.stars.visible = du < 1;
    this.clouds.forEach((m, i) => {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = lerp(0.4, 0.6, du);
      mat.color.set("#6a7fa8").lerp(new THREE.Color("#f5ede0"), du);
      m.position.x = -140 + i * 55 + ((t * 0.5 + i * 17) % 40);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
    });
    // water + glints
    this.waterMat.color.set("#16283f").lerp(new THREE.Color("#3a5a80"), du);
    this.glints.forEach((g, i) => {
      (g.material as THREE.MeshBasicMaterial).opacity = (0.3 + 0.4 * Math.max(0, Math.sin(t * 2 + i * 1.7))) * (1 - du * 0.5);
    });
    this.fleet.forEach((ship, i) => {
      ship.position.y = -0.1 + Math.sin(t * 0.5 + i) * 0.12;
      ship.rotation.z = 0.012 * Math.sin(t * 0.4 + i);
    });
    this.bannerMeshes.forEach((b, i) => { b.rotation.z = 0.02 * Math.sin(t * 1.2 + i); });
    // fire flames flicker
    this.fireFlames.forEach((fl, i) => {
      const k = 1 + 0.1 * Math.sin(t * 12 + i * 2) + 0.06 * Math.sin(t * 27 + i);
      fl.scale.set(k, 1 + 0.14 * Math.sin(t * 15 + i * 3), 1);
    });
    (this.fireGlow.material as THREE.SpriteMaterial).opacity = 0.85 * fl;
    // ---- bomb ----
    const bp = bombAt(id, f);
    this.bomb.position.set(bp[0], bp[1], bp[2]);
    this.bomb.rotation.z = wobble(f);
    this.bomb.visible = age <= 0 || id < 19;
    if (id === 19 && age > 0) this.bomb.visible = false;
    const ek = emberK(f);
    (this.ember.material as THREE.SpriteMaterial).opacity = ek;
    this.ember.visible = ek > 0 && this.bomb.visible;
    this.ember.scale.setScalar(0.12 + 0.1 * ek + 0.02 * Math.sin(t * 6));
    const sk = smokeK(f);
    this.thread.forEach((sp, i) => {
      const u = ((t * 0.35 + i / 7) % 1);
      sp.position.set(0.03 + Math.sin(u * 6 + t * 2) * 0.05 * u, BOMB_R + 0.05 + u * 1.1, 0.02);
      sp.scale.setScalar(0.15 + u * 0.42);
      (sp.material as THREE.SpriteMaterial).opacity = sk * 0.85 * (1 - u * 0.65) * Math.min(1, u * 4);
      sp.visible = sk > 0 && this.bomb.visible;
    });
    // ---- cord + stub ----
    const showCord = id === 13 || id === 14;
    this.cord.visible = showCord;
    if (showCord) {
      const ep = cordPoint(fuseU(f));
      this.cordEmber.position.set(...ep);
      (this.cordEmber.material as THREE.SpriteMaterial).opacity = id === 13 ? 0.95 : 0.6;
      this.stubSpark.position.set(STUB_PTS[2][0], STUB_PTS[2][1] + 0.03, STUB_PTS[2][2]);
      (this.stubSpark.material as THREE.SpriteMaterial).opacity = stubK(f);
      this.stubSpark.visible = id === 14;
      this.cordEmber.visible = true;
    }
    // ---- far flash ----
    const ff = farFlashK(f);
    (this.farFlash.material as THREE.SpriteMaterial).opacity = ff;
    this.farFlash.visible = ff > 0;
    this.farBomb.visible = id === 17;
    // ---- explosion ----
    const showBoom = age > 0 && age < 9;
    this.explosion.visible = showBoom || id === 20;
    if (showBoom || id === 20) {
      const bu = blastU(f);
      this.fireball.forEach((sp, i) => {
        const grow = Math.min(1, age / 0.3), fade = 1 - clamp01((age - 0.35) / 1.15);
        const sc2 = (0.6 + i * 0.5) * (0.4 + 2.6 * grow) * (1 - 0.3 * bu);
        sp.scale.setScalar(Math.max(0.01, sc2));
        (sp.material as THREE.SpriteMaterial).opacity = grow * fade;
        sp.visible = age < 1.5 && age > 0;
      });
      this.boomSmoke.forEach((b) => {
        const a2 = Math.max(0, age - b.ph * 0.3);
        const pos = b.dir.clone().multiplyScalar(b.sp * Math.min(a2, 2.5));
        b.s.position.set(pos.x + a2 * 0.5, pos.y + a2 * 0.8, pos.z);
        b.s.scale.setScalar(0.6 + Math.min(a2, 3) * 1.1);
        (b.s.material as THREE.SpriteMaterial).opacity = a2 <= 0 ? 0 : 0.75 * Math.exp(-Math.max(0, a2 - 2) / 2.2) * Math.min(1, a2 * 3);
        b.s.visible = a2 > 0 && age < 8;
      });
      if (age > 0 && age < 1.3) {
        for (let i = 0; i < 120; i++) {
          const vx = this.sparkVel[i * 3], vy = this.sparkVel[i * 3 + 1], vz = this.sparkVel[i * 3 + 2];
          const y = vy * age - 4.9 * age * age;
          this.sparkPos.set([vx * age, Math.max(-0.28, y), vz * age], i * 3);
        }
        (this.sparks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        this.sparkMat.opacity = 1 - age / 1.3;
        this.sparks.visible = true;
      } else this.sparks.visible = false;
      if (age > 0 && age < 0.5) {
        const rs = 1 + age * 14;
        this.ring.scale.set(rs, rs, 1);
        this.ringMat.opacity = 0.8 * (1 - age / 0.5);
        this.ring.visible = true;
      } else this.ring.visible = false;
      // smoke column: continuous slow rise, loops upward
      const colAge = Math.min(age, 8);
      this.column.forEach((sp, i) => {
        const yy = 0.5 + ((i * 1.35 + colAge * 0.85) % 9);
        sp.position.set(0.3 + Math.sin(yy * 0.8) * 0.4 + colAge * 0.12, yy, 0.2 * Math.sin(yy));
        sp.scale.setScalar(1.6 + yy * 0.35);
        (sp.material as THREE.SpriteMaterial).opacity = age > 1 ? 0.55 * (1 - yy / 11) : 0;
        sp.visible = age > 1;
      });
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stageThunder(id, t, f, { pos: cam.position, right });
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
