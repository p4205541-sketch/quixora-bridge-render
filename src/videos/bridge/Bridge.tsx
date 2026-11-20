// "The Bridge That Fell for a Song": our original 67 s short in the flat-characters-in-a-3D-toon-world style.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (look-match pass):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

export const BRIDGE_FRAMES = TOTAL;

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean; composer: boolean; fbtype: "half" | "byte"; msaa: number; depth: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false, composer: true, fbtype: "half", msaa: 4, depth: false, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

/** Depth-pass stills (post.depth, composer off): linearised grayscale depth, WHITE = NEAR, black = far, linear in
 *  metres over [DEPTH_MIN, DEPTH_MAX]. MeshDepthMaterial on its own writes 1 - gl_FragCoord.z (hyperbolic: the whole
 *  40-110 m town-aerial range would crush to ~1 gray level), so onBeforeCompile replaces the packed output with a
 *  linear ramp from the true view distance (camera near/far are the ShotView values below: 0.2 / 1500). The depth
 *  shader has no fog / tone-mapping chunks, so the output is raw. Map + alphaTest (+ alphaMap / displacementMap)
 *  are copied per source material so cut-out cards keep their silhouettes. Transparent non-depth-writing objects (clouds, smoke, soft fx, sun sprites)
 *  carry no depth info and are hidden by applyDepthPass. Convention matches the depth-studio compositor's default
 *  (near = white, far = black), so no --invert-depth is needed. */
const DEPTH_MIN = 1, DEPTH_MAX = 150;
const DEPTH_BACKGROUND = new THREE.Color(0x000000);
const depthCache = new WeakMap<THREE.Material, THREE.MeshDepthMaterial>();
/** mesh -> beauty material(s) as seen on its first depth swap. Static world geometry keeps its
 *  material forever, so without this the swap would wrap the depth material in a new depth
 *  material every frame (linearDepth(depthMat) is a cache miss: new instance per frame). Fx
 *  cards get their material reassigned by world.update() each frame (cast.ts Fx.use/bind), so
 *  the stored source is refreshed whenever the current material is neither the stored source
 *  nor its depth material. WeakMap: dropped meshes (and their entries) are GC'd. */
/** Create (or reuse) a linearised depth material for a source material, preserving alpha cut-outs and displacement.
 *  Hardening merged from the ChatGPT-integrated ZIP: shader-patch guard (throws instead of silently keeping the
 *  hyperbolic depth output if three.js changes the output line), alphaMap + displacementMap support, toneMapped
 *  off. The depth shader has no fog / tone-mapping / colorspace chunks (verified in three 0.187.0 source), so the
 *  output is raw linear regardless. Cache-hit path re-copies map/alphaMap so expression swaps track (stills: the
 *  swap runs once; video must re-run the swap every frame — see the useFrame comment below). */
const linearDepth = (src: THREE.Material): THREE.MeshDepthMaterial => {
  const srcAny = src as THREE.MeshDepthMaterial & {
    map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; alphaTest?: number;
    displacementMap?: THREE.Texture | null; displacementScale?: number; displacementBias?: number;
  };
  let dm = depthCache.get(src);
  if (dm) {
    if (dm.map !== (srcAny.map ?? null)) { dm.map = srcAny.map ?? null; dm.needsUpdate = true; }
    if (dm.alphaMap !== (srcAny.alphaMap ?? null)) { dm.alphaMap = srcAny.alphaMap ?? null; dm.needsUpdate = true; }
    return dm;
  }
  dm = new THREE.MeshDepthMaterial({
    depthPacking: THREE.BasicDepthPacking, side: src.side,
    map: srcAny.map ?? null, alphaMap: srcAny.alphaMap ?? null, alphaTest: srcAny.alphaTest ?? 0,
    displacementMap: srcAny.displacementMap ?? null, displacementScale: srcAny.displacementScale ?? 1,
    displacementBias: srcAny.displacementBias ?? 0, toneMapped: false,
  });
  // NOTE: no `fog` flag here — MeshDepthMaterial has no fog property in the three.js
  // types, and the depth shader has no fog chunk anyway (verified in three 0.187.0
  // source); scene-level fog is cleared in applyDepthPass instead.
  dm.onBeforeCompile = (shader) => {
    shader.uniforms.uNear = { value: 0.2 };
    shader.uniforms.uFar = { value: 1500 };
    shader.uniforms.uDMin = { value: DEPTH_MIN };
    shader.uniforms.uDMax = { value: DEPTH_MAX };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNear;\nuniform float uFar;\nuniform float uDMin;\nuniform float uDMax;")
      .replace(
        /gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*1\.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\);/,
        `float viewD = uNear / max(1.0 - fragCoordZ * (uFar - uNear) / uFar, 1e-4);
         float linT = clamp((viewD - uDMin) / (uDMax - uDMin), 0.0, 1.0);
         gl_FragColor = vec4(vec3(1.0 - linT), 1.0);`,
      );
    if (!shader.fragmentShader.includes("linT")) {
      throw new Error("Depth shader patch failed: Three.js MeshDepthMaterial output signature changed.");
    }
  };
  depthCache.set(src, dm);
  return dm;
};
const depthSource = new WeakMap<THREE.Mesh, THREE.Material[]>();
const toDepth = (mats: THREE.Material[]): THREE.MeshDepthMaterial[] => mats.map(linearDepth);
/** Swap one mesh to its depth material, tracking its beauty source. At useFrame time the
 *  mesh's material is the current beauty material (world.update() just reassigned it via
 *  Fx.use/bind in the render body); static meshes still carry last frame's depth material. */
const swapMeshDepth = (m: THREE.Mesh): boolean => {
  const curArr = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
  const stored = depthSource.get(m);
  const setMat = (mats: THREE.Material[]) => { m.material = (Array.isArray(m.material) ? mats : mats[0]) as THREE.Material | THREE.Material[]; };
  if (!stored) {
    depthSource.set(m, curArr);
    setMat(toDepth(curArr));
    return true;
  }
  const storedDepth = toDepth(stored);
  const sameAs = (a: THREE.Material[], b: THREE.Material[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (sameAs(curArr, storedDepth)) return false; // already depth (static mesh) — leave it
  if (!sameAs(curArr, stored)) depthSource.set(m, curArr); // Fx reassigned: new beauty source
  setMat(toDepth(depthSource.get(m)!)); // cache hit for stored sources, fresh depth for new ones
  return true;
};
let lastDepthLog = "";
const applyDepthPass = (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
  // Depth values must stay raw linear: no fog, black background, linear output, no tone mapping. (The depth shader
  // itself has no fog / tone-mapping / colorspace chunks, so these are belt-and-braces for any non-depth pixels.)
  scene.fog = null;
  scene.background = DEPTH_BACKGROUND;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  let swapped = 0, hidden = 0;
  scene.traverse((o) => {
    if ((o as THREE.Sprite).isSprite) { o.visible = false; hidden++; return; } // sun disc/halo: effectively at infinity
    if ((o as THREE.Line).isLine || (o as THREE.Points).isPoints) { o.visible = false; hidden++; return; } // ink lines / point fx are not solid depth surfaces
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
    if (mats.some((x) => (x as THREE.MeshBasicMaterial).transparent && (x as THREE.MeshBasicMaterial).depthWrite === false)) {
      o.visible = false; hidden++; return; // clouds, smoke, soft fx: no depth info
    }
    // Visibility is re-asserted by world.update() in the render body before this runs (used Fx
    // visible=true, unused visible=false), so the swap never touches it: a mesh hidden here as
    // soft in one frame is re-shown by world.update() if it comes back hard in a later frame.
    if (swapMeshDepth(m)) swapped++;
  });
  const msg = `[depth] swapped ${swapped} meshes, hid ${hidden} objects`;
  if (msg !== lastDepthLog) { lastDepthLog = msg; console.log(msg); }
};

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("bridge kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  // Depth video: the swap runs EVERY frame in useFrame. The render body runs world.update()
  // before the frame's useFrame callbacks, and world.update() reassigns mesh.material via
  // Fx.use()/bind() (cast.ts) — so any depth material from the previous frame is overwritten
  // by a beauty material before each draw. At useFrame time the mesh's material IS the current
  // beauty material, so map it through linearDepth() again (swapMeshDepth tracks mesh->source,
  // so static meshes are not re-wrapped). Visibility is re-asserted by world.update() each
  // frame, so the hide of sprites / lines / points / transparent objects re-runs too. Stills
  // still work: the first frame's useFrame swap happens before the first draw, exactly as the
  // old once-guard did.
  useFrame(() => { if (on.depth) applyDepthPass(scene, gl); });
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    on.composer && !on.depth ? (
      <EffectComposer multisampling={on.msaa} frameBufferType={on.fbtype === "byte" ? THREE.UnsignedByteType : THREE.HalfFloatType}>
        {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
        {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null}
        {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
        {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
        <primitive object={fx.tone} dispose={null} />
        {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
        {on.grain ? <primitive object={fx.grain} dispose={null} /> : null}
      </EffectComposer>
    ) : null
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const BridgeShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = !toggles().depth && f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
