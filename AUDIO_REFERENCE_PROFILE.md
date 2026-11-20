# Reference audio profile (measured from supplied 64.13-second clip)

This is a measurable **mix/master reference**, not a verified isolated voiceprint. Exact speaking rate and vocal pitch are not inferred from a full mixed track.

## Measured source properties

| Property | Measured value |
|---|---:|
| Duration | 64.13 s |
| Source audio codec | AAC |
| Sample rate | 44.1 kHz |
| Channels | Stereo |
| Integrated loudness | -17.3 LUFS |
| Loudness range | 2.5 LU |
| True peak | -2.2 dBFS |

## Quixora starting mix target

- Preserve source voice performance and timing by default. Do not time-stretch or pitch-shift automatically.
- For a comparable overall mix, use -17.3 LUFS integrated and -2.2 dBTP as the **reference measurement**, then listen-check the result. This is a match target, not a universal platform loudness recommendation.
- Keep dialogue intelligible above music and effects. Duck music under dialogue rather than boosting the entire mix indiscriminately.
- Avoid clipping; use a true-peak limiter and re-measure after encoding.
- Retain stereo when the source is stereo.

## Voice speed and pitch

The supplied track has not been separated into clean dialogue stems. Exact narrator words-per-minute and isolated fundamental pitch are therefore **not verified**. Do not hard-code a pitch shift or playback-speed multiplier based on the full mix. If a clean voice stem is available, measure speech-only sections and approve any speed/pitch changes by listening.

## Reproducible measurement

```bash
ffmpeg -hide_banner -i reference.wav -filter_complex ebur128=peak=true -f null -
```

Record Integrated loudness, LRA and True Peak from the final Summary. Measure the final encoded video too; encoding can change peak values.
