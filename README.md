# Draft Room

**Live: https://sam0.github.io/draft-room/**

Mock-draft a fantasy football team against AI managers who all have strong opinions.
15 rounds, snake order, PPR scoring, 2026 projections.

## Your opponents

Each AI manager has a drafting personality and says why it made each pick:

| Manager | Style |
|---|---|
| 📊 Spreadsheet Steve | Follows ADP to the decimal (even takes a defense in round 8) |
| 🙅 Zero-RB Zoe | Refuses running backs early |
| 📣 Homer Hank | Loves one NFL team a little too much |
| 🎲 Chaos Carl | Drafts on vibes |
| 🎯 QB Quinn | Needs an elite quarterback |
| 🌱 Rookie Rae | Buys every rookie |
| 🙌 Wideout Wes | Stacks wide receivers |
| 🐄 Bellcow Bo | Hoards running backs |
| 🧱 Tight End Tina | Believes in the tight end edge |
| 🧓 Veteran Vic | Trusts proven players |
| 🥪 Autodraft Andy | Missed the draft; the app picks for him |

## How the pick suggestions work

- **Value over replacement:** points above the last starter-quality player at that position for your league size
- **Roster need:** favors open starting spots, including FLEX
- **Timing:** checks whether the player will likely be gone before your next turn in the snake

At the end, every team is graded on its best projected starting lineup
(QB, 2 RB, 2 WR, TE, FLEX, K, DEF), and you see your best value pick and biggest reach.

## Repo layout

| Path | What |
|---|---|
| `docs/index.html` | The app (GitHub Pages) |
| `docs/draft.js` | Draft engine: snake order, AI managers, suggestions, grading |
| `docs/data.json` | Top ~320 players by ADP |
| `tools/snapshot.cjs` | Refreshes `data.json` from Sleeper's public projections API |

Data: Sleeper public API (PPR projections + ADP).
