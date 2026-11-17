# Issue tracker

GitHub issues on `lhak1341/obsidian-pokedex`, driven with `gh`.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`. Tickets carry exactly one of `wayfinder:research|prototype|grilling|task`.
- Child ticket: `gh api -X POST repos/lhak1341/obsidian-pokedex/issues/<map>/sub_issues -F sub_issue_id=<id>`.
- Block: `gh api -X POST repos/lhak1341/obsidian-pokedex/issues/<blocked>/dependencies/blocked_by -F issue_id=<id>`; unblock with `-X DELETE .../dependencies/blocked_by/<id>`.
- `<id>` is the issue's database id (`gh api repos/lhak1341/obsidian-pokedex/issues/<n> --jq .id`), not its number (what passing a number does is untested).
- Both POSTs return the *parent* issue, so their output cannot confirm the link: verify with a GET of `.../sub_issues` or `.../dependencies/blocked_by`.
- Frontier: open children of the map with no open `blocked_by` and no assignee. Claim = assign `lhak1341`.
- Nothing is committed or pushed by an agent here, so research findings go to `temp/research/<name>.md` (gitignored) plus a resolution comment on the ticket, not a pushed `research/` branch; prototypes stay in `temp/proto/`, linked from the ticket.
- A resolution comment records only what the user saw and approved; anything only stated, not prototyped, is named as still open (Card anatomy and grid claimed the tap panel's look was settled; it was not).
