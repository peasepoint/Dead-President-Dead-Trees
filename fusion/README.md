# Fusion designs

Every part in `parts.mjs` as an editable, parametric Autodesk Fusion design: one design per folder in `stl/`. To print without Fusion, use the STLs; see the [main README](../README.md#how-to-print).

| File | What it is |
|---|---|
| `DeadPresidentTreeSections_roof_parts.f3d` | Gables, shingles, chimney, door and window (`stl/roof_parts/`) |
| `DeadPresidentTreeSections_smooth.f3d` | The 10 logs, round and plain (`stl/smooth/`) |
| `DeadPresidentTreeSections_flat_end_round.f3d` | The 10 logs, round, flat ends, with their wood-grain meshes (`stl/flat_end_round/`) |
| `DeadPresidentTreeSections_flat_end_octagonal.f3d` | The 10 logs, octagonal, flat ends, with their wood-grain meshes (`stl/flat_end_octagonal/`) |
| `DeadPresidentTreeSections_ball_end_round.f3d` | The 10 logs, round, rounded ends, with their wood-grain meshes (`stl/ball_end_round/`) |
| `build_lincoln_logs.py` | The script that built them. To rebuild one, set `PART_SET` at the top to the folder name, then in Fusion: Utilities > Add-Ins > Scripts and Add-Ins > + > pick this folder > Run. For a wood-grain set it reads the meshes from `../stl/<set>/` |
| `layout_<set>.png` | A picture of each design |

Open a design in Fusion with File > Open > Open from my computer.

![The octagonal log set in Fusion](layout_flat_end_octagonal.png)

## How it is organised

- **One component per part**, named like the STL (`log_3insert_7-5_8_oct`, `chimney` ...). The timeline has one group per part.
- **Every size is a user parameter** (Modify > Change Parameters). Sketch dimensions and feature distances are expressions of those parameters, and every sketch is fully constrained.
- **Each body sits exactly where its STL does**, in printing orientation on Z = 0: notched logs and the beveled end lying along X on one of their two equal flats, notches facing sideways (+/-Y); half logs flat side down; solid logs standing; gables and shingles flat; the chimney upside down. So a body and its STL line up when both are shown.
- **The four log designs hold the same 10 logs** with the same part codes, so a parameter means the same thing in each.

## What is parametric and what is a mesh

The parametric solids are the plain shapes: round or octagonal sections, the two flats, square notches, the slanted end, and (in the ball-end set) rounded ends. The wood grain and the growth rings on the ends are only in the STLs.

So in the three wood-grain designs each log component also holds its STL as a mesh body, named `<part>_woodgrain`. The mesh is visible and the parametric solid is hidden; turn on a body's eye icon to see it. The meshes don't follow parameter changes: after changing a size, regenerate the STLs with `node log_generator.mjs` and rebuild the design with the script, or re-insert the mesh (Insert > Insert Mesh).

The smooth design has no meshes; its solids match `stl/smooth/`. To print from Fusion, right-click a body (or a wood-grain mesh body) > Save As Mesh.

## Shared parameters

Change one and every part in the design follows.

| Parameter | Default | Meaning |
|---|---|---|
| `LogDia` | 0.75 in | Log diameter; across the flats for an octagonal log |
| `NotchDepth` | 0.1875 in | Notch depth, each side |
| `NotchCenters` | 3 in | Spacing between notch centres |
| `Clearance` | 0.2 mm | Fit clearance per side (try 0.3 mm for PETG) |
| `PrintFlat` | 0.8 mm | Total width taken off a log, as an equal 0.4 mm flat on each side; the bed side is one of them |
| `MateWidth` | `LogDia - PrintFlat` | Width of a log, half log or gable where it sits in a notch (18.25 mm) |
| `NotchWidth` | `MateWidth + 2 * Clearance` | Notch width (18.65 mm) |
| `CourseRise` | `LogDia - 2 * NotchDepth` | Height gained per crossing course |
| `HalfLogHeight` | `LogDia - NotchDepth` | Half-log height |
| `EndRadius` | 4 mm | Radius of the rounded ends (ball-end design only) |
| `GableThk` | `MateWidth` | Gable thickness (roof design) |
| `ShingleThk`, `FlatShingleWidth`, `RidgeShingleWidth` | 0.125 in, 18.5 mm, 1.125 in | Shingle sizes (roof design) |
| `RidgeGrooveWidth`, `RidgeGrooveDepth` | 1.6, 0.8 mm | Ridge shingle groove (roof design) |
| `PanelThk` | 0.125 in | Door and window thickness (roof design) |
| `PlasticRoofAngle` | from the large gable (24.0 deg) | The angle the shingles lie at; the chimney's V follows it (roof design) |

## Per-part parameters

Each part's parameters start with its code.

| Code | Part (base name) | Main parameters |
|---|---|---|
| `L1a`, `L1b` | `log_1insert_1-5_8`, `log_1insert_1-1_2_round` (`log_1insert_1-1_2_oct` in the octagonal set) | `_Length`, `_Notches` |
| `L2`, `L3`, `L4` | `log_2insert_4-1_2`, `log_3insert_7-5_8`, `log_4insert_10-5_8` | `_Length`, `_Notches` |
| `Half2`, `Half3` | `half_log_4-1_2`, `half_log_7-1_2` | `_Length`, `_Notches` |
| `Bev` | `beveled_end_1-1_2` | `_Length`, `_Angle` |
| `Solid1`, `Solid2` | `solid_log_1-3_8`, `solid_log_1-5_8` | `_Length` |
| `GableL`, `GableS` | `gable_plastic_8-1_2`, `gable_plastic_small_2notch` | `_Width`, `_Height`, `_Steps`, `_Notches`, `_EaveHeight`, `_LipThk`, `_LipHeight`, `_Riser` |
| `GableTri` | `gable_wood_triangle_4x2` | `_Width`, `_Height`, `_Notches` |
| `ShFlat6`, `ShFlat9`, `ShFlat11` | `shingle_flat_*` | `_Length` |
| `ShRidge5`, `ShRidge6`, `ShRidge9` | `shingle_ridge_*` | `_Length` |
| `Chimney` | `chimney` | `_Width`, `_Depth`, `_Height`, `_Wall`, `_Pocket` |
| `Door`, `Window` | `extra_door`, `extra_window` | `_Courses`, plus `_OpeningWidth`, `_OpeningHeight` on the window |

Notes:
- Notches stay centred on the part: set `_Notches` and `_Length` and the row re-centres.
- `_FirstNotch`, `_NotchStep`, `_StepRun`, `_TreadRise`, `_StepPitch`, `_TreadLen` and `Chimney_VDepth` are derived. Leave them alone.
- `_NotchStep` exists because Fusion cannot pattern a single copy. The notch pattern always makes at least two; with one notch the step drops to 0.001 mm so the second copy lands on the first.
- `GableS_Height` is an expression that keeps the small gable's treads as long as the large one's. Type a number over it to set the height directly.
- A flat shingle lies on each tread, so `_TreadLen` must stay a little longer than `FlatShingleWidth` (18.7 against 18.5 mm).

## How the shapes are modelled

- **Round log:** a `LogDia` circle centred `LogDia / 2 - PrintFlat / 2` above the bed, extruded along X, with everything below Z = 0 and above `MateWidth` cut away: two equal flats.
- **Octagon:** a `LogDia` square with its four long edges chamfered by `LogDia * (1 - sqrt(2) / 2)`, a regular octagon `LogDia` across the flats, then cut to the same two flats.
- **Notches:** everything beyond the notch floors (`|Y| > LogDia / 2 - NotchDepth`) is cut away over `NotchWidth` round each notch centre, giving square walls, and the cut is patterned along the log.
- **Half log:** the section centred `HalfLogHeight - LogDia / 2` above the bed, cut flat at Z = 0 and to `MateWidth` across, with notches in the top.
- **Rounded ends:** a fillet of `EndRadius` on the end edges, made before the flats are cut. On a half log the bottom edge is left sharp, so it stays flat on the bed; on the beveled end only the square end is rounded. The STLs use a three-step taper instead (`ROUNDED_ENDS` in `parts.mjs`), which removes a little more, so a ball-end solid is about 0.5 to 4.6% larger than its mesh.

## Checked against the STLs

Each design was built with the script and every body's volume and bounding box compared with the same part from `parts.mjs`, without texture:

- **Smooth and flat-end round:** volumes within 0.03% (the STLs are 144-sided, the solids true circles); bounding boxes the same.
- **Octagonal:** volumes the same to the mm3; bounding boxes the same.
- **Ball-end:** bounding boxes the same; volumes 0.5 to 4.6% larger, from the fillet described above.

## Making a new part

Copy a component (right-click > Copy, then Paste New), or add an entry to `LOGS` at the top of `build_lincoln_logs.py` (for example a 5-notch log: `('L5', 'log_5insert_13-5_8', '13.625 in', 5, 'log', 'set')`, plus a position in `LAYOUT`) and run the script again.
