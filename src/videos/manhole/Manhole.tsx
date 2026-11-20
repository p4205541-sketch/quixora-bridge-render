// ManholeShort composition — mirrors Bridge.tsx's structure, NO EffectComposer anywhere.
// post.composer:false always. TOTAL 1770 frames @ 30fps, 1080x1920.
// Captions: RicksClips-style — sentence-case, ONE WORD at a time synced to speech,
// white with thick black outline, lower third; stats in bold orange capitals.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ManholeWorld, loadKit } from "./world";
import { Kit } from "../bridge/build";
import { TOTAL, shotAt } from "./story";

export const DURATION = TOTAL;

// one entry per shot (id 1-18): timed stat pop-up (orange bold capitals).
// statTop overrides the default 38% anchor when the default would sit on a face/prop.
const STATS: { stat?: string; note?: string; statTop?: string }[] = [
  { stat: "275 POUNDS" },
  {},
  { stat: "267,000" },
  { stat: "2,000" },
  {},
  {},
  {},
  { stat: "1.414x" },
  {},
  {},
  {},
  {},
  {},
  {},
  { stat: "7,500", statTop: "30%" },
  { stat: "40 TONNES", note: "lab test", statTop: "30%" },
  {},
  {},
];

// RicksClips-style captions: sentence-case, ONE WORD at a time, synced to speech.
// Windows derived from audio/timings.json: each sentence's words spread evenly
// across that sentence's spoken duration (Ronan paces evenly within a line).
const WORDS: { text: string; a: number; b: number }[] = [
  { text: "This", a: 9.0, b: 17.4 },
  { text: "iron", a: 17.4, b: 25.9 },
  { text: "lid", a: 25.9, b: 34.3 },
  { text: "weighs", a: 34.3, b: 42.8 },
  { text: "up", a: 42.8, b: 51.2 },
  { text: "to", a: 51.2, b: 59.7 },
  { text: "275", a: 59.7, b: 68.1 },
  { text: "pounds,", a: 68.1, b: 76.6 },
  { text: "and", a: 76.6, b: 85.0 },
  { text: "nothing", a: 85.0, b: 93.5 },
  { text: "but", a: 93.5, b: 101.9 },
  { text: "its", a: 101.9, b: 110.4 },
  { text: "shape", a: 110.4, b: 118.8 },
  { text: "holds", a: 118.8, b: 127.3 },
  { text: "it", a: 127.3, b: 135.7 },
  { text: "up.", a: 135.7, b: 144.2 },
  { text: "Every", a: 147.2, b: 154.8 },
  { text: "day,", a: 154.8, b: 162.4 },
  { text: "you", a: 162.4, b: 170.1 },
  { text: "walk", a: 170.1, b: 177.7 },
  { text: "right", a: 177.7, b: 185.3 },
  { text: "over", a: 185.3, b: 192.9 },
  { text: "it.", a: 192.9, b: 200.6 },
  { text: "But", a: 203.6, b: 214.3 },
  { text: "in", a: 214.3, b: 225.1 },
  { text: "New", a: 225.1, b: 235.9 },
  { text: "York", a: 235.9, b: 246.7 },
  { text: "alone,", a: 246.7, b: 257.4 },
  { text: "there", a: 257.4, b: 268.2 },
  { text: "are", a: 268.2, b: 279.0 },
  { text: "267,000", a: 279.0, b: 289.7 },
  { text: "of", a: 289.7, b: 300.5 },
  { text: "them.", a: 300.5, b: 311.3 },
  { text: "And", a: 314.3, b: 323.0 },
  { text: "every", a: 323.0, b: 331.7 },
  { text: "year,", a: 331.7, b: 340.5 },
  { text: "around", a: 340.5, b: 349.2 },
  { text: "2,000", a: 349.2, b: 357.9 },
  { text: "of", a: 357.9, b: 366.7 },
  { text: "them", a: 366.7, b: 375.4 },
  { text: "smoke", a: 375.4, b: 384.1 },
  { text: "or", a: 384.1, b: 392.8 },
  { text: "explode.", a: 392.8, b: 401.6 },
  { text: "So", a: 404.6, b: 411.2 },
  { text: "why", a: 411.2, b: 417.9 },
  { text: "not", a: 417.9, b: 424.5 },
  { text: "make", a: 424.5, b: 431.2 },
  { text: "them", a: 431.2, b: 437.9 },
  { text: "square?", a: 437.9, b: 444.5 },
  { text: "A", a: 447.5, b: 453.6 },
  { text: "square", a: 453.6, b: 459.7 },
  { text: "lid", a: 459.7, b: 465.8 },
  { text: "would", a: 465.8, b: 472.0 },
  { text: "do", a: 472.0, b: 478.1 },
  { text: "the", a: 478.1, b: 484.2 },
  { text: "same", a: 484.2, b: 490.3 },
  { text: "job,", a: 490.3, b: 496.4 },
  { text: "and", a: 496.4, b: 502.5 },
  { text: "it", a: 502.5, b: 508.6 },
  { text: "would", a: 508.6, b: 514.7 },
  { text: "be", a: 514.7, b: 520.9 },
  { text: "cheaper", a: 520.9, b: 527.0 },
  { text: "to", a: 527.0, b: 533.1 },
  { text: "make.", a: 533.1, b: 539.2 },
  { text: "It", a: 542.2, b: 549.7 },
  { text: "sounds", a: 549.7, b: 557.2 },
  { text: "sensible,", a: 557.2, b: 564.7 },
  { text: "until", a: 564.7, b: 572.1 },
  { text: "you", a: 572.1, b: 579.6 },
  { text: "turn", a: 579.6, b: 587.1 },
  { text: "it", a: 587.1, b: 594.6 },
  { text: "on", a: 594.6, b: 602.1 },
  { text: "its", a: 602.1, b: 609.6 },
  { text: "edge.", a: 609.6, b: 617.1 },
  { text: "A", a: 620.1, b: 631.0 },
  { text: "square's", a: 631.0, b: 642.0 },
  { text: "diagonal", a: 642.0, b: 653.0 },
  { text: "is", a: 653.0, b: 664.0 },
  { text: "1.414", a: 664.0, b: 674.9 },
  { text: "times", a: 674.9, b: 685.9 },
  { text: "longer", a: 685.9, b: 696.9 },
  { text: "than", a: 696.9, b: 707.9 },
  { text: "its", a: 707.9, b: 718.8 },
  { text: "side.", a: 718.8, b: 729.8 },
  { text: "Turn", a: 732.8, b: 739.3 },
  { text: "it", a: 739.3, b: 745.8 },
  { text: "on", a: 745.8, b: 752.3 },
  { text: "edge,", a: 752.3, b: 758.8 },
  { text: "and", a: 758.8, b: 765.3 },
  { text: "it", a: 765.3, b: 771.8 },
  { text: "slips", a: 771.8, b: 778.3 },
  { text: "straight", a: 778.3, b: 784.9 },
  { text: "through", a: 784.9, b: 791.4 },
  { text: "its", a: 791.4, b: 797.9 },
  { text: "own", a: 797.9, b: 804.4 },
  { text: "hole.", a: 804.4, b: 810.9 },
  { text: "But", a: 813.9, b: 822.2 },
  { text: "a", a: 822.2, b: 830.6 },
  { text: "circle", a: 830.6, b: 838.9 },
  { text: "is", a: 838.9, b: 847.2 },
  { text: "the", a: 847.2, b: 855.6 },
  { text: "same", a: 855.6, b: 863.9 },
  { text: "width", a: 863.9, b: 872.3 },
  { text: "in", a: 872.3, b: 880.6 },
  { text: "every", a: 880.6, b: 888.9 },
  { text: "direction.", a: 888.9, b: 897.3 },
  { text: "Turn", a: 900.3, b: 907.6 },
  { text: "it", a: 907.6, b: 914.9 },
  { text: "however", a: 914.9, b: 922.3 },
  { text: "you", a: 922.3, b: 929.6 },
  { text: "like,", a: 929.6, b: 937.0 },
  { text: "it", a: 937.0, b: 944.3 },
  { text: "cannot", a: 944.3, b: 951.7 },
  { text: "fall", a: 951.7, b: 959.0 },
  { text: "in.", a: 959.0, b: 966.3 },
  { text: "That's", a: 969.3, b: 976.8 },
  { text: "reason", a: 976.8, b: 984.3 },
  { text: "one.", a: 984.3, b: 991.8 },
  { text: "Reason", a: 991.8, b: 999.2 },
  { text: "two:", a: 999.2, b: 1006.7 },
  { text: "you", a: 1006.7, b: 1014.2 },
  { text: "can", a: 1014.2, b: 1021.7 },
  { text: "roll", a: 1021.7, b: 1029.1 },
  { text: "it.", a: 1029.1, b: 1036.6 },
  { text: "No", a: 1039.6, b: 1048.4 },
  { text: "crane,", a: 1048.4, b: 1057.2 },
  { text: "no", a: 1057.2, b: 1066.0 },
  { text: "carrying,", a: 1066.0, b: 1074.8 },
  { text: "just", a: 1074.8, b: 1083.5 },
  { text: "roll", a: 1083.5, b: 1092.3 },
  { text: "it", a: 1092.3, b: 1101.1 },
  { text: "into", a: 1101.1, b: 1109.9 },
  { text: "place.", a: 1109.9, b: 1118.7 },
  { text: "Reason", a: 1121.7, b: 1130.4 },
  { text: "three:", a: 1130.4, b: 1139.2 },
  { text: "no", a: 1139.2, b: 1147.9 },
  { text: "corners", a: 1147.9, b: 1156.6 },
  { text: "to", a: 1156.6, b: 1165.4 },
  { text: "line", a: 1165.4, b: 1174.1 },
  { text: "up,", a: 1174.1, b: 1182.8 },
  { text: "so", a: 1182.8, b: 1191.6 },
  { text: "it", a: 1191.6, b: 1200.3 },
  { text: "fits", a: 1200.3, b: 1209.0 },
  { text: "every", a: 1209.0, b: 1217.8 },
  { text: "time.", a: 1217.8, b: 1226.5 },
  { text: "One", a: 1229.5, b: 1238.7 },
  { text: "American", a: 1238.7, b: 1247.9 },
  { text: "city", a: 1247.9, b: 1257.1 },
  { text: "tried", a: 1257.1, b: 1266.3 },
  { text: "triangles", a: 1266.3, b: 1275.5 },
  { text: "instead,", a: 1275.5, b: 1284.7 },
  { text: "7,500", a: 1284.7, b: 1293.9 },
  { text: "of", a: 1293.9, b: 1303.1 },
  { text: "them,", a: 1303.1, b: 1312.3 },
  { text: "and", a: 1312.3, b: 1321.5 },
  { text: "spent", a: 1321.5, b: 1330.6 },
  { text: "years", a: 1330.6, b: 1339.8 },
  { text: "swapping", a: 1339.8, b: 1349.0 },
  { text: "them", a: 1349.0, b: 1358.2 },
  { text: "all", a: 1358.2, b: 1367.4 },
  { text: "back.", a: 1367.4, b: 1376.6 },
  { text: "And", a: 1379.6, b: 1388.6 },
  { text: "the", a: 1388.6, b: 1397.6 },
  { text: "lid", a: 1397.6, b: 1406.6 },
  { text: "itself", a: 1406.6, b: 1415.5 },
  { text: "is", a: 1415.5, b: 1424.5 },
  { text: "lab-tested", a: 1424.5, b: 1433.5 },
  { text: "to", a: 1433.5, b: 1442.5 },
  { text: "survive", a: 1442.5, b: 1451.5 },
  { text: "40", a: 1451.5, b: 1460.4 },
  { text: "tonnes", a: 1460.4, b: 1469.4 },
  { text: "of", a: 1469.4, b: 1478.4 },
  { text: "force.", a: 1478.4, b: 1487.4 },
  { text: "So", a: 1490.4, b: 1497.7 },
  { text: "the", a: 1497.7, b: 1504.9 },
  { text: "next", a: 1504.9, b: 1512.2 },
  { text: "time", a: 1512.2, b: 1519.5 },
  { text: "you", a: 1519.5, b: 1526.8 },
  { text: "step", a: 1526.8, b: 1534.0 },
  { text: "over", a: 1534.0, b: 1541.3 },
  { text: "one,", a: 1541.3, b: 1548.6 },
  { text: "remember,", a: 1548.6, b: 1555.9 },
  { text: "the", a: 1555.9, b: 1563.2 },
  { text: "shape", a: 1563.2, b: 1570.4 },
  { text: "is", a: 1570.4, b: 1577.7 },
  { text: "doing", a: 1577.7, b: 1585.0 },
  { text: "all", a: 1585.0, b: 1592.3 },
  { text: "the", a: 1592.3, b: 1599.5 },
  { text: "work.", a: 1599.5, b: 1606.8 },
  { text: "For", a: 1609.8, b: 1617.1 },
  { text: "more", a: 1617.1, b: 1624.4 },
  { text: "stories", a: 1624.4, b: 1631.7 },
  { text: "like", a: 1631.7, b: 1639.0 },
  { text: "this,", a: 1639.0, b: 1646.3 },
  { text: "Like,", a: 1646.3, b: 1653.7 },
  { text: "Share,", a: 1653.7, b: 1661.0 },
  { text: "and", a: 1661.0, b: 1668.3 },
  { text: "Comment", a: 1668.3, b: 1675.6 },
  { text: "on", a: 1675.6, b: 1682.9 },
  { text: "the", a: 1682.9, b: 1690.2 },
  { text: "video,", a: 1690.2, b: 1697.5 },
  { text: "and", a: 1697.5, b: 1704.8 },
  { text: "make", a: 1704.8, b: 1712.1 },
  { text: "sure", a: 1712.1, b: 1719.4 },
  { text: "to", a: 1719.4, b: 1726.7 },
  { text: "Subscribe", a: 1726.7, b: 1734.0 },
  { text: "and", a: 1734.0, b: 1741.3 },
  { text: "Follow!", a: 1741.3, b: 1748.6 },
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
  const cap = STATS[id - 1];
  const word = WORDS.find((w) => f >= w.a && f < w.b)?.text ?? "";
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
          <div style={{ position: "absolute", left: "50%", top: cap.statTop ?? "38%", transform: "translateX(-50%)", textAlign: "center", width: "92%" }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 72, fontWeight: 900, color: "#ff9d33", textTransform: "uppercase", lineHeight: 1, textShadow: "0 5px 0 #000, 0 0 18px rgba(0,0,0,.8)" }}>{cap.stat}</div>
            {cap.note && <div style={{ fontFamily: "Arial, sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", textTransform: "uppercase", textShadow: "0 3px 0 #000, 0 0 12px rgba(0,0,0,.8)" }}>{cap.note}</div>}
          </div>
        )}
        <div style={{ position: "absolute", left: "50%", bottom: 190, transform: "translateX(-50%)", textAlign: "center", width: "90%" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 40, fontWeight: 900, color: "#fff", lineHeight: 1.15, textShadow: "0 3px 0 #000, 3px 0 0 #000, -3px 0 0 #000, 0 -3px 0 #000, 0 0 14px rgba(0,0,0,.8)" }}>{word}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
