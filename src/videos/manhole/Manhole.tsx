// ManholeShort composition — mirrors Bridge.tsx's structure, NO EffectComposer anywhere.
// post.composer:false always. TOTAL 1770 frames @ 30fps, 1080x1920.
// Captions: lowercase white with thick black outline, lower third; stats in bold orange capitals.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ManholeWorld, loadKit } from "./world";
import { Kit } from "../bridge/build";
import { TOTAL, shotAt } from "./story";

export const DURATION = TOTAL;

// one entry per shot (id 1-18): the spoken line (lowercase caption) + timed stat pop-up
const CAPTIONS: { line: string; stat?: string; note?: string }[] = [
  { line: "this iron lid weighs up to 275 pounds, and nothing but its shape holds it up.", stat: "275 POUNDS" },
  { line: "every day, you walk right over it." },
  { line: "but in new york alone, there are 267,000 of them.", stat: "267,000" },
  { line: "and every year, around 2,000 of them smoke or explode.", stat: "2,000" },
  { line: "so why not make them square?" },
  { line: "a square lid would do the same job, and it would be cheaper to make." },
  { line: "it sounds sensible, until you turn it on its edge." },
  { line: "a square's diagonal is 1.414 times longer than its side.", stat: "1.414x" },
  { line: "turn it on edge, and it slips straight through its own hole." },
  { line: "but a circle is the same width in every direction." },
  { line: "turn it however you like, it cannot fall in." },
  { line: "that's reason one. reason two: you can roll it." },
  { line: "no crane, no carrying, just roll it into place." },
  { line: "reason three: no corners to line up, so it fits every time." },
  { line: "one american city tried triangles instead, 7,500 of them, and spent years swapping them all back.", stat: "7,500" },
  { line: "and the lid itself is lab-tested to survive 40 tonnes of force.", stat: "40 TONNES", note: "lab test" },
  { line: "so the next time you step over one, remember, the shape is doing all the work." },
  { line: "for more stories like this, like, share, and comment on the video, and make sure to subscribe and follow!" },
];

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("manhole kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new ManholeWorld(kit), [kit]);
  gl.toneMapping = THREE.NoToneMapping;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  world.update(id, f, camera as THREE.PerspectiveCamera, scene);
  return <primitive object={world.root} dispose={null} />;
};

export const ManholeShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  const id = shotAt(f).id;
  const cap = CAPTIONS[id - 1];
  const flash = f >= 1228 && f < 1234 ? [1, 0.75, 0.45, 0.2, 0.1, 0][f - 1228] ?? 0 : 0;
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      {kit && (
        <ThreeCanvas width={1080} height={1920} shadows
          gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
          camera={{ fov: 50, near: 0.2, far: 1500 }}>
          <Inner id={id} kit={kit} />
        </ThreeCanvas>
      )}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {cap.stat && (
          <div style={{ position: "absolute", left: "50%", top: "38%", transform: "translateX(-50%)", textAlign: "center", width: "92%" }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 72, fontWeight: 900, color: "#ff9d33", textTransform: "uppercase", lineHeight: 1, textShadow: "0 5px 0 #000, 0 0 18px rgba(0,0,0,.8)" }}>{cap.stat}</div>
            {cap.note && <div style={{ fontFamily: "Arial, sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", textTransform: "uppercase", textShadow: "0 3px 0 #000, 0 0 12px rgba(0,0,0,.8)" }}>{cap.note}</div>}
          </div>
        )}
        <div style={{ position: "absolute", left: "50%", bottom: 190, transform: "translateX(-50%)", textAlign: "center", width: "90%" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 -3px 0 #000, 0 0 14px rgba(0,0,0,.8)" }}>{cap.line}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
