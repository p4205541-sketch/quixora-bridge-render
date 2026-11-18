// "Why Samurai Never Touched Quiet Bombs": the first Quixora story on the 3D stack.
// Defender-side tetsuhau story (V1 script/characters), one persistent night-camp world
// re-lit to dawn. NO post chain: the EffectComposer outputs zero pixels under SwiftShader
// (proven in every configuration), so this composition has no composer code path at all —
// the grade is applied later as a local ffmpeg post step. The blast flash is a DOM overlay.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ThunderWorld } from "./world";
import { TOTAL, shotAt, flashK } from "./story";

export const THUNDER_FRAMES = TOTAL;

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new ThunderWorld(), []);
  world.update(shotAt(f).id, f, camera as THREE.PerspectiveCamera, scene);
  return <primitive object={world.root} dispose={null} />;
};

export const FlyingThunderShort: React.FC = () => {
  const f = useCurrentFrame();
  const flash = flashK(f);
  return (
    <AbsoluteFill style={{ background: "#0e1a30" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Inner />
      </ThreeCanvas>
      {flash > 0.02 && <AbsoluteFill style={{ background: "#fff2cc", opacity: Math.min(0.85, flash) }} />}
    </AbsoluteFill>
  );
};
