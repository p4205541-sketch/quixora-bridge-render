// BurglarShort composition — mirrors Manhole.tsx's structure, NO EffectComposer anywhere.
// post.composer:false always. TOTAL 1679 frames @ 30fps (real voice timings, 55.26 s),
// 1080x1920.
// Captions: Reference 14 style — sentence-case 1-3-WORD PHRASE CARDS synced to speech,
// white bold rounded sans with thick black outline, centered lower third.
// NO stat pop-ups, NO colored words, NO CTA (Reference 14 has none — Matching Rules Rule 9).
// Shot 10 gets a CCTV monitor-frame overlay (our own-world signature): CAM 01 + 03:00 timestamp + REC dot.
// CARDS below are from the real voice timings (audio/timings.json), regenerated with
// ~/workspace/quixora_short_burglar/regen_cards.py from the re-recorded voice.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { BurglarWorld, loadKit } from "./world";
import { Kit } from "../bridge/build";
import { TOTAL, shotAt } from "./story";

export const DURATION = TOTAL;

// Phrase cards (1-3 words) — REAL timings from audio/timings.json, 212 words,
// 98 cards, re-recorded voice (237.5 wpm speech), regenerated 20 Nov 23:57 IST.
const CARDS: { text: string; a: number; b: number }[] = [
  { text: "Every night,", a: 9.0, b: 23.7 },
  { text: "someone slipped", a: 23.7, b: 38.4 },
  { text: "into their home.", a: 38.4, b: 60.4 },
  { text: "But he never", a: 63.4, b: 86.8 },
  { text: "stole anything.", a: 86.8, b: 102.3 },
  { text: "He fixed", a: 102.3, b: 117.9 },
  { text: "things.", a: 117.9, b: 125.7 },
  { text: "Night one,", a: 128.7, b: 143.0 },
  { text: "the front door", a: 143.0, b: 164.6 },
  { text: "stopped squeaking.", a: 164.6, b: 178.9 },
  { text: "The dad", a: 182.0, b: 196.6 },
  { text: "noticed.", a: 196.6, b: 203.9 },
  { text: "That door", a: 203.9, b: 218.5 },
  { text: "had squeaked", a: 218.5, b: 233.2 },
  { text: "for six years.", a: 233.2, b: 255.1 },
  { text: "The next night,", a: 258.1, b: 282.0 },
  { text: "the wobbly table", a: 282.0, b: 305.8 },
  { text: "stood perfectly", a: 305.8, b: 321.7 },
  { text: "still.", a: 321.7, b: 329.6 },
  { text: "Mom set", a: 329.6, b: 345.5 },
  { text: "her coffee", a: 345.5, b: 361.4 },
  { text: "down.", a: 361.4, b: 369.3 },
  { text: "It didn't", a: 369.3, b: 385.2 },
  { text: "spill.", a: 385.2, b: 393.1 },
  { text: "A few nights", a: 396.1, b: 418.7 },
  { text: "later,", a: 418.7, b: 426.3 },
  { text: "the painting", a: 426.3, b: 441.3 },
  { text: "was straight,", a: 441.3, b: 456.4 },
  { text: "the bulb", a: 456.4, b: 471.5 },
  { text: "had stopped", a: 471.5, b: 486.5 },
  { text: "flickering,", a: 486.5, b: 494.1 },
  { text: "and the dad", a: 494.1, b: 516.7 },
  { text: "was sure", a: 516.7, b: 531.8 },
  { text: "the house", a: 531.8, b: 546.8 },
  { text: "was haunted.", a: 546.8, b: 561.9 },
  { text: "By a", a: 564.9, b: 580.8 },
  { text: "helpful ghost.", a: 580.8, b: 596.7 },
  { text: "So they", a: 599.7, b: 615.6 },
  { text: "called a priest.", a: 615.6, b: 639.5 },
  { text: "The priest", a: 639.5, b: 655.5 },
  { text: "blessed the", a: 655.5, b: 671.4 },
  { text: "living room,", a: 671.4, b: 687.4 },
  { text: "the kitchen,", a: 687.4, b: 703.3 },
  { text: "and the", a: 703.3, b: 719.2 },
  { text: "squeaky door.", a: 719.2, b: 735.2 },
  { text: "That night,", a: 738.2, b: 753.2 },
  { text: "the hinge", a: 753.2, b: 768.2 },
  { text: "got oiled", a: 768.2, b: 783.2 },
  { text: "anyway.", a: 783.2, b: 790.7 },
  { text: "So they", a: 793.7, b: 808.3 },
  { text: "set up", a: 808.3, b: 822.9 },
  { text: "a camera.", a: 822.9, b: 837.5 },
  { text: "At three", a: 837.5, b: 852.1 },
  { text: "in the morning,", a: 852.1, b: 874.0 },
  { text: "it caught", a: 874.0, b: 888.6 },
  { text: "a man", a: 888.6, b: 903.2 },
  { text: "in black,", a: 903.2, b: 917.8 },
  { text: "fixing the door", a: 917.8, b: 939.7 },
  { text: "with a tiny", a: 939.7, b: 961.6 },
  { text: "toolbox.", a: 961.6, b: 968.9 },
  { text: "The next night,", a: 971.9, b: 993.6 },
  { text: "the dad hid", a: 993.6, b: 1015.4 },
  { text: "behind the sofa", a: 1015.4, b: 1037.2 },
  { text: "with a flashlight.", a: 1037.2, b: 1059.0 },
  { text: "He caught him", a: 1062.0, b: 1084.4 },
  { text: "under the sink.", a: 1084.4, b: 1106.8 },
  { text: "And the man", a: 1106.8, b: 1129.2 },
  { text: "said, I'm", a: 1129.2, b: 1144.2 },
  { text: "so sorry,", a: 1144.2, b: 1159.1 },
  { text: "wrong house.", a: 1159.1, b: 1174.1 },
  { text: "The lady", a: 1177.1, b: 1192.6 },
  { text: "across the street", a: 1192.6, b: 1216.0 },
  { text: "hired me", a: 1216.0, b: 1231.5 },
  { text: "to fix", a: 1231.5, b: 1247.1 },
  { text: "her door.", a: 1247.1, b: 1262.7 },
  { text: "I've had", a: 1262.7, b: 1278.2 },
  { text: "the wrong address", a: 1278.2, b: 1301.6 },
  { text: "all week.", a: 1301.6, b: 1317.1 },
  { text: "He pointed", a: 1317.1, b: 1332.7 },
  { text: "at the house", a: 1332.7, b: 1356.0 },
  { text: "number.", a: 1356.0, b: 1363.8 },
  { text: "Sixteen.", a: 1363.8, b: 1371.6 },
  { text: "He'd been", a: 1371.6, b: 1387.2 },
  { text: "looking for", a: 1387.2, b: 1402.7 },
  { text: "sixty-one.", a: 1402.7, b: 1410.5 },
  { text: "Come morning,", a: 1413.5, b: 1427.9 },
  { text: "the dad taped", a: 1427.9, b: 1449.6 },
  { text: "a note", a: 1449.6, b: 1464.0 },
  { text: "to the handyman's", a: 1464.0, b: 1485.6 },
  { text: "toolbox.", a: 1485.6, b: 1492.8 },
  { text: "It said,", a: 1492.8, b: 1507.3 },
  { text: "the sink", a: 1507.3, b: 1521.7 },
  { text: "is leaking too.", a: 1521.7, b: 1543.3 },
  { text: "And the handyman", a: 1546.3, b: 1570.2 },
  { text: "smiled.", a: 1570.2, b: 1578.2 },
  { text: "Because a handyman", a: 1578.2, b: 1602.1 },
  { text: "never says no", a: 1602.1, b: 1626.0 },
  { text: "to a leaking sink.", a: 1626.0, b: 1657.9 },
];

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("burglar kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new BurglarWorld(kit), [kit]);
  gl.toneMapping = THREE.NoToneMapping;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  world.update(id, f, camera as THREE.PerspectiveCamera, scene);
  return <primitive object={world.root} dispose={null} />;
};

export const BurglarShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  const id = shotAt(f).id;
  const card = CARDS.find((c) => f >= c.a && f < c.b)?.text ?? "";
  const isCctv = id === 10; // security-camera monitor insert (frames 794-972)
  const cctvSec = Math.floor((f - 794) / 30);
  const recOn = Math.floor(f / 15) % 2 === 0; // blinking REC dot
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      {kit && (
        <ThreeCanvas width={1080} height={1920} shadows
          gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
          camera={{ fov: 50, near: 0.2, far: 1500 }}>
          <Inner id={id} kit={kit} />
        </ThreeCanvas>
      )}
      {isCctv && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 24, border: "6px solid rgba(0,0,0,0.85)", borderRadius: 12 }} />
          <div style={{ position: "absolute", top: 48, left: 56, fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 900, color: "#fff", textShadow: "0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000" }}>CAM 01</div>
          <div style={{ position: "absolute", top: 48, right: 56, fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 900, color: "#fff", textShadow: "0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000" }}>
            03:00:{String(cctvSec).padStart(2, "0")}
          </div>
          <div style={{ position: "absolute", top: 100, left: 56, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: recOn ? "#e33" : "#7a1a1a" }} />
            <span style={{ fontFamily: "Arial, sans-serif", fontSize: 26, fontWeight: 900, color: "#fff", textShadow: "0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000" }}>REC</span>
          </div>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", bottom: 190, transform: "translateX(-50%)", textAlign: "center", width: "90%" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 -3px 0 #000, 0 0 14px rgba(0,0,0,.8)" }}>{card}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
