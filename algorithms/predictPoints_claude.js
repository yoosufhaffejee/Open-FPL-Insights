// predictPoints_claude.js
// Entrypoint for the Claude model of Expected Points
//
// REBUILD NOTES (vs. previous version) — see fpl-xpoints-rebuild-spec.md for full rationale:
//   1. Namespacing fix: every internal constant/helper is now hidden inside an IIFE. The old file
//      declared SCORING, CONFIG, poissonPMF, shrink, factorial, etc. as bare top-level identifiers.
//      Because ACTIVE_ALGORITHM implies v1.js / gpt.js / claude.js are all loaded as classic <script>
//      tags sharing ONE global scope, any sibling file declaring the same top-level name (extremely
//      likely — they were probably built from the same spec) would throw
//      "Identifier 'SCORING' has already been declared" and break the whole page. Only the 3
//      functions the router calls, plus simulatePlayerPoints_claude, are now exposed on window.
//   2. Team/opponent strength was completely mocked ({attack:1.0, defense:1.0} hardcoded) — every
//      fixture was being treated identically regardless of opponent. Replaced with a real
//      attack/defense strength model built from pulseStandings (home/away goals for/against),
//      shrunk toward league-average for small samples.
//   3. Clean sheet, goals-conceded, and saves each independently recomputed "expected opponent goals"
//      with two different, inconsistent formulas. Now computed once (lambdaTeamConceded) and shared.
//   4. Expected-minutes model no longer zeroes out pure substitutes (previously: starts===0 => 0
//      expected minutes => 0 predicted points, even for a player getting 20 mins/game off the bench).
//   5. Data-driven position priors (computed from allPlayers) replace flat magic-number priors
//      (0.05, 0.1, 0.15, 0.01...).
//   6. Own goals were entirely unused; penalty misses were hardcoded to 0 despite
//      player.penalties_missed being available. Both are now modeled (conservatively, since we don't
//      have an explicit "designated penalty taker" field — see PENALTY_TAKER_OVERRIDES below).
//   7. Bonus was "historical bonus per 90, shrunk" — exactly the anti-pattern the spec calls out.
//      Replaced with a proxy built from this fixture's expected events (goals/assists/CS/DEFCON/saves).
//   8. Best-effort (schema-adaptive, never-throws) blending of previous-season data from the SQLite
//      `db`, since the exact fpl_data column names weren't specified — see detectDbSchema().
//   9. All Poisson math moved to log-space (no factorial overflow), every function defensively
//      handles null/undefined/NaN, and the whole core calculation is wrapped in try/catch with a
//      safe fallback so one malformed player object can never break the page.
//  10. Added simulatePlayerPoints_claude() — an opt-in Monte Carlo sampler. It is intentionally NOT
//      used to inflate xPoints itself (a mean should stay a mean); see the message accompanying this
//      file for why your "60-65 avg but 42-73 spread" ask is a simulation/realized-outcome question,
//      not an xPoints-calibration question.

let predictionCache_claude = null;

(function () {
    'use strict';

    // ==========================================
    // OFFICIAL FPL SCORING (2026/27) — Part 3 of spec
    // ==========================================
    const SCORING = {
        appearance: { bucket1_59: 1, bucket60plus: 2 },
        goals: { GK: 10, DEF: 6, MID: 5, FWD: 4 },
        assists: 3,
        clean_sheets: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
        saves: { per_count: 3, points: 1 },
        penalties_saved: 5,
        penalties_missed: -2,
        goals_conceded: { per_count: 2, points: -1, positions: ['GK', 'DEF'] },
        cards: { yellow: -1, red: -3 },
        own_goals: -2,
        defcon: { points: 2, threshold_def: 10, threshold_mid_fwd: 12 },
        bonus: [3, 2, 1]
    };

    const POSITION_NAMES = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    function getPosName(player) {
        return POSITION_NAMES[player && player.element_type] || 'MID';
    }

    // Fallback position baselines — only used when allPlayers-derived priors and historical DB
    // data are both unavailable (e.g. brand new preseason player pool with 0 minutes leaguewide).
    const POSITION_DEFAULTS = {
        GK: { xG90: 0.001, xA90: 0.001, defcon90: 0, saves90: 2.8, startRate: 0.65, minsIfPlaying: 90, subOnRate: 0.02, subOnMinutes: 20 },
        DEF: { xG90: 0.04, xA90: 0.05, defcon90: 7, saves90: 0, startRate: 0.5, minsIfPlaying: 82, subOnRate: 0.15, subOnMinutes: 22 },
        MID: { xG90: 0.10, xA90: 0.12, defcon90: 6, saves90: 0, startRate: 0.45, minsIfPlaying: 75, subOnRate: 0.25, subOnMinutes: 25 },
        FWD: { xG90: 0.35, xA90: 0.12, defcon90: 2, saves90: 0, startRate: 0.45, minsIfPlaying: 73, subOnRate: 0.30, subOnMinutes: 25 }
    };

    // Shrinkage / model constants — all named here, none buried inline. Tune k_* values via the
    // backtester described in the spec; these are reasonable untuned starting points.
    const CONFIG = {
        k_start: 4.0,
        k_minutes_sub: 5.0,
        k_goals: 12.0,
        k_assists: 12.0,
        k_saves: 8.0,
        k_defcon: 5.0,
        k_cards: 20.0,
        k_og: 30.0,
        k_bonus: 15.0,
        k_team_strength: 5.0,      // games needed before trusting a home/away split over neutral
        priorPseudoN: 2.0,          // "weight" (in matches) the position-average prior carries
        maxHistoricalWeight: 25,    // cap how much influence multi-season history can carry
        sot_per_goal_ratio: 3.0,    // approx shots-on-target faced per goal conceded (~33% conv. rate)
        fdr_nudge_weight: 0.03,     // FDR used only as a small sanity nudge, never the primary driver
        assumedCameoMinutes: 20,
        bpsWeights: { goal: 6, assist: 3, cleanSheet: 3, defcon: 2, save: 0.7, appearance: 1 },
        bonusMidpoint: 6,
        bonusScale: 4,
        bonusPositionPrior: { GK: 0.25, DEF: 0.30, MID: 0.35, FWD: 0.40 }
    };

    // Populate with known designated penalty takers if/when you have real team-news data, e.g.
    // { 302: true } keyed by player.id. Without this, penalty involvement is inferred weakly from
    // the player's own historical penalties_missed/penalties_saved — see calculatePenalties().
    const PENALTY_TAKER_OVERRIDES = {};

    // ==========================================
    // Generic helpers
    // ==========================================
    function safeNum(x, fallback) {
        const n = typeof x === 'string' ? parseFloat(x) : x;
        return (typeof n === 'number' && isFinite(n)) ? n : fallback;
    }
    function clamp(x, lo, hi) {
        x = safeNum(x, lo);
        return Math.min(hi, Math.max(lo, x));
    }
    function round2(x) { return Math.round(safeNum(x, 0) * 100) / 100; }

    // ==========================================
    // Distributions (log-space Poisson — robust to larger k/lambda, no factorial overflow)
    // ==========================================
    function logFactorial(n) {
        n = Math.max(0, Math.floor(safeNum(n, 0)));
        let s = 0;
        for (let i = 2; i <= n; i++) s += Math.log(i);
        return s;
    }
    function poissonPMF(lambda, k) {
        lambda = Math.max(0, safeNum(lambda, 0));
        k = Math.max(0, Math.floor(safeNum(k, 0)));
        if (lambda === 0) return k === 0 ? 1 : 0;
        const logP = -lambda + k * Math.log(lambda) - logFactorial(k);
        return Math.exp(logP);
    }
    // P(X >= threshold) for X ~ Poisson(lambda) — replaces the old "rate squared" DEFCON hack.
    function pAtLeast(lambda, threshold) {
        let cum = 0;
        for (let k = 0; k < threshold; k++) cum += poissonPMF(lambda, k);
        return clamp(1 - cum, 0, 1);
    }
    // E[valueFn(k)] for X ~ Poisson(lambda), exact discretized sum — used for saves (floor(k/3)) and
    // goals-conceded deductions (floor(k/2)) instead of dividing the mean, which is mathematically wrong.
    function expectedStepValue(lambda, valueFn, maxK) {
        maxK = maxK || 15;
        let expected = 0, cumP = 0;
        for (let k = 0; k <= maxK; k++) {
            const p = poissonPMF(lambda, k);
            expected += p * valueFn(k);
            cumP += p;
        }
        if (cumP < 1) expected += (1 - cumP) * valueFn(maxK + 1);
        return expected;
    }
    function samplePoisson(lambda) {
        lambda = Math.max(0, safeNum(lambda, 0));
        if (lambda <= 0) return 0;
        if (lambda > 30) lambda = 30; // guard against pathological inputs in sim mode
        const L = Math.exp(-lambda);
        let k = 0, p = 1;
        do { k++; p *= Math.random(); } while (p > L);
        return k - 1;
    }

    // ==========================================
    // Shrinkage / credibility weighting (Part 4.2) + multi-horizon precision blend (Part 4.3)
    // ==========================================
    function credibilityWeight(n, k) {
        n = Math.max(0, safeNum(n, 0));
        k = Math.max(0.0001, safeNum(k, 1));
        return n / (n + k);
    }
    function shrink(observed, prior, n, k) {
        const w = credibilityWeight(n, k);
        return safeNum(observed, prior) * w + safeNum(prior, 0) * (1 - w);
    }
    // Precision(evidence-weighted) blend across horizon layers: [{est, n}, ...]
    function precisionBlend(layers) {
        let num = 0, den = 0;
        layers.forEach(function (l) {
            if (l.est == null || !isFinite(l.est)) return;
            const n = Math.max(0, safeNum(l.n, 0));
            num += l.est * n;
            den += n;
        });
        return den > 0 ? num / den : (layers.length ? safeNum(layers[0].est, 0) : 0);
    }

    // ==========================================
    // Position-average priors, data-driven from allPlayers (Part 4.2 — replaces flat magic priors)
    // ==========================================
    let _positionPriorsCache = null;
    let _positionPriorsCacheLen = -1;
    function weightedAvg(arr, valueFn, weightFn) {
        let num = 0, den = 0;
        arr.forEach(function (p) {
            const w = safeNum(weightFn(p), 0);
            const v = valueFn(p);
            if (isFinite(v) && w > 0) { num += v * w; den += w; }
        });
        return den > 0 ? num / den : null;
    }
    function getPositionPriors(allPlayersRef) {
        allPlayersRef = allPlayersRef || [];
        if (_positionPriorsCache && _positionPriorsCacheLen === allPlayersRef.length) return _positionPriorsCache;

        const buckets = { GK: [], DEF: [], MID: [], FWD: [] };
        allPlayersRef.forEach(function (p) {
            const pos = POSITION_NAMES[p.element_type];
            if (pos && safeNum(p.minutes, 0) >= 180) buckets[pos].push(p);
        });

        const result = {};
        ['GK', 'DEF', 'MID', 'FWD'].forEach(function (pos) {
            const arr = buckets[pos];
            const mins = function (p) { return safeNum(p.minutes, 1); };
            result[pos] = {
                xG90: weightedAvg(arr, function (p) { return safeNum(p.expected_goals_per_90, 0); }, mins) ?? POSITION_DEFAULTS[pos].xG90,
                xA90: weightedAvg(arr, function (p) { return safeNum(p.expected_assists_per_90, 0); }, mins) ?? POSITION_DEFAULTS[pos].xA90,
                defcon90: weightedAvg(arr, function (p) { return safeNum(p.defensive_contribution_per_90, 0); }, mins) ?? POSITION_DEFAULTS[pos].defcon90,
                saves90: weightedAvg(arr, function (p) { return safeNum(p.saves_per_90, 0); }, mins) ?? POSITION_DEFAULTS[pos].saves90,
                yellow90: weightedAvg(arr, function (p) { return safeNum(p.yellow_cards, 0) / Math.max(1, safeNum(p.minutes, 90) / 90); }, mins) ?? 0.15,
                red90: 0.01,
                og90: 0.003,
                startRate: POSITION_DEFAULTS[pos].startRate,
                minsIfPlaying: POSITION_DEFAULTS[pos].minsIfPlaying,
                subOnRate: POSITION_DEFAULTS[pos].subOnRate,
                subOnMinutes: POSITION_DEFAULTS[pos].subOnMinutes
            };
        });

        _positionPriorsCache = result;
        _positionPriorsCacheLen = allPlayersRef.length;
        return result;
    }

    // ==========================================
    // Best-effort historical (multi-season) player prior from the SQLite `db`.
    // Schema-adaptive and fully defensive: if fpl_data's real column names don't match the
    // candidates below, this silently returns null (never throws, never blocks a prediction).
    // NOTE: confirm your actual fpl_data columns and extend the candidate lists if this stays null.
    // ==========================================
    let _dbSchemaChecked = false;
    let _dbColumnMap = null;
    function detectDbSchema() {
        if (_dbSchemaChecked) return _dbColumnMap;
        _dbSchemaChecked = true;
        _dbColumnMap = null;
        try {
            if (typeof db === 'undefined' || !db || typeof db.exec !== 'function') return null;
            const res = db.exec('SELECT * FROM fpl_data LIMIT 1');
            if (!res || !res[0] || !res[0].columns) return null;
            const cols = res[0].columns.map(function (c) { return String(c).toLowerCase(); });
            const find = function (candidates) {
                for (let i = 0; i < candidates.length; i++) if (cols.indexOf(candidates[i]) !== -1) return candidates[i];
                return null;
            };
            const map = {
                id: find(['element', 'player_id', 'id', 'fpl_id']),
                minutes: find(['minutes', 'mins']),
                goals: find(['goals_scored', 'goals']),
                assists: find(['assists']),
                order: find(['kickoff_time', 'date', 'round', 'gw'])
            };
            _dbColumnMap = (map.id && map.minutes) ? map : null;
        } catch (err) {
            _dbColumnMap = null;
        }
        return _dbColumnMap;
    }

    const _historicalPriorCache = {};
    function getHistoricalPlayerPrior(playerId) {
        if (_historicalPriorCache[playerId] !== undefined) return _historicalPriorCache[playerId];
        let result = null;
        try {
            const cm = detectDbSchema();
            if (cm && typeof db !== 'undefined' && db) {
                const idNum = parseInt(playerId, 10);
                if (isFinite(idNum)) {
                    const goalsCol = cm.goals || '0';
                    const assistsCol = cm.assists || '0';
                    const orderClause = cm.order ? (' ORDER BY ' + cm.order + ' DESC') : '';
                    const q = 'SELECT ' + cm.minutes + ' as m, ' + goalsCol + ' as g, ' + assistsCol + ' as a FROM fpl_data WHERE ' + cm.id + ' = ' + idNum + orderClause + ' LIMIT 76';
                    const res = db.exec(q);
                    if (res && res[0] && res[0].values && res[0].values.length > 0) {
                        let totalMin = 0, totalG = 0, totalA = 0, matchCount = 0, startCount = 0;
                        res[0].values.forEach(function (row) {
                            const m = safeNum(row[0], 0);
                            totalMin += m;
                            totalG += safeNum(row[1], 0);
                            totalA += safeNum(row[2], 0);
                            if (m > 0) matchCount++;
                            if (m >= 60) startCount++;
                        });
                        if (totalMin > 90 && matchCount > 0) {
                            result = {
                                matchCount: matchCount,
                                startRate: clamp(startCount / matchCount, 0, 1),
                                minsIfPlaying: clamp(totalMin / matchCount, 1, 90),
                                xG90Hist: totalG / (totalMin / 90),
                                xA90Hist: totalA / (totalMin / 90)
                            };
                        }
                    }
                }
            }
        } catch (err) {
            result = null;
        }
        _historicalPriorCache[playerId] = result;
        return result;
    }

    // ==========================================
    // Expected Minutes model (Part 4.1) — build before anything else touches the data.
    // Fixes: pure substitutes no longer get zeroed to 0 expected minutes; 0-minute players fall
    // back to historical/position priors instead of computing a meaningless 0/0 rate; chance_of_playing
    // now scales the PROBABILITY of featuring, not the duration once selected.
    // ==========================================
    function getExpectedMinutes(player, teamMatchesPlayed, historicalPrior, posPrior) {
        const minutes = safeNum(player.minutes, 0);
        const starts = safeNum(player.starts, 0);

        let cop = 1.0;
        if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
            cop = clamp(safeNum(player.chance_of_playing_next_round, 100) / 100, 0, 1);
        } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
            cop = clamp(safeNum(player.chance_of_playing_this_round, 100) / 100, 0, 1);
        }

        const priorStartRate = (historicalPrior && historicalPrior.startRate != null) ? historicalPrior.startRate : posPrior.startRate;
        const priorMinsIfPlaying = (historicalPrior && historicalPrior.minsIfPlaying != null) ? historicalPrior.minsIfPlaying : posPrior.minsIfPlaying;

        // No minutes at all this season: don't compute any current-season rate, use priors directly.
        if (minutes === 0) {
            const pStart0 = clamp(priorStartRate * cop, 0, 1);
            return buildAvailability(pStart0, priorMinsIfPlaying, cop, {
                evidence: 'none-fallback-to-prior', pSubIfBench: posPrior.subOnRate * cop, minsIfSubOn: posPrior.subOnMinutes
            });
        }

        const gamesForRateEstimate = Math.max(safeNum(teamMatchesPlayed, 0), starts, 1);
        const rawStartRate = clamp(starts / gamesForRateEstimate, 0, 1);
        const pStartBase = shrink(rawStartRate, priorStartRate, gamesForRateEstimate, CONFIG.k_start);
        const pStart = clamp(pStartBase * cop, 0, 1);

        let minsIfStarted;
        if (starts > 0) {
            const rawMinsPerStart = clamp(minutes / starts, 1, 90);
            minsIfStarted = shrink(rawMinsPerStart, priorMinsIfPlaying, starts, CONFIG.k_minutes_sub);
        } else {
            minsIfStarted = priorMinsIfPlaying;
        }

        let pSubIfBench, minsIfSubOn;
        if (starts === 0 && minutes > 0) {
            // All evidence so far is sub-on cameos.
            const estSubApps = Math.max(1, Math.round(minutes / CONFIG.assumedCameoMinutes));
            minsIfSubOn = clamp(minutes / estSubApps, 1, 45);
            pSubIfBench = shrink(1.0, posPrior.subOnRate, estSubApps, CONFIG.k_minutes_sub);
        } else {
            minsIfSubOn = posPrior.subOnMinutes;
            pSubIfBench = posPrior.subOnRate;
        }
        pSubIfBench = clamp(pSubIfBench * cop, 0, 1);

        return buildAvailability(pStart, minsIfStarted, cop, {
            evidence: 'current-season', pSubIfBench: pSubIfBench, minsIfSubOn: minsIfSubOn, starts: starts, minutes: minutes
        });
    }

    function buildAvailability(pStart, minsIfPlaying, cop, meta) {
        const pSubIfBench = meta.pSubIfBench != null ? meta.pSubIfBench : 0;
        const minsIfSubOn = meta.minsIfSubOn || 20;

        const expMins = clamp(pStart * minsIfPlaying + (1 - pStart) * pSubIfBench * minsIfSubOn, 0, 90);

        // Minute-bucket distribution (needed because appearance / CS / DEFCON / bonus are all
        // gated on the 60' line, not on the mean directly).
        const p60GivenStart = clamp((minsIfPlaying - 45) / 45, 0.05, 0.97);
        const p60GivenSub = minsIfSubOn >= 60 ? 0.5 : 0.02;

        const pSubOnAbs = (1 - pStart) * pSubIfBench;
        const p60plus = clamp(pStart * p60GivenStart + pSubOnAbs * p60GivenSub, 0, 1);
        const p0 = clamp(1 - pStart - pSubOnAbs, 0, 1);
        const p1_59 = clamp(1 - p0 - p60plus, 0, 1);

        return {
            p_start: pStart,
            minutes_if_playing: minsIfPlaying,
            expected_minutes: expMins,
            buckets: { p0: p0, p1_59: p1_59, p60plus: p60plus },
            chance_of_playing: cop,
            meta: meta
        };
    }

    // ==========================================
    // Team & opponent strength (Part 4.4) — real model built from pulseStandings.
    // attack_X > 1 means stronger-than-average attack; defense_X > 1 means leakier-than-average
    // defense (concedes more). Both increase an opponent's expected goals when multiplied in.
    // ==========================================
    function normalizeTeamName(name) {
        if (!name) return '';
        return String(name).toLowerCase()
            .replace(/football club|f\.?c\.?|afc|a\.?f\.?c\.?/g, '')
            .replace(/[^a-z]/g, '')
            .trim();
    }
    const _standingsResolveCache = {};
    const _standingsWarned = {};
    function resolveStandingsEntry(teamName, pulseRef) {
        if (!teamName) return null;
        const key = normalizeTeamName(teamName);
        if (_standingsResolveCache[key] !== undefined) return _standingsResolveCache[key];

        let result = null;
        try {
            const entries = pulseRef && pulseRef.tables && pulseRef.tables[0] && pulseRef.tables[0].entries;
            if (Array.isArray(entries)) {
                const candidatesOf = function (e) {
                    return [
                        e.team && e.team.name, e.team && e.team.shortName,
                        e.team && e.team.club && e.team.club.name,
                        e.teamName, e.name
                    ].filter(Boolean);
                };
                result = entries.find(function (e) {
                    return candidatesOf(e).some(function (c) { return normalizeTeamName(c) === key; });
                }) || null;
                if (!result) {
                    result = entries.find(function (e) {
                        return candidatesOf(e).some(function (c) {
                            const nc = normalizeTeamName(c);
                            return (nc.length > 2 && key.length > 2) && (nc.indexOf(key) !== -1 || key.indexOf(nc) !== -1);
                        });
                    }) || null;
                }
            }
        } catch (err) {
            result = null;
        }

        if (!result && !_standingsWarned[key]) {
            _standingsWarned[key] = true;
            if (typeof console !== 'undefined') {
                console.warn('[predictPoints_claude] Could not resolve pulseStandings entry for team "' + teamName + '" — using neutral league-average strength. Check the entry.team.name field mapping.');
            }
        }
        _standingsResolveCache[key] = result;
        return result;
    }

    let _leagueAvgCache = null;
    function computeLeagueAverages(pulseRef) {
        if (_leagueAvgCache) return _leagueAvgCache;
        const FALLBACK = { avgHomeGF: 1.5, avgAwayGF: 1.15 };
        try {
            const entries = pulseRef && pulseRef.tables && pulseRef.tables[0] && pulseRef.tables[0].entries;
            if (!Array.isArray(entries) || entries.length === 0) { _leagueAvgCache = FALLBACK; return FALLBACK; }
            let totalHomeGF = 0, totalHomeGames = 0, totalAwayGF = 0, totalAwayGames = 0;
            entries.forEach(function (e) {
                totalHomeGF += safeNum(e.home && e.home.goalsFor, 0);
                totalHomeGames += safeNum(e.home && e.home.played, 0);
                totalAwayGF += safeNum(e.away && e.away.goalsFor, 0);
                totalAwayGames += safeNum(e.away && e.away.played, 0);
            });
            _leagueAvgCache = {
                avgHomeGF: totalHomeGames > 0 ? totalHomeGF / totalHomeGames : FALLBACK.avgHomeGF,
                avgAwayGF: totalAwayGames > 0 ? totalAwayGF / totalAwayGames : FALLBACK.avgAwayGF
            };
        } catch (err) {
            _leagueAvgCache = FALLBACK;
        }
        return _leagueAvgCache;
    }

    const _teamStrengthCache = {};
    function computeTeamStrength(teamId, teamsRef, pulseRef) {
        if (_teamStrengthCache[teamId]) return _teamStrengthCache[teamId];
        const NEUTRAL = { attack_home: 1, defense_home: 1, attack_away: 1, defense_away: 1 };
        const meta = (teamsRef || []).find(function (t) { return t.id === teamId; });
        if (!meta) { _teamStrengthCache[teamId] = NEUTRAL; return NEUTRAL; }
        const entry = resolveStandingsEntry(meta.name, pulseRef);
        if (!entry) { _teamStrengthCache[teamId] = NEUTRAL; return NEUTRAL; }

        const lg = computeLeagueAverages(pulseRef);
        const homePlayed = safeNum(entry.home && entry.home.played, 0);
        const awayPlayed = safeNum(entry.away && entry.away.played, 0);
        const homeGF = safeNum(entry.home && entry.home.goalsFor, 0);
        const homeGA = safeNum(entry.home && entry.home.goalsAgainst, 0);
        const awayGF = safeNum(entry.away && entry.away.goalsFor, 0);
        const awayGA = safeNum(entry.away && entry.away.goalsAgainst, 0);

        const rawAttackHome = homePlayed > 0 ? (homeGF / homePlayed) / lg.avgHomeGF : 1;
        const rawDefenseHome = homePlayed > 0 ? (homeGA / homePlayed) / lg.avgAwayGF : 1;
        const rawAttackAway = awayPlayed > 0 ? (awayGF / awayPlayed) / lg.avgAwayGF : 1;
        const rawDefenseAway = awayPlayed > 0 ? (awayGA / awayPlayed) / lg.avgHomeGF : 1;

        const result = {
            attack_home: shrink(rawAttackHome, 1, homePlayed, CONFIG.k_team_strength),
            defense_home: shrink(rawDefenseHome, 1, homePlayed, CONFIG.k_team_strength),
            attack_away: shrink(rawAttackAway, 1, awayPlayed, CONFIG.k_team_strength),
            defense_away: shrink(rawDefenseAway, 1, awayPlayed, CONFIG.k_team_strength)
        };
        _teamStrengthCache[teamId] = result;
        return result;
    }

    function getTeamMatchesPlayed(teamId, teamsRef, pulseRef) {
        const meta = (teamsRef || []).find(function (t) { return t.id === teamId; });
        if (!meta) return 0;
        const entry = resolveStandingsEntry(meta.name, pulseRef);
        if (!entry) return 0;
        return safeNum(entry.home && entry.home.played, 0) + safeNum(entry.away && entry.away.played, 0);
    }

    function getFixtureContext(player, fixture, teamsRef, pulseRef) {
        const lg = computeLeagueAverages(pulseRef);
        const overallAvg = (lg.avgHomeGF + lg.avgAwayGF) / 2;

        if (!fixture) {
            return { isHome: true, attackMultiplier: 1, defenseWorkloadMultiplier: 1, lambdaTeamGoals: overallAvg, lambdaTeamConceded: overallAvg, fdrAdjPct: 0, oppName: null };
        }

        const isHome = player.team === fixture.team_h;
        const ownStrength = computeTeamStrength(player.team, teamsRef, pulseRef);
        const oppTeamId = isHome ? fixture.team_a : fixture.team_h;
        const oppStrength = computeTeamStrength(oppTeamId, teamsRef, pulseRef);

        let oppName = null;
        try {
            if (typeof getOpponentTeam === 'function') oppName = getOpponentTeam(player.team, fixture);
        } catch (err) { oppName = null; }

        let lambdaTeamGoals, lambdaTeamConceded;
        if (isHome) {
            lambdaTeamGoals = lg.avgHomeGF * ownStrength.attack_home * oppStrength.defense_away;
            lambdaTeamConceded = lg.avgAwayGF * oppStrength.attack_away * ownStrength.defense_home;
        } else {
            lambdaTeamGoals = lg.avgAwayGF * ownStrength.attack_away * oppStrength.defense_home;
            lambdaTeamConceded = lg.avgHomeGF * oppStrength.attack_home * ownStrength.defense_away;
        }

        // FDR used only as a small sanity nudge on top of the strength-model output, per spec Part 39.
        const fdrOwn = isHome ? safeNum(fixture.team_h_difficulty, 3) : safeNum(fixture.team_a_difficulty, 3);
        const fdrNudge = 1 + ((3 - fdrOwn) * CONFIG.fdr_nudge_weight);

        lambdaTeamGoals = Math.max(0.1, lambdaTeamGoals * fdrNudge);
        lambdaTeamConceded = Math.max(0.1, lambdaTeamConceded);

        return {
            isHome: isHome,
            attackMultiplier: lambdaTeamGoals / overallAvg,
            defenseWorkloadMultiplier: lambdaTeamConceded / overallAvg,
            lambdaTeamGoals: lambdaTeamGoals,
            lambdaTeamConceded: lambdaTeamConceded,
            fdrAdjPct: Math.round((fdrNudge - 1) * 100),
            oppName: oppName
        };
    }

    // ==========================================
    // Event probability / expected-points modules (Part 4.5–4.10)
    // ==========================================
    function calcAppearance(availability) {
        return availability.buckets.p1_59 * SCORING.appearance.bucket1_59 +
               availability.buckets.p60plus * SCORING.appearance.bucket60plus;
    }

    function calcGoalsAndAssists(player, availability, fixtureCtx, posPrior, pos, historicalPrior) {
        const matches90 = safeNum(player.minutes, 0) / 90;
        const xG90Now = safeNum(player.expected_goals_per_90, null);
        const xA90Now = safeNum(player.expected_assists_per_90, null);
        const histN = historicalPrior ? Math.min(safeNum(historicalPrior.matchCount, 0), CONFIG.maxHistoricalWeight) : 0;

        const layersG = [{ est: posPrior.xG90, n: CONFIG.priorPseudoN }];
        const layersA = [{ est: posPrior.xA90, n: CONFIG.priorPseudoN }];
        if (historicalPrior && historicalPrior.xG90Hist != null) layersG.push({ est: historicalPrior.xG90Hist, n: histN });
        if (historicalPrior && historicalPrior.xA90Hist != null) layersA.push({ est: historicalPrior.xA90Hist, n: histN });
        if (xG90Now != null) layersG.push({ est: xG90Now, n: Math.min(matches90, CONFIG.k_goals * 3) });
        if (xA90Now != null) layersA.push({ est: xA90Now, n: Math.min(matches90, CONFIG.k_assists * 3) });

        const shrunkXG90 = precisionBlend(layersG);
        const shrunkXA90 = precisionBlend(layersA);

        const exposure = availability.expected_minutes / 90;
        const lambdaGoals = Math.max(0, shrunkXG90 * fixtureCtx.attackMultiplier * exposure);
        const lambdaAssists = Math.max(0, shrunkXA90 * fixtureCtx.attackMultiplier * exposure);

        const goalPtsValue = SCORING.goals[pos] || SCORING.goals.MID;

        return {
            lambdaGoals: lambdaGoals,
            lambdaAssists: lambdaAssists,
            goalsPts: lambdaGoals * goalPtsValue,
            assistsPts: lambdaAssists * SCORING.assists
        };
    }

    // Clean sheet + goals conceded computed together so they always share one lambdaConceded.
    function calcCleanSheetAndConceded(player, availability, fixtureCtx, pos) {
        const lambdaConceded = fixtureCtx.lambdaTeamConceded;
        const csPtsValue = SCORING.clean_sheets[pos] || 0;

        let csPts = 0;
        if (csPtsValue > 0) {
            const pCS = poissonPMF(lambdaConceded, 0);
            csPts = pCS * availability.buckets.p60plus * csPtsValue;
        }

        let gcPts = 0;
        if (SCORING.goals_conceded.positions.indexOf(pos) !== -1) {
            // Exposure-prorated: a player on the pitch for half the match is exposed to roughly
            // half the team's expected goals against (goals conceded points are earned "while on
            // the pitch", not for the whole match the way clean sheets are).
            const exposureFraction = clamp(availability.expected_minutes / 90, 0, 1);
            const lambdaExposed = lambdaConceded * exposureFraction;
            const expectedDeduction = expectedStepValue(lambdaExposed, function (k) { return Math.floor(k / SCORING.goals_conceded.per_count); }, 12);
            gcPts = -expectedDeduction;
        }

        return { csPts: csPts, gcPts: gcPts, lambdaConceded: lambdaConceded };
    }

    function calcSaves(player, availability, fixtureCtx, posPrior, lambdaConceded) {
        if (getPosName(player) !== 'GK') return 0;

        const estSOTFaced = fixtureCtx.lambdaTeamConceded * CONFIG.sot_per_goal_ratio;
        let lambdaSaves = Math.max(0, estSOTFaced - lambdaConceded);

        // Personal shot-stopping skill adjustment from the keeper's own shrunk saves_per_90.
        const matches90 = safeNum(player.minutes, 0) / 90;
        const rawSaves90 = safeNum(player.saves_per_90, null);
        if (rawSaves90 != null && posPrior.saves90 > 0) {
            const shrunkSaves90 = shrink(rawSaves90, posPrior.saves90, matches90, CONFIG.k_saves);
            const skillMultiplier = clamp(shrunkSaves90 / posPrior.saves90, 0.7, 1.35);
            lambdaSaves *= skillMultiplier;
        }

        lambdaSaves *= clamp(availability.expected_minutes / 90, 0, 1);

        return expectedStepValue(lambdaSaves, function (k) { return Math.floor(k / SCORING.saves.per_count); }, 15) * SCORING.saves.points;
    }

    function calcDefCon(player, availability, fixtureCtx, posPrior, pos) {
        if (pos === 'GK') return 0;
        const threshold = (pos === 'DEF') ? SCORING.defcon.threshold_def : SCORING.defcon.threshold_mid_fwd;
        const matches90 = safeNum(player.minutes, 0) / 90;
        const raw90 = safeNum(player.defensive_contribution_per_90, null);
        const shrunk90 = raw90 != null ? shrink(raw90, posPrior.defcon90, matches90, CONFIG.k_defcon) : posPrior.defcon90;

        const lambda = Math.max(0, shrunk90 * fixtureCtx.defenseWorkloadMultiplier * (availability.expected_minutes / 90));
        return pAtLeast(lambda, threshold) * SCORING.defcon.points;
    }

    function calcBonus(player, availability, ga, csGc, defconPts, savesPts, pos) {
        const W = CONFIG.bpsWeights;
        const csProb = (SCORING.clean_sheets[pos] || 0) > 0 ? csGc.csPts / SCORING.clean_sheets[pos] : 0;
        const defconProb = defconPts > 0 ? defconPts / SCORING.defcon.points : 0;

        const proxy =
            W.goal * ga.lambdaGoals +
            W.assist * ga.lambdaAssists +
            W.cleanSheet * csProb * (pos === 'GK' || pos === 'DEF' ? 1 : 0.3) +
            W.defcon * defconProb +
            W.save * (savesPts / (SCORING.saves.points || 1)) +
            W.appearance * (availability.buckets.p60plus + 0.3 * availability.buckets.p1_59);

        const z = (proxy - CONFIG.bonusMidpoint) / CONFIG.bonusScale;
        const modelBonus = 3 / (1 + Math.exp(-z));

        const matches90 = safeNum(player.minutes, 0) / 90;
        const rawBonusPerMatch = matches90 > 0 ? safeNum(player.bonus, 0) / matches90 : 0;
        const histBonusPerMatch = shrink(rawBonusPerMatch, CONFIG.bonusPositionPrior[pos] || 0.3, matches90, CONFIG.k_bonus);

        return clamp(0.7 * modelBonus + 0.3 * histBonusPerMatch, 0, 3);
    }

    function calcCards(player, posPrior, availability) {
        const matches90 = safeNum(player.minutes, 0) / 90;
        const ycRaw = matches90 > 0 ? safeNum(player.yellow_cards, 0) / matches90 : posPrior.yellow90;
        const rcRaw = matches90 > 0 ? safeNum(player.red_cards, 0) / matches90 : posPrior.red90;
        const ycShrunk = shrink(ycRaw, posPrior.yellow90, matches90, CONFIG.k_cards);
        const rcShrunk = shrink(rcRaw, posPrior.red90, matches90, CONFIG.k_cards);
        const exposure = clamp(availability.expected_minutes / 90, 0, 1);
        return (ycShrunk * SCORING.cards.yellow + rcShrunk * SCORING.cards.red) * exposure;
    }

    function calcOwnGoals(player, posPrior, availability) {
        const matches90 = safeNum(player.minutes, 0) / 90;
        const ogRaw = matches90 > 0 ? safeNum(player.own_goals, 0) / matches90 : posPrior.og90;
        const ogShrunk = shrink(ogRaw, posPrior.og90, matches90, CONFIG.k_og);
        return -ogShrunk * 2 * clamp(availability.expected_minutes / 90, 0, 1);
    }

    // Penalty misses/saves — weak-signal proxy in the absence of an explicit "designated taker"
    // field. Populate PENALTY_TAKER_OVERRIDES with real team-news data for a materially better
    // estimate; this proxy only activates for players with direct historical evidence.
    function calcPenalties(player, availability, pos) {
        const matches90 = Math.max(0.01, safeNum(player.minutes, 0) / 90);
        const missedHist = safeNum(player.penalties_missed, 0);
        const savedHist = safeNum(player.penalties_saved, 0);
        const exposure = clamp(availability.expected_minutes / 90, 0, 1);

        let penMissPts = 0;
        const isLikelyTaker = PENALTY_TAKER_OVERRIDES[player.id] === true || missedHist > 0;
        if (isLikelyTaker) {
            const estPensPer90 = 0.06; // rough league-average team penalty-award rate
            const missRatePrior = 0.22; // rough league-average penalty miss rate
            const missRate = shrink(missedHist > 0 ? 1 : missRatePrior, missRatePrior, matches90, CONFIG.k_cards);
            penMissPts = -(estPensPer90 * missRate * exposure) * Math.abs(SCORING.penalties_missed);
        }

        let penSavePts = 0;
        if (pos === 'GK') {
            const estPensFacedPer90 = 0.05;
            const saveRatePrior = 0.20;
            const saveRate = shrink(savedHist > 0 ? 1 : saveRatePrior, saveRatePrior, matches90, CONFIG.k_cards);
            penSavePts = estPensFacedPer90 * saveRate * exposure * SCORING.penalties_saved;
        }

        return { penMissPts: penMissPts, penSavePts: penSavePts };
    }

    // ==========================================
    // Confidence + explainability
    // ==========================================
    function computeConfidence(player, availability, historicalPrior) {
        const minutes = safeNum(player.minutes, 0);
        let score = 0.3;
        score += clamp(minutes / 1200, 0, 0.35);
        score += historicalPrior ? 0.15 : 0;
        score += clamp(availability.p_start, 0, 1) * 0.2;
        score = clamp(score, 0, 1);
        let label = 'low';
        if (score >= 0.4) label = 'medium';
        if (score >= 0.7) label = 'high';
        return { score: score, label: label };
    }

    function buildExplainability(player, xPoints, availability, breakdown, fixtureAdjPct, confidence) {
        confidence = confidence || { score: 0.2, label: 'low' };
        const b = breakdown || {};
        const other = safeNum(b.own_goals, 0) + safeNum(b.pen_miss, 0) + safeNum(b.pen_save, 0);
        return {
            player_id: player.id,
            xPoints: round2(xPoints),
            expected_minutes: Math.round(clamp(availability.expected_minutes, 0, 90)),
            minutes_bucket_probs: {
                p0: round2(availability.buckets.p0),
                p1_59: round2(availability.buckets.p1_59),
                p60plus: round2(availability.buckets.p60plus)
            },
            breakdown: {
                appearance: round2(b.appearance),
                goals: round2(b.goals),
                assists: round2(b.assists),
                clean_sheet: round2(b.clean_sheet),
                defcon: round2(b.defcon),
                saves: round2(b.saves),
                bonus: round2(b.bonus),
                cards: round2(b.cards),
                goals_conceded: round2(b.goals_conceded),
                other: round2(other)
            },
            fixture_adjustment_pct: fixtureAdjPct || 0,
            confidence: confidence.label,
            confidence_score: round2(confidence.score),
            sample_sizes: { current_season_minutes: safeNum(player.minutes, 0) }
        };
    }

    function safeFallbackPrediction(player) {
        return {
            player_id: player ? player.id : null,
            xPoints: 0,
            expected_minutes: 0,
            minutes_bucket_probs: { p0: 1, p1_59: 0, p60plus: 0 },
            breakdown: { appearance: 0, goals: 0, assists: 0, clean_sheet: 0, defcon: 0, saves: 0, bonus: 0, cards: 0, goals_conceded: 0, other: 0 },
            fixture_adjustment_pct: 0,
            confidence: 'low',
            confidence_score: 0,
            sample_sizes: { current_season_minutes: player ? safeNum(player.minutes, 0) : 0 }
        };
    }

    // ==========================================
    // Core orchestration
    // ==========================================
    function computeCore(player, fixture) {
        if (!player) return safeFallbackPrediction(player);

        const allPlayersRef = (typeof allPlayers !== 'undefined') ? allPlayers : [];
        const teamsRef = (typeof teams !== 'undefined') ? teams : [];
        const pulseRef = (typeof pulseStandings !== 'undefined') ? pulseStandings : null;

        const priors = getPositionPriors(allPlayersRef);
        const pos = getPosName(player);
        const posPrior = priors[pos] || priors.MID;

        const teamMatchesPlayed = getTeamMatchesPlayed(player.team, teamsRef, pulseRef);
        const historicalPrior = getHistoricalPlayerPrior(player.id);

        const availability = getExpectedMinutes(player, teamMatchesPlayed, historicalPrior, posPrior);

        if (availability.expected_minutes <= 0.01) {
            return buildExplainability(player, 0, availability, {}, 0, computeConfidence(player, availability, historicalPrior));
        }

        const fixtureCtx = getFixtureContext(player, fixture, teamsRef, pulseRef);

        const breakdown = {};
        breakdown.appearance = calcAppearance(availability);

        const ga = calcGoalsAndAssists(player, availability, fixtureCtx, posPrior, pos, historicalPrior);
        breakdown.goals = ga.goalsPts;
        breakdown.assists = ga.assistsPts;

        const csGc = calcCleanSheetAndConceded(player, availability, fixtureCtx, pos);
        breakdown.clean_sheet = csGc.csPts;
        breakdown.goals_conceded = csGc.gcPts;

        breakdown.saves = calcSaves(player, availability, fixtureCtx, posPrior, csGc.lambdaConceded);
        breakdown.defcon = calcDefCon(player, availability, fixtureCtx, posPrior, pos);
        breakdown.bonus = calcBonus(player, availability, ga, csGc, breakdown.defcon, breakdown.saves, pos);
        breakdown.cards = calcCards(player, posPrior, availability);
        breakdown.own_goals = calcOwnGoals(player, posPrior, availability);

        const pens = calcPenalties(player, availability, pos);
        breakdown.pen_miss = pens.penMissPts;
        breakdown.pen_save = pens.penSavePts;

        let xPoints = 0;
        for (const key in breakdown) xPoints += safeNum(breakdown[key], 0);
        xPoints = clamp(xPoints, -5, 25); // sanity bound — no impossible predictions

        const confidence = computeConfidence(player, availability, historicalPrior);
        return buildExplainability(player, xPoints, availability, breakdown, fixtureCtx.fdrAdjPct, confidence);
    }

    // ==========================================
    // Router-facing entry points (names/signatures preserved exactly)
    // ==========================================
    function loadPredictionCache_claude() {
        if (predictionCache_claude === null) {
            try {
                const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('fpl_predictions_v5_claude') : null;
                predictionCache_claude = stored ? JSON.parse(stored) : {};
            } catch (e) {
                predictionCache_claude = {};
            }
        }
    }

    function getExpectedPoints_claude(player, fixture) {
        loadPredictionCache_claude();
        const cacheKey = player.id + '_' + (fixture ? fixture.id : 'no_fixture');
        const cached = predictionCache_claude[cacheKey];
        if (cached !== undefined && cached !== null) {
            return typeof cached === 'object' ? cached.xPoints : cached;
        }
        return '?';
    }

    function calculateExpectedPointsCore_claude(player, fixture) {
        try {
            return computeCore(player, fixture);
        } catch (err) {
            if (typeof console !== 'undefined') console.error('[predictPoints_claude] prediction failed, returning safe fallback:', err, player && player.id);
            return safeFallbackPrediction(player);
        }
    }

    function clearPredictionCache_claude() {
        predictionCache_claude = null;
        try { if (typeof localStorage !== 'undefined') localStorage.removeItem('fpl_predictions_v5_claude'); } catch (e) {}

        Object.keys(_teamStrengthCache).forEach(function (k) { delete _teamStrengthCache[k]; });
        Object.keys(_standingsResolveCache).forEach(function (k) { delete _standingsResolveCache[k]; });
        Object.keys(_standingsWarned).forEach(function (k) { delete _standingsWarned[k]; });
        Object.keys(_historicalPriorCache).forEach(function (k) { delete _historicalPriorCache[k]; });
        _leagueAvgCache = null;
        _positionPriorsCache = null;
        _positionPriorsCacheLen = -1;
        _dbSchemaChecked = false;
        _dbColumnMap = null;
    }

    // ==========================================
    // Optional: Monte Carlo single-realization sampler (Part 6 of spec).
    // Use this — NOT an inflated xPoints — to get the kind of week-to-week spread (e.g. 42 to 73
    // across a squad) you're describing. xPoints is a MEAN and should stay stable; real variance
    // only exists in a sampled realization or in actual results. Not called by the router; call it
    // yourself per player and sum across your XI to build a simulated gameweek-total distribution.
    // ==========================================
    function sampleBonusFromExpectation(expBonus) {
        const e = clamp(expBonus, 0, 3);
        if (Math.random() < e / 3) {
            if (Math.random() < e / 3) return 3;
            return Math.random() < 0.5 ? 2 : 1;
        }
        return 0;
    }

    function simulatePlayerPoints_claude(player, fixture, nSims) {
        nSims = nSims || 2000;
        try {
            const allPlayersRef = (typeof allPlayers !== 'undefined') ? allPlayers : [];
            const teamsRef = (typeof teams !== 'undefined') ? teams : [];
            const pulseRef = (typeof pulseStandings !== 'undefined') ? pulseStandings : null;

            const priors = getPositionPriors(allPlayersRef);
            const pos = getPosName(player);
            const posPrior = priors[pos] || priors.MID;
            const teamMatchesPlayed = getTeamMatchesPlayed(player.team, teamsRef, pulseRef);
            const historicalPrior = getHistoricalPlayerPrior(player.id);
            const availability = getExpectedMinutes(player, teamMatchesPlayed, historicalPrior, posPrior);

            if (availability.expected_minutes <= 0.01) {
                return { mean: 0, p10: 0, p25: 0, median: 0, p75: 0, p90: 0, n: nSims };
            }

            const fixtureCtx = getFixtureContext(player, fixture, teamsRef, pulseRef);
            const ga = calcGoalsAndAssists(player, availability, fixtureCtx, posPrior, pos, historicalPrior);
            const csGc = calcCleanSheetAndConceded(player, availability, fixtureCtx, pos);
            const defconPts = calcDefCon(player, availability, fixtureCtx, posPrior, pos);
            const savesPts = calcSaves(player, availability, fixtureCtx, posPrior, csGc.lambdaConceded);
            const expBonus = calcBonus(player, availability, ga, csGc, defconPts, savesPts, pos);

            const threshold = pos === 'DEF' ? SCORING.defcon.threshold_def : SCORING.defcon.threshold_mid_fwd;
            const matches90 = safeNum(player.minutes, 0) / 90;
            const rawDefcon90 = safeNum(player.defensive_contribution_per_90, null);
            const shrunkDefcon90 = rawDefcon90 != null ? shrink(rawDefcon90, posPrior.defcon90, matches90, CONFIG.k_defcon) : posPrior.defcon90;
            const lambdaDefcon = Math.max(0, shrunkDefcon90 * fixtureCtx.defenseWorkloadMultiplier);

            const ycRate = matches90 > 0 ? safeNum(player.yellow_cards, 0) / matches90 : posPrior.yellow90;

            const results = [];
            for (let i = 0; i < nSims; i++) {
                const r = Math.random();
                let scenario;
                if (r < availability.buckets.p0) scenario = 0;
                else if (r < availability.buckets.p0 + availability.buckets.p1_59) scenario = 1;
                else scenario = 2;

                if (scenario === 0) { results.push(0); continue; }

                let pts = (scenario === 1) ? SCORING.appearance.bucket1_59 : SCORING.appearance.bucket60plus;

                const g = samplePoisson(ga.lambdaGoals);
                const a = samplePoisson(ga.lambdaAssists);
                pts += g * (SCORING.goals[pos] || SCORING.goals.MID) + a * SCORING.assists;

                if (scenario === 2) {
                    const conceded = samplePoisson(csGc.lambdaConceded);
                    if (conceded === 0 && (SCORING.clean_sheets[pos] || 0) > 0) pts += SCORING.clean_sheets[pos];
                    if (SCORING.goals_conceded.positions.indexOf(pos) !== -1) pts -= Math.floor(conceded / SCORING.goals_conceded.per_count);

                    if (pos === 'GK') {
                        const estSOT = fixtureCtx.lambdaTeamConceded * CONFIG.sot_per_goal_ratio;
                        const saves = samplePoisson(Math.max(0, estSOT - csGc.lambdaConceded));
                        pts += Math.floor(saves / SCORING.saves.per_count) * SCORING.saves.points;
                    } else {
                        const defActs = samplePoisson(lambdaDefcon);
                        if (defActs >= threshold) pts += SCORING.defcon.points;
                    }

                    pts += sampleBonusFromExpectation(expBonus);
                }

                if (Math.random() < clamp(ycRate, 0, 1)) pts -= 1;

                results.push(pts);
            }

            results.sort(function (a, b) { return a - b; });
            const pct = function (p) { return results[clamp(Math.floor(p * results.length), 0, results.length - 1)]; };
            const mean = results.reduce(function (s, x) { return s + x; }, 0) / results.length;

            return { mean: round2(mean), p10: pct(0.10), p25: pct(0.25), median: pct(0.5), p75: pct(0.75), p90: pct(0.90), n: nSims };
        } catch (err) {
            if (typeof console !== 'undefined') console.error('[predictPoints_claude] simulation failed:', err, player && player.id);
            return { mean: 0, p10: 0, p25: 0, median: 0, p75: 0, p90: 0, n: 0 };
        }
    }

    // Expose only what the router / app needs — everything else stays private to this IIFE.
    const globalTarget = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
    globalTarget.getExpectedPoints_claude = getExpectedPoints_claude;
    globalTarget.calculateExpectedPointsCore_claude = calculateExpectedPointsCore_claude;
    globalTarget.clearPredictionCache_claude = clearPredictionCache_claude;
    globalTarget.simulatePlayerPoints_claude = simulatePlayerPoints_claude;
})();