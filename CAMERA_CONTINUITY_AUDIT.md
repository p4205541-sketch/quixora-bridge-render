# Camera continuity implementation — BridgeShort

## What changed

`src/videos/bridge/story.ts` now resolves camera movement from the global frame through `camAt()`:

- All active render layers use the same frame-global camera pose.
- Former `cut: true` reframes and shot-boundary camera jumps are routed through eased travel windows.
- Camera position, optical direction, FOV and roll are interpolated; the optical direction uses spherical interpolation.
- Longer geographic moves use a raised arc to reduce the chance of passing through the deck or town silhouettes.
- Existing impact kicks are layered over the travel movement.

The original camera keys and story timings remain in place as the source framings. The transition table is the movement layer between them.

## Local camera-path test result

The automated regression test in `scripts/test-camera-continuity.cjs` transpiles and executes `story.ts`, then samples every frame of the 67.5-second composition (2,025 frames at 30 fps).

- **PASS:** all 2,025 camera poses are finite and have a valid field of view and look direction.
- **PASS:** no one-frame camera translation exceeds 2.0 world metres.
- **PASS:** no one-frame optical-axis rotation exceeds 3.5 degrees.
- Measured maximum translation: **1.751 m/frame**, at frame 1620.
- Measured maximum optical-axis rotation: **3.013 degrees/frame**, at frame 1041.

Run locally with `npm ci && npm run test:camera`.

## GitHub Actions validation

The **Bridge Camera Continuity Clips** workflow now runs these checks before rendering:

1. Install the locked dependencies.
2. Type-check the complete project with `npm run typecheck`.
3. Run the all-frame camera continuity regression test.
4. Render five low-resolution clips covering the major transitions.

The workflow artifacts still need visual inspection for framing, occlusion and geometry intersections. The numeric test cannot prove that a camera path is collision-free.

## Scope and remaining visual validation

This is a continuous camera-movement pass, not a literal uninterrupted one-take of every story event. The story still contains editorial state changes (lighting, crowd states, collapsed/rebuilt bridge states) and selected crossfade layers. These are retained to avoid silently changing the story.

A full Remotion render and full project typecheck could not be executed in this environment because dependency installation was blocked by DNS/network resolution (`EAI_AGAIN` while fetching from npm). The all-frame camera-path test, Python compositor syntax check and workflow YAML parsing passed locally. The five rendered clips and final full video remain pending GitHub Actions execution and visual review.
