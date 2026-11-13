# Design notes

How the parts were measured, what is assumed, and how the example buildings are checked. This is background reading: to print, start with the [README](README.md); for pictures and downloads of every part, see the [parts catalogue](PARTS.md).

## Contents

1. [Where the measurements come from](#where-the-measurements-come-from)
2. [Shared log geometry](#shared-log-geometry)
3. [The five sets](#the-five-sets)
4. [Wood texture](#wood-texture)
5. [Measurement notes by part](#measurement-notes-by-part)
6. [Check against `PARTS_SPEC.md`](#check-against-parts_specmd)
7. [Test buildings](#test-buildings)
8. [What `verify.mjs` checks](#what-verifymjs-checks)
9. [Limits](#limits)
10. [Printing notes](#printing-notes)
11. [Scripts](#scripts)
12. [Legal](#legal)

## Where the measurements come from

Two sets of photos of original wooden and plastic pieces, read with a pixel grid.

| Source | Shows | Scale taken from | Accuracy |
|---|---|---|---|
| A resale [listing](https://poshmark.com/listing/Lincoln-Log-Pieces-697ff0d8e9c77d6090234e27) with 11 photos, one of them the seller's sheet of part names and lengths | The logs, half logs, beveled end, solid logs, large stepped gable, triangle gable and shingles | The cutting mat's 1 in grid and ruler (about 83 px per inch) and the 3 in notch spacing on each log (82 to 86 px per inch) | About ±0.03 in |
| A second photo, supplied directly | Nine orange stepped gables in two sizes and two yellow chimneys, front-on | The large gable's 8 1/2 in width and the 3 in notch spacing (about 126 px per inch) | About ±0.03 in |

Where the seller's sheet gives a length, that figure is used. Where a photo and the sheet disagree, the difference is recorded under [Measurement notes by part](#measurement-notes-by-part). The second photo is the only source for the small stepped gable and the chimney, and it confirms the large gable's three bottom notches and its symmetry.

## Shared log geometry

| Feature | Value | Basis |
|---|---|---|
| Log diameter | 3/4 in (19.05 mm) | Photos (end grain about 0.76 in) and the published spec |
| Printing flats | 0.4 mm off each side, 0.8 mm in total | Round logs print lying down with no supports. The bed flat matches the one opposite, so a log is the same width either way up |
| Mating width | 18.25 mm (3/4 in less the two flats) | The width of a log where it sits in a notch. Octagonal logs, base logs and gables are trimmed to the same width, so they fit the same notch |
| Notch width | 18.65 mm (mating width + 0.2 mm clearance per side) | The [fit test](fit_test/README.md) in PLA. The photos show about 0.76 in |
| Notch depth | 3/16 in, top and bottom | Hobbyist plans; consistent with the photos |
| Notch centres | 3 in | Photos: 245 to 260 px between notches on every log |
| Course rise | 3/8 in | Two 3/16 in notches overlap |
| Notch placement | Centred on the listed length | Ends measured 0.33 to 0.44 in, which fits a centred layout within about 1/16 in |

## The five sets

One folder of roof parts that every building uses, and four log sets to choose between. Every log set has the same 10 logs, the same notch layout and the same 18.25 mm mating width, so the sets mix in one building and each one can build any of the test buildings.

| Folder | Contents | Built by |
|---|---|---|
| [`stl/roof_parts/`](stl/roof_parts) | 3 gables, 6 shingles, the chimney, a door and a window (12 parts). Smooth | `makeParts()`, the parts that are not logs |
| [`stl/flat_end_round/`](stl/flat_end_round) | Round logs, wood grain, flat ends | `makeParts({ texture: true })`, the default |
| [`stl/ball_end_round/`](stl/ball_end_round) | Round logs, wood grain, rounded ends | `makeParts({ set: 'rounded' })` |
| [`stl/flat_end_octagonal/`](stl/flat_end_octagonal) | Octagonal logs, wood grain, flat ends | `makeParts({ set: 'octagonal' })` |
| [`stl/smooth/`](stl/smooth) | Round logs, plain, flat ends | `makeParts({ texture: false })` |

"Logs" means the notched logs, base logs, beveled end and solid logs. Two folders were renamed: `flat_end_round` was `woodgrain`, and `ball_end_round` was `rounded_woodgrain`.

### Flat-End-Round and Smooth

The reference shapes. Both folders hold the same 10 logs under the same file names; Smooth leaves out the texture. The other two sets are variations on these.

### Ball-End-Round

The standard logs with rounded ends. Each STL is named like its flat-end counterpart with `_rounded` added. The end shape comes from the original 4 3/4 in "beveled end" log, which is not itself included: its 1/2 in shoulders don't follow the length rule, and it does the same job as the 4 1/2 in log.

| Feature | Value |
|---|---|
| End shape | The cross-section steps down to 95% of full size 1.5 mm in from the end, 82% at 3.5 mm and 60% at the end face (`ROUNDED_ENDS` in `parts.mjs`) |
| Lengths, notches, fit | The same as the matching flat-end log; the rounding sits in the end shoulders, outside the notches |
| Logs and beveled end | They shrink towards the log's axis, so the last 1.5 mm of each end lifts slightly off the bed. The beveled end is rounded only at its square end |
| Base logs | Rounded over the top and sides only, so the flat side stays flat on the bed |
| Solid logs | Both ends rounded |

### Flat-End-Octagonal

The standard logs with an eight-sided section. Each STL is named like its round counterpart with `_oct` added.

| Feature | Value |
|---|---|
| Section | A regular octagon, 3/4 in across the flats, with the two side faces cut 0.4 mm each, so it is 18.25 mm wide where it sits in a notch |
| Printing | Lying on one of the cut side faces, notches facing sideways, as the round logs lie on their flat |
| Fit | Notches, clearance and course rise are unchanged; the corners stay inside the round log's 3/4 in square |
| Grain | Streaks on six faces; the two side faces stay smooth, like the round logs' flats |
| 1 1/2 in log | Octagonal like the rest, so it is named `log_1insert_1-1_2_oct` rather than `..._round_oct` |
| Base logs | The octagon cut at the bottom-notch floor, with the same side faces |
| Solid logs | Octagonal prisms standing on end, a full 3/4 in across the flats (they sit in no notch) |

### The two-piece 4-notch log

Every log set also holds `log_4insert_10-5_8` as two halves, `..._split_tongue` and `..._split_groove`, for beds shorter than 270 mm. Neither is in the reference lot. The first version of the joint (0.3 mm clearance on every face, sides sloping 1 in 4) was printed in PLA on a P2S: it went together freely but a row of five pieces sagged and bent at every joint. The press fit below replaces it and has not been printed.

| Feature | Value | Reason |
|---|---|---|
| Position | Centred on the log, between the two middle notches | The four notches keep their places, and 25 mm of whole log is left between the joint and the nearest notch |
| Shape | Dovetail: a tail on one half, a socket between two tines on the other | The joint of a hewn-log cabin corner. Unlike a plain tongue it stops the halves pulling apart |
| Direction | Cut straight through from one printing flat to the other | A log prints lying on a flat, so every face of the joint is an upright wall and needs no support. In a wall the tail slides in from the side, and the tines above and below it keep the two halves level |
| Tail | 6.15 mm long, 4.9 mm at the neck, 8.1 mm at its widest near the tip | Sides slope 2 in 5 (22 degrees). A steeper slope gives less endways play for the same gap: gap / slope. The printed 1 in 4 joint turned its 0.3 mm gap into 1.2 mm of play |
| Socket | 1/4 in (6.35 mm) deep, 5.2 mm at the mouth, 9.3 mm at the floor before rounding | Its sides are 0.05 mm outside the tail's. The tines either side of it are 4.9 mm thick at their thinnest |
| Edges | 0.8 mm radius in the socket's floor and at the tail's neck; 1.0 mm on the tail's tip and the tips of the tines; 0.8 mm on the rims where the shoulder and the tines meet the outside of the log | Rounded like the worn corners of a hewn log, with nothing sharp for small hands. Each edge that sticks out has 0.2 mm more radius than the corner it fits into, so it stands clear of it and the joint closes on its flat faces, not on its corners. `--splice-round` changes the radius; `0` gives square edges |
| Fit | Press fit. No gap between the tips of the tines and the other piece's shoulder; 0.05 mm between the sloping sides (`--splice-clearance`); 0.2 mm between the tail's tip and the socket's floor | The joint bears on the shoulders and the sloping sides only. The shoulders, 19 mm apart across the log, are what stop it hinging, and the sloping sides hold them together. The tail's tip stays clear so it can never hold the shoulders apart. As drawn the pieces can move 0.125 mm apart endways; printed walls usually come out a little fat and close that up |
| Hold | The tail's widest point is 1.4 mm wider on each side than the socket's mouth | This is what stops the halves pulling apart. It was 0.7 mm with the 1 in 4 slope |
| Length of each half | 137.9 mm (tongue), 138.1 mm (groove) | The tongue half is half the log plus half the joint, less the 0.2 mm at the tail's tip; the groove half reaches the tongue half's shoulder |

- **Tolerance.** The tines are short and thick, so they give very little. A few hundredths of a millimetre separate a joint that still hinges from one that is too tight to push together, and printers differ by more than that. [fit_test/dovetail](fit_test/dovetail/README.md) has the extender with gaps of 0, 0.05 and 0.1 mm to find the right one. A first-layer flare (elephant foot) narrows the socket and fattens the tail where they touch the bed, so the slicer's elephant foot compensation should be on.
- **Bed contact.** On the round logs the socket (5.2 to 9.3 mm) is mostly wider than the printing flat (5.4 mm), so each tine's inner edge touches the bed only near the mouth and lifts off it elsewhere along the log's own curve, by up to 0.8 mm at the floor. The earlier joint lifted 0.3 mm there and printed cleanly. The rounded rims lower only the crown of the log, not the flats, so they do not lift anything off the bed. The octagonal logs' flat is wide enough that the tines sit on the bed all the way.
- **Strength.** The neck is 4.9 mm thick and the full 18.25 mm wide, with the layers running along it. It is the weakest point of the joined log. The radius where it meets the shoulder makes it thicker than a square corner would (4.1 mm) and spreads the load.
- **Grain.** The joint faces are smooth. The grain stops at the cut lines, so the texture does not change the fit.
- **Extender.** `log_extender_1insert_3` has the same socket at one end and the same tail at the other, 3 in apart, with one notch between them. It goes between the two halves and adds 3 in, so every notch of the longer log stays on 3 in centres; several can be chained. It is 82.35 mm long. No building longer than the 4-notch log exists to use it yet.
- **Base-log versions.** `base_log_10-5_8_split_tongue`, `base_log_10-5_8_split_groove` and `base_log_extender_1insert_3` are the same three pieces as base logs for the base course: flat underneath at the bottom-notch floor, notches on top only, the same lengths and notch places. The reference lot has no base log this long. Their dovetail has the same outline, fit and radii but is cut straight down through the log, because a base log prints on its flat bottom and the joint's faces must stay upright on the bed. The tail goes into the socket from above. The tail is the full height of the base log (14.3 mm) and the tines are 4.5 mm thick at their thinnest, either side of it, and reach the bed all along. The rounded rims are on the sides of the log, not on its bottom edge, which stays square on the bed. The two kinds of piece do not join with each other.
- **Not in the other files.** The Fusion designs and `verify.mjs` do not include the halves or the extenders, and no example building uses them.

## Wood texture

Three log sets carry a shallow wood grain, built into the mesh by `parts.mjs`: `flat_end_round`, `ball_end_round` and `flat_end_octagonal`. The roof parts are smooth.

| Feature | Value | Why |
|---|---|---|
| Side grain | Lengthwise streaks, up to 0.25 mm deep and 1.1 to 1.8 mm wide, that wander slightly and fade in and out | The wooden originals are stained dowels with the grain running along the log |
| End grain | Growth rings 0.2 mm deep, about 1.2 to 1.7 mm apart, round a slightly off-centre pith; they fade out 0.6 mm from the rim | The originals show ring arcs on their sawn ends |
| Direction | Grooves only, never raised | Diameter, length and notch fit are unchanged, so the sets can be mixed |
| Left smooth | Notch floors and walls, both side flats of each log, the base-log underside, the octagon's two side faces | Mating surfaces and bed adhesion |
| Slopes | Smooth groove profile, about 35 deg at its steepest | Prints without supports in any orientation |
| Variation | Each part name seeds its own pattern; the two ends of a log differ | The output is the same on every run |

The sizes are in `TEX` at the top of the texture section of `parts.mjs`. The depths are a judgement for a 0.4 mm nozzle at 0.2 mm layers, not a measurement of an original log, and no textured log has been test-printed.

## Measurement notes by part

What each part was modelled from and where the sources disagree. Names are the Flat-End-Round ones; pictures and downloads are in the [parts catalogue](PARTS.md).

### Logs

| Part | Sold as | Modelled as | Notes |
|---|---|---|---|
| `log_1insert_1-5_8` | 1 Insert Log, 1 5/8 | Round, 1 notch | Photo measured 1.58 in |
| `log_1insert_1-1_2_round` | 1 Insert Log (Round), 1 1/2 | Round, 1 notch | |
| `log_2insert_4-1_2` | 2 Insert Log, 4 1/2 | Round, 2 notches | Photo measured 4.57 in |
| `log_3insert_7-5_8` | 3 Insert Log, 7 3/4 | Round, 3 notches, 7 5/8 in | The sheet says 7 3/4, but the photo measured about 7.6 in and the length rule in [`PARTS_SPEC.md`](PARTS_SPEC.md) gives 7 5/8, in line with the 1 5/8 and 10 5/8 in logs |
| `log_4insert_10-5_8` | 4 Insert Log, 10 5/8 | Round, 4 notches | |
| `base_log_4-1_2`, `base_log_7-1_2` | Base Log, 4 1/2 and 7 1/2 | Flat bottom at the bottom-notch floor (9/16 in tall), notches on top only | Photo: about 0.53 in tall |
| `beveled_end_1-1_2` | Beveled End, 1 1/2 x 1 1/4 | 1 1/2 in log, one end cut at 39 deg | The angle is from the photos and matches the triangle gable. The "1 1/4" is not explained by the photos |
| `solid_log_1-3_8`, `solid_log_1-5_8` | Solid Log, 1 3/8 and 1 5/8 | Plain 3/4 in cylinders | Purpose unknown; not used in the test buildings |
| (dropped) | 1 Insert Log (Hex), 1 1/2 | Not included | The end grain shows flats top and bottom. It is the same size as the round 1 1/2 in log and does the same job, so the 1 1/2 in log covers it; the [Flat-End-Octagonal](#flat-end-octagonal) set gives octagonal logs of every length |

### Roof parts

| Part | Sold as | Modelled as | Notes |
|---|---|---|---|
| `gable_plastic_8-1_2` | Plastic Orange Roof, 2 1/4 x 8 1/2 | Symmetric; 3 bottom notches on 3 in centres; 6 steps per side, one per flat shingle; eave hook lips | Shingles lie at 24 deg. Six steps counted in a resale photo of the 3-notch gable; the 1974 Frontiersman box shows six shingles a slope |
| `gable_plastic_small_2notch` | Second photo only | Symmetric; 2 bottom notches 3 in apart; 4 steps per side; eave hook lips; 5.8 x 1.60 in | Photo: about 5.8 x 1.6 in, notch centres about 1.4 in from each end. Same lip, riser and step length as the large gable, so the height follows from the width. Four steps counted in a photo of a 1974 set |
| `gable_wood_triangle_4x2` | Triangle, 4 x 2 | Straight 39 deg slopes, 2 bottom notches 3 in apart | Measures about 4 7/8 x 2 in: 3 in between notches plus about 0.9 in of overhang each side. The decorative log-row grooves are not modelled |
| `shingle_flat_6`, `_9`, `_11` | Flat Shingle, 6, 9 and 11 | 18.5 mm (0.73 in) x 1/8 in boards | Width measured 0.79 to 0.8 in in the listing photo, but six that wide do not fit the large gable's slope, and the Frontiersman box shows six. The width is set so six fit |
| `shingle_ridge_5-5_8`, `_6`, `_9` | Shingle with Ridge | 1 1/8 in board with a centre groove | Measured 1.13 to 1.17 in wide. Both halves are lit identically, so it is flat, not folded |
| `chimney` | Second photo only | Open-topped block, 1 3/8 in wide x 1.2 in tall x 1 in deep, inverted-V cut in the base | Photo: about 1.39 x 1.2 in, V about 0.36 in deep with 27 deg sides. Modelled V: 0.31 in, matched to the 24 deg the shingles lie at |
| `extra_door`, `extra_window` | Not an original part | 1/8 in panels sized to a wall opening | Designed for this project; not used in the test buildings |

Three dimensions are not visible in any photo and are assumed:

- **Gable thickness:** 18.25 mm, the same as a log's mating width, so a gable fills a crossing log's notch the way a log does. That locks it sideways.
- **Shingle thickness:** 1/8 in.
- **Chimney depth and socket:** 1 in deep, 0.12 in walls and a 1/2 in-deep open top. The photo is front-on.

## Check against `PARTS_SPEC.md`

Every part was re-rendered and its dimensions compared with [the spec](PARTS_SPEC.md). Two parts changed:

| Part | Was | Now | Why |
|---|---|---|---|
| 3-insert log | 7 3/4 in (1/2 in shoulders) | 7 5/8 in (7/16 in shoulders); STL renamed `log_3insert_7-5_8` | 7 3/4 fits neither column of the spec's length rule; 7 5/8 fits the 7/16 in column and the photo |
| Small plastic gable | 5 3/4 x 1.55 in | 5.8 x 1.60 in | Spec and photo give about 5.8 x 1.6 in, with notches 1.4 in from each end |

Everything else agrees with the spec within its stated confidence. Known differences that were kept:

- **End shoulders are mixed.** The 1 1/2 and 4 1/2 in logs and the base logs use 3/8 in; the 1 5/8, 7 5/8 and 10 5/8 in logs use 7/16 in. Both appear in the spec, and each length follows the measured pieces.
- **Base-log height** is 9/16 in against about 0.53 in measured, so the flat sits exactly at the notch floor. The difference is inside the photo error.
- **Width across the notch faces.** The spec's 11/16 in (low confidence, from one compatible build) is not used. Logs stay 3/4 in round and are 18.25 mm wide where they sit in a notch.
- **Two logs were dropped** because their shoulders don't follow the length rule: the 4 3/4 in rounded-end log (its ends live on in the ball-end set) and the 6 in 2-insert log.
- **The 1 1/2 in "hex" log was dropped** because it duplicates the round 1 1/2 in log: same length, same notch, same job. The Flat-End-Octagonal set gives octagonal logs of every length instead.
- **Spec pieces not modelled:** the 4-notch flat log, the 1916-1920s gable logs and one-piece roof, slats of 12, 9 3/4, 7 3/4, 4 and 3 in, slat clips, and the 1990s-on molded roofs, windows and doors (no dimensions exist).

## Test buildings

`assembly.mjs` lays out six buildings using only parts from the reference photos. Part counts for each are in the [README](README.md#4-print-a-building). The buildings follow the toy's own rules:

- End walls take the even courses, starting with **base logs**.
- Side walls take the odd courses.
- Each gable sits where the next end-wall log would go, with its bottom notches over the crossing side-wall logs.

| | Cabin | Shed | Cottage |
|---|---|---|---|
| Size between wall centres | 6 x 9 in | 3 x 6 in | 3 x 6 in |
| Base | `base_log_7-1_2` | `base_log_4-1_2` | `base_log_4-1_2` |
| End walls | 3-insert logs; a doorway (front) and window (back) framed with 1- and 2-insert logs | 2-insert logs | 2-insert logs |
| Side walls | 4-insert logs | 3-insert logs | 3-insert logs |
| Gables | 2 x large stepped gable | 2 x triangle gable | 2 x small stepped gable |
| Shingles per slope | 6 flat 9 in, one per step, edge to edge | 2 flat 6 in + 1 ridge 6 in | 4 flat 6 in, one per step, edge to edge |
| Chimney | Yes | No: its 39 deg roof doesn't match the chimney's 24 deg V | Yes |

| | Porch cabin | Tall house | Watchtower |
|---|---|---|---|
| Size between wall centres | 6 x 6 in room + 3 in porch | 6 x 6 in | 3 x 3 in |
| Courses | 8 | 12 | 14 |
| Base | 3 x `base_log_7-1_2` (the third is the porch sill) | `base_log_7-1_2` | `base_log_4-1_2` |
| Walls | 3-insert logs; the top side-wall course is 4-insert logs that run forward over two posts, each seven crossed 1-insert logs | 3-insert logs; a doorway three courses high and a window in each wall, framed with 1- and 2-insert logs | 2-insert logs; five look-out slits, each a pair of 1-insert logs |
| Gables | 2 x large stepped gable (one over the porch) | 2 x large stepped gable | 2 x triangle gable |
| Shingles | 9 in, flush with the gables | 9 in, overhanging 1 1/2 in at each gable | 6 in, overhanging 1 1/2 in at each gable |
| Chimney | Yes | Yes | No |

**Shingle positions are computed, not placed by hand.**

On the **stepped gables** the shingles lie edge to edge, one flat shingle on each step, as on the 1974 Frontiersman set. Its box photo shows six shingles on each slope of the large gable, touching along their edges in one plane, none overlapping:

1. Each step's tread is 18.7 mm long and a shingle is 18.5 mm wide, so a shingle lies flat on its tread with 0.1 mm to spare at each edge.
2. The riser between two treads is 0.8 mm, a quarter of a shingle's thickness. So each shingle's lower edge faces the upper edge of the one below across most of its thickness, and the row butts together down to the eave lip.
3. The lip's inner face leans back square to the first tread, so the lowest shingle's edge meets it face to face.

The shingles lie at 24 deg and each is 0.7 mm higher than the one below, which shows as a fine line between them. The two top shingles meet at the peak along their lower corners, so the ridge is closed. The step count and shingle width come from photos, not from an original part: see [Limits](#limits).

On the **triangle gable**, a plain slope, each shingle is lowered onto the gable's top edge the way a real board settles, edge to edge:

1. Its lower edge starts just clear of the shingle below.
2. It rotates down until it touches the edge again.
3. If its centre of mass would be past that second contact, it tips forward until its far edge lands.

The layout that reaches closest to the peak without crossing it is kept.

**The chimney is placed the same way.** It is centred on the ridge and lowered until its V-cut base first touches the shingles.

## What `verify.mjs` checks

Each placed part is voxelised at 0.5 mm from the same geometry as the STLs. All six buildings pass all three checks with each of the four log sets.

| Check | Method | Result |
|---|---|---|
| Interference | Volume shared between parts; any shared voxel counts | None. Parts touch but never overlap |
| Support | Each part's centre of mass must lie inside the convex hull of its contacts below. A contact is another part, or the table, within 1 mm (two voxels) directly below | Every part is supported. Only the base logs touch the table, so every building sits flat |
| Interlock | Each part is pushed 1.5 mm in each sideways direction to see whether a neighbour blocks it | All 51 wall logs are locked in all four directions by their notches |

Two voxels are allowed for a contact because rounding to a 0.5 mm grid can open a false gap at a line contact, such as a shingle corner resting on a step.

What holds the parts that are not wall logs:

- Gables are locked by their bottom notches.
- Chimneys are held across the ridge by their V.
- On the stepped gables each shingle lies on its own step, between the riser above and the shingle below. The lowest is stopped by the eave lip, so the row cannot slide down.
- Shingles on the triangle gable can slide downhill if pushed. They rely on friction, as the originals do.

Per-part results, one file per log set: [flat-end round](VERIFY_flat_end_round.md), [ball-end round](VERIFY_ball_end_round.md), [flat-end octagonal](VERIFY_flat_end_octagonal.md), [smooth](VERIFY_smooth.md).

## Limits

- **Only the notch fit has been printed.** Pairs of 1-notch logs were printed in PLA (0.4 mm nozzle, 0.2 mm layers) with notches 18.65, 18.85, 19.05, 19.25, 19.45 and 19.65 mm wide. The 18.65 mm pair fit best, with a small amount of play, so that is the default. No narrower notch was tried, and no other part has been printed. Details are in [fit_test/README.md](fit_test/README.md).
- **Photo measurements carry about ±0.03 in of error.** These are assumptions:
  - Gable thickness and shingle thickness.
  - Chimney depth and socket.
  - The meaning of "1 1/2 x 1 1/4" on the beveled end.
  - The small gable's height: 1.60 in, derived from the large gable's step length, against about 1.6 in measured.
  - The flat shingle's width, 18.5 mm, and the 0.8 mm riser. Six shingles must fit between the lip and the peak of the large gable, which caps the width at about 18.7 mm (0.74 in). An original slat may be up to 3/4 in wide; one that wide would ride on the risers instead of sitting in a step.
- **Shingle ends bear on half a gable.** The 9 in and 6 in shingles are exactly as long as the wall-centre spacing they cover, so each end rests on half the gable's thickness. Photos show the original slats reaching the gable's outer face, and the reference lists a 9 3/4 in slat (9 in plus a 3/4 in gable), which is not modelled.
- **The door and window** are not in any photo and are not used in the verified buildings.

## Printing notes

Slicer settings and step-by-step instructions are in the [README](README.md#how-to-print). The reasoning behind them:

- **Lying down.** Round logs and the beveled end lie on a 0.4 mm flat with their notches facing sideways, so nothing overhangs and no supports are needed.
- **Standing logs were tried and dropped.** Printing round logs on end saves bed space, but the notch walls then need support. Built-in break-away support combs did not remove cleanly, and slicer supports cost notch quality. The test plate is in [sample_print/](sample_print/README.md).
- **Solid logs** print standing. The end on the bed has rings too; they are shallow enough to close over in the second layer.
- **Wood grain** needs no supports. Finer layers (0.12 to 0.16 mm) show the grain on top of the logs better. Textured log STLs are 1 to 2.5 MB each.
- **Chimney:** the STL is upside down, open top on the bed and V facing up.
- **Long parts:** the 4-notch log (270 mm) and the 11 in shingle (279 mm) need a large bed or a diagonal layout.
- **PETG:** regenerate with `--clearance 0.3`.

## Scripts

Every part is defined in `parts.mjs`, and the same geometry feeds each script. How to run them is in the [README](README.md#regenerating-the-files).

| Script | What it does |
|---|---|
| `log_generator.mjs` | Writes the five folders in `stl/` |
| `assembly.mjs` | Lays the parts out into the six test buildings |
| `verify.mjs` | Checks the buildings with each log set; writes `VERIFY_<set>.md` |
| `make_gif.mjs` | Renders `cabin_build.gif` |
| `render_lib.mjs`, `make_renders.mjs`, `make_landscape_gif.mjs` | Render the example-building stills and the landscape animation in `images/examples/` |
| `make_part_images.mjs` | Renders the still and rotating pictures in the [parts catalogue](PARTS.md), one folder per set under `images/` |

[`fusion/`](fusion/README.md) holds one parametric Fusion design per folder, built by `fusion/build_lincoln_logs.py`. The wood-grain sets also carry their STLs as mesh bodies.

## Legal

The 1920 patent has expired, so the geometry is free to copy. "Lincoln Logs" is a registered Hasbro trademark ([Justia](https://trademarks.justia.com/715/38/lincoln-logs-71538955.html)), so the name is not. If you share or sell the files or prints, call them "compatible log-cabin logs".
