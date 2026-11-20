# Camera continuity audit — BridgeShort

This audit is based on `src/videos/bridge/story.ts` and `Bridge.tsx` in the uploaded repository.

## What the current project actually does

- The bridge is one reusable Three.js world, but `BridgeShort` mounts separate `ShotView` canvases for the active shot layers.
- `SHOTS` contains 15 editorial shot ranges across 2,025 frames (30 fps; 67.5 seconds).
- `layersAt()` only crossfades the shot IDs listed in `XFADE`; other shot boundaries switch directly.
- `run()` in `story.ts` intentionally jumps immediately whenever a camera key has `cut: true`.
- The explicit within-shot camera cuts are at frames: **497, 717, 871, 925, 1039, 1062, 1099, 1685, 1770, 1932**.
- Additional shot-boundary reframes occur at the `SHOTS` start frames. Some are crossfaded, but many are direct cuts.

## Why I did not silently remove `cut: true`

Those camera keys are not merely tiny camera shakes: several move from a close-up to an aerial, from an anchor insert to the river, or from a bank shot to an officer close-up. Replacing every cut with a generic interpolation would move the camera through the 3D world, often through buildings/bridge geometry, and could destroy the framing or reveal areas the scene was never designed to show.

Also, a camera-only interpolation cannot remove the shot changes while `BridgeShort` is still rendering two independent canvases for crossfades and resetting shot-specific story time/light/crowd state.

## Correct next implementation for a genuine one-take

1. Replace the per-shot `ShotView` stack with one persistent `ThreeCanvas` and one persistent `World`.
2. Define one global camera path (position + look target + roll + FOV) sampled continuously over all 2,025 frames.
3. Keep story events as world-state changes on a single global clock, not per-shot `tau` resets.
4. Use spline/Bezier path segments with collision checks against the bridge, town and props.
5. Render a low-resolution camera-path preview first; only then run the full beauty/depth renders.

**Status:** depth-pass export is being wired into the current architecture. True single-take camera reconstruction is not claimed as fixed by this patch.
