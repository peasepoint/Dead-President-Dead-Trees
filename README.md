# Printable logs for the classic log building toy

3D-printable logs, gables, shingles and a chimney, sized to match the original wooden and plastic pieces. Print replacements, extend a set you own, or print a whole building.

![Cabin, shed and cottage built from the printable parts](cabin_build.gif)

> **Only the notch fit has been test-printed.** Two crossed 1-notch logs in PLA fit well at the current notch width. The three buildings above and the three [further down](#more-buildings) are checked in software for overlap, support and interlocking, but nobody has printed a whole building yet. Do the [fit test](#2-print-the-fit-test) on your own printer before printing a full set.

## The parts

Every STL is in millimetres and already lies in its printing orientation.

| Logs | Half logs | Gables | Shingles | Chimney |
|:---:|:---:|:---:|:---:|:---:|
| <img src="images/log_3insert_7-5_8.png" width="150" alt="3-notch log"> | <img src="images/half_log_7-1_2.png" width="150" alt="Half log"> | <img src="images/gable_plastic_8-1_2.png" width="150" alt="Large plastic-style gable"> | <img src="images/shingle_ridge_9.png" width="150" alt="Ridge shingle"> | <img src="images/chimney.png" width="150" alt="Chimney"> |
| 1 to 4 notches, 1 1/2 to 10 5/8 in | 4 1/2 and 7 1/2 in; the base course | Two stepped sizes and a plain triangle | Flat and ridge, 5 5/8 to 11 in | Sits astride the roof ridge |

Also included: two solid logs, a short beveled end, and a door and window of my own design (not copies of an original). Pictures and measurements of every part are in [DESIGN_NOTES.md](DESIGN_NOTES.md#every-part).

The files come in three sets:

| Folder | Contents | Looks like |
|---|---|:---:|
| [`stl/smooth/`](stl/smooth) | All 23 parts, plain logs. Small files (about 1 MB in total) | |
| [`stl/woodgrain/`](stl/woodgrain) | The same 23 parts, with grain along the logs and growth rings on their ends (about 15 MB in total) | <img src="images/log_2insert_4-1_2.gif" width="150" alt="Wood-grain log, rotating"> |
| [`stl/rounded_woodgrain/`](stl/rounded_woodgrain) | The 7 notched logs only, with rounded ends and wood grain | <img src="images/rounded/log_2insert_4-3_4_rounded.gif" width="150" alt="Rounded-end log, rotating"> |

All three sets fit together and can be mixed in one building. The grain is cut into the surface, never raised, so sizes and notch fit don't change. Only the 11 logs differ between `smooth` and `woodgrain`; the gables, shingles, chimney, door and window are the same files in both.

## How to print

### 1. Get the files

On GitHub, choose **Code > Download ZIP** and unzip it, or clone the repository. You only need the `stl/` folder. Pick one of the three sets above.

### 2. Print the fit test

Printers and filaments vary, so check the notch fit before printing a building. Print:

- 2 x `log_1insert_1-5_8`
- 1 x `half_log_4-1_2`

Cross the two logs at their notches, then seat one in a half-log notch. A log should seat fully and lift out freely, without rattling.

- **Too tight or too loose:** a notch is 18.65 mm wide and the part that sits in it is 18.25 mm wide, which leaves 0.2 mm clearance per side. In a PLA test print this seated fully with a small amount of play. Change the clearance in 0.05 mm steps with `--clearance` (see [Regenerating the files](#regenerating-the-files)) or the `Clearance` parameter in the [Fusion design](fusion/README.md).
- **PETG:** start at 0.3 mm.

### 3. Slice

Load the STLs as they are: no rotation and no supports.

| Setting | Value |
|---|---|
| Nozzle | 0.4 mm |
| Layer height | 0.2 mm. Use 0.12 to 0.16 mm to show the wood grain better |
| Walls | 3 or more |
| Infill | 20 to 30% |
| Supports | None |
| Material | PLA. For PETG, use 0.3 mm clearance (step 2) |

How each part sits on the bed:

| Part | Orientation in the STL |
|---|---|
| Round logs, beveled end | Lying on a 0.8 mm flat along one side, notches facing sideways |
| Octagonal log | Lying on one of its faces |
| Half logs | Flat side down, notches up |
| Solid logs | Standing on end |
| Gables, shingles, door, window | Flat on a face |
| Chimney | Upside down: open top on the bed, V-cut facing up |

**Bed size.** Two parts are longer than a 256 mm bed: `log_4insert_10-5_8` (270 mm) and `shingle_flat_11` (279 mm). Turn them diagonally, or use a larger printer. The next longest parts are the 9 in shingles (229 mm) and the 3-notch log (194 mm).

**Rounded-end logs.** The last 1.5 mm of each end lifts slightly off the bed, a small overhang that is meant to print without supports.

### 4. Print a building

Quantities for the three buildings in the animation:

| Part | Cabin (6 x 9 in) | Shed (3 x 6 in) | Cottage (3 x 6 in) |
|---|:---:|:---:|:---:|
| `half_log_7-1_2` | 2 | | |
| `half_log_4-1_2` | | 2 | 2 |
| `log_4insert_10-5_8` | 8 | | |
| `log_3insert_7-5_8` | 3 | 8 | 8 |
| `log_2insert_4-1_2` | 3 | 6 | 6 |
| `log_1insert_1-5_8` | 1 | | |
| `log_1insert_1-1_2_round` | 1 | | |
| `log_1insert_1-1_2_octagonal` | 1 | | |
| `gable_plastic_8-1_2` | 2 | | |
| `gable_plastic_small_2notch` | | | 2 |
| `gable_wood_triangle_4x2` | | 2 | |
| `shingle_flat_9` | 6 | | |
| `shingle_ridge_9` | 2 | | |
| `shingle_flat_6` | | 4 | 6 |
| `shingle_ridge_6` | | 2 | |
| `chimney` | 1 | | 1 |
| **Total** | **30** | **24** | **25** |

The shed and the cottage are the easier first builds: their longest part is 194 mm. The cabin needs the 270 mm logs.

For colours close to the originals, print the logs brown, the stepped gables orange, the chimney yellow, and the shingles green, yellow, orange or red.

### More buildings

Three more buildings made from the same parts. Each passes the same software check as the first three.

| Porch cabin, smooth logs | Tall house, wood-grain logs |
|:---:|:---:|
| ![Porch cabin with smooth logs](images/examples/porch_cabin_smooth.png) | ![Tall house with wood-grain logs](images/examples/tall_house_woodgrain.png) |
| 6 x 6 in room; the roof runs forward over a 3 in porch on two posts of crossed 1-notch logs | 6 x 6 in and 12 courses, with a doorway three logs high, a window in every wall and the roof overhanging both gables |

The same corner in both finishes, and the watchtower (3 x 3 in, 14 courses):

| Smooth | Wood grain | Watchtower |
|:---:|:---:|:---:|
| <img src="images/examples/porch_corner_smooth.png" width="300" alt="Corner of the porch cabin, smooth logs"> | <img src="images/examples/porch_corner_woodgrain.png" width="300" alt="Corner of the porch cabin, wood-grain logs"> | <img src="images/examples/watchtower_woodgrain.png" width="180" alt="Watchtower with wood-grain logs"> |

Each cabin is also rendered in the other finish: [porch cabin, wood grain](images/examples/porch_cabin_woodgrain.png) and [tall house, smooth](images/examples/tall_house_smooth.png).

| Part | Porch cabin | Tall house | Watchtower |
|---|:---:|:---:|:---:|
| `half_log_7-1_2` | 3 | 2 | |
| `half_log_4-1_2` | | | 2 |
| `log_4insert_10-5_8` | 2 | | |
| `log_3insert_7-5_8` | 9 | 14 | |
| `log_2insert_4-1_2` | 3 | 8 | 21 |
| `log_1insert_1-5_8` | 12 | 3 | 10 |
| `log_1insert_1-1_2_round` | 2 | 3 | |
| `log_1insert_1-1_2_octagonal` | 1 | 2 | |
| `gable_plastic_8-1_2` | 2 | 2 | |
| `gable_wood_triangle_4x2` | | | 2 |
| `shingle_flat_9` | 6 | 6 | |
| `shingle_ridge_9` | 2 | 2 | |
| `shingle_flat_6` | | | 4 |
| `shingle_ridge_6` | | | 2 |
| `chimney` | 1 | 1 | |
| **Total** | **43** | **43** | **41** |

The three 1-notch logs are interchangeable, so any mix of them works. All six buildings together, and the porch cabin in a setting its size doesn't deserve:

![All six buildings](images/examples/village_woodgrain.png)

![The porch cabin in a mountain meadow](images/examples/cabin_landscape.gif)

The logs in these pictures are the exact STL geometry. The colours are a suggestion, and the meadow, pines, lake and mountains are generated by `make_landscape_gif.mjs`.

### 5. Assemble

1. Lay two **half logs** flat side down as the end walls. They are the only parts that touch the table.
2. Cross two side-wall logs over them, notch into notch.
3. Keep alternating end walls and side walls. Each course adds 3/8 in. Use the short 1- and 2-notch logs to leave gaps for a door or window.
4. Set a gable where the next end-wall log would go, its bottom notches over the side-wall logs.
5. Lay shingles across the two gables from the eave upward, then drop the chimney over the ridge. The chimney fits the stepped gables only; the triangle's roof is steeper.

## Editing the parts

**In Fusion.** [`fusion/`](fusion) holds the parts as Autodesk Fusion designs, with every size a named parameter. See [fusion/README.md](fusion/README.md).

![The parts laid out in Fusion](fusion/layout.png)

**In code.** All geometry is defined in `parts.mjs`.

### Regenerating the files

Requires [Node.js](https://nodejs.org); there is nothing to install. From this folder:

```bash
node log_generator.mjs
```

This rewrites all three `stl/` sets and checks that every mesh is watertight and sits on the bed. Options:

| Option | Default | Meaning |
|---|---|---|
| `--clearance` | `0.2` | Gap on each side between a notch and the part sitting in it, in mm |
| `--flat` | `0.8` | Depth of the flat that round logs print on, in mm. The parts that sit in notches are narrower by this much (18.25 mm), and the notches follow |
| `--finish` | `all` | `all`, `smooth`, `woodgrain` or `rounded_woodgrain` |
| `--out` | `stl` | Parent folder for the sets |

For example, for PETG:

```bash
node log_generator.mjs --clearance 0.3
```

The other scripts:

| Command | What it does |
|---|---|
| `node verify.mjs` | Checks the six buildings with wood-grain logs and writes `VERIFY.md`. Exits non-zero if parts overlap or a part is unsupported |
| `node verify.mjs --finish smooth` | The same with smooth logs; writes `VERIFY_smooth.md` |
| `node make_gif.mjs` | Renders `cabin_build.gif` |
| `node make_renders.mjs` | Renders the stills of the example buildings into `images/examples/` |
| `node make_landscape_gif.mjs` | Renders `images/examples/cabin_landscape.gif` and a still of the same scene (takes a few minutes) |
| `node make_part_images.mjs` | Renders a still and a rotating image of each part into `images/` |

## Status

- **Checked in software:** in all six buildings no parts overlap, every part is supported, and every wall log is locked by its notches. Results are in [VERIFY.md](VERIFY.md) and [VERIFY_smooth.md](VERIFY_smooth.md). The rounded-end logs share the standard notch layout but aren't checked separately.
- **Test-printed:** the notch fit only. Pairs of 1-notch logs were printed in PLA with notches from 18.65 to 19.65 mm wide; 18.65 mm fit best and is now the default.
- **Not checked:** everything else in the real world. No half log, gable, shingle, chimney or whole building has been printed.

If you print these, the most useful things to report are:

1. The clearance that gave a good fit, with your printer and material.
2. Whether shingles settle on the gables as in the animation, and whether the chimney sits on a stepped-gable ridge.
3. If you own original pieces: their gable thickness, shingle thickness and chimney depth. These three are assumptions (see [DESIGN_NOTES.md](DESIGN_NOTES.md#limits)).

## More documentation

| File | Contents |
|---|---|
| [DESIGN_NOTES.md](DESIGN_NOTES.md) | How each part was measured, what is assumed, the wood texture, and how the buildings are verified |
| [fusion/README.md](fusion/README.md) | The Fusion designs and their parameters |
| [PARTS_SPEC.md](PARTS_SPEC.md) | Catalog of the pieces sold commercially, with dimensions and confidence |
| [RESEARCH.md](RESEARCH.md) | Sources: existing models, original dimensions, printing tolerances |
| [VERIFY.md](VERIFY.md), [VERIFY_smooth.md](VERIFY_smooth.md) | Per-part verification results (generated) |

## Legal

"Lincoln Logs" is a Hasbro trademark; this project is not affiliated with Hasbro. The 1920 patent has expired, so the geometry is free to copy. If you share or sell the files or prints, call them "compatible log-cabin logs".
