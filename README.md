


## Beauty + depth render workflow (GitHub Actions)

The Bridge composition now supports a dedicated depth render through `post.depth=true`.
The depth shader writes **near = white / far = black** as a linear camera-space ramp from 1 m to 150 m.
Depth mode disables fog, tone mapping and the EffectComposer so the depth values are not contaminated by the look grade.

Run **Actions → Render Beauty + Depth + Composite → Run workflow**. It renders the beauty and depth passes on separate GitHub runners, then composites them with the CPU-only Python/FFmpeg script. Both passes use the same composition, frame range and scale.

The output artifact is `final-depth-look`. The intermediate artifacts `bridge-beauty-pass` and `bridge-depth-pass` are retained for 3 days.

### Manual render / composite

```bash
npm ci
npx remotion render src/index.ts BridgeShort out/beauty.mp4 --frames=0-2024 --scale=1 --props='{"post":{"composer":false}}'
npx remotion render src/index.ts BridgeShort out/depth.mp4 --frames=0-2024 --scale=1 --crf=8 --props='{"post":{"depth":true,"composer":false}}'
python -m pip install -r requirements-depth.txt
python scripts/depth_pass_composite.py --rgb out/beauty.mp4 --depth out/depth.mp4 --output out/final.mp4
```

Tune `--focus` (depth threshold), `--blur`, `--bloom`, `--warmth`, `--lift`, and `--haze` in the compositor.

**Important:** depth and beauty must use identical frame ranges, scale, dimensions and FPS. The compositor checks these and checks frame-count alignment.

## Camera continuity update

`story.ts` now routes the camera through eased travel windows at the former hard cuts and shot-boundary reframes. The optical axis is spherical-interpolated, long moves use a raised arc, and impact kicks remain layered on top. See [`CAMERA_CONTINUITY_AUDIT.md`](CAMERA_CONTINUITY_AUDIT.md) for the measured path checks and the remaining story-state limitations.

Before the full render, run **Actions → Bridge Camera Continuity Clips → Run workflow**. It renders five low-resolution clips covering the major camera transitions. Review these clips for framing and geometry intersections before rendering the full 67.5-second video.

### Fast validation: town frame 200

Before spending time on the full 67.5-second render, run **Actions → Bridge Depth Still A-B Test** with frame `200` and scale `0.5`. It creates two separate artifacts:
- `bridge-beauty-frame-200`: normal town frame
- `bridge-depth-frame-200`: depth map (near white / far black)

Inspect the depth image first. If the whole town is nearly black or white, adjust `DEPTH_MIN` / `DEPTH_MAX` in `Bridge.tsx` before running the full two-pass workflow.
