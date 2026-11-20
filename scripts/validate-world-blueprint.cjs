const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'templates/world-blueprint.template.json'), 'utf8'));
const checks = [
 ['balanced quality profile', data.project?.quality_profile === 'balanced'],
 ['mixed character direction', data.project?.character_art_direction === 'mixed_2d_style_characters_in_3d_world'],
 ['location template exists', Array.isArray(data.locations) && data.locations.length > 0],
 ['foreground/midground/background planes', ['foreground','midground','background'].every(k => Array.isArray(data.locations?.[0]?.planes?.[k]))],
 ['camera constraints', !!data.locations?.[0]?.camera_constraints],
 ['lighting specification', !!data.locations?.[0]?.lighting],
 ['visual QA required', data.quality_assurance?.visual_review_required === true],
 ['world standard exists', fs.existsSync(path.join(root, 'WORLD_CREATION_STANDARD.md'))],
 ['audio reference profile exists', fs.existsSync(path.join(root, 'AUDIO_REFERENCE_PROFILE.md'))],
];
let failed = false;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed = true; }
if (failed) process.exit(1);
