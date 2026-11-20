// BurglarShort composition — mirrors Manhole.tsx's structure, NO EffectComposer anywhere.
// post.composer:false always. TOTAL 1650 frames @ 30fps (PROVISIONAL — update from real
// voice timings when they land), 1080x1920.
// Captions: Reference 14 style — sentence-case 1-3-WORD PHRASE CARDS synced to speech,
// white bold rounded sans with thick black outline, centered lower third.
// NO stat pop-ups, NO colored words, NO CTA (Reference 14 has none — Matching Rules Rule 9).
// Shot 10 gets a CCTV monitor-frame overlay (our own-world signature): CAM 01 + 03:00 timestamp + REC dot.
// CARDS below are PROVISIONAL (7.5 frames/word from the script); regenerate from
// audio/timings.json with ~/workspace/quixora_short_burglar/gen_cards.py when the voice lands.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { BurglarWorld, loadKit } from "./world";
import { Kit } from "../bridge/build";
import { TOTAL, shotAt } from "./story";

export const DURATION = TOTAL;

// Phrase cards (1-3 words) — provisional timings, 219 words @ 7.5 frames/word.
const CARDS: { text: string; a: number; b: number }[] = [
  { text: "A man", a: 0.0, b: 15.0 },
  { text: "broke into", a: 15.0, b: 30.0 },
  { text: "a family's house", a: 30.0, b: 52.5 },
  { text: "every single night.", a: 52.5, b: 75.0 },
  { text: "But he never", a: 75.0, b: 97.5 },
  { text: "stole anything.", a: 97.5, b: 112.5 },
  { text: "He fixed", a: 112.5, b: 127.5 },
  { text: "things.", a: 127.5, b: 135.0 },
  { text: "The first night,", a: 135.0, b: 157.5 },
  { text: "the front door", a: 157.5, b: 180.0 },
  { text: "stopped squeaking.", a: 180.0, b: 195.0 },
  { text: "The dad", a: 195.0, b: 210.0 },
  { text: "noticed.", a: 210.0, b: 217.5 },
  { text: "That door", a: 217.5, b: 232.5 },
  { text: "had squeaked", a: 232.5, b: 247.5 },
  { text: "for six years.", a: 247.5, b: 270.0 },
  { text: "The next night,", a: 270.0, b: 292.5 },
  { text: "the wobbly table", a: 292.5, b: 315.0 },
  { text: "stood perfectly", a: 315.0, b: 330.0 },
  { text: "still.", a: 330.0, b: 337.5 },
  { text: "Mom set", a: 337.5, b: 352.5 },
  { text: "her coffee", a: 352.5, b: 367.5 },
  { text: "down.", a: 367.5, b: 375.0 },
  { text: "It didn't", a: 375.0, b: 390.0 },
  { text: "spill.", a: 390.0, b: 397.5 },
  { text: "By the end", a: 397.5, b: 420.0 },
  { text: "of the week,", a: 420.0, b: 442.5 },
  { text: "the painting", a: 442.5, b: 457.5 },
  { text: "was straight,", a: 457.5, b: 472.5 },
  { text: "the bulb", a: 472.5, b: 487.5 },
  { text: "had stopped", a: 487.5, b: 502.5 },
  { text: "flickering,", a: 502.5, b: 510.0 },
  { text: "and the dad", a: 510.0, b: 532.5 },
  { text: "was sure", a: 532.5, b: 547.5 },
  { text: "the house", a: 547.5, b: 562.5 },
  { text: "was haunted.", a: 562.5, b: 577.5 },
  { text: "By a", a: 577.5, b: 592.5 },
  { text: "helpful ghost.", a: 592.5, b: 607.5 },
  { text: "So they", a: 607.5, b: 622.5 },
  { text: "called a priest.", a: 622.5, b: 645.0 },
  { text: "The priest", a: 645.0, b: 660.0 },
  { text: "blessed the", a: 660.0, b: 675.0 },
  { text: "living room,", a: 675.0, b: 690.0 },
  { text: "the kitchen,", a: 690.0, b: 705.0 },
  { text: "and the", a: 705.0, b: 720.0 },
  { text: "squeaky door.", a: 720.0, b: 735.0 },
  { text: "That night,", a: 735.0, b: 750.0 },
  { text: "the hinge", a: 750.0, b: 765.0 },
  { text: "got oiled", a: 765.0, b: 780.0 },
  { text: "anyway.", a: 780.0, b: 787.5 },
  { text: "So they", a: 787.5, b: 802.5 },
  { text: "set up", a: 802.5, b: 817.5 },
  { text: "a camera.", a: 817.5, b: 832.5 },
  { text: "At three", a: 832.5, b: 847.5 },
  { text: "in the morning,", a: 847.5, b: 870.0 },
  { text: "it caught", a: 870.0, b: 885.0 },
  { text: "a man", a: 885.0, b: 900.0 },
  { text: "in black,", a: 900.0, b: 915.0 },
  { text: "fixing the door", a: 915.0, b: 937.5 },
  { text: "with a tiny", a: 937.5, b: 960.0 },
  { text: "toolbox.", a: 960.0, b: 967.5 },
  { text: "The next night,", a: 967.5, b: 990.0 },
  { text: "the dad hid", a: 990.0, b: 1012.5 },
  { text: "behind the couch", a: 1012.5, b: 1035.0 },
  { text: "with a flashlight.", a: 1035.0, b: 1057.5 },
  { text: "He caught him", a: 1057.5, b: 1080.0 },
  { text: "under the sink.", a: 1080.0, b: 1102.5 },
  { text: "And the man", a: 1102.5, b: 1125.0 },
  { text: "said, I'm", a: 1125.0, b: 1140.0 },
  { text: "so sorry,", a: 1140.0, b: 1155.0 },
  { text: "wrong house.", a: 1155.0, b: 1170.0 },
  { text: "The lady", a: 1170.0, b: 1185.0 },
  { text: "across the street", a: 1185.0, b: 1207.5 },
  { text: "hired me", a: 1207.5, b: 1222.5 },
  { text: "to fix", a: 1222.5, b: 1237.5 },
  { text: "her door.", a: 1237.5, b: 1252.5 },
  { text: "I've had", a: 1252.5, b: 1267.5 },
  { text: "the wrong address", a: 1267.5, b: 1290.0 },
  { text: "all week.", a: 1290.0, b: 1305.0 },
  { text: "He pointed", a: 1305.0, b: 1320.0 },
  { text: "at the house", a: 1320.0, b: 1342.5 },
  { text: "number.", a: 1342.5, b: 1350.0 },
  { text: "Sixteen.", a: 1350.0, b: 1357.5 },
  { text: "He'd been", a: 1357.5, b: 1372.5 },
  { text: "looking for", a: 1372.5, b: 1387.5 },
  { text: "sixty-one.", a: 1387.5, b: 1395.0 },
  { text: "The next morning,", a: 1395.0, b: 1417.5 },
  { text: "the dad taped", a: 1417.5, b: 1440.0 },
  { text: "a note", a: 1440.0, b: 1455.0 },
  { text: "to the handyman's", a: 1455.0, b: 1477.5 },
  { text: "toolbox.", a: 1477.5, b: 1485.0 },
  { text: "It said,", a: 1485.0, b: 1500.0 },
  { text: "the sink", a: 1500.0, b: 1515.0 },
  { text: "is leaking too.", a: 1515.0, b: 1537.5 },
  { text: "And the handyman", a: 1537.5, b: 1560.0 },
  { text: "smiled.", a: 1560.0, b: 1567.5 },
  { text: "Because a handyman", a: 1567.5, b: 1590.0 },
  { text: "never says no", a: 1590.0, b: 1612.5 },
  { text: "to a leaking sink.", a: 1612.5, b: 1642.5 },
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
  const isCctv = id === 10; // security-camera monitor insert (frames 802-975)
  const cctvSec = Math.floor((f - 802) / 30);
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
