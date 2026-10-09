# Route pack data collection

How the team collects and checks the one corridor Para! ships with. The router only knows what is in these files. If something was not measured, leave it out. Never fill a gap with a guess.

## Workflow

1. Copy `data/templates/` to `data/pack/`.
2. Ride the corridor and fill in the five CSV files (rules below).
3. Run `npm run validate:pack`. Fix every `ERROR`. Read every `WARN` and decide if it is expected.
4. Keep fare-matrix photos and GPS tracks in a team folder. Reference them by file name in the CSVs. Do not commit photos that show faces or plate numbers.

`npm run validate:pack some/other/folder` checks a different folder.

## General rules

- IDs: short, lowercase, no spaces, never reused. Example pattern: `lm-01`, `rt-01`, `fare-jeep-2026-09`.
- Lists inside one cell (aliases, tags, routes served) are separated with `|`.
- Dates are `YYYY-MM-DD`.
- A cell with a comma must be wrapped in double quotes. Spreadsheet apps do this on export.
- One direction is one route. The return trip is a second route with its own stops, distances and times.
- Every example value in this document is made up. Do not copy example values into the pack.

## landmarks.csv

Boarding and alighting points riders actually name.

| Column | Required | Meaning |
|---|---|---|
| `id` | yes | Unique id |
| `name` | yes | The name riders say most |
| `aliases` | no | Other names and common spellings, `|` separated. Feeds the Taglish fuzzy matcher |
| `tags` | no | Road or area names the stop sits on, `|` separated (for "iwas ..." requests). Use the same spelling everywhere |
| `lat`, `lon` | yes | Decimal degrees, at least 5 decimal places |
| `note` | no | Free text |

How to measure: stand at the spot where passengers board, wait for the GPS accuracy reading to drop below about 10 m, then record. Jeepneys have no fixed stops, so pick the point most riders use and say so in `note`.

## routes.csv

| Column | Required | Meaning |
|---|---|---|
| `id` | yes | Unique id |
| `mode` | yes | `jeepney`, `modern_jeepney`, `uv`, `bus`, `train` |
| `name` | yes | Signboard text as displayed |
| `tags` | no | Roads the route runs along, `|` separated. A route tagged with a road is removed when the rider asks to avoid that road |
| `fare_table_id` | yes | An `id` from `fares.csv` |
| `verified` | yes | `true` only if a team member rode the full route |
| `verified_date` | if verified | Date of the ride |
| `verified_by` | if verified | Who rode it |
| `note` | no | Shown to riders in the "Tandaan" box. Facts observed on the ride only |

Unverified routes are allowed while collecting. The app labels any result that uses one as "Hindi pa verified".

## route_stops.csv

One row per stop, in riding order.

| Column | Required | Meaning |
|---|---|---|
| `route_id` | yes | An `id` from `routes.csv` |
| `seq` | yes | 1, 2, 3 ... in riding order |
| `landmark_id` | yes | An `id` from `landmarks.csv` |
| `dist_km_from_prev` | yes | Road distance from the previous stop. `0` on the first stop |
| `min_from_prev` | yes | Off-peak minutes from the previous stop. `0` on the first stop |
| `min_from_prev_rush` | no | Rush-hour minutes for the same hop |
| `method` | no | `gps` or `odometer` |
| `measured_date`, `measured_by` | no | When and who |
| `note` | no | Free text |

### Distance: GPS track vs odometer

- **GPS track (preferred).** Record a track with a phone app during the ride and read the distance between stops from it. Works on any vehicle. Errors: tunnels, flyovers and tall buildings cause drift, so check the track on a map afterwards.
- **Odometer.** Only when you can see it (private car following the same road). Read at each stop and subtract. Errors: lane changes and detours the public vehicle does not take.
- If both exist and differ by more than 10%, ride again. Record which method was used in `method`.
- Distances drive the fare, so a wrong distance means a wrong fare on screen.

The validator compares each stated distance with the straight line between the two landmark coordinates. Shorter than the straight line is an error (distance or coordinates are wrong). More than three times longer is a warning (confirm the detour is real).

### Time: off-peak vs rush

- `min_from_prev` is off-peak: weekday, roughly 10:00 to 15:00. Time from wheels moving at one stop to arrival at the next.
- `min_from_prev_rush` is the same hop on a weekday between roughly 6:00 and 9:00 or 17:00 and 20:00.
- Two rides per period are better than one. Record the median, not the best run.
- Waiting time at the stop is not part of either number. The router does not model waiting.
- The router uses `min_from_prev` today. Rush-hour values are stored for later use.

## fares.csv

Fares are reference data with a date, not a ruling on what a driver may charge.

| Column | Required | Meaning |
|---|---|---|
| `id` | yes | Unique id. Put the period in it so a new matrix gets a new id |
| `mode` | yes | Same values as routes |
| `product` | yes | Ticket/fare product, e.g. `single-journey` |
| `vehicle_class` | yes | Vehicle class, e.g. `ordinary`, `air-conditioned`, `traditional`, `modern` |
| `rule` | yes | `distance` or `matrix` |
| `base_fare` | for distance | Pesos covered by the base fare |
| `base_km` | for distance | Distance covered by `base_fare` |
| `per_km` | for distance | Pesos for each km after `base_km` |
| `effective_date` | yes | Date the matrix took effect. Shown on screen as "as of" |
| `expires_at` | no | Last date the fare or temporary guide is valid |
| `rounding_rule` | no | `nearest_0.25` (default), `nearest_1`, `ceil_1` or `none` |
| `source_note` | yes | Where the numbers came from, in words |
| `source_url` | yes | Link to the official matrix or source record |
| `photo_ref` | no | File name of the posted fare matrix photo |
| `conflict_note` | no | Fill in when sources disagree |

For `rule=distance`, use the formula fields. For `rule=matrix`, leave them blank and put exact directional amounts in `fare_matrix.csv`:

| Column | Meaning |
|---|---|
| `fare_entry_id` | Fare ID from `fares.csv` |
| `promotion_id` | Empty for the scheduled fare; promotion ID for a discounted matrix |
| `origin_id`, `destination_id` | Boarding and alighting landmark IDs; direction matters |
| `fare` | Exact fare in pesos |

`fare_promotions.csv` stores a fare change without replacing the scheduled rule. Use `eligibility=all` for a temporary universal discount, or `student`, `senior`, or `pwd` for eligible passengers. `kind=percent_off` uses `value` as a percent; `kind=matrix` reads final fares from `fare_matrix.csv` using its `promotion_id`. Promotions have their own effective and expiry dates and do not stack; the lowest applicable fare is selected. The router defaults to an adult rider and applies only universal promotions.

How to collect:

- **Photograph the fare matrix posted inside the vehicle.** Operators must post it before charging the new rates. Capture the whole sheet, including the date and the issuing office. Put the file name in `photo_ref`.
- Copy numbers from the photo or the official LTFRB matrix. Never from memory, and never from an app.
- Rounding: check how the posted matrix rounds and choose the matching `rounding_rule`. If unsure, leave it empty and say so in `source_note`.
- **Conflicting sources.** `CLAUDE.md` section 3 notes that published reports disagree on some 2026 figures. When two sources differ, enter the value from the posted matrix photo, and describe the disagreement in `conflict_note`. The validator prints every conflict note so nobody forgets it.
- When a new matrix takes effect, add a new row with a new `id` and `effective_date`. Do not edit the old row.

Distance fare formula used by the router: `base_fare + max(0, distance - base_km) * per_km`, then the rounding rule. Matrix fares use the exact board-to-alight entry; the reverse direction is never inferred.

## terminals.csv

Three to five terminals, each checked on site.

| Column | Required | Meaning |
|---|---|---|
| `id` | yes | Unique id |
| `name` | yes | Name on the terminal signage |
| `landmark_id` | no | The landmark riders board at, if it is in `landmarks.csv` |
| `lat`, `lon` | no | Entrance used by passengers |
| `routes_served` | no | Route ids, `|` separated |
| `verified_date` | no | Date someone stood there and checked |
| `note` | no | What you saw: where the queue forms, which bay |

## What the validator reports

Errors (exit code 1): a missing file or column, a missing or invalid `ncr_boundary.geojson`, a stop landmark outside the supplied NCR polygon, an empty required cell, a fare missing its product, vehicle class, source note, HTTPS source URL, or valid effective date, a duplicate id, a reference to an id that does not exist, a value that is not a number, coordinates out of range, an unknown mode or rounding rule, a date not in `YYYY-MM-DD`, a route with fewer than two stops, a first stop that is not `0`/`0`, a later stop with zero or negative distance or minutes, a stated distance shorter than the straight line, a route marked verified without a date and a name.

`ncr_boundary.geojson` must contain only NCR boundary features, and every feature must identify NCR in a region/name/code property. The validator checks stop landmarks against polygon geometry, including holes. This does not certify the source boundary or test the route's full path between stops; source and boundary currency must still be documented and reviewed.

Warnings: an empty file, an unverified route, a fare with no photo or link, a fare with a conflict note, an empty rounding rule, a distance over three times the straight line, rush minutes lower than off-peak, a landmark no route stops at, a fare table no route uses, a terminal with no landmark or no verified date.

A clean run means the files are consistent with each other. It does not mean the data is true. Only the ride does that.
