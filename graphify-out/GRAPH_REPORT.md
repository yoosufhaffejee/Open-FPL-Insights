# Graph Report - algorithms  (2026-08-24)

## Corpus Check
- Corpus is ~7,081 words - fits in a single context window. You may not need a graph.

## Summary
- 61 nodes · 93 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- GPT Prediction Engine
- Historic Statistics
- V1 Prediction Engine
- Claude Prediction Engine
- Claude Event Models
- Claude Core Pipeline
- Claude Probability Helpers
- Claude DEFCON

## God Nodes (most connected - your core abstractions)
1. `calculateExpectedPointsCore_claude()` - 13 edges
2. `shrink()` - 7 edges
3. `calculateExpectedPointsCore_gpt()` - 7 edges
4. `poissonPMF()` - 6 edges
5. `loadHistoricStats()` - 5 edges
6. `calculateDefCon()` - 4 edges
7. `pAtLeast()` - 3 edges
8. `calculateGoals()` - 3 edges
9. `calculateAssists()` - 3 edges
10. `calculateCleanSheet()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `calculateExpectedPointsCore_claude()` --calls--> `calculateAssists()`  [EXTRACTED]
  predictPoints_claude.js → predictPoints_claude.js  _Bridges community 6 → community 5_
- `calculateExpectedPointsCore_claude()` --calls--> `calculateCleanSheet()`  [EXTRACTED]
  predictPoints_claude.js → predictPoints_claude.js  _Bridges community 6 → community 7_
- `calculateExpectedPointsCore_claude()` --calls--> `calculateDefCon()`  [EXTRACTED]
  predictPoints_claude.js → predictPoints_claude.js  _Bridges community 6 → community 10_
- `pAtLeast()` --calls--> `poissonPMF()`  [EXTRACTED]
  predictPoints_claude.js → predictPoints_claude.js  _Bridges community 7 → community 10_
- `calculateDefCon()` --calls--> `shrink()`  [EXTRACTED]
  predictPoints_claude.js → predictPoints_claude.js  _Bridges community 5 → community 10_

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "GPT Prediction Engine"
Cohesion: 0.27
Nodes (10): AvailabilityModel_gpt, calculateExpectedPointsCore_gpt(), Config_gpt, EventModels_gpt, FixtureModel_gpt, FplScoringRules_gpt, getExpectedPoints_gpt(), loadPredictionCache_gpt() (+2 more)

### Community 1 - "Historic Statistics"
Cohesion: 0.48
Nodes (6): getPlayerHistoricStatsAgainst(), historicStatsCache, loadHistoricCache(), loadHistoricStats(), renderHistoricStats(), saveHistoricCache()

### Community 3 - "V1 Prediction Engine"
Cohesion: 0.43
Nodes (5): calculateExpectedPointsCore_v1(), correctPenaltiesOrder_v1(), getExpectedPoints_v1(), getLastFive_v1(), loadPredictionCache_v1()

### Community 4 - "Claude Prediction Engine"
Cohesion: 0.40
Nodes (4): CONFIG, getExpectedPoints_claude(), loadPredictionCache_claude(), SCORING

### Community 5 - "Claude Event Models"
Cohesion: 0.33
Nodes (6): calculateAssists(), calculateBonus(), calculateCards(), calculateGoals(), credibilityWeight(), shrink()

### Community 6 - "Claude Core Pipeline"
Cohesion: 0.40
Nodes (5): buildExplainability(), calculateAppearance(), calculateExpectedPointsCore_claude(), calculatePenaltyMiss(), getExpectedMinutes()

### Community 7 - "Claude Probability Helpers"
Cohesion: 0.40
Nodes (5): calculateCleanSheet(), calculateGoalsConceded(), calculateSaves(), factorial(), poissonPMF()

## Knowledge Gaps
- **5 isolated node(s):** `historicStatsCache`, `SCORING`, `CONFIG`, `FplScoringRules_gpt`, `Config_gpt`
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `calculateExpectedPointsCore_claude()` connect `Claude Core Pipeline` to `Claude DEFCON`, `Claude Prediction Engine`, `Claude Event Models`, `Claude Probability Helpers`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `shrink()` connect `Claude Event Models` to `Claude DEFCON`, `Claude Prediction Engine`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `historicStatsCache`, `SCORING`, `CONFIG` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._