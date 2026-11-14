# Dovetail fit test

The dovetail that joins the halves of the two-piece log is a press fit, and a press fit depends on the printer. These three files are the smooth `log_extender_1insert_3` with three gaps between the sloping sides of the tail and the socket. Everything else about them is the same.

> [!IMPORTANT]
> **The dovetail is a semi-permanent joint.** Once two pieces are pushed together they are meant to stay together. They are not meant to be taken apart, and pulling them apart can crack or loosen the tines. These test pieces are the exception: expect to wear them out trying the fit.

| File | `--splice-clearance` | Expect |
|---|:---:|---|
| `log_extender_gap_0.00.stl` | 0 | Tightest. May need a hard push or not go in |
| `log_extender_gap_0.05.stl` | 0.05 (the default) | Firm push |
| `log_extender_gap_0.10.stl` | 0.1 | Easy push; may hinge slightly |

Print two of each, lying on the flat as they load, and keep track of which pair is which: the parts look alike, so mark them with a pen as they come off the bed. Use the settings you will print the logs with, and turn on elephant foot compensation.

Slide the tail of one into the socket of its twin, across the log. The best pair is the loosest one that stays straight when you hold it by one end. Then regenerate the STLs with that gap, as described in the [main README](../../README.md#regenerating-the-files):

```
node log_generator.mjs --splice-clearance 0.1
```

Nothing here has been printed yet.
