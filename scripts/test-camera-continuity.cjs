/*
 * Frame-by-frame mathematical regression test for the BridgeShort camera path.
 * This does not replace visual review of the rendered clips; it catches NaNs,
 * teleports, and abrupt optical-axis changes before expensive rendering starts.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');

const storyPath = path.resolve(__dirname, '../src/videos/bridge/story.ts');
const source = fs.readFileSync(storyPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
  },
  fileName: storyPath,
}).outputText;
const storyModule = new Module(storyPath, module);
storyModule.filename = storyPath;
storyModule.paths = module.paths;
storyModule._compile(compiled, storyPath);

const { camAt, TOTAL, FPS, SHOTS } = storyModule.exports;
assert.equal(typeof camAt, 'function', 'story.ts must export camAt()');
assert.equal(TOTAL, 2025, 'Unexpected BridgeShort frame count');
assert.equal(FPS, 30, 'Unexpected BridgeShort FPS');
assert.equal(SHOTS.length, 15, 'Unexpected shot count');

const MAX_POSITION_STEP = 2.0; // world metres per frame
const MAX_DIRECTION_STEP_DEG = 3.5;
let previous = null;
let maxPositionStep = 0;
let maxDirectionStep = 0;
let maxPositionFrame = 0;
let maxDirectionFrame = 0;

for (let frame = 0; frame < TOTAL; frame++) {
  const camera = camAt(1, frame);
  const values = [...camera.pos, ...camera.look, camera.fov, camera.roll];
  assert(values.every(Number.isFinite), `Non-finite camera value at frame ${frame}`);
  assert(camera.fov > 0 && camera.fov < 180, `Invalid FOV at frame ${frame}: ${camera.fov}`);

  const direction = camera.look.map((value, index) => value - camera.pos[index]);
  const directionLength = Math.hypot(...direction);
  assert(directionLength > 1e-5, `Camera look vector collapsed at frame ${frame}`);
  const unitDirection = direction.map((value) => value / directionLength);

  if (previous) {
    const positionStep = Math.hypot(
      camera.pos[0] - previous.position[0],
      camera.pos[1] - previous.position[1],
      camera.pos[2] - previous.position[2],
    );
    const dot = Math.max(-1, Math.min(1,
      unitDirection.reduce((sum, value, index) => sum + value * previous.direction[index], 0),
    ));
    const directionStep = Math.acos(dot) * 180 / Math.PI;

    if (positionStep > maxPositionStep) {
      maxPositionStep = positionStep;
      maxPositionFrame = frame;
    }
    if (directionStep > maxDirectionStep) {
      maxDirectionStep = directionStep;
      maxDirectionFrame = frame;
    }
    assert(positionStep <= MAX_POSITION_STEP,
      `Camera teleport at frame ${frame}: ${positionStep.toFixed(3)} m/frame`);
    assert(directionStep <= MAX_DIRECTION_STEP_DEG,
      `Abrupt camera turn at frame ${frame}: ${directionStep.toFixed(3)} deg/frame`);
  }

  previous = { position: camera.pos, direction: unitDirection };
}

console.log(`PASS: ${TOTAL} frames (${TOTAL / FPS}s) sampled across ${SHOTS.length} shots.`);
console.log(`Max camera travel: ${maxPositionStep.toFixed(3)} m/frame at frame ${maxPositionFrame}.`);
console.log(`Max optical-axis turn: ${maxDirectionStep.toFixed(3)} deg/frame at frame ${maxDirectionFrame}.`);
