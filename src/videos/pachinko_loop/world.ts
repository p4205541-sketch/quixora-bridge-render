// The Pachinko world: one persistent night-city set — hall interior (machines, counter,
// prize shelf), neon street, prize-exchange window alley, warehouse — re-lit to dawn from
// shot 10. Plain Lambert/Phong materials + real lights — no two-tone shader, no composer
// anywhere. Colours are on-screen targets from the dissection (night exteriors mean RGB
// 0.25/0.23/0.36, hall interiors 0.57/0.43/0.35, no pure black, blue-lifted shadows).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function).
import * as THREE from "three";
import { ctex, rep, beam } from "../bridge/paint";
import { V } from "../bridge/build";
import { NOINK } from "../bridge/ink";
import { CHAR, untone } from "../bridge/shade";
import { Pool, Actor, Fx } from "../bridge/cast";
import { stagePachinko } from "./cast";
import {
  FPS, SHOTS, V3, clamp01, smooth, lerp, dawnU, loopU, loopPoint, cardFlip, flareK,
  cascadeK, lidU, cardAt, cashAt, boxAt, vanAt, cardSlideU, CARD_MACRO, camAt,
} from "./story";

const SKY_NIGHT = ["#3f6d9f", "#2c4a72", "#1c2a4a", "#141f38", "#0e1a30"]; // horizon -> zenith
const SKY_DAWN = ["#f0d9a8", "#c5cfe0", "#aebfd6", "#9db2cc", "#8fa8c4"];
const SKY_E = [0, 3, 8, 16, 40];
const FOG_NIGHT = "#2c4a72", FOG_DAWN = "#d8c4a8";

const glowTex = (key: string, inner: string, outer: string) => ctex(key, 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.45, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const flareTex = () => ctex("pachFlare", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 2, 128, 128, 120);
  gr.addColorStop(0, "rgba(255,250,225,1)"); gr.addColorStop(0.25, "rgba(255,230,150,0.7)"); gr.addColorStop(1, "rgba(255,210,90,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(255,250,230,0.95)";
  g.fillRect(124, 8, 8, 240); g.fillRect(8, 124, 240, 8); // 4-point star spikes
  g.fillStyle = "rgba(255,240,190,0.6)";
  g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); g.fillRect(-4, -100, 8, 200); g.fillRect(-100, -4, 200, 8); g.restore();
});
const ballTex = () => ctex("pachBall", 64, 64, (g) => {
  const gr = g.createRadialGradient(26, 24, 2, 32, 32, 30);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(215,220,228,1)"); gr.addColorStop(0.8, "rgba(140,148,160,1)"); gr.addColorStop(1, "rgba(90,96,108,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
});
const asphaltTex = () => ctex("pachAsphalt", 512, 512, (g, r) => {
  g.fillStyle = "#23242c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.25)";
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  for (let i = 0; i < 14; i++) { // faint wet sheen patches
    const x = r() * 512, y = r() * 512, rad = 40 + r() * 90;
    const gr = g.createRadialGradient(x, y, 4, x, y, rad);
    gr.addColorStop(0, "rgba(120,140,180,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
});
const carpetTex = () => ctex("pachCarpet", 512, 512, (g, r) => {
  g.fillStyle = "#8e2430"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = (x + y) % 2 ? "#a83240" : "#7e1e2a";
    g.beginPath(); g.arc(x * 64 + 32, y * 64 + 32, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(232,196,90,0.5)";
    g.beginPath(); g.arc(x * 64 + 32, y * 64 + 32, 7, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 2000; i++) { g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(r() * 512, r() * 512, 2, 2); }
});
const facadeTex = (key: string, base: string, lit: number) => ctex(key, 256, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 4; x++) {
    const on = r() < lit;
    g.fillStyle = on ? (r() < 0.7 ? "#ffd98a" : "#bfe0ff") : "#141821";
    g.fillRect(14 + x * 60, 16 + y * 50, 40, 30);
    g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(14 + x * 60, 16 + y * 50, 40, 4);
  }
  g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(0, 0, 256, 8);
});
const brickTex = () => ctex("pachBrick", 256, 256, (g, r) => {
  g.fillStyle = "#3a3f4a"; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 10; row++) {
    let x = row % 2 ? -32 : 0;
    while (x < 256) {
      const w = 56 + r() * 14;
      g.fillStyle = ["#4a3a3c", "#54444a", "#46383e"][Math.floor(r() * 3)];
      g.fillRect(x + 2, row * 26 + 2, w - 4, 22);
      x += w;
    }
  }
});
const plasterTex = () => ctex("pachPlaster", 256, 256, (g, r) => {
  g.fillStyle = "#6e6258"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 3, 3); }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 240, 256, 16); // dado line
});
const screenTex = (key: string, hue: string, hue2: string) => ctex(key, 128, 160, (g, r) => {
  g.fillStyle = "#101018"; g.fillRect(0, 0, 128, 160);
  const gr = g.createLinearGradient(0, 0, 0, 160);
  gr.addColorStop(0, hue); gr.addColorStop(1, hue2);
  g.fillStyle = gr; g.fillRect(8, 8, 112, 88);
  g.fillStyle = "#ffffff";
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(28 + i * 36, 52, 14, 0, Math.PI * 2); g.fill(); g.fillStyle = hue2; g.font = "bold 20px sans-serif"; g.fillText("7", 21 + i * 36, 59); g.fillStyle = "#ffffff"; }
  for (let i = 0; i < 12; i++) { g.fillStyle = r() < 0.5 ? "#ffe066" : "#ff6b9d"; g.fillRect(8 + r() * 112, 104 + r() * 48, 10, 6); }
  g.fillStyle = "#e8c45a"; g.font = "bold 16px sans-serif"; g.fillText("¥4", 52, 140);
});
const signTex = (key: string, text: string, fg: string, bg: string, vertical = false) => ctex(key, vertical ? 128 : 512, vertical ? 512 : 128, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, vertical ? 128 : 512, vertical ? 512 : 128);
  g.fillStyle = fg; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  if (vertical) {
    const chars = text.split("");
    chars.forEach((c, i) => g.fillText(c, 64, 42 + i * ((512 - 60) / chars.length)));
  } else g.fillText(text, 256, 64);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, (vertical ? 128 : 512) - 8, (vertical ? 512 : 128) - 8);
});
const goldCardTex = () => ctex("pachGoldCard", 256, 384, (g) => {
  const gr = g.createLinearGradient(0, 0, 256, 384);
  gr.addColorStop(0, "#f5d67a"); gr.addColorStop(0.45, "#e8c45a"); gr.addColorStop(0.55, "#c9a23a"); gr.addColorStop(1, "#f0d080");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#8a6a1e"; g.lineWidth = 8; g.strokeRect(10, 10, 236, 364);
  g.fillStyle = "#7a5c14"; g.font = "bold 34px sans-serif"; g.textAlign = "center";
  g.fillText("GOLD", 128, 70); g.fillText("CARD", 128, 112);
  g.fillStyle = "#fff2b8"; g.fillRect(48, 150, 160, 90); // sealed gold sliver window
  g.fillStyle = "#e8c45a"; g.fillRect(58, 160, 140, 70);
  g.fillStyle = "#7a5c14"; g.font = "bold 44px sans-serif"; g.fillText("¥1,000", 128, 300);
  g.font = "bold 20px sans-serif"; g.fillText("SPECIAL PRIZE", 128, 340);
});
const stripeTex = () => ctex("pachStripe", 64, 256, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#c23b2e" : "#1c1c20"; g.fillRect(0, i * 32, 64, 32); }
});
const corrugTex = () => ctex("pachCorrug", 256, 256, (g) => {
  g.fillStyle = "#4a5568"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) { g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x, 0, 6, 256); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 10, 0, 6, 256); }
});
const woodTex = () => ctex("pachWood", 256, 256, (g, r) => {
  g.fillStyle = "#8a5a34"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#7a4e2c" : "#96663a"; g.fillRect(0, i * 64, 256, 64); g.fillStyle = "#5a3a20"; g.fillRect(0, i * 64, 256, 3); }
  for (let i = 0; i < 20; i++) { g.strokeStyle = "rgba(60,35,15,0.3)"; g.lineWidth = 2; const y = r() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 4, 170, y - 4, 256, y); g.stroke(); }
});

type Mats = Record<string, THREE.Material>;
const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

export class PachinkoWorld {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private sun: THREE.DirectionalLight;
  private hallLights: THREE.PointLight[] = [];
  private windowLight: THREE.PointLight;
  private machineLight: THREE.PointLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#2c4a72", 30, 220);
  private moonDisc: THREE.Sprite; private moonHalo: THREE.Sprite; private sunGlow: THREE.Sprite;
  private stars: THREE.Points; private starMat: THREE.PointsMaterial;
  private macroCard: THREE.Group; private macroFlare: THREE.Sprite; private macroGlow: THREE.Sprite;
  private smallCard: THREE.Group; private smallGlint: THREE.Sprite;
  private cashProp: THREE.Mesh;
  private boxGroup: THREE.Group; private boxLid: THREE.Group;
  private van: THREE.Group;
  private loopSegs: THREE.Mesh[] = [];
  private loopGlows: THREE.Sprite[] = [];
  private aerialRing: THREE.Mesh; private aerialRingMat: THREE.MeshBasicMaterial;
  private traveler: THREE.Sprite;
  private pedestal: THREE.Mesh;
  private reflections: THREE.Mesh[] = [];
  private warehouseLight: THREE.PointLight;
  private cascade: THREE.Points; private cascadeMat: THREE.PointsMaterial;
  private cascadePos: Float32Array; private cascadeSeed: Float32Array;
  private screenMats: THREE.MeshBasicMaterial[] = [];
  private neonMats: THREE.MeshBasicMaterial[] = [];
  private lanternGlows: THREE.Sprite[] = [];
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
    const discT = glowTex("pachMoonDisc", "rgba(255,255,255,1)", "rgba(255,255,255,1)");
    this.moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discT, color: new THREE.Color(1.6, 1.6, 1.55), fog: false, depthWrite: false }));
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("pachHalo", "rgba(200,215,240,0.55)", "rgba(200,215,240,0.25)"), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("pachSunGlow", "rgba(255,200,120,0.9)", "rgba(255,160,80,0.4)"), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    for (const m of [this.moonDisc, this.moonHalo, this.sunGlow]) { m.frustumCulled = false; m.layers.set(NOINK); m.renderOrder = -0.5; R.add(m); }
    {
      const n = 380, pos = new Float32Array(n * 3);
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
    this.hemi = new THREE.HemisphereLight("#8aa3cc", "#4a4238", 0.8);
    this.moon = new THREE.DirectionalLight("#b8cdea", 1.2);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    this.sun = new THREE.DirectionalLight("#ffb35e", 0);
    R.add(this.hemi, this.moon, this.moon.target, this.sun, this.sun.target);
    for (const [x, z] of [[-4, -5], [0, -9], [4, -5]] as const) { // warm hall ceiling lights
      const pl = new THREE.PointLight("#ffd9a0", 22, 13, 2);
      pl.position.set(x, 3.1, z); R.add(pl); this.hallLights.push(pl);
    }
    this.windowLight = new THREE.PointLight("#ffcf8a", 8, 7, 2);
    this.windowLight.position.set(10.4, 1.6, 6); R.add(this.windowLight);
    const streetLight = new THREE.PointLight("#ff9ecb", 14, 14, 2);
    streetLight.position.set(0, 3.4, 10); R.add(streetLight);
    const shelfLight = new THREE.PointLight("#ffd9a0", 10, 8, 2);
    shelfLight.position.set(2, 2.8, -11.5); R.add(shelfLight);
    this.warehouseLight = new THREE.PointLight("#ffd9a0", 12, 9, 2);
    this.warehouseLight.position.set(-8.8, 2.6, 6); R.add(this.warehouseLight);
    const hallGlow = new THREE.PointLight("#ffd9a0", 14, 12, 2);
    hallGlow.position.set(0, 2.6, 1.5); R.add(hallGlow);
    this.machineLight = new THREE.PointLight("#ffe9b0", 4, 6, 2);
    this.machineLight.position.set(-0.5, 1.6, -7.2); R.add(this.machineLight);

    // ---- ground: asphalt city + plaza + hall carpet ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 120), new THREE.MeshPhongMaterial({ map: rep(asphaltTex(), 30, 22), color: "#b0b6c4", specular: "#5a6a8a", shininess: 60 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 6);
    ground.receiveShadow = true; R.add(ground);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(27, 15), new THREE.MeshLambertMaterial({ map: rep(asphaltTex(), 6, 4), color: "#c0c4d0" }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.012, 6.5); plaza.receiveShadow = true; R.add(plaza);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 12.6), new THREE.MeshLambertMaterial({ map: rep(carpetTex(), 5, 4) }));
    carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.02, -7.5); carpet.receiveShadow = true; R.add(carpet);
    // wet neon reflections on the plaza (fake: additive gradient strips under the signs)
    const reflTex = () => ctex("pachReflGrad", 64, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    });
    for (const [x, z, col, w] of [[5.5, 3.5, "#ff6ba8", 2.0], [-4, 4.5, "#4ad6ff", 1.5], [0, 2.5, "#ffd34d", 2.4]] as const) {
      const refl = new THREE.Mesh(new THREE.PlaneGeometry(w, 5),
        new THREE.MeshBasicMaterial({ map: reflTex(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.2, fog: false }));
      refl.rotation.x = -Math.PI / 2; refl.position.set(x, 0.03, z); refl.layers.set(NOINK); this.reflections.push(refl); R.add(refl);
    }

    // ---- hall shell: facade (with door opening), interior walls, roof ----
    const facadeMat = new THREE.MeshLambertMaterial({ map: facadeTex("pachHallFacade", "#2e3548", 0.55) });
    const plasterMat = new THREE.MeshLambertMaterial({ map: plasterTex() });
    const wallMat = new THREE.MeshLambertMaterial({ color: "#5a4a3e" });
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadow = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; R.add(m); return m;
    };
    // facade segments around the door opening (x -1.5..1.5, y 0..2.6)
    box(7.5, 4.2, 0.4, facadeMat, -5.25, 2.1, -1);
    box(7.5, 4.2, 0.4, facadeMat, 5.25, 2.1, -1);
    box(3.0, 1.6, 0.4, facadeMat, 0, 3.4, -1);
    // open door panels, angled outward
    const doorMat = new THREE.MeshPhongMaterial({ color: "#3a5a7a", specular: "#aaccff", shininess: 80, transparent: true, opacity: 0.75 });
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.5, 0.08), doorMat);
      door.position.set(s * 1.85, 1.25, -0.3); door.rotation.y = s * 0.7; R.add(door);
    }
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshLambertMaterial({ color: "#3a2a2a" }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.03, -1.9); R.add(mat);
    // interior walls + roof (roof keeps the aerial from seeing a hollow shell)
    box(18, 4.2, 0.3, plasterMat, 0, 2.1, -14);
    box(0.3, 4.2, 13, plasterMat, -9, 2.1, -7.5);
    box(0.3, 4.2, 13, plasterMat, 9, 2.1, -7.5);
    box(18.4, 0.3, 13.4, wallMat, 0, 4.35, -7.5);
    // roof furniture (reads in the aerials; was a flat brown expanse)
    box(1.4, 0.7, 1.4, new THREE.MeshLambertMaterial({ color: "#6a7080" }), -5, 4.85, -5);
    box(1.1, 0.5, 1.1, new THREE.MeshLambertMaterial({ color: "#5a5e6a" }), 3, 4.75, -10);
    box(0.8, 1.0, 0.8, new THREE.MeshLambertMaterial({ color: "#7a7a86" }), 6, 5.0, -4);
    const skylight = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.6), new THREE.MeshBasicMaterial({ color: "#ffe9b8" }));
    skylight.rotation.x = -Math.PI / 2; skylight.position.set(-1, 4.52, -8); R.add(skylight);
    // ceiling light strips (emissive planes)
    const stripMat = new THREE.MeshBasicMaterial({ color: "#fff2d0" });
    for (const z of [-4, -8, -12]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.5), stripMat);
      strip.rotation.x = Math.PI / 2; strip.position.set(0, 3.4, z); R.add(strip);
    }
    // pillars (red/black stripes)
    const pillarMat = new THREE.MeshLambertMaterial({ map: rep(stripeTex(), 2, 3) });
    for (const [x, z] of [[-4, -4], [4, -4], [-4, -10], [4, -10]] as const) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.4, 10), pillarMat);
      pil.position.set(x, 1.7, z); pil.castShadow = true; R.add(pil);
    }
    // ---- pachinko machines (row at z = -8, screens face +z) ----
    const screenKeys: [string, string, string][] = [["pachScr1", "#ff5a8a", "#7a2aff"], ["pachScr2", "#2affc4", "#2a6aff"], ["pachScr3", "#ffb02a", "#ff2a5a"]];
    screenKeys.forEach(([key, h1, h2]) => {
      const m = new THREE.MeshBasicMaterial({ map: screenTex(key, h1, h2) });
      this.screenMats.push(m);
    });
    const machineBody = new THREE.MeshLambertMaterial({ color: "#7a1e28" });
    const machineTrim = new THREE.MeshLambertMaterial({ color: "#e8c45a" });
    for (let i = 0; i < 8; i++) {
      const x = -6.3 + i * 1.8;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.5), machineBody);
      body.position.y = 0.95; body.castShadow = true;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.95), this.screenMats[i % 3]);
      scr.position.set(0, 1.15, 0.26);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.52), machineTrim);
      trim.position.y = 1.82;
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.4), new THREE.MeshLambertMaterial({ color: "#2a2a30" }));
      tray.position.set(0, 0.42, 0.32);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 12), new THREE.MeshLambertMaterial({ color: "#c23b2e" }));
      stool.position.set(0, 0.25, 1.0); stool.castShadow = true;
      g.add(body, scr, trim, tray, stool);
      g.position.set(x, 0, -8);
      R.add(g);
    }
    // ---- counter + NO CASH sign + prize shelf ----
    box(6, 1.05, 0.8, new THREE.MeshLambertMaterial({ map: woodTex() }), 0, 0.525, -11.2);
    box(6.3, 0.08, 1.0, new THREE.MeshLambertMaterial({ color: "#d8c8a8" }), 0, 1.09, -11.2);
    const noCash = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.55),
      new THREE.MeshBasicMaterial({ map: signTex("pachNoCash", "NO CASH", "#ffffff", "#8e1e28") }));
    noCash.position.set(0, 1.95, -13.8); R.add(noCash);
    this.neonMats.push(noCash.material as THREE.MeshBasicMaterial);
    // prize shelf unit at x = 4.5
    const shelfFrame = new THREE.MeshLambertMaterial({ map: woodTex() });
    box(3.2, 2.6, 0.5, shelfFrame, 4.5, 1.3, -12.7);
    for (const y of [0.7, 1.35, 2.0]) box(3.0, 0.06, 0.6, shelfFrame, 4.5, y, -12.45);
    const snackCols = ["#e74c3c", "#e67e22", "#2a9d8f", "#e9c46a", "#9b59b6"];
    for (let i = 0; i < 6; i++) // snacks, top shelf
      box(0.34, 0.42, 0.3, new THREE.MeshLambertMaterial({ color: snackCols[i % 5] }), 3.3 + i * 0.48, 2.25, -12.45);
    for (let i = 0; i < 5; i++) { // shampoo bottles, middle shelf
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8), new THREE.MeshLambertMaterial({ color: ["#4ad6ff", "#ff9ecb", "#a8e063", "#ffd34d", "#c9b8ff"][i] }));
      b.position.set(3.4 + i * 0.55, 1.62, -12.45); R.add(b);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), new THREE.MeshLambertMaterial({ color: "#f2f2f2" }));
      cap.position.set(3.4 + i * 0.55, 1.9, -12.45); R.add(cap);
    }
    const goldMat = new THREE.MeshPhongMaterial({ color: "#e8c45a", specular: "#fff2b8", shininess: 90, emissive: "#4a3608" });
    for (let i = 0; i < 5; i++) // gold cards on the bottom shelf (the prop card is separate)
      box(0.24, 0.34, 0.03, goldMat, 3.5 + i * 0.5, 0.95, -12.42, false);

    // ---- neon signs on the hall facade ----
    const mkSign = (texKey: string, text: string, fg: string, bg: string, w: number, h: number, x: number, y: number, z: number, vertical = false, yaw = 0) => {
      const m = new THREE.MeshBasicMaterial({ map: signTex(texKey, text, fg, bg, vertical) });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      s.position.set(x, y, z); s.rotation.y = yaw; R.add(s); this.neonMats.push(m); return s;
    };
    mkSign("pachSignPach", "PACHINKO", "#ff9ecb", "#3a0a24", 0.9, 3.6, 5.5, 5.6, -0.75, true);
    mkSign("pachSignHall", "PRIZE HALL", "#ffe066", "#2a1a08", 4.2, 0.8, 0, 3.6, -0.75);
    mkSign("pachSignArrow", ">>>", "#ffe066", "#3a2a08", 1.4, 0.6, 6.8, 2.6, -0.75);
    mkSign("pachSignYen", "¥4", "#4ad6ff", "#082a3a", 0.8, 0.8, -5.5, 3.2, -0.75);
    const signGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("pachSignGlow", "rgba(255,110,170,0.55)", "rgba(255,110,170,0.2)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    signGlow.position.set(5.5, 5.6, -0.3); signGlow.scale.setScalar(5); signGlow.layers.set(NOINK); R.add(signGlow);
    // neon strip along the facade top
    const strip = new THREE.Mesh(new THREE.BoxGeometry(18, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: "#ff6ba8" }));
    strip.position.set(0, 4.15, -0.75); R.add(strip);

    // ---- neighbouring hall fronts (scale shot) + street buildings ----
    const nbCols = ["#2e3a55", "#3a2e4a", "#24384a", "#4a2e35"];
    for (const [x, hgt, ci] of [[-13.5, 6, 0], [-11.2, 5, 1], [11.2, 5.5, 2], [13.5, 6.5, 3]] as const) {
      box(2.6, hgt, 3, new THREE.MeshLambertMaterial({ map: facadeTex(`pachNb${x}`, nbCols[ci], 0.5) }), x, hgt / 2, -1);
      mkSign(`pachNbSign${x}`, x < 0 ? "SLOTS" : "PACHINKO", "#4ad6ff", "#0a2438", 0.7, 2.6, x, hgt + 0.6, 0.6, true);
    }
    const bCols = ["#232c40", "#2c2438", "#1f3040", "#33262e", "#28323e"];
    for (let i = 0; i < 5; i++) { // south row (behind the street cameras)
      const w = 4.5 + hh(i, 3) * 2, hgt = 6 + hh(i, 4) * 3;
      box(w, hgt, 4, new THREE.MeshLambertMaterial({ map: facadeTex(`pachSouth${i}`, bCols[i], 0.45) }), -12 + i * 6, hgt / 2, 17);
    }
    for (let i = 0; i < 3; i++) { // east + west flanks
      box(4, 8 + hh(i, 5) * 4, 5, new THREE.MeshLambertMaterial({ map: facadeTex(`pachEast${i}`, bCols[(i + 1) % 5], 0.4) }), 15, 4 + hh(i, 5) * 2, 1 + i * 5);
      box(4, 7 + hh(i, 6) * 5, 5, new THREE.MeshLambertMaterial({ map: facadeTex(`pachWest${i}`, bCols[(i + 2) % 5], 0.4) }), -15, 3.5 + hh(i, 6) * 2.5, 1 + i * 5);
    }
    for (let i = 0; i < 6; i++) { // distant towers behind the hall
      const hgt = 14 + hh(i, 7) * 12;
      box(6, hgt, 6, new THREE.MeshLambertMaterial({ map: facadeTex(`pachTower${i}`, "#1a2233", 0.35) }), -30 + i * 12, hgt / 2, -28);
    }
    // red lanterns over the street
    for (const [x, z] of [[-6, 13], [0, 13.5], [6, 13]] as const) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshBasicMaterial({ color: "#ff4a3a" }));
      lamp.position.set(x, 3.1, z); lamp.scale.y = 0.85; R.add(lamp);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(`pachLamp${x}`, "rgba(255,90,60,0.6)", "rgba(255,60,40,0.25)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      gl.position.set(x, 3.1, z); gl.scale.setScalar(1.6); gl.layers.set(NOINK); this.lanternGlows.push(gl); R.add(gl);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4), new THREE.MeshBasicMaterial({ color: "#111111" }));
      cord.position.set(x, 3.9, z); R.add(cord);
    }

    // ---- prize-exchange window + alley (wall x = 10, opening z 5..7, y 0.9..2.3) ----
    const brickMat = new THREE.MeshLambertMaterial({ map: brickTex() });
    box(0.5, 4, 2, brickMat, 10, 2, 4);       // wall south of the opening
    box(0.5, 4, 2, brickMat, 10, 2, 8);       // wall north of the opening
    box(0.5, 0.9, 2, brickMat, 10, 0.45, 6);  // below the opening
    box(0.5, 1.7, 2, brickMat, 10, 3.15, 6);  // above the opening
    box(0.7, 0.08, 2.2, new THREE.MeshLambertMaterial({ map: woodTex() }), 9.85, 0.94, 6); // ledge
    const winGlowTex = ctex("pachWinGlow", 128, 96, (g) => {
      const gr = g.createRadialGradient(64, 48, 6, 64, 48, 70);
      gr.addColorStop(0, "#ffd9a0"); gr.addColorStop(0.55, "#b07a3e"); gr.addColorStop(1, "#3a2412");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 96);
    });
    const winGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshBasicMaterial({ map: winGlowTex }));
    winGlow.position.set(10.9, 1.6, 6); winGlow.rotation.y = -Math.PI / 2; R.add(winGlow);
    box(3.4, 4.4, 7, new THREE.MeshLambertMaterial({ map: facadeTex("pachAlleySide", "#252a38", 0.3) }), 12.2, 2.2, 6); // alley side building
    box(1.2, 0.3, 6.4, wallMat, 10, 4.15, 6); // alley roof slab
    // crates + bottles at the wall base
    const crateMat = new THREE.MeshLambertMaterial({ map: woodTex() });
    box(0.7, 0.7, 0.7, crateMat, 9.3, 0.35, 4.4);
    box(0.6, 0.6, 0.6, crateMat, 9.35, 1.0, 4.4);
    box(0.7, 0.7, 0.7, crateMat, 9.3, 0.35, 7.8);
    for (let i = 0; i < 4; i++) {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8), new THREE.MeshPhongMaterial({ color: "#2a6a3a", specular: "#aaccff", shininess: 60 }));
      bt.position.set(9.15 + (i % 2) * 0.25, 1.45, 4.25 + Math.floor(i / 2) * 0.25); R.add(bt);
    }
    // ---- warehouse (door faces +x at x = -10) ----
    const corrMat = new THREE.MeshLambertMaterial({ map: rep(corrugTex(), 3, 2) });
    box(4, 4.5, 6, corrMat, -12, 2.25, 6);
    const doorRecess = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.8, 2.6), new THREE.MeshLambertMaterial({ color: "#14161c" }));
    doorRecess.position.set(-9.95, 1.4, 6); R.add(doorRecess);
    const roller = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshLambertMaterial({ map: rep(corrugTex(), 2, 1), color: "#8a94a8" }));
    roller.position.set(-9.8, 2.6, 6); roller.rotation.y = Math.PI / 2; R.add(roller);
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), new THREE.MeshBasicMaterial({ map: winGlowTex }));
    doorGlow.position.set(-9.78, 1.15, 6); doorGlow.rotation.y = Math.PI / 2; R.add(doorGlow);
    mkSign("pachWholesale", "WHOLESALE", "#e8e4da", "#2a3548", 3.0, 0.6, -9.75, 3.6, 6, false, Math.PI / 2);
    // stacked boxes inside + outside the door
    const cardMat = new THREE.MeshLambertMaterial({ color: "#b08a4e" });
    const stackDefs: [number, number, number, number][] = [
      [-9.55, 0.3, 4.6, 0.6], [-9.55, 0.9, 4.6, 0.6], [-9.55, 0.3, 5.3, 0.6],
      [-9.55, 0.3, 6.9, 0.6], [-9.55, 0.9, 6.9, 0.6], [-9.55, 1.5, 6.9, 0.6],
      [-9.4, 0.3, 4.6, 0.6], [-9.4, 0.3, 7.4, 0.6], [-9.5, 0.9, 7.4, 0.6],
    ];
    for (const [x, y, z, s] of stackDefs) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), Math.random() < 0.5 ? cardMat : crateMat);
      b.position.set(x, y, z); b.rotation.y = (hh(x * 10 + z, 2) - 0.5) * 0.3; b.castShadow = true; R.add(b);
    }

    // ---- van (black, gold stripe, headlights) ----
    this.van = new THREE.Group();
    const vanBody = new THREE.MeshLambertMaterial({ color: "#16161a" });
    const vBody = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 3.6), vanBody);
    vBody.position.y = 1.05; vBody.castShadow = true;
    const vCab = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.7, 0.9), vanBody);
    vCab.position.set(0, 0.85, 2.0); vCab.castShadow = true;
    const vGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), new THREE.MeshPhongMaterial({ color: "#9ab8d8", specular: "#ffffff", shininess: 120 }));
    vGlass.position.set(0, 1.15, 2.46); vGlass.rotation.x = -0.25;
    const vStripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 3.62), goldMat);
    vStripe.position.y = 0.75;
    const wheelMat = new THREE.MeshLambertMaterial({ color: "#0a0a0c" });
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
    for (const [x, z] of [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]] as const) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); this.van.add(w);
    }
    for (const s of [-1, 1]) {
      const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(`pachHead${s}`, "rgba(255,250,220,0.95)", "rgba(255,240,180,0.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      hl.position.set(s * 0.55, 0.75, 2.5); hl.scale.setScalar(0.8); hl.layers.set(NOINK); this.van.add(hl);
    }
    this.van.add(vBody, vCab, vGlass, vStripe);
    R.add(this.van);

    // ---- macro gold card (shot 1): portrait card + plastic case + flare ----
    this.macroCard = new THREE.Group();
    const mcFace = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.03), new THREE.MeshBasicMaterial({ map: goldCardTex() }));
    mcFace.castShadow = false;
    this.macroFlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.macroFlare.position.set(0.14, 0.18, 0.08); this.macroFlare.layers.set(NOINK);
    this.macroGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex("pachMacroGlow", "rgba(255,210,90,0.5)", "rgba(255,180,50,0.2)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.macroGlow.scale.setScalar(1.6); this.macroGlow.layers.set(NOINK);
    this.macroCard.add(mcFace, this.macroFlare, this.macroGlow);
    this.macroCard.position.set(...CARD_MACRO);
    R.add(this.macroCard);
    this.pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.5, 20), new THREE.MeshLambertMaterial({ color: "#1c1c22" }));
    this.pedestal.position.set(CARD_MACRO[0], 0.25, CARD_MACRO[2]); this.pedestal.castShadow = true; R.add(this.pedestal);

    // ---- small gold card prop + cash prop + wooden box ----
    this.smallCard = new THREE.Group();
    const sc = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.012), new THREE.MeshBasicMaterial({ map: goldCardTex() }));
    this.smallGlint = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.smallGlint.scale.setScalar(0.3); this.smallGlint.layers.set(NOINK);
    this.smallCard.add(sc, this.smallGlint);
    R.add(this.smallCard);
    this.cashProp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.12), new THREE.MeshLambertMaterial({ color: "#d8e8c8" }));
    const cashBand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), new THREE.MeshLambertMaterial({ color: "#c23b2e" }));
    this.cashProp.add(cashBand);
    R.add(this.cashProp);
    this.boxGroup = new THREE.Group();
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.35), crateMat);
    boxBase.position.y = 0.14; boxBase.castShadow = true;
    const boxInner = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.29), new THREE.MeshLambertMaterial({ color: "#3a2a1a" }));
    boxInner.position.y = 0.27;
    this.boxLid = new THREE.Group();
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.37), crateMat);
    lidMesh.position.set(0.26, 0.025, 0);
    this.boxLid.add(lidMesh);
    this.boxLid.position.set(-0.25, 0.29, 0); // hinge at the west edge: lid flips sideways, clerk stays visible
    this.boxGroup.add(boxBase, boxInner, this.boxLid);
    R.add(this.boxGroup);

    // ---- the GLOWING GOLD LOOP LINE: 72 segments on the ellipse + aerial ring + traveler ----
    const segGeo = new THREE.BoxGeometry(0.78, 0.025, 0.1);
    const segMat = new THREE.MeshBasicMaterial({ color: "#ffd34d", fog: false });
    const NSEG = 72;
    for (let i = 0; i < NSEG; i++) {
      const u0 = i / NSEG, u1 = (i + 1) / NSEG;
      const [x0, z0] = loopPoint(u0), [x1, z1] = loopPoint(u1);
      const seg = new THREE.Mesh(segGeo, segMat);
      seg.position.set((x0 + x1) / 2, 0.045, (z0 + z1) / 2);
      seg.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      seg.layers.set(NOINK);
      this.loopSegs.push(seg); R.add(seg);
      if (i % 6 === 0) {
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(`pachLoop${i}`, "rgba(255,210,90,0.8)", "rgba(255,180,50,0.3)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        gl.position.set((x0 + x1) / 2, 0.12, (z0 + z1) / 2); gl.scale.setScalar(0.7); gl.layers.set(NOINK);
        this.loopGlows.push(gl); R.add(gl);
      }
    }
    this.aerialRingMat = new THREE.MeshBasicMaterial({ color: "#ffd34d", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.aerialRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1.0, 96), this.aerialRingMat);
    this.aerialRing.rotation.x = -Math.PI / 2;
    this.aerialRing.scale.set(9.5, 7, 1);
    this.aerialRing.position.set(0, 0.06, 6);
    this.aerialRing.layers.set(NOINK);
    R.add(this.aerialRing);
    this.traveler = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.traveler.scale.setScalar(1.4); this.traveler.layers.set(NOINK); R.add(this.traveler);

    // ---- ball cascade: 170 steel balls with gravity (shot 5) ----
    {
      const n = 260;
      this.cascadePos = new Float32Array(n * 3);
      this.cascadeSeed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        this.cascadeSeed.set([hh(i, 51), hh(i, 52), hh(i, 53), hh(i, 54)], i * 4);
        this.cascadePos.set([0, -10, 0], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.cascadePos, 3));
      this.cascadeMat = new THREE.PointsMaterial({ color: "#ffffff", size: 0.09, map: ballTex(), transparent: true, opacity: 0.98, depthWrite: false, fog: false });
      this.cascade = new THREE.Points(g, this.cascadeMat);
      this.cascade.frustumCulled = false; this.cascade.layers.set(NOINK);
      R.add(this.cascade);
    }
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], du = dawnU(f);
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- lights: night -> dawn ramp ----
    this.hemi.color.set("#8aa3cc").lerp(new THREE.Color("#cfd8e8"), du);
    this.hemi.groundColor.set("#4a4238").lerp(new THREE.Color("#8a8078"), du);
    this.hemi.intensity = lerp(0.8, 1.15, du);
    const moonDir = V(-0.35, 0.75, -0.55).normalize();
    this.moon.color.set("#b8cdea");
    this.moon.intensity = lerp(1.2, 0.15, du);
    this.moon.position.copy(focus).addScaledVector(moonDir, 220);
    this.moon.target.position.copy(focus);
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 40);
    const sc = this.moon.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 150; sc.far = 320; sc.updateProjectionMatrix();
    this.moon.shadow.bias = -0.0003; this.moon.shadow.normalBias = 0.03;
    const sunDir = V(0.85, 0.35, -0.4).normalize();
    this.sun.position.copy(focus).addScaledVector(sunDir, 220);
    this.sun.target.position.copy(focus);
    this.sun.intensity = lerp(0, 3.0, du);
    this.sun.castShadow = du > 0.6;
    this.hallLights.forEach((pl, i) => { pl.intensity = lerp(22, 10, du) * (1 + 0.05 * Math.sin(t * 7 + i * 2)); });
    this.windowLight.intensity = lerp(8, 4, du);
    this.warehouseLight.intensity = lerp(12, 6, du);
    this.pedestal.visible = id === 1;
    this.reflections.forEach((r) => { r.visible = id !== 4 && id !== 14; });
    // machine win light: spikes with the cascade
    const ck = cascadeK(f);
    this.machineLight.intensity = 4 + ck * (8 + 4 * Math.sin(t * 18));
    // character card uniforms: cool moonlit tint at night, warming to dawn
    CHAR.uCharTint.value.set(lerp(0.88, 1.0, du), lerp(0.94, 0.94, du), lerp(1.06, 0.92, du));
    CHAR.uCharShade.value = lerp(0.78, 0.86, du);
    CHAR.uGrad.value = 0.07; CHAR.uBodyGrad.value = 0.2;
    CHAR.uSideTint.value.set(lerp(0.85, 0.92, du), lerp(0.88, 0.9, du), lerp(1.0, 0.96, du));
    // ---- sky, fog, moon, stars ----
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
    this.fog.near = lerp(30, 45, du); this.fog.far = lerp(220, 280, du);
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
    // ---- machine screens flicker + neon dim slightly at dawn ----
    this.screenMats.forEach((m, i) => {
      const k = 0.85 + 0.3 * Math.max(0, Math.sin(t * 6 + i * 2.1));
      m.color.setRGB(k, k, k);
    });
    this.neonMats.forEach((m) => { const k = lerp(1, 0.75, du); m.color.setRGB(k, k, k); });
    this.lanternGlows.forEach((gl, i) => {
      (gl.material as THREE.SpriteMaterial).opacity = 0.8 + 0.15 * Math.sin(t * 3 + i * 2);
    });
    // ---- macro card (shot 1 only) ----
    this.macroCard.visible = id === 1;
    if (id === 1) {
      this.macroCard.rotation.y = cardFlip(f);
      this.macroCard.rotation.x = -0.08 + 0.03 * Math.sin(t * 1.5);
      this.macroCard.position.y = CARD_MACRO[1] + 0.03 * Math.sin(t * 1.8);
      const fk = flareK(f);
      (this.macroFlare.material as THREE.SpriteMaterial).opacity = Math.min(1, fk);
      this.macroFlare.scale.setScalar(0.35 + fk * 0.75);
      this.macroFlare.visible = fk > 0.03;
      (this.macroGlow.material as THREE.SpriteMaterial).opacity = 0.5 + fk * 0.4;
    }
    // ---- small gold card prop ----
    const ca = cardAt(id, f);
    this.smallCard.visible = ca.vis;
    if (ca.vis) {
      this.smallCard.position.set(...ca.p);
      this.smallCard.rotation.y = ca.spin + 0.25 * Math.sin(t * 2);
      this.smallCard.rotation.x = -0.15;
      const gl = 0.4 + 0.6 * Math.max(0, Math.sin(t * 3.2));
      (this.smallGlint.material as THREE.SpriteMaterial).opacity = gl;
      this.smallGlint.visible = gl > 0.15;
    }
    // ---- cash prop (shot 8 slide-back) ----
    const cash = cashAt(f);
    this.cashProp.visible = id === 8 && cash.vis;
    if (this.cashProp.visible) {
      this.cashProp.position.set(...cash.p);
      this.cashProp.rotation.y = 0.3;
    }
    // ---- wooden box + lid ----
    const bx = boxAt(id, f);
    this.boxGroup.visible = bx.vis;
    if (bx.vis) {
      this.boxGroup.position.set(bx.p[0], bx.p[1] - 0.28, bx.p[2]);
      // lid open through shot 8, closes in shot 9, stays shut after
      const open = id === 8 ? 1 : 1 - lidU(f);
      this.boxLid.rotation.z = open * 1.9;
    }
    // ---- van ----
    const vn = vanAt(id, f);
    this.van.visible = vn.vis;
    if (vn.vis) {
      this.van.position.set(...vn.p);
      this.van.rotation.y = vn.yaw;
    }
    // ---- loop line reveal + aerial ring + traveler ----
    const lu = loopU(f);
    const nSeg = this.loopSegs.length;
    this.loopSegs.forEach((seg, i) => { seg.visible = lu > 0 && i / nSeg <= lu; });
    this.loopGlows.forEach((gl, i) => {
      const on = lu > 0 && (i * 6) / nSeg <= lu;
      gl.visible = on;
      if (on) (gl.material as THREE.SpriteMaterial).opacity = 0.65 + 0.3 * Math.sin(t * 2.5 + i);
    });
    const aerial = id === 14 || id === 15;
    this.aerialRing.visible = aerial;
    if (aerial) this.aerialRingMat.opacity = 0.55 + 0.25 * Math.sin(t * 2.2);
    this.traveler.visible = aerial;
    if (aerial) {
      const [tx, tz] = loopPoint((t * 0.12) % 1);
      this.traveler.position.set(tx, 0.25, tz);
      (this.traveler.material as THREE.SpriteMaterial).opacity = 0.85 + 0.15 * Math.sin(t * 4);
    }
    // ---- ball cascade (shot 5): gravity arcs from the machine tray into the bucket ----
    this.cascade.visible = ck > 0;
    if (ck > 0) {
      const n = 260;
      for (let i = 0; i < n; i++) {
        const ph = this.cascadeSeed[i * 4], sx = this.cascadeSeed[i * 4 + 1], sz = this.cascadeSeed[i * 4 + 2], sp = this.cascadeSeed[i * 4 + 3];
        const cycle = 0.8, age = (((t * (0.9 + sp * 0.3) + ph) % 1) + 1) % 1 * cycle;
        const x0 = -0.95 + sx * 0.4, z0 = -7.0 + sz * 0.2;
        const vx = (sx - 0.5) * 0.3, vy = -0.3, vz = 2.0;
        const y = 1.5 + vy * age - 4.9 * age * age;
        if (y < 0.72 || age > 0.45) { this.cascadePos.set([0, -10, 0], i * 3); continue; } // landed in the bucket
        this.cascadePos.set([x0 + vx * age, y, z0 + vz * age], i * 3);
      }
      (this.cascade.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.cascadeMat.opacity = 0.95 * ck;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stagePachinko(id, t, f, { pos: cam.position, right });
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
