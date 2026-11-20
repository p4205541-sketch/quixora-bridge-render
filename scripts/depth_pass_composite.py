#!/usr/bin/env python3
"""Depth-aware background defocus + bloom/grade compositor (CPU only).

Expected inputs:
  beauty.mp4 : normal RGB render
  depth.mp4  : aligned grayscale depth render; near=white, far=black

Depth video must have exactly the same frame count, dimensions and FPS as beauty.
"""
import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy as np


def depth_defocus(frame: np.ndarray, depth_frame: np.ndarray, focus: float, max_blur: float) -> np.ndarray:
    depth = cv2.cvtColor(depth_frame, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    h, w = frame.shape[:2]
    if depth.shape != (h, w):
        depth = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)

    # near=white, far=black. Pixels farther than the focus plane receive more blur.
    far = np.clip((focus - depth) / max(focus, 1e-4), 0.0, 1.0)
    far = far * far * (3.0 - 2.0 * far)  # smoothstep
    far = cv2.GaussianBlur(far, (0, 0), 1.25)

    sigmas = [0.0, 2.0, 4.0, 7.0, 10.0, 14.0, 18.0, 22.0]
    levels = [frame] + [cv2.GaussianBlur(frame, (0, 0), s) for s in sigmas[1:]]
    scaled = far * (min(max_blur, 22.0) / 22.0) * (len(levels) - 1)
    idx = np.clip(np.floor(scaled).astype(np.int32), 0, len(levels) - 2)
    frac = (scaled - idx).astype(np.float32)
    out = np.empty_like(frame, dtype=np.float32)
    for i in range(len(levels) - 1):
        mask = idx == i
        if not np.any(mask):
            continue
        blend = levels[i].astype(np.float32) * (1.0 - frac[..., None]) + levels[i + 1].astype(np.float32) * frac[..., None]
        out[mask] = blend[mask]
    return np.clip(out, 0, 255).astype(np.uint8)


def cinematic_grade(frame: np.ndarray, bloom: float, warmth: float, lift: float, haze: float) -> np.ndarray:
    x = frame.astype(np.float32) / 255.0  # OpenCV BGR
    x[:, :, 2] *= 1.0 + warmth * 0.34  # red
    x[:, :, 0] *= 1.0 - warmth * 0.28  # blue
    luma = x.mean(axis=2, keepdims=True)
    shadow_weight = np.clip((0.62 - luma) / 0.62, 0.0, 1.0) ** 1.5
    x = np.clip(x + lift * shadow_weight, 0.0, 1.0)

    if bloom > 0:
        highlights = np.clip((x - 0.68) / 0.32, 0.0, 1.0)
        glow = cv2.GaussianBlur((highlights * 255).astype(np.uint8), (0, 0), 12).astype(np.float32) / 255.0
        x = np.clip(x + glow * bloom, 0.0, 1.0)
    if haze > 0:
        warm_veil = np.array([0.68, 0.83, 0.96], dtype=np.float32)[None, None, :]
        x = x * (1.0 - haze) + warm_veil * haze
    return (np.clip(x, 0.0, 1.0) * 255.0).astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--rgb", required=True, help="Beauty/color video")
    ap.add_argument("--depth", required=True, help="Depth-pass video, near white / far black")
    ap.add_argument("--output", required=True)
    ap.add_argument("--focus", type=float, default=0.68, help="Depth value at the focus plane (0..1)")
    ap.add_argument("--blur", type=float, default=14.0, help="Maximum background blur radius (0..22)")
    ap.add_argument("--bloom", type=float, default=0.18)
    ap.add_argument("--warmth", type=float, default=0.12)
    ap.add_argument("--lift", type=float, default=0.10)
    ap.add_argument("--haze", type=float, default=0.035)
    ap.add_argument("--invert-depth", action="store_true", help="Use if depth export is near black / far white")
    ap.add_argument("--crf", type=int, default=18)
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("FFmpeg must be installed and available on PATH.")
    rgb = cv2.VideoCapture(args.rgb)
    dep = cv2.VideoCapture(args.depth)
    if not rgb.isOpened() or not dep.isOpened():
        raise SystemExit("Could not open beauty or depth video.")

    fps = rgb.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(rgb.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(rgb.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dep_fps = dep.get(cv2.CAP_PROP_FPS) or fps
    dep_w = int(dep.get(cv2.CAP_PROP_FRAME_WIDTH))
    dep_h = int(dep.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if abs(dep_fps - fps) > 0.01 or (dep_w, dep_h) != (width, height):
        raise SystemExit(f"Beauty/depth mismatch: beauty={width}x{height}@{fps}, depth={dep_w}x{dep_h}@{dep_fps}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with tempfile.TemporaryDirectory() as td:
        silent = Path(td) / "processed.mp4"
        writer = cv2.VideoWriter(str(silent), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        if not writer.isOpened():
            raise SystemExit("Could not initialize temporary video writer.")
        while True:
            ok, color = rgb.read()
            if not ok:
                break
            ok_depth, depth_frame = dep.read()
            if not ok_depth:
                raise RuntimeError(f"Depth pass ended before beauty at frame {count}. Re-render both passes with identical frame ranges.")
            if args.invert_depth:
                depth_frame = 255 - depth_frame
            result = depth_defocus(color, depth_frame, args.focus, args.blur)
            result = cinematic_grade(result, args.bloom, args.warmth, args.lift, args.haze)
            writer.write(result)
            count += 1
            if count % 150 == 0:
                print(f"Processed {count} frames")
        # Ensure the depth pass has no extra frames either.
        extra_ok, _ = dep.read()
        if extra_ok:
            raise RuntimeError("Depth pass has more frames than beauty. Re-render both passes with identical frame ranges.")
        rgb.release()
        dep.release()
        writer.release()

        cmd = [
            "ffmpeg", "-y", "-i", str(silent), "-i", args.rgb,
            "-map", "0:v:0", "-map", "1:a?",
            "-c:v", "libx264", "-crf", str(args.crf), "-preset", "veryfast",
            "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", str(output),
        ]
        subprocess.run(cmd, check=True)
    print(f"Done: {output} ({count} frames).")


if __name__ == "__main__":
    main()
