# Gap check: what existing apps do in airplane mode

**Status: not tested yet. Every result cell below is blank on purpose.** The claim that Para! fills a gap is only as good as these tests. Fill the table from the team's own tests on a real phone. Do not fill it from memory, reviews or app-store descriptions.

`CLAUDE.md` section 3 already notes that Sakay.ph, Google Maps and Lakbayan cover routes, fares and crowdsourcing while online. The open question is narrower: what exactly stops working with no signal.

## How to test (same steps for every app)

Record for each app: app version, phone model, OS version, tester, date.

1. With signal: install or update the app. Open it, search one trip on the chosen corridor (same origin and destination for every app), and view the result. If the app offers an offline download (maps or an area), download the corridor area.
2. Close the app fully.
3. Turn on airplane mode. Turn WiFi off too.
4. Open the app. Note what loads.
5. Search the **same** trip again. Note the result or the exact error text.
6. Search a **different** trip on the corridor that you did not search while online. Note the result or the exact error text.
7. If a route appears: check whether it shows public transport legs (jeepney, bus, UV, train), a fare, and step-by-step boarding and alighting points.
8. Try to change the request: ask for a cheaper option, or avoid a road. Note what happens.
9. Take a screenshot of every result and error. Save them in a team folder; reference the file names in the Evidence column.

## Results

| Test in airplane mode | Sakay.ph | Moovit | Google Maps |
|---|---|---|---|
| App version / phone / date / tester | | | |
| App opens (step 4) | | | |
| Repeat of the trip searched online (step 5) | | | |
| New trip not searched before (step 6) | | | |
| Public transport legs shown | | | |
| Fare shown | | | |
| Boarding and alighting points shown | | | |
| Can refine: cheaper option | | | |
| Can refine: avoid a road | | | |
| Works in Tagalog or Taglish text | | | |
| Exact error text when it fails | | | |
| Evidence (screenshot file names) | | | |

## Para! on the same test

Fill this in on the same phone, the same day, for a fair comparison. The automated checks in this repository ran on a laptop only.

| Test in airplane mode | Para! |
|---|---|
| App version (commit) / phone / date / tester | |
| App opens | |
| New trip not searched before | |
| Public transport legs shown | |
| Fare shown, with date | |
| Boarding and alighting points shown | |
| Can refine: cheaper option | |
| Can refine: avoid a road | |
| Works in Taglish text | |
| Evidence | |

## What to write once the table is filled

One or two sentences, stating only what the table shows. For example, the form of an honest claim is: "In our test on [date] with [app version], [app] did [X] in airplane mode and could not do [Y]." If an app turns out to do everything in the table offline, say so and narrow the Para! claim to what is left.
