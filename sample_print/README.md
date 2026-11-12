# Log sample plate (P2S)

`log_sample_p2s.3mf` is a Bambu Studio project for a Bambu Lab P2S, 0.4 mm nozzle, Bambu PLA Basic, Cool Plate. It uses the same settings as the notch fit test: 0.2 mm layers, 3 walls, 25% infill, no slicer supports. Bambu Studio's CLI estimates about 3 h 28 min and about 105 g.

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
| H5 `half_log_4-1_2` | branch `lying-equal-flats` | flat side down | wood grain |

The standing logs (V) have a 5 mm brim set on each object; the lying parts use auto brim. The standing logs carry break-away support combs in their notches.

**The two sets do not cross-fit.** Standing logs are full 19.05 mm rounds with 19.45 mm notches; lying logs are 18.25 mm across the flats with 18.65 mm notches. Fit-test V parts with V parts and H parts with H parts.
