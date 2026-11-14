# Sample plates (P2S)

Three Bambu Studio projects for a Bambu Lab P2S, 0.4 mm nozzle, Bambu PLA Basic, Cool Plate.

## Dovetail pair test plate

> [!IMPORTANT]
> **The dovetail is a semi-permanent joint.** Once two pieces are pushed together they are meant to stay together. They are not meant to be taken apart, and pulling them apart can crack or loosen the tines. Join the pieces into the full-length log before building, and keep the joined log whole when the cabin is taken down.


`dovetail_pair_p2s.3mf` is the quick fit check: one pair, the Flat-End-Round tongue half and groove half of `log_4insert_10-5_8`, built from the current press-fit STLs. Both lie on their flats side by side, centred on the P2S bed. It uses the same print settings as the dovetail splice sample below (0.24 mm layers, 2 walls, 8% gyroid, no supports). Print it, slide the halves together, and check that the joint is snug with no sag and that the tine tips are clean. This pair has been printed in PLA on a P2S and passed.

It is not pre-sliced; slice it in Bambu Studio. If the joint is too tight or too loose, see the fit ladder in `fit_test/dovetail/`.

## Dovetail splice sample

**This plate now holds the press-fit joint,** rebuilt from the current STLs. Its first version had the loose joint (0.3 mm clearance on every face), whose pieces sagged at every joint. The tongue halves and extenders are a little longer than before, so their positions on the bed moved by a fraction of a millimetre; the layout is otherwise the same.

`dovetail_p2s.3mf` prints every dovetail piece: the tongue half and groove half of the two-piece `log_4insert_10-5_8`, and the `log_extender_1insert_3`, from each of the four log sets. That is 12 parts on one plate, all lying on their flats as in the STLs. The pre-sliced `.gcode.3mf` of the loose version was removed; slice this plate in Bambu Studio before printing. Bambu Studio's estimates below are from the loose version and should be close.

![Plate preview](dovetail_preview.png)

Rows run from the back of the bed to the front. Each set takes two rows: the tongue half beside its extender, then the groove half. The sets are in this order: Ball-End-Round, Flat-End-Round, Flat-End-Octagonal, Smooth.

The settings use less filament than the log style sample and print faster:

| Setting | Value | Log style sample |
|---|---|---|
| Layer height | 0.24 mm (first layer 0.2 mm) | 0.2 mm |
| Walls | 2 | 2 |
| Infill | 8%, gyroid | 10%, gyroid |
| Top shell layers | 4 | 4 |
| Bottom shell layers | 3 | 3 |
| Outer wall and top surface speed | 250 mm/s | 200 mm/s |
| Top surface acceleration | 4000 mm/s² | 2000 mm/s² |
| Gap infill speed | 300 mm/s | 250 mm/s |
| Supports | None | None |
| Brim | Auto | Auto |

Bambu Studio's CLI estimates about 3 h 50 min and about 130 g. With the log style sample's settings the same plate comes to about 4 h 36 min and 137 g. Lightning infill would cut it to about 3 h and 100 g but leaves the parts weak inside. The walls and infill are flow-limited (21 mm³/s for PLA Basic), so faster speed settings would not shorten the print much.

In the loose version, Bambu Studio warned that a round groove half had floating regions: the inner edges of the tines lifted up to 0.3 mm off the bed and printed ragged and stringy. The rebuilt plate has a foot under each tine instead (see [DESIGN_NOTES.md](../DESIGN_NOTES.md)).

## Log style reference sample

`log_styles_p2s.3mf` prints two of each kind of log from every log set, to compare the four styles side by side and to cross the pairs at their notches. It holds 16 parts on one plate, all in their STL orientation: logs lying on their flats, base logs flat side down. Nothing stands on end and nothing needs support.

![Plate preview](log_styles_preview.png)

Rows run from the back of the bed to the front, two parts in each:

| Rows | Part | Sets, in order |
|---|---|---|
| 1 to 4 | `log_2insert_4-1_2` (2 notches, 4 1/2 in) | Ball-End-Round, Flat-End-Round, Flat-End-Octagonal, Smooth |
| 5 to 8 | `base_log_4-1_2` (4 1/2 in) | Ball-End-Round, Flat-End-Round, Flat-End-Octagonal, Smooth |

The print settings are chosen to save filament:

| Setting | Value |
|---|---|
| Layer height | 0.2 mm |
| Walls | 2 |
| Infill | 10%, gyroid |
| Top shell layers | 4 |
| Bottom shell layers | 3 |
| Supports | None |
| Brim | Auto |

Bambu Studio's CLI estimates about 5 h 19 min and about 166 g. With the fit test's 3 walls, 25% grid infill and 5 top layers the same plate comes to about 6 h and about 246 g. The plate has been sliced but not yet printed.

## Standing and lying comparison (earlier)

`log_sample_p2s.3mf` is the earlier sample that compared logs printed standing on end with logs printed lying down. Standing logs have since been dropped, so use it only for reference. It has the same settings as the notch fit test: 0.2 mm layers, 3 walls, 25% infill, no slicer supports. Bambu Studio's CLI estimates about 3 h 28 min and about 105 g.

![Plate preview](plate_preview.png)

| Object | Source | Orientation | Finish |
|---|---|---|---|
| V1 `log_1insert_1-5_8` | branch `vertical-print-logs` | standing | smooth |
| V2 `log_1insert_1-5_8` | branch `vertical-print-logs` | standing | wood grain |
| V3 `log_2insert_4-1_2` | branch `vertical-print-logs` | standing, 114 mm tall | wood grain |
| V4 `log_1insert_1-1_2_hex` | branch `vertical-print-logs` | standing | wood grain |
| V5 `log_1insert_1-5_8_rounded` | branch `vertical-print-logs` | standing | rounded-end wood grain |
| H1 `log_1insert_1-5_8` | branch `lying-equal-flats` | lying | smooth |
| H2 `log_1insert_1-5_8` | branch `lying-equal-flats` | lying | wood grain |
| H3 `log_2insert_4-1_2` | branch `lying-equal-flats` | lying | smooth |
| H4 `log_2insert_4-1_2` | branch `lying-equal-flats` | lying | wood grain |
| H5 `base_log_4-1_2` | branch `lying-equal-flats` | flat side down | wood grain |

The standing logs (V) have a 5 mm brim set on each object; the lying parts use auto brim. The standing logs carry break-away support combs in their notches.

**The two sets do not cross-fit.** Standing logs are full 19.05 mm rounds with 19.45 mm notches; lying logs are 18.25 mm across the flats with 18.65 mm notches. Fit-test V parts with V parts and H parts with H parts.
