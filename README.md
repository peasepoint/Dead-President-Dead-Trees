# Log building toy compatible generated shapes
Files to augment the classic toy with additive manufacturing.

![Cabin, shed and cottage built from the printable parts](cabin_build.gif)

Printable versions of every part in a reference listing of original wooden and plastic pieces: logs, half logs, beveled pieces, solid logs, the wooden triangle and two sizes of plastic gable, the chimney and the shingles. Three test buildings are assembled from them and checked for fit, support and interlocking. Nothing has been test-printed yet.

## Contents

| Path | What it is |
|---|---|
| `stl/smooth/` | 25 ready-to-print STLs with plain logs: 23 parts from the reference photos (21 from the listing, plus the small plastic gable and the chimney from a second photo) and 2 extras (door, window) that are in neither |
| `stl/woodgrain/` | The same 25 parts with wood grain and end-grain rings on the 13 logs |
| `parts.mjs` | Geometry for every part (single source of truth), including the optional wood texture on the logs |
| `log_generator.mjs` | Writes both `stl/` sets and checks every mesh is watertight and sits on the bed |
| `fusion/` | The parts as an Autodesk Fusion design: a smooth parametric file and a wood-grain copy (see `fusion/README.md`) |
| `assembly.mjs` | The three test buildings (cabin 6 x 9 in with chimney, shed 3 x 6 in, cottage 3 x 6 in with small gables and chimney), using photographed parts only |
| `verify.mjs` | Voxel check of the buildings: interference, support, interlock. Writes `VERIFY.md` |
| `VERIFY.md`, `VERIFY_smooth.md` | Latest verification results, per part, for the wood-grain and the smooth logs |
| `make_gif.mjs` | Renders `cabin_build.gif` from the same geometry and layout |
| `cabin_build.gif` | Parts as printed, then the cabin built course by course, then the shed and the cottage |
| `make_part_images.mjs` | Renders a still PNG and a rotating GIF of every photographed part into `images/` (shown in the `DESIGN_NOTES.md` parts table). Run `node make_part_images.mjs` |
| `DESIGN_NOTES.md` | How each part was measured, what is assumed, printing notes |
| `RESEARCH.md` | Web research summary |
| `PARTS_SPEC.md` | Catalog of every commercially sold piece with dimensions, part numbers and confidence |

## Smooth or wood grain

Every log comes in two finishes. Pick one folder and print from it; each folder is a complete set, and the two finishes fit together and can be mixed in one building.

| | Smooth | Wood grain |
|---|---|---|
| STLs | `stl/smooth/` | `stl/woodgrain/` |
| Fusion design | `fusion/DeadPresidentTreeSections.f3d` (parametric solids) | `fusion/DeadPresidentTreeSections_woodgrain.f3d` (the same design plus textured meshes) |
| Logs | Plain cylinders | Lengthwise grain up to 0.25 mm deep, growth rings on the ends |
| File size | About 1 MB for the set | About 18 MB for the set |

- Only the 13 logs differ (notched logs, half logs, beveled pieces, solid logs). The gables, shingles, chimney, door and window are identical in both folders.
- The grain is cut into the surface, never raised, so sizes and notch fit are the same in both finishes.
- The pictures in `images/` and `cabin_build.gif` show the wood-grain finish.

Details are in the "Wood texture" section of `DESIGN_NOTES.md`.

## Run

Requires Node (`node --version`). From this folder:

```bash
node log_generator.mjs
```

```bash
node verify.mjs
```

```bash
node verify.mjs --finish smooth
```

```bash
node make_gif.mjs
```

The generator writes both finishes. It takes `--clearance` (mm per side, default 0.2), `--flat` (side flat, default 0.8) and `--finish` (`both`, `smooth` or `woodgrain`; default `both`); `--out` changes the parent folder (default `stl`). `verify.mjs` exits non-zero if any parts overlap or any part is unsupported.

## Status

- **Verified (in software):** all three buildings have no overlapping parts, every part supported, all wall logs locked by their notches, and only the half logs touch the table.
- **Not verified:** real-world fit. Nothing has been printed.

Next steps:
1. **Fit test:** print two `log_1insert_1-5_8` and one `half_log_4-1_2`, cross them, and adjust `--clearance` in 0.05 mm steps.
2. Print one gable of each type with two shingles, and check the shingles settle where `assembly.mjs` predicts. Check the chimney straddles a plastic-gable ridge.
3. If you have original pieces, check these assumptions in `parts.mjs`: gable thickness, shingle thickness, chimney depth and the 6 in 2-insert's notch layout.

## Legal

"Lincoln Logs" is a Hasbro trademark. Printing for yourself is low risk. If you share or sell the files, call them "compatible log-cabin logs".
