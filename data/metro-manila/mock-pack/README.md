# Mock jeepney pack (made up)

Everything in this folder is **mock data**, written by `scripts/mock-jeepney-pack.mjs` on 2026-10-10 at the team's request so that the app has jeepney routes to plan, draw and talk about next to the real train fares.

- The routes do not exist. The stops are not real stops. The fares (₱12 for the first 4 km plus ₱1.50 per km; "modern" ₱16 plus ₱2.25 per km) are invented and are deliberately not the LTFRB numbers.
- Stop coordinates were picked by hand to fall inside Metro Manila. Distances are the straight line between stops times 1.25, and ride times assume a made-up speed. Nobody rode or measured anything.
- Each of the 16 Metro Manila cities has one made-up stop named "<City> Sentro (mock)" (ids `mock-city-*`) so a rider can ask Tsupher for a city by name. The point is hand-picked inside the city and is not a real terminal. "Marikina" alone still means the real LRT-2 station, which a mock line also serves.
- Routes start or end at real LRT-1, LRT-2 and MRT-3 stations so the lines join the train network on the map. That does not make them real.

How the app marks it: every id starts with `mock-`, stop names end in "(mock)", route names end in "(MOCK)", routes are `verified=false`, and results, route detail, chat cards and the map show a "MOCK DATA" badge.

To remove the mock data: delete this folder, run `npm run import:ncr`, rebuild.
To change it: edit the script, run it, then `npm run import:ncr`.
