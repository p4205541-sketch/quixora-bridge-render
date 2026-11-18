// "Why The Same Gold Card Pays Everyone": the pachinko three-shop loop on the 3D stack.
// One persistent night-city set re-lit to dawn; the glowing gold loop line is the
// own-world signature. NO post chain: the EffectComposer outputs zero pixels under
// SwiftShader (proven in every configuration), so this composition has no composer
// code path at all — the grade is applied later as a local ffmpeg post step.
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { PachinkoWorld } from "./world";
import { TOTAL, shotAt, flareK } from "./story";

export const PACHINKO_FRAMES = TOTAL;

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new PachinkoWorld(), []);
  world.update(shotAt(f).id, f, camera as THREE.PerspectiveCamera, scene);
  return <primitive object={world.root} dispose={null} />;
};

export const PachinkoLoopShort: React.FC = () => {
  const f = useCurrentFrame();
  const flare = flareK(f);
  return (
    <AbsoluteFill style={{ background: "#0e1a30" }}>
      <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
        camera={{ fov: 40, near: 0.2, far: 1500 }}>
        <Inner />
      </ThreeCanvas>
      {flare > 0.55 && (
        <AbsoluteFill style={{
          background: "radial-gradient(circle at 50% 38%, rgba(255,244,200,0.35) 0%, rgba(255,220,120,0.12) 30%, rgba(255,210,90,0) 55%)",
          opacity: Math.min(0.6, (flare - 0.55) * 1.4),
        }} />
      )}
    </AbsoluteFill>
  );
};
