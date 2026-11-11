# Notch fit test

`notch_fit_test.3mf` is the Bambu Studio project used to choose the notch width. It holds six pairs of `log_1insert_1-5_8` (smooth), each pair with a different notch width, set up for a Bambu Lab P2S with a 0.4 mm nozzle, Bambu PLA Basic, 0.2 mm layers, 3 walls and 25% infill. It prints in about 2 h 12 min and uses about 74 g.

Cross the two logs of a pair at their notches. The best pair is the tightest one that seats fully and lifts out freely.

## Reading the labels

Each log has a number cut 0.6 mm deep into both end faces ([preview](label_preview.png)). The numbers were written before the notch was redefined, so they are **not** today's `--clearance` values. Use this table:

| Label | Row on the bed | Notch width | Today's `--clearance` |
|:---:|:---:|:---:|:---:|
| `-0.2` | 1 (front) | 18.65 mm | 0.2 (the default) |
| `-0.1` | 2 | 18.85 mm | 0.3 |
| `0.0` | 3 | 19.05 mm | 0.4 |
| `+0.1` | 4 | 19.25 mm | 0.5 |
| `+0.2` | 5 | 19.45 mm | 0.6 |
| `+0.3` | 6 (back) | 19.65 mm | 0.7 |

The part that sits in a notch is 18.25 mm wide, so today's clearance is (notch width − 18.25 mm) / 2.

## Result

In PLA the `-0.2` pair (18.65 mm) fit best, with a small amount of play. It is the tightest pair in the test, so nothing narrower has been tried. That width is now the default for every part.

To try a tighter or looser fit on your own printer, regenerate the STLs with a different clearance, as described in the [main README](../README.md#regenerating-the-files).
