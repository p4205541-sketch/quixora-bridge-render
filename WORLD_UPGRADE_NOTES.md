# Quixora balanced 3D world upgrade

## Reference interpretation

The supplied RicksClips reference uses flat/outlined cartoon characters composited into fully built 3D spaces: storefront interiors, timber floors, town streets, racecourse seating, countryside, fences, signs, and prop dressing. The selected Quixora direction is **mixed**: retain the existing flat/cartoon cast and original bridge story, while increasing physical depth and material response in the 3D environment.

The reference's betting-shop and horse-racing locations are story-specific. They have not been substituted into the bridge story because the instruction was to preserve the existing story and camera. Their reusable visual principles—layered geometry, readable architectural trim, prop density, material relief, and lighting—inform this additive upgrade.

## Implemented in this revision

- `src/videos/bridge/paint.ts`: cached 512px grayscale height-map generation from existing painted canvas textures.
- `src/videos/bridge/world.ts`: subtle bump relief on grass, cobblestones, quay masonry, tower stone, timber, river bed, and bridge deck materials.
- `src/videos/bridge/build.ts`: bump relief on plaster facades, roof tiles, and stone plinths; additional static roofline geometry (ridge caps, fascia, gutters, rainwater downpipes); extruded window jambs.
- `scripts/test-world-upgrade.cjs`: structural regression checks for the added detail and story timeline presence.
- `.github/workflows/world-detail-preview.yml`: CI typecheck, camera/world structural checks, and four representative rendered stills.

## Preserved

- Existing story timeline and shot definitions.
- Existing camera path and continuity data.
- Existing character/cast system and mixed 2D-character/3D-world art direction.
- Existing depth-pass and per-frame DOF/composite workflows.

## Verification status

Local structural checks and workflow YAML parsing pass. A full TypeScript typecheck and Remotion still render were not run in this environment because dependency installation did not complete. Run the **Bridge 3D World Detail Preview** GitHub Actions workflow before accepting the visuals or starting the final full-length render.
