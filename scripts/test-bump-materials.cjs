const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const build = fs.readFileSync(path.join(root, "src/videos/bridge/build.ts"), "utf8");
const bridge = fs.readFileSync(path.join(root, "src/videos/bridge/Bridge.tsx"), "utf8");
const paint = fs.readFileSync(path.join(root, "src/videos/bridge/paint.ts"), "utf8");
const checks = [
  ["all non-chain materials use MeshLambertMaterial (original baseline)", /else m = twoTone\(new THREE\.MeshLambertMaterial\(make\(\)\)\);/.test(build)],
  ["no Phong selection for bump-bearing materials", !/hasBump/.test(build)],
  ["bump textures use non-colour data space", /map\.colorSpace\s*=\s*THREE\.NoColorSpace/.test(paint)],
  ["legacy thin-lens effect disabled by default", /lens:\s*false,\s*pre:\s*false/.test(bridge)],
  ["depth toggle remains available", /depth:\s*false/.test(bridge)],
];
let failed = false;
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed = true; }
if (failed) process.exit(1);
