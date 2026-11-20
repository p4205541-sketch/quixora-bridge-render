const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const build = read('src/videos/bridge/build.ts');
const world = read('src/videos/bridge/world.ts');
const paint = read('src/videos/bridge/paint.ts');
const story = read('src/videos/bridge/story.ts');
const checks = [
  ['procedural height-map generator', paint.includes('heightFromTexture') && paint.includes('THREE.NoColorSpace')],
  ['bump detail on terrain and masonry', world.includes('bumpMap: heightFromTexture(grassMap)') && world.includes('bumpMap: heightFromTexture(towerMap)')],
  ['bump detail on timber decking', world.includes('bumpMap: heightFromTexture(deckMap)')],
  ['roof ridge, gutters and downpipes', build.includes('roofGutter') && build.includes('rainPipe') && build.includes('roofFascia')],
  ['extruded 3D window jambs', build.includes('Extruded side jambs')],
  ['story timeline preserved', story.includes('export const SHOTS') && story.includes('export const TOTAL')],
];
let failed = false;
for (const [name, ok] of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}\n`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
