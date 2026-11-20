#!/usr/bin/env node
/* Export the exact per-frame focus distance and thin-lens strength from story.ts. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function parseFrames(value) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(value);
  if (!m) throw new Error(`Invalid --frames value: ${value}; expected start-end`);
  const start = Number(m[1]);
  const end = Number(m[2] ?? m[1]);
  if (end < start) throw new Error('Frame end must be >= frame start');
  return { start, end };
}

const root = path.resolve(__dirname, '..');
const storyPath = path.join(root, 'src/videos/bridge/story.ts');
const source = fs.readFileSync(storyPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  fileName: storyPath,
}).outputText;
const mod = new Module(storyPath, module);
mod.filename = storyPath;
mod.paths = Module._nodeModulePaths(path.dirname(storyPath));
mod._compile(compiled, storyPath);
const story = mod.exports;

const { start, end } = parseFrames(arg('--frames', `0-${story.TOTAL - 1}`));
if (end >= story.TOTAL) throw new Error(`Frame ${end} is outside TOTAL=${story.TOTAL}`);
const out = path.resolve(arg('--out', path.join(root, 'out/focus.csv')));
const lines = ['frame,focus_m,c_inf'];
for (let f = start; f <= end; f++) {
  const layers = story.layersAt(f);
  const active = layers.reduce((a, b) => (b.alpha > a.alpha ? b : a), layers[0]);
  const cam = story.camAt(active.id, f);
  const focus = story.focusAt(active.id, f);
  const dir = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
  const len = Math.hypot(...dir) || 1;
  const toFocus = [focus[0] - cam.pos[0], focus[1] - cam.pos[1], focus[2] - cam.pos[2]];
  // PORT FIX (not in the ZIP): if the DOF table's focus point has swung behind the camera plane
  // (projection < 1 m), the raw projection is degenerate — the thin-lens CoC would blur the whole
  // frame. Fall back to the camera look distance, which is always in front of the lens. Found on
  // frames 1856-1862: the 1770 officer-eyes focus goes behind the camera during the travel to
  // the 1863 tourists shot (projection 0.93 -> -2.75, look distance 6.1-6.8 m). Legitimate
  // close-ups never focus closer than ~1.6 m, so a 1.0 m threshold only catches this case.
  let focusM = (toFocus[0] * dir[0] + toFocus[1] * dir[1] + toFocus[2] * dir[2]) / len;
  if (focusM < 1.0) focusM = len;
  const dof = story.dofAt(f);
  lines.push(`${f},${focusM.toFixed(5)},${Math.max(0, dof.cInf).toFixed(4)}`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`Wrote ${end - start + 1} per-frame DOF records to ${out}`);
