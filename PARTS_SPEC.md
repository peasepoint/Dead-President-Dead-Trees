# Parts spec: commercially sold Lincoln Logs pieces

A catalog of the pieces sold in Lincoln Logs sets from 1916 to today, with the best dimensions available, for reverse engineering. No official dimensioned drawings exist. This spec is built from official instruction sheets, compatible woodworking plans, a museum record and resale listings measured by sellers. Researched with Tavily in November 2026.

Confidence: **High** = several independent sources agree. **Medium** = one good source, or inferred from official drawings. **Low** = seller measurements or a single mention. Measure real pieces before trusting anything below High.

## 1. Core log geometry

| Feature | Value | Confidence | Sources |
|---|---|---|---|
| Diameter | 3/4 in (19.05 mm) | High | Wikipedia; Log Cabin Hub; 1958 box text "LARGE 3/4" SCALED PIECES" (V&A) |
| Notch width | 3/4 in | High | LumberJocks; ibuildit.ca |
| Notch centre spacing | 3 in (2 1/4 in solid between notches) | High | LumberJocks; ibuildit.ca; Log Cabin Hub |
| Notch depth | 3/16 in, top and bottom at each notch position | Medium | LumberJocks; ibuildit.ca (a shallower variant) |
| End shoulder past the outer notch | 3/8 in nominal; originals measure closer to 7/16 in | Medium | LumberJocks, ibuildit (3/8); vintage listings at 1 5/8, 4 5/8 in and the Poshmark lot (see `RESEARCH.md`) imply 7/16 |
| Width across the notch faces | about 11/16 in (1/16 in play in a 3/4 in notch) | Low | ibuildit.ca (compatible build) |
| Course rise | 3/8 in per crossing course (3/4 - 2 x 3/16); parallel logs in one wall touch | Derived | Matches ibuildit's note that store logs rest on the row below |

**Length rule:** L = 3(n - 1) + 2s, where n = notch positions and s = end shoulder.

| n | s = 3/8 in | s = 7/16 in |
|---|---|---|
| 1 | 1.5 in | 1.625 in |
| 2 | 4.5 in | 4.625 in |
| 3 | 7.5 in | 7.625 in |
| 4 | 10.5 in | 10.625 in |

Both columns appear in listings. The 7/16 column matches more measured originals; the 3/8 column matches most compatible plans and seller "nominal" sizes.

`parts.mjs` uses `D = 3/4 in`, `NOTCH_D = 3/16 in`, `CENTERS = 3 in`, `PITCH = 3/8 in`, which agrees with this table. Its log lengths follow the reference lot: 3/8 in shoulders on the 1 1/2 and 4 1/2 in logs, 7/16 in on the 1 5/8, 7 5/8 and 10 5/8 in logs (see "Check against `PARTS_SPEC.md`" in `DESIGN_NOTES.md`).

## 2. Log catalog

| Piece | Profile | Length (nominal) | Notches | Hasbro/Playskool no. | K'NEX part no. | Confidence |
|---|---|---|---|---|---|---|
| 1-notch single | round | 1.5 in | 1 position, top and bottom | #1 | 9000.001 | High |
| 2-notch | round | 4.5 in | 2, at the ends | #3 | 9001.001 | High |
| 3-notch | round | 7.5 in | 3: both ends and centre | #4 | 9002.001 | Medium |
| 4-notch | round | 10.5 in | 4: ends and two inside | #11 | not found | Medium |
| 2-notch flat (base log) | flat bottom, notches on top | 4.5 in | 2 | #5 | 9003.001 (inferred) | Medium |
| 3-notch flat (base log) | flat bottom, notches on top | 7.5 in | 3 | #8 | 9004.001 (inferred) | Medium |
| 4-notch flat | flat bottom | 10.5 in | 4 | not seen | not seen | Low (handmade sets only) |
| 2-insert 6 in log | round | 6 in | 2, non-standard layout | n/a | n/a | Low (one vintage lot, see `RESEARCH.md`) |

Notes:
- #-numbers come from the Playskool *Log Cabin* sheet (1996: #1, #3, #4, #5) and the K'NEX *Discovery* 00902 sheet (1999: #1, #3, #5, #8, #11). Lengths were matched by scaling the sheets' parts drawings against each other (e.g. #4 draws at 1.64x #3, close to 7.5/4.5; #11 at 2.3x, close to 10.5/4.5). The sheets give no lengths.
- K'NEX numbers come from the 2019 *On The Trail* 00821 and *Fun On The Farm* 00858 parts legends. The flat-log mapping is read from the legend drawings and should be checked against a real part.
- Base-log height: measured at about 0.53 in from photos (`RESEARCH.md`). A base log ripped exactly through the centre would be 3/8 in, so the originals are cut above centre.

## 3. Roof, gable and accessory pieces

| Era | Piece | Known details | Confidence |
|---|---|---|---|
| about 1916-1920s | One-piece wooden roof with fabric hinge | architoys.net | Medium |
| about 1916-1920s | Gable logs | Patent 1,351,086: logs of evenly decreasing length; a downward notch near each end, upward notches set further in, holding short connecting members in an inverted V; a long ridge-pole log at the apex | Medium (proportions only) |
| 1930s-1960s | Wooden gables, flat roof boards, wooden chimney with a triangular cut-out underneath to sit on the ridge | 1958 Set 1C: 44 logs, 2 gables, 18 roof boards, 1 chimney; box cites patents 1,351,086 and 2,012,160 (V&A O1604211) | Medium |
| 1930s-1960s | Wooden triangle gable | about 4 7/8 x 2 in, 39 deg slopes, two bottom notches 3 in apart (`RESEARCH.md`) | Low |
| 1960s-1980s (Playskool) | Plastic gables and trusses | Sold with 2 or 3 notches; large about 8 1/2 x 2 1/4 in, small about 5.8 x 1.6 in (`RESEARCH.md`) | Low |
| 1960s-1980s | Roof slats (wood, later plastic) | Lengths listed: 12, 11, 9 3/4, 9, 7 3/4, 6, 5 3/4, 4, 3 in; some grooved, some with raised edges; flat slats about 0.8 in wide, ridge slats about 1 1/8 in with a centre groove | Low |
| 1960s-1980s | Chimney (open top) | about 1 3/8 x 1.2 in, inverted-V base at about 27 deg (`RESEARCH.md`) | Low |
| 1970s | Slat edge clips; card signs with plastic holders | architoys.net; resale listings | Low |
| 1990s-today | Molded one-piece roofs (e.g. 4264.4), barn gable 3424.505, roof slat 3426.104, window 3462.5xx, door frame 3461.501, door 3460.501 | K'NEX part numbers only; no dimensions found. Windows and doors fit the gaps left in log walls; doors "a little less than 3 in" (forum recollection) | Low |

Not in scope (different shape or scale): Lincoln Log Timbers (square, 1930s), Miniature Timbers (1950s), Halsam American Logs, Mini Classics and "World's Smallest" sets, Roy Toy (compatible third-party maker still selling wooden gables and green roof planks).

## 4. Open questions

- Wikipedia's John Lloyd Wright article gives about 1.5 cm (0.59 in) diameter, against 3/4 in everywhere else. Treat 3/4 in as the production size.
- Text of patent 2,012,160 could not be read; its drawings may show gable and roof details.
- No measured drawings found for gable thickness, slat thickness, chimneys, windows or doors in any era.
- Measure 3 to 5 real logs per length to fix: notch depth, width across notch faces, end shoulder (3/8 vs 7/16 in), and whether the section is fully round or has side flats.

## Sources

- Official sheets: Playskool *Log Cabin* (Hasbro, 1996) https://www.hasbro.com/common/instruct/LincolnLogsLogCabin.PDF ; K'NEX *Discovery* 00902 (1999) https://d2npjmct0hwe3x.cloudfront.net/wp-content/uploads/manuals/Lincoln-Logs-Discovery-Building-Set-00902.pdf ; Basic Fun *On The Trail* 00821 https://www.basicfun.com/wp-content/uploads/2023/02/Lincoln-Logs-On-The-Trail-00821.pdf ; *Fun On The Farm* 00858 https://www.basicfun.com/wp-content/uploads/2023/02/Lincoln-Logs-Fun-On-The-Farm-00858.pdf
- US Patent 1,351,086: https://patents.google.com/patent/US1351086A/en
- LumberJocks: https://www.lumberjocks.com/threads/lincoln-logs.343506
- ibuildit.ca: https://ibuildit.ca/projects/lincoln-logs
- V&A Set 1C (1958): https://collections.vam.ac.uk/item/O1604211/original-lincoln-logs-construction-toy-lloyd-wright-john
- architoys.net: https://www.architoys.net/toys/toypages/linclogs.html
- Log Cabin Hub: https://logcabinhub.com/lincoln-logs ; Wikipedia: https://en.wikipedia.org/wiki/Lincoln_Logs
- Resale listings (vintage lengths): eBay roofing-parts category and MNWebSource store; Etsy roof listings
