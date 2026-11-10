# Fusion design

Every part in `parts.mjs` as an editable, parametric Autodesk Fusion design.

| File | What it is |
|---|---|
| `DeadPresidentTreeSections.f3d` | The design, exported from the Fusion document of the same name. In Fusion: File > Open > Open from my computer |
| `build_lincoln_logs.py` | The script that built it. Run it to rebuild from scratch: Utilities > Add-Ins > Scripts and Add-Ins > + > pick this folder |
| `layout.png` | Picture of the layout |

![layout](layout.png)

## How it is organised

- **One component per part**, named like the STL (`log_3insert_7-5_8`, `chimney` ...). The timeline has one group per part.
- **Every size is a user parameter** (Modify > Change Parameters). Sketch dimensions and feature distances are expressions of those parameters, and every sketch is fully constrained.
- **Each body is in its printing orientation**, sitting on Z = 0: round logs on their printing flat with notches sideways, half logs flat side down, gables and shingles flat, solid logs standing, the chimney upside down.

## Shared parameters

Change one and every part follows.

| Parameter | Default | Meaning |
|---|---|---|
| `LogDia` | 0.75 in | Log diameter |
| `NotchDepth` | 0.1875 in | Notch depth, each side |
| `NotchCenters` | 3 in | Spacing between notch centres |
| `Clearance` | 0.2 mm | Fit clearance per side (try 0.3 mm for PETG) |
| `NotchWidth` | `LogDia + 2 * Clearance` | Notch width |
| `PrintFlat` | 0.8 mm | Depth of the flat a round log prints on |
| `CourseRise` | `LogDia - 2 * NotchDepth` | Height gained per crossing course |
| `HalfLogHeight` | `LogDia - NotchDepth` | Half-log height |
| `GableThk` | `LogDia` | Gable thickness |
| `ShingleThk`, `FlatShingleWidth`, `RidgeShingleWidth` | 0.125, 0.8, 1.125 in | Shingle sizes |
| `RidgeGrooveWidth`, `RidgeGrooveDepth` | 1.6, 0.8 mm | Ridge shingle groove |
| `PanelThk` | 0.125 in | Door and window thickness |
| `PlasticRoofAngle` | from the large gable (27.1 deg) | The small gable's height and the chimney's V follow it |

## Per-part parameters

Each part's parameters start with its code.

| Code | Component | Main parameters |
|---|---|---|
| `L1a`, `L1b`, `L1oct` | `log_1insert_1-5_8`, `log_1insert_1-1_2_round`, `log_1insert_1-1_2_octagonal` | `_Length`, `_Notches` |
| `L2a`, `L2b`, `L3`, `L4` | `log_2insert_4-1_2`, `log_2insert_6`, `log_3insert_7-5_8`, `log_4insert_10-5_8` | `_Length`, `_Notches` |
| `BevLong` | `beveled_end_4-3_4` | `_Length`, `_Notches`, `_EndRadius` |
| `BevShort` | `beveled_end_1-1_2` | `_Length`, `_Angle` |
| `Half2`, `Half3` | `half_log_4-1_2`, `half_log_7-1_2` | `_Length`, `_Notches` |
| `Solid1`, `Solid2` | `solid_log_1-3_8`, `solid_log_1-5_8` | `_Length` |
| `GableL`, `GableS` | `gable_plastic_8-1_2`, `gable_plastic_small_2notch` | `_Width`, `_Height`, `_Steps`, `_Notches`, `_EaveHeight`, `_LipThk`, `_LipHeight`, `_Riser` |
| `GableTri` | `gable_wood_triangle_4x2` | `_Width`, `_Height`, `_Notches` |
| `ShFlat6`, `ShFlat9`, `ShFlat11` | `shingle_flat_*` | `_Length` |
| `ShRidge5`, `ShRidge6`, `ShRidge9` | `shingle_ridge_*` | `_Length` |
| `Chimney` | `chimney` | `_Width`, `_Depth`, `_Height`, `_Wall`, `_Pocket` |
| `Door`, `Window` | `extra_door`, `extra_window` | `_Courses`, plus `_OpeningWidth`, `_OpeningHeight` on the window |

Notes:
- Notches stay centred on the part: set `_Notches` and `_Length` and the row re-centres.
- `_FirstNotch`, `_NotchStep`, `_StepRun`, `_TreadRise`, `_StepPitch` and `Chimney_VDepth` are derived. Leave them alone.
- `_NotchStep` exists because Fusion cannot pattern a single copy. The notch pattern always makes at least two; with one notch the step drops to 0.001 mm so the second copy lands on the first.
- `GableS_Height` is an expression that keeps the large gable's pitch. Type a number over it to set the height directly.

## Making a new part

Copy a component (right-click > Copy, then Paste New), or add an entry to the lists at the top of `build_lincoln_logs.py` (for example a 5-notch log: `('L5', 'log_5insert', '13.625 in', 5, 'round')`, plus a position in `LAYOUT`) and run the script again.

## Printing

Right-click a component's body > Save As Mesh (3MF or STL). Bodies are already oriented for the bed, so no rotation is needed in the slicer.

## Differences from the STLs in `stl/`

Volumes and bounding boxes were compared with every STL. All match, with two expected differences:
- Round parts are true cylinders here; the STLs are 96-sided, so the Fusion volumes are about 0.05% larger.
- `beveled_end_4-3_4` has a 4 mm fillet on each end in place of the STL's three-segment taper (about 1% more volume).
