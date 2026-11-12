# Design notes

How the parts were measured, what is assumed, and how the test buildings are checked. To print the parts, start with the [README](README.md).

Every part is defined in `parts.mjs`. The same geometry feeds each script:

| Script | What it does |
|---|---|
| `log_generator.mjs` | Writes the five folders in `stl/`: `roof_parts/`, `smooth/`, `flat_end_round/`, `flat_end_octagonal/` and `ball_end_round/` |
| `assembly.mjs` | Lays the parts out into six test buildings |
| `verify.mjs` | Checks the buildings with each log set; results in `VERIFY_flat_end_round.md`, `VERIFY_flat_end_octagonal.md` and `VERIFY_smooth.md` |
| `make_gif.mjs` | Renders `cabin_build.gif` |
| `render_lib.mjs`, `make_renders.mjs`, `make_landscape_gif.mjs` | Render the example-building stills and the landscape animation in `images/examples/` |
| `make_part_images.mjs` | Renders the still and rotating images in the tables below (one folder per set: `images/roof_parts/`, `images/flat_end_round/`, `images/flat_end_octagonal/`, `images/ball_end_round/`), in assembly orientation |

## How the parts were measured

The reference is a Poshmark listing of about 675 original wooden and plastic pieces ([listing](https://poshmark.com/listing/Lincoln-Log-Pieces-697ff0d8e9c77d6090234e27)). Its 11 photos include the seller's inventory sheet (part names, lengths in inches, quantities). I enlarged each photo in the browser and laid a labelled pixel grid over it. Scale came from the cutting mat's 1 in grid and ruler (about 83 px per inch at the mat) and from the known 3 in notch spacing on each log (about 82 to 86 px per inch at a log's top). Readings are good to roughly ±0.03 in. Where the sheet gives a length, I used the sheet's figure. Where the photos and the sheet disagree, I note it below.

A second photo (supplied directly, not from the listing) shows nine orange plastic gables in two sizes and two yellow chimneys, front-on on a plain background. Its scale came from the large gable's known 8 1/2 in width and the 3 in notch spacing, about 126 px per inch. Two parts come from it: the **small two-notch plastic gable** and the **chimney**. It also confirms the large gable's three bottom notches and its symmetry.

## Shared log geometry

| Feature | Value | Basis |
|---|---|---|
| Log diameter | 3/4 in (19.05 mm) | Photos (end grain about 0.76 in), published spec |
| Notch width | 19.45 mm: the log diameter + 0.2 mm clearance per side | The clearance is from the fit test in PLA (see Limits). The photos show about 0.76 in |
| Mating width | 19.05 mm: a full log | Round logs are round from end to end, as the originals are. Half logs are as wide and gables as thick. (`--flat 0.8` gives the earlier 18.25 mm) |
| Notch depth | 3/16 in, top and bottom | Hobbyist plans; consistent with photos |
| Notch centres | 3 in | Photos: 245 to 260 px between notches on every log |
| Course rise | 3/8 in | Two 3/16 in notches overlap |
| Notch placement | Centred on the listed length | Ends measured 0.33 to 0.44 in, which fits a centred layout within about 1/16 in |
| Print orientation | Round, hex, beveled and solid logs stand on end | No printing flat, so the logs are fully round. Half logs still lie flat side down |
| Notch walls on standing logs | Square. The upper wall of each notch, a 4.8 mm flat overhang as printed, rests on a built-in break-away comb: five 0.5 mm fins 2.4 mm apart on a spine, 0.2 mm under the wall, 0.5 mm off the notch floor, 0.4 mm inside the surface | Square walls hold the crossing log both ways. `STAND` in `parts.mjs`; `--supports 0` leaves the combs out, `--roof 45` leans the wall back instead |

## The five sets

The parts are split into one folder of shared roof parts and four log sets. Every log set has the same 11 logs, the same notch layout and the same mating width, so the sets mix in one building and each one can build any of the test buildings.

| Folder | Contents | Built by |
|---|---|---|
| `stl/roof_parts/` | Gables, shingles, chimney, and the door and window (12 parts). Smooth; used with every log set | `makeParts()`, the parts that are not logs |
| `stl/flat_end_round/` | Round logs with wood grain and flat ends (11 parts). Was `stl/woodgrain/` | `makeParts({ texture: true })`, the default |
| `stl/ball_end_round/` | Round logs with rounded ends and wood grain (11 parts). Was `stl/rounded_woodgrain/` | `makeParts({ set: 'rounded' })` |
| `stl/flat_end_octagonal/` | Octagonal logs with wood grain and flat ends (11 parts) | `makeParts({ set: 'octagonal' })` |
| `stl/smooth/` | Round logs, plain, flat ends (11 parts) | `makeParts({ texture: false })` |

"Logs" means the notched logs, half logs, beveled end and solid logs. `node log_generator.mjs` writes all five folders; `--set <folder>` writes one.

## Wood texture

Three log sets carry wood grain: `flat_end_round`, `ball_end_round` and `flat_end_octagonal`. Every log in them carries a shallow texture, built into the mesh by `parts.mjs` (`texture: true`, the default; `texture: false` gives the smooth logs). The roof parts are smooth.

| Feature | Value | Why |
|---|---|---|
| Side grain | Lengthwise streaks, up to 0.25 mm deep and 1.1 to 1.8 mm wide, that wander slightly and fade in and out | The wooden originals are stained dowels with the grain running along the log |
| End grain | Growth rings, 0.2 mm deep, about 1.2 to 1.7 mm apart, round a slightly off-centre pith | The originals show ring arcs on their sawn ends |
| Hollow ends | On logs that stand on end the rings sit in a hollow 1 mm deep, reached by a 45 deg slope. The flat rim round it is 1.2 to 2.8 mm wide and varies with angle | Looks like the end of a hollow log. Only the rim touches the bed (about 106 mm2, against 285 mm2 for a full end); 1.2 mm is three 0.4 mm lines. The slope carries the first layers; the floor is a 13 mm bridge. Half logs keep flush rings |
| Direction | Grooves only, never raised | The outside diameter, length and notch fit are unchanged, so the sets can be mixed |
| Left smooth | Notch floors and walls; the end rims; the half-log underside and side flat | Mating surfaces and bed adhesion |
| Slopes | Smooth groove profile, about 35 deg at its steepest | Prints without supports in any orientation |
| Variation | Each part name seeds its own pattern; the two ends of a log differ | Same output on every run |

The sizes are in `TEX` at the top of the texture section of `parts.mjs`. The depths are a judgement for a 0.4 mm nozzle at 0.2 mm layers, not a measurement of an original log, and nothing has been test-printed.

All four log sets are checked in the test buildings: `node verify.mjs` with flat-end round logs (`VERIFY_flat_end_round.md`), and `--set ball_end_round`, `--set flat_end_octagonal` and `--set smooth` (`VERIFY_<set>.md`). `make_gif.mjs` and the example renders use the flat-end round logs.

`fusion/` holds one parametric Fusion design per folder, built by `fusion/build_lincoln_logs.py`; the wood-grain sets also carry their STLs as mesh bodies. See [fusion/README.md](fusion/README.md).

## Every part

Listing quantities are from the Poshmark sheet. The small plastic gable and the chimney are not on the sheet; they come from the second photo.

### Logs: Flat-End-Round and Smooth

`stl/flat_end_round/` and `stl/smooth/` hold the same 11 logs with the same names; the pictures show the wood-grain ones.

| STL | Listing line (qty) | Model | Notes | Still and rotating |
|---|---|---|---|---|
| `log_1insert_1-5_8` | 1 Insert Log, 1 5/8 (119) | Round, 1 notch | Photo measured 1.58 in | <img src="images/flat_end_round/log_1insert_1-5_8.png" width="160" alt="log_1insert_1-5_8"> <img src="images/flat_end_round/log_1insert_1-5_8.gif" width="160" alt="log_1insert_1-5_8 rotating"> |
| `log_1insert_1-1_2_round` | 1 Insert Log (Round), 1 1/2 (169) | Round, 1 notch | | <img src="images/flat_end_round/log_1insert_1-1_2_round.png" width="160" alt="log_1insert_1-1_2_round"> <img src="images/flat_end_round/log_1insert_1-1_2_round.gif" width="160" alt="log_1insert_1-1_2_round rotating"> |
| `log_1insert_1-1_2_hex` | 1 Insert Log (Hex), 1 1/2 (96) | Round, 3/4 in, with six flats 0.7 mm deep: top, bottom and four diagonals. 1 notch | Listed as hex. The end grain shows flats top and bottom. A true hexagon is 1.28 mm deep at its flats; the shallower cut keeps the corners round and the sides a full 3/4 in wide, so it fits a notch like a round log | <img src="images/flat_end_round/log_1insert_1-1_2_hex.png" width="160" alt="log_1insert_1-1_2_hex"> <img src="images/flat_end_round/log_1insert_1-1_2_hex.gif" width="160" alt="log_1insert_1-1_2_hex rotating"> |
| `log_2insert_4-1_2` | 2 Insert Log, 4 1/2 (121) | Round, 2 notches | Photo measured 4.57 in | <img src="images/flat_end_round/log_2insert_4-1_2.png" width="160" alt="log_2insert_4-1_2"> <img src="images/flat_end_round/log_2insert_4-1_2.gif" width="160" alt="log_2insert_4-1_2 rotating"> |
| `log_3insert_7-5_8` | 3 Insert Log, 7 3/4 (110) | Round, 3 notches, 7 5/8 in | The sheet says 7 3/4, but the photo measured about 7.6 in and the length rule in `PARTS_SPEC.md` (3 in centres, 7/16 in shoulders) gives 7 5/8, matching the 1 5/8 and 10 5/8 in logs from the same lot. 7 5/8 is used | <img src="images/flat_end_round/log_3insert_7-5_8.png" width="160" alt="log_3insert_7-5_8"> <img src="images/flat_end_round/log_3insert_7-5_8.gif" width="160" alt="log_3insert_7-5_8 rotating"> |
| `log_4insert_10-5_8` | 4 Insert Log, 10 5/8 (3) | Round, 4 notches | | <img src="images/flat_end_round/log_4insert_10-5_8.png" width="160" alt="log_4insert_10-5_8"> <img src="images/flat_end_round/log_4insert_10-5_8.gif" width="160" alt="log_4insert_10-5_8 rotating"> |
| `half_log_4-1_2`, `half_log_7-1_2` | Half Log, 4 1/2 (8) and 7 1/2 (10) | Flat bottom at the bottom-notch floor (9/16 in tall), notches on top only, 3/4 in wide | Photo: about 0.53 in tall. These are the base course, so a building sits flat on the table | <img src="images/flat_end_round/half_log_4-1_2.png" width="160" alt="half_log_4-1_2"> <img src="images/flat_end_round/half_log_4-1_2.gif" width="160" alt="half_log_4-1_2 rotating"><br><img src="images/flat_end_round/half_log_7-1_2.png" width="160" alt="half_log_7-1_2"> <img src="images/flat_end_round/half_log_7-1_2.gif" width="160" alt="half_log_7-1_2 rotating"> |
| `beveled_end_1-1_2` | Beveled End, 1 1/2 x 1 1/4 (19) | 1 1/2 in log, one end cut at 39 deg | The 39 deg is from the photos and matches the wooden triangle. The sheet's "1 1/4" is not explained by the photos | <img src="images/flat_end_round/beveled_end_1-1_2.png" width="160" alt="beveled_end_1-1_2"> <img src="images/flat_end_round/beveled_end_1-1_2.gif" width="160" alt="beveled_end_1-1_2 rotating"> |
| `solid_log_1-3_8`, `solid_log_1-5_8` | Solid Log, 1 3/8 (30) and 1 5/8 (15) | Plain 3/4 in cylinders | Purpose unknown; not used in the test buildings | <img src="images/flat_end_round/solid_log_1-3_8.png" width="160" alt="solid_log_1-3_8"> <img src="images/flat_end_round/solid_log_1-3_8.gif" width="160" alt="solid_log_1-3_8 rotating"><br><img src="images/flat_end_round/solid_log_1-5_8.png" width="160" alt="solid_log_1-5_8"> <img src="images/flat_end_round/solid_log_1-5_8.gif" width="160" alt="solid_log_1-5_8 rotating"> |

### Roof Parts

`stl/roof_parts/`: the same files whichever log set you print. The folder also holds `extra_door` and `extra_window`, my own design (not copies of an original), which stand in a wall opening.

| STL | Listing line (qty) | Model | Notes | Still and rotating |
|---|---|---|---|---|
| `gable_plastic_8-1_2` | Plastic Orange Roof, 2 1/4 x 8 1/2 (1) | Symmetric; 3 bottom notches on 3 in centres; 7 steps per side; eave hook lips | Measured from an enlarged photo; slope 27 deg | <img src="images/roof_parts/gable_plastic_8-1_2.png" width="160" alt="gable_plastic_8-1_2"> <img src="images/roof_parts/gable_plastic_8-1_2.gif" width="160" alt="gable_plastic_8-1_2 rotating"> |
| `gable_plastic_small_2notch` | Not on the sheet (second photo shows 4) | Symmetric; 2 bottom notches 3 in apart; 5 steps per side; eave hook lips; 5.8 x 1.56 in | Photo: about 5.8 in wide and 1.6 in tall, notch centres about 1.4 in from each end. Same lip, riser and pitch (27 deg) as the large gable, so the height follows from the width | <img src="images/roof_parts/gable_plastic_small_2notch.png" width="160" alt="gable_plastic_small_2notch"> <img src="images/roof_parts/gable_plastic_small_2notch.gif" width="160" alt="gable_plastic_small_2notch rotating"> |
| `chimney` | Not on the sheet (second photo shows 2) | Open-topped block, 1 3/8 in wide x 1.2 in tall x 1 in deep, inverted-V cut in the base | Photo: about 1.39 x 1.2 in; V about 0.36 in deep with 27 deg sides, so it straddles a plastic-gable roof ridge. Modelled V: 0.35 in, matched to the 27.1 deg roof. Depth and the 1/2 in-deep top socket are not visible; my choice | <img src="images/roof_parts/chimney.png" width="160" alt="chimney"> <img src="images/roof_parts/chimney.gif" width="160" alt="chimney rotating"> |
| `gable_wood_triangle_4x2` | Triangle, 4 x 2 (16) | Straight 39 deg slopes, 2 bottom notches 3 in apart | Listed 4 x 2; measures about 4 7/8 x 2 (notch-to-notch 3 in plus about 0.9 in overhang each side). Decorative log-row grooves not modelled | <img src="images/roof_parts/gable_wood_triangle_4x2.png" width="160" alt="gable_wood_triangle_4x2"> <img src="images/roof_parts/gable_wood_triangle_4x2.gif" width="160" alt="gable_wood_triangle_4x2 rotating"> |
| `shingle_flat_6`, `_9`, `_11` | Orange/Yellow/Green Flat Shingle, 6, 9, 11 | 0.8 x 1/8 in boards | Width measured about 0.79 to 0.8 in | <img src="images/roof_parts/shingle_flat_6.png" width="160" alt="shingle_flat_6"> <img src="images/roof_parts/shingle_flat_6.gif" width="160" alt="shingle_flat_6 rotating"><br><img src="images/roof_parts/shingle_flat_9.png" width="160" alt="shingle_flat_9"> <img src="images/roof_parts/shingle_flat_9.gif" width="160" alt="shingle_flat_9 rotating"><br><img src="images/roof_parts/shingle_flat_11.png" width="160" alt="shingle_flat_11"> <img src="images/roof_parts/shingle_flat_11.gif" width="160" alt="shingle_flat_11 rotating"> |
| `shingle_ridge_5-5_8`, `_6`, `_9` | Red/Yellow/Green with Ridge Shingle | 1 1/8 in board with a centre groove | Measured 1.13 to 1.17 in wide. Both halves are lit identically, so it is flat, not folded | <img src="images/roof_parts/shingle_ridge_5-5_8.png" width="160" alt="shingle_ridge_5-5_8"> <img src="images/roof_parts/shingle_ridge_5-5_8.gif" width="160" alt="shingle_ridge_5-5_8 rotating"><br><img src="images/roof_parts/shingle_ridge_6.png" width="160" alt="shingle_ridge_6"> <img src="images/roof_parts/shingle_ridge_6.gif" width="160" alt="shingle_ridge_6 rotating"><br><img src="images/roof_parts/shingle_ridge_9.png" width="160" alt="shingle_ridge_9"> <img src="images/roof_parts/shingle_ridge_9.gif" width="160" alt="shingle_ridge_9 rotating"> |

**Gable thickness** isn't visible in any photo. All three gables are 19.05 mm thick, the same as a log, so they fill a crossing log's notch slot the way a log does. That locks them sideways.

**Shingle thickness** is also not visible. I used 1/8 in.

**Chimney depth and socket** are also not visible, since the photo is front-on. I used 1 in deep, 0.12 in walls and a 1/2 in-deep open top.

## Ball-End-Round set

`stl/ball_end_round/` (was `stl/rounded_woodgrain/`) is the 11 standard logs with rounded ends and wood grain. The end shape comes from the old 4 3/4 in "beveled end" log, which is no longer included: its 1/2 in shoulders don't follow the toy's length rule, and it did the same job as the 4 1/2 in log. Build the set with `makeParts({ set: 'rounded' })`. Each STL is named like its flat-end counterpart with `_rounded` on the end.

| Feature | Value |
|---|---|
| End shape | The cross-section steps down to 95% of full size 1.5 mm in from the end, 82% at 3.5 mm and 66.5% at the end face; the first step is a 45 deg overhang on the end that stands on the bed (`ROUNDED_ENDS` in `parts.mjs`) |
| Lengths, notches, fit | The same as the matching flat-end log; the rounding sits in the end shoulders, outside the notches |
| Half logs | Both ends rounded over the top and sides only: the section shrinks towards the bottom, so the flat side stays flat on the bed |
| Beveled end | The square end, which stands on the bed, is rounded; the 39 deg slanted end is left as cut |
| Solid logs | Both ends rounded |

| STL | Based on | Still and rotating |
|---|---|---|
| `log_1insert_1-5_8_rounded` | `log_1insert_1-5_8` | <img src="images/ball_end_round/log_1insert_1-5_8_rounded.png" width="160" alt="log_1insert_1-5_8_rounded"> <img src="images/ball_end_round/log_1insert_1-5_8_rounded.gif" width="160" alt="log_1insert_1-5_8_rounded rotating"> |
| `log_1insert_1-1_2_round_rounded` | `log_1insert_1-1_2_round` | <img src="images/ball_end_round/log_1insert_1-1_2_round_rounded.png" width="160" alt="log_1insert_1-1_2_round_rounded"> <img src="images/ball_end_round/log_1insert_1-1_2_round_rounded.gif" width="160" alt="log_1insert_1-1_2_round_rounded rotating"> |
| `log_1insert_1-1_2_hex_rounded` | `log_1insert_1-1_2_hex` | <img src="images/ball_end_round/log_1insert_1-1_2_hex_rounded.png" width="160" alt="log_1insert_1-1_2_hex_rounded"> <img src="images/ball_end_round/log_1insert_1-1_2_hex_rounded.gif" width="160" alt="log_1insert_1-1_2_hex_rounded rotating"> |
| `log_2insert_4-1_2_rounded` | `log_2insert_4-1_2` | <img src="images/ball_end_round/log_2insert_4-1_2_rounded.png" width="160" alt="log_2insert_4-1_2_rounded"> <img src="images/ball_end_round/log_2insert_4-1_2_rounded.gif" width="160" alt="log_2insert_4-1_2_rounded rotating"> |
| `log_3insert_7-5_8_rounded` | `log_3insert_7-5_8` | <img src="images/ball_end_round/log_3insert_7-5_8_rounded.png" width="160" alt="log_3insert_7-5_8_rounded"> <img src="images/ball_end_round/log_3insert_7-5_8_rounded.gif" width="160" alt="log_3insert_7-5_8_rounded rotating"> |
| `log_4insert_10-5_8_rounded` | `log_4insert_10-5_8` | <img src="images/ball_end_round/log_4insert_10-5_8_rounded.png" width="160" alt="log_4insert_10-5_8_rounded"> <img src="images/ball_end_round/log_4insert_10-5_8_rounded.gif" width="160" alt="log_4insert_10-5_8_rounded rotating"> |
| `half_log_4-1_2_rounded` | `half_log_4-1_2` | <img src="images/ball_end_round/half_log_4-1_2_rounded.png" width="160" alt="half_log_4-1_2_rounded"> <img src="images/ball_end_round/half_log_4-1_2_rounded.gif" width="160" alt="half_log_4-1_2_rounded rotating"> |
| `half_log_7-1_2_rounded` | `half_log_7-1_2` | <img src="images/ball_end_round/half_log_7-1_2_rounded.png" width="160" alt="half_log_7-1_2_rounded"> <img src="images/ball_end_round/half_log_7-1_2_rounded.gif" width="160" alt="half_log_7-1_2_rounded rotating"> |
| `beveled_end_1-1_2_rounded` | `beveled_end_1-1_2` | <img src="images/ball_end_round/beveled_end_1-1_2_rounded.png" width="160" alt="beveled_end_1-1_2_rounded"> <img src="images/ball_end_round/beveled_end_1-1_2_rounded.gif" width="160" alt="beveled_end_1-1_2_rounded rotating"> |
| `solid_log_1-3_8_rounded` | `solid_log_1-3_8` | <img src="images/ball_end_round/solid_log_1-3_8_rounded.png" width="160" alt="solid_log_1-3_8_rounded"> <img src="images/ball_end_round/solid_log_1-3_8_rounded.gif" width="160" alt="solid_log_1-3_8_rounded rotating"> |
| `solid_log_1-5_8_rounded` | `solid_log_1-5_8` | <img src="images/ball_end_round/solid_log_1-5_8_rounded.png" width="160" alt="solid_log_1-5_8_rounded"> <img src="images/ball_end_round/solid_log_1-5_8_rounded.gif" width="160" alt="solid_log_1-5_8_rounded rotating"> |

All six test buildings pass `verify.mjs --set ball_end_round` (no interference, every part supported). The standing pieces stand on the narrowed end, 12.7 mm across, with about 59 mm2 on the bed, so they need a brim.

## Flat-End-Octagonal set

`stl/flat_end_octagonal/` is the 11 standard logs with a regular octagonal section instead of a round one, with wood grain and flat, hollowed ends like `flat_end_round`. Build it with `makeParts({ set: 'octagonal' })`. Each STL is named like its round counterpart with `_oct` on the end.

| Feature | Value |
|---|---|
| Section | Regular octagon, 3/4 in (19.05 mm) across the flats, 20.6 mm across the corners. Flats face up, down and to both sides |
| Fit | A side flat is what bears on a notch wall, so the mating width is the same 19.05 mm as a round log, and the notch, clearance and course rise are unchanged. The corners stay inside the round log's 3/4 in square, so nothing a round log fits next to is hit |
| Notches, supports, ends | As the round standing logs: square notch walls, the break-away comb in each notch, and the growth rings in a hollow behind an uneven rim |
| Grain | The same streaks as the round logs, cut into the flats; each part has its own pattern |
| 1 1/2 in logs | `log_1insert_1-1_2_oct` is the octagonal version of the round one ("round" dropped from the name). The hex log, `log_1insert_1-1_2_hex_oct`, keeps its own section (round with six shallow flats), as in every set |
| Half logs | Octagon cut off at the bottom-notch floor; the bottom stays smooth and both side flats carry grain |
| Solid logs, beveled end | Octagonal prisms; the beveled end is cut at 39 deg as before |

| STL | Based on | Still and rotating |
|---|---|---|
| `log_1insert_1-5_8_oct` | `log_1insert_1-5_8` | <img src="images/flat_end_octagonal/log_1insert_1-5_8_oct.png" width="160" alt="log_1insert_1-5_8_oct"> <img src="images/flat_end_octagonal/log_1insert_1-5_8_oct.gif" width="160" alt="log_1insert_1-5_8_oct rotating"> |
| `log_1insert_1-1_2_oct` | `log_1insert_1-1_2_round` | <img src="images/flat_end_octagonal/log_1insert_1-1_2_oct.png" width="160" alt="log_1insert_1-1_2_oct"> <img src="images/flat_end_octagonal/log_1insert_1-1_2_oct.gif" width="160" alt="log_1insert_1-1_2_oct rotating"> |
| `log_1insert_1-1_2_hex_oct` | `log_1insert_1-1_2_hex` | <img src="images/flat_end_octagonal/log_1insert_1-1_2_hex_oct.png" width="160" alt="log_1insert_1-1_2_hex_oct"> <img src="images/flat_end_octagonal/log_1insert_1-1_2_hex_oct.gif" width="160" alt="log_1insert_1-1_2_hex_oct rotating"> |
| `log_2insert_4-1_2_oct` | `log_2insert_4-1_2` | <img src="images/flat_end_octagonal/log_2insert_4-1_2_oct.png" width="160" alt="log_2insert_4-1_2_oct"> <img src="images/flat_end_octagonal/log_2insert_4-1_2_oct.gif" width="160" alt="log_2insert_4-1_2_oct rotating"> |
| `log_3insert_7-5_8_oct` | `log_3insert_7-5_8` | <img src="images/flat_end_octagonal/log_3insert_7-5_8_oct.png" width="160" alt="log_3insert_7-5_8_oct"> <img src="images/flat_end_octagonal/log_3insert_7-5_8_oct.gif" width="160" alt="log_3insert_7-5_8_oct rotating"> |
| `log_4insert_10-5_8_oct` | `log_4insert_10-5_8` | <img src="images/flat_end_octagonal/log_4insert_10-5_8_oct.png" width="160" alt="log_4insert_10-5_8_oct"> <img src="images/flat_end_octagonal/log_4insert_10-5_8_oct.gif" width="160" alt="log_4insert_10-5_8_oct rotating"> |
| `half_log_4-1_2_oct` | `half_log_4-1_2` | <img src="images/flat_end_octagonal/half_log_4-1_2_oct.png" width="160" alt="half_log_4-1_2_oct"> <img src="images/flat_end_octagonal/half_log_4-1_2_oct.gif" width="160" alt="half_log_4-1_2_oct rotating"> |
| `half_log_7-1_2_oct` | `half_log_7-1_2` | <img src="images/flat_end_octagonal/half_log_7-1_2_oct.png" width="160" alt="half_log_7-1_2_oct"> <img src="images/flat_end_octagonal/half_log_7-1_2_oct.gif" width="160" alt="half_log_7-1_2_oct rotating"> |
| `beveled_end_1-1_2_oct` | `beveled_end_1-1_2` | <img src="images/flat_end_octagonal/beveled_end_1-1_2_oct.png" width="160" alt="beveled_end_1-1_2_oct"> <img src="images/flat_end_octagonal/beveled_end_1-1_2_oct.gif" width="160" alt="beveled_end_1-1_2_oct rotating"> |
| `solid_log_1-3_8_oct` | `solid_log_1-3_8` | <img src="images/flat_end_octagonal/solid_log_1-3_8_oct.png" width="160" alt="solid_log_1-3_8_oct"> <img src="images/flat_end_octagonal/solid_log_1-3_8_oct.gif" width="160" alt="solid_log_1-3_8_oct rotating"> |
| `solid_log_1-5_8_oct` | `solid_log_1-5_8` | <img src="images/flat_end_octagonal/solid_log_1-5_8_oct.png" width="160" alt="solid_log_1-5_8_oct"> <img src="images/flat_end_octagonal/solid_log_1-5_8_oct.gif" width="160" alt="solid_log_1-5_8_oct rotating"> |

All six test buildings pass `verify.mjs --set flat_end_octagonal` (no interference, every part supported). None has been printed.

## Check against `PARTS_SPEC.md`

Every part was re-rendered and its dimensions compared with the spec. Two parts changed:

| Part | Was | Now | Why |
|---|---|---|---|
| 3-insert log | 7 3/4 in (1/2 in shoulders) | 7 5/8 in (7/16 in shoulders); STL renamed `log_3insert_7-5_8` | 7 3/4 fits neither column of the spec's length rule; 7 5/8 fits the 7/16 in column and the photo |
| Small plastic gable | 5 3/4 x 1.55 in | 5.8 x 1.56 in | Spec and photo give about 5.8 x 1.6 in, with notches 1.4 in from each end |

Everything else agrees with the spec within its stated confidence. Known differences that were kept:
- **End shoulders are mixed:** the 1 1/2 and 4 1/2 in logs and the half logs use 3/8 in; the 1 5/8, 7 5/8 and 10 5/8 in logs use 7/16 in. Both appear in the spec, and each length follows the reference lot.
- **Half-log height** is 9/16 in against about 0.53 in measured, so the flat sits exactly at the notch floor. The difference is inside the photo error.
- **Width across the notch faces:** the spec's 11/16 in (low confidence, from one compatible build) is not used. Logs stay 3/4 in round. Earlier versions were 18.25 mm wide where they sat in a notch because of the printing flat, with 0.2 mm clearance per side.
- **Two logs were dropped** because their shoulders don't follow the length rule: the 4 3/4 in rounded-end log (1/2 in shoulders; its rounded ends live on in the ball-end set) and the 6 in 2-insert log (1 1/8 in shoulders, non-standard in the spec).
- **Spec pieces not modelled:** the 4-notch flat log, the 1916-1920s gable logs and one-piece roof, slats of 12, 9 3/4, 7 3/4, 4 and 3 in, slat clips, and the 1990s-on molded roofs, windows and doors (no dimensions exist).

## Test buildings (verified)

`assembly.mjs` builds six buildings using only parts from the reference photos. It follows the brand's building rules:
- End walls take the even courses, starting with **half logs**.
- Side walls take the odd courses.
- Each gable sits where the next end-wall log would go, with its bottom notches dropped over the crossing side-wall logs.

| | Cabin | Shed | Cottage |
|---|---|---|---|
| Size between wall centres | 6 x 9 in | 3 x 6 in | 3 x 6 in |
| Base | `half_log_7-1_2` | `half_log_4-1_2` | `half_log_4-1_2` |
| End walls | 3-insert logs; doorway (front) and window (back) framed with 1-insert pieces, including the hex and round 1 1/2 in ones, and 2-insert logs | 2-insert 4 1/2 logs | 2-insert 4 1/2 logs |
| Side walls | 4-insert logs | 3-insert logs | 3-insert logs |
| Gables | 2 x large plastic gable | 2 x wooden triangle | 2 x small plastic gable |
| Shingles per slope | 3 flat 9 in + 1 ridge 9 in | 2 flat 6 in + 1 ridge 6 in | 3 flat 6 in |
| Chimney | Yes, on the ridge | No (its 39 deg roof doesn't match the chimney's 27 deg V) | Yes, on the ridge |

Three more buildings use the same rules and helpers:

| | Porch cabin | Tall house | Watchtower |
|---|---|---|---|
| Size between wall centres | 6 x 6 in room + 3 in porch | 6 x 6 in | 3 x 3 in |
| Courses | 8 | 12 | 14 |
| Base | 3 x `half_log_7-1_2` (the third is the porch sill) | `half_log_7-1_2` | `half_log_4-1_2` |
| Walls | 3-insert logs; the top side-wall course is 4-insert logs that run forward over two posts, each seven crossed 1-insert logs | 3-insert logs; doorway on three courses and a window in each wall, framed with 1- and 2-insert logs | 2-insert logs; five look-out slits, each a pair of 1-insert logs |
| Gables | 2 x large plastic gable (one over the porch) | 2 x large plastic gable | 2 x wooden triangle |
| Shingles | 9 in, flush with the gables | 9 in, overhanging 1 1/2 in at each gable | 6 in, overhanging 1 1/2 in at each gable |
| Chimney | Yes | Yes | No |

**The chimney is placed the same way as a real one would settle.** It is centred on the ridge and lowered until its V-cut base first touches the shingles.

**Shingle positions are computed, not placed by hand.** Each shingle is lowered onto the gable's top edge, the way a real board settles:
1. Its lower edge starts just clear of the eave lip or the shingle below.
2. It rotates down until it touches the edge again.
3. If its centre of mass would be past that second contact, it tips forward until its far edge lands.

The layout that reaches closest to the peak without crossing it is kept. On the stepped plastic gable this gives a slightly stepped, overlapping-looking roof, as in the photos.

### What `verify.mjs` checks

Each placed part is voxelised at 0.5 mm, from the same geometry as the STLs. Then:
- **Interference:** volume shared between parts; any shared voxel counts. Result: **none, in all six buildings**. Parts touch but never overlap.
- **Support:** each part's centre of mass must lie inside the convex hull of its contacts below. A contact means another part, or the table, within 1 mm (two voxels) directly below. One voxel isn't enough, because rounding to a 0.5 mm grid can open a false gap at a line contact, such as a shingle corner resting on a step. Result: **every part supported**. Only the half logs touch the table, so every building sits flat.
- **Wood grain** needs no supports. Finer layers (0.12 to 0.16 mm) show the grain on top of the logs better. Textured log STLs are 1 to 2.5 MB each.
- **Chimney:** the STL is upside down, open top on the bed and V facing up.
- **Long parts:** the 4-insert log stands 270 mm tall and needs a printer with that much height. The 11 in shingle (279 mm) needs a large bed or a diagonal layout.
- **PETG:** regenerate with `--clearance 0.3`.

## Legal

The 1920 patent has expired, so the geometry is free to copy. "Lincoln Logs" is a registered Hasbro trademark ([Justia](https://trademarks.justia.com/715/38/lincoln-logs-71538955.html)), so the name is not. If you share or sell the files or prints, call them "compatible log-cabin logs".
