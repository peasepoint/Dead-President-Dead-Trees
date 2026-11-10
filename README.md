# Lincoln-Logs
Files to recreate the classic Lincoln Logs toy with additive manufacturing.

![Cabin and shed built from the printable parts](cabin_build.gif)

Printable versions of every part in a reference listing of original wooden and plastic pieces: logs, half logs, beveled pieces, solid logs, both gable types and the shingles. Two test buildings are assembled from them and checked for fit, support and interlocking. Nothing has been test-printed yet.

## Contents

| Path | What it is |
|---|---|
| `stl/` | 24 ready-to-print STLs: 21 listed parts plus 3 extras (door, window, chimney) that are not in the listing |
| `parts.mjs` | Geometry for every part (single source of truth) |
| `log_generator.mjs` | Writes `stl/` and checks every mesh is watertight and sits on the bed |
| `assembly.mjs` | The two test buildings (cabin 6 x 9 in, shed 3 x 6 in), using listed parts only |
| `verify.mjs` | Voxel check of the buildings: interference, support, interlock. Writes `VERIFY.md` |
| `VERIFY.md` | Latest verification results, per part |
| `make_gif.mjs` | Renders `cabin_build.gif` from the same geometry and layout |
| `cabin_build.gif` | Parts as printed, then the cabin built course by course, then the shed |
| `make_part_images.mjs` | Renders a still PNG and a rotating GIF of every listed part into `images/` (shown in the `DESIGN_NOTES.md` parts table). Run `node make_part_images.mjs` |
| `DESIGN_NOTES.md` | How each part was measured, what is assumed, printing notes |
| `RESEARCH.md` | Web research summary |

## Run

Requires Node (`node --version`). From this folder:

```bash
node log_generator.mjs
```

```bash
node verify.mjs
```

```bash
node make_gif.mjs
```

The generator takes `--clearance` (mm per side, default 0.2) and `--flat` (side flat, default 0.8); `--out` changes the folder. `verify.mjs` exits non-zero if any parts overlap or any part is unsupported.

## Status

- **Verified (in software):** both buildings have no overlapping parts, every part supported, all wall logs locked by their notches, and only the half logs touch the table.
- **Not verified:** real-world fit. Nothing has been printed.

Next steps:
1. **Fit test:** print two `log_1insert_1-5_8` and one `half_log_4-1_2`, cross them, and adjust `--clearance` in 0.05 mm steps.
2. Print one gable and two shingles of each type, and check the shingles settle where `assembly.mjs` predicts.
3. If you have original pieces, check gable thickness, shingle thickness and the 6 in 2-insert's notch layout. These are assumptions in `parts.mjs`.

## Legal

"Lincoln Logs" is a Hasbro trademark. Printing for yourself is low risk. If you share or sell the files, call them "compatible log-cabin logs".
