# Quixora — Reusable World Creation Standard

**Selected direction:** balanced render quality; mixed art direction (simple outlined/2D-style characters inside a dimensional 3D world). This is the permanent art-direction and production standard for every new story world. It is a reusable workflow/specification, not an automatic one-click world generator.

## 1. Non-negotiable visual target

Build a complete, explorable-looking 3D environment rather than a flat background. Keep characters visually simple if the story calls for it, but give the world real geometry, material response, lighting, shadows, and depth.

Compose every location in three intentional planes:
- **Foreground:** readable props, plants, fences, furniture, passing objects, ground detail.
- **Midground:** action area, characters, primary buildings/vehicles/structures.
- **Background:** skyline, distant buildings, hills, trees, mountains, clouds, atmospheric perspective.

Add story-specific set dressing. Do not fill every empty pixel with random clutter; detail must support the story and preserve clean character silhouettes.

## 2. Required workflow for every new story

1. Parse the script: locations, time of day, weather, era, style cues, story props, character entrances/exits, and actions.
2. Create a location list. Each place needs an ID, dimensions, layout, entrances/exits, landmarks, and camera-safe paths.
3. Create a visual bible: palette, architecture language, material families, scale rules, prop language, lighting, and atmosphere.
4. Block out ground, terrain, major structures, roads/water, buildings, and landmarks. Confirm camera routes before detailed dressing.
5. Build hero assets for objects touched by characters or shown close-up.
6. Build modular architecture: wall, corner, window, door, roof, trim, stair, fence, railing, and storefront modules. Vary proportions so repeated modules do not look cloned.
7. Add story-relevant trees, shrubs, grass clumps, flowers, rocks, poles, benches, lamps, signs, vehicles, furniture, and background silhouettes.
8. Author materials: base colour/albedo plus roughness; use normal/bump/height detail where useful. Avoid relying on colour noise alone. Use plausible scale and UV repetition.
9. Light the scene: key light, fill/sky contribution, contact shadows, bounce cues, practical lights, and time-of-day colour.
10. Place characters. Match ground contact, scale, perspective, cast/contact shadows, and occlusion. Preserve readable faces and silhouettes.
11. Design camera coverage, subject screen position, focus target, clearance, and continuous route where required. Do not solve camera jumps by simply deleting cuts.
12. Add restrained depth of field, bloom, haze, colour grade, and motion blur only when justified.
13. Render location contact sheets and transition frames. Inspect clipping, z-fighting, texture scale, repeated assets, character grounding, exposure, and continuity.
14. Approve previews before full render.

## 3. Asset detail standard

### Architecture and interiors
- Use actual geometry for wall thickness, window recesses, door frames, roof edges, stairs, balconies, gutters, chimneys, railings, and visible supports.
- Break large flat surfaces with trim, seams, bevels, panels, masonry courses, or controlled material variation.
- Give buildings distinct silhouettes, heights, roof profiles, facade rhythms, and colour families.
- Interiors need floors, walls, ceiling/roof structure where visible, trim, practical lights, furniture, and depth beyond the doorway.

### Ground and landscape
- Roads: edge definition, curbs/shoulders, drains, patches, gravel/dirt variation, and story-appropriate markings.
- Grass: layered ground colour, clumps/tufts, varied height, bushes, flowers, and edge transitions; never rely on one flat green plane.
- Dirt/sand: subtle roughness, footprints/ruts when story-relevant, stones, and colour breakup.
- Water: depth tint, surface normals/ripples, reflections/specular response, shoreline geometry, and foam only where justified.
- Stone/brick/wood: visible scale-appropriate seams/grain and non-uniform roughness.

### Props, materials, and performance
- Place props with believable support/contact: signs on posts or walls, lamps on mounts, furniture on floors, fences anchored to terrain, cables supported by poles, vegetation rooted in ground.
- Use shared texture atlases/material families where practical. Use subtle bump/normal detail; avoid embossed/noisy surfaces.
- Use instancing or merged static geometry for repeated props. Keep hero assets detailed; distant assets can use simpler geometry and lower texture resolution.
- Set LOD/density by camera distance. Do not add expensive detail never visible to camera.
- Maintain consistent real-world scale and UV texel density.

## 4. Camera and composition rules

- Design camera paths against the blockout before final dressing.
- Review every transition at least 2 seconds before and after the boundary (or an equivalent interval for short clips).
- Keep clearance from walls, bridge cables, trees, poles, furniture, and characters.
- Use easing and controlled look-at interpolation; avoid sudden yaw flips and abrupt focal-length changes.
- Keep the subject readable; avoid long stretches where foreground geometry hides the action.
- Use cuts when story grammar requires them. A continuous take is a camera/story requirement, not a blanket instruction to interpolate unrelated locations.
- DOF follows the active focus target and camera distance, not one arbitrary constant for the entire video.

## 5. Mixed character integration

- Keep the chosen simple/outlined character design; do not automatically convert characters to realistic 3D.
- Match foot/ground contact and apparent scale to the world.
- Add contact shadows and subtle environment occlusion without changing established line-art style.
- Use correct foreground/background occlusion. Avoid floating or sliding characters.
- Preserve identity, costume, proportions, and screen direction across shots.

## 6. Lighting and cinematic finish

- Define per-location time of day, key direction, sky/fill level, practical lights, shadow softness, and atmosphere.
- Use ambient occlusion/contact shadow selectively; avoid dirty halos and excessive darkening.
- Bloom only bright highlights; do not wash out the image.
- Warmth is a controlled grade, not an orange overlay.
- Haze increases with distance and must not flatten nearby subjects.
- DOF separates planes while keeping the active subject sharp.
- Texture detail comes from geometry/materials/lighting; post-processing cannot replace missing models or surfaces.

## 7. Required deliverables for every new world

- `WORLD_BIBLE.md`: story-specific visual language and references.
- `world-blueprint.json`: locations, layout, hero assets, modular kits, materials, lighting, atmosphere, camera constraints, and performance budget.
- `assets/`: custom models/textures or documented approved asset sources.
- `preview/`: location contact sheets and camera-transition stills.
- `WORLD_QA.md`: pass/fail results and known limitations.

Start from `templates/world-blueprint.template.json`. Replace every `TODO` and empty list before production approval.

## 8. Acceptance checklist

A world is not complete until every story location has a distinct layout and landmark; foreground, midground, and background are intentionally designed; hero assets have real geometry and readable materials; visible interiors have depth; ground, vegetation, water, and props have believable contact and scale; characters sit naturally with shadows/occlusion; camera transitions have no unintended jumps, clipping, or blocked action; focus follows the subject; representative stills are visually inspected; and performance is measured at target render scale.

**Do not claim “reference matched” or “production ready” from structural tests alone. Visual preview renders must be inspected.**
