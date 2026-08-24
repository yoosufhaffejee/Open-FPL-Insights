// predictPoints_claude.js
// Entrypoint for the Claude model of Expected Points

// Fallback scoring config (Part 3)
const SCORING = {
    appearance: {
        bucket1_59: 1,
        bucket60plus: 2
    },
    goals: {
        GK: 10,
        DEF: 6,
        MID: 5,
        FWD: 4
    },
    assists: 3,
    clean_sheets: {
        GK: 4,
        DEF: 4,
        MID: 1,
        FWD: 0
    },
    saves: {
        per_count: 3,
        points: 1
    },
    penalties_saved: 5,
    penalties_missed: -2,
    goals_conceded: {
        per_count: 2,
        points: -1,
        positions: [1, 2] // GK, DEF
    },
    cards: {
        yellow: -1,
        red: -3
    },
    own_goals: -2,
    defcon: {
        points: 2,
        threshold_def: 10,
        threshold_mid_fwd: 12
    },
    bonus: [3, 2, 1]
};

// Config for Shrinkage & Credibility (Part 4.2)
// These k-values should be tuned by backtest
const CONFIG = {
    k_start: 3.0,
    k_minutes_sub: 5.0,
    k_goals: 15.0, // Rare, needs more evidence
    k_assists: 15.0,
    k_saves: 8.0,
    k_defcon: 5.0, // High volume
    k_cards: 25.0, // Very rare
    k_bonus: 20.0
};

let predictionCache_claude = null;

function loadPredictionCache_claude() {
    if (predictionCache_claude === null) {
        const stored = localStorage.getItem('fpl_predictions_v5_claude');
        if (stored) {
            try {
                predictionCache_claude = JSON.parse(stored);
            } catch (e) {
                predictionCache_claude = {};
            }
        } else {
            predictionCache_claude = {};
        }
    }
}

function clearPredictionCache_claude() {
    predictionCache_claude = null;
    localStorage.removeItem('fpl_predictions_v5_claude');
}

function getExpectedPoints_claude(player, fixture) {
    loadPredictionCache_claude();
    const cacheKey = `${player.id}_${fixture ? fixture.id : 'no_fixture'}`;
    const cached = predictionCache_claude[cacheKey];
    if (cached !== undefined) {
        return typeof cached === 'object' ? cached.xPoints : cached;
    }
    return '?';
}

function calculateExpectedPointsCore_claude(player, fixture, allPlayers, teams, pulseStandings) {
    // 1. Availability Model
    const availability = getExpectedMinutes(player);
    if (availability.expected_minutes === 0) {
        return buildExplainability(player, 0, availability, {}, {}, 0);
    }
    
    // 2. Team & Opponent Strength
    // (mocking this out for now until we have real data sources hooked up)
    const teamContext = { attack: 1.0, defense: 1.0 };
    const oppContext = { attack: 1.0, defense: 1.0, possession: 0.5 };
    
    // 3. Expected Events
    const breakdown = {
        appearance: calculateAppearance(availability),
        goals: calculateGoals(player, availability, teamContext, oppContext),
        assists: calculateAssists(player, availability, teamContext, oppContext),
        clean_sheet: calculateCleanSheet(player, availability, teamContext, oppContext),
        defcon: calculateDefCon(player, availability, oppContext),
        saves: calculateSaves(player, availability, teamContext, oppContext),
        bonus: calculateBonus(player, availability, teamContext, oppContext),
        cards: calculateCards(player, availability),
        goals_conceded: calculateGoalsConceded(player, availability, oppContext),
        pen_miss: calculatePenaltyMiss(player, availability)
    };
    
    let xPoints = 0;
    for (const key in breakdown) {
        xPoints += breakdown[key];
    }
    
    return buildExplainability(player, xPoints, availability, breakdown, teamContext, 0);
}

// ==========================================
// MODULES (Inline for now to avoid cross-origin module import issues in browser)
// ==========================================

// --- Math & Distributions ---
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function poissonPMF(lambda, k) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function pAtLeast(lambda, threshold) {
    let pLess = 0;
    for (let k = 0; k < threshold; k++) {
        pLess += poissonPMF(lambda, k);
    }
    return 1 - pLess;
}

// --- Shrinkage ---
function credibilityWeight(n, k) {
    return n / (n + k);
}

function shrink(observed, prior, n, k) {
    const w = credibilityWeight(n, k);
    return observed * w + prior * (1 - w);
}

// --- Availability ---
function getExpectedMinutes(player) {
    let cop = 1.0;
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
        cop = player.chance_of_playing_next_round / 100;
    } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
        cop = player.chance_of_playing_this_round / 100;
    }

    const avgMinutes = player.starts === 0 ? 0 : player.minutes / player.starts;
    let expMins = avgMinutes * cop;
    
    if (expMins > 90) expMins = 90;
    
    // Bucket probs
    let p0 = 1 - cop;
    let p60plus = (expMins >= 60) ? (expMins / 90) * cop : 0.1 * cop;
    let p1_59 = 1 - p0 - p60plus;
    if (p1_59 < 0) p1_59 = 0;

    return {
        expected_minutes: expMins,
        buckets: { p0, p1_59, p60plus }
    };
}

// --- Events ---
function calculateAppearance(availability) {
    return (availability.buckets.p1_59 * SCORING.appearance.bucket1_59) + 
           (availability.buckets.p60plus * SCORING.appearance.bucket60plus);
}

function calculateGoals(player, availability, teamCtx, oppCtx) {
    const pos = player.element_type;
    let pts = SCORING.goals.FWD;
    if (pos === 1) pts = SCORING.goals.GK;
    if (pos === 2) pts = SCORING.goals.DEF;
    if (pos === 3) pts = SCORING.goals.MID;
    
    const xG90 = player.expected_goals_per_90 ? parseFloat(player.expected_goals_per_90) : 0;
    const prior = 0.05; // Fallback prior
    const matches = player.minutes / 90;
    
    const shrunk_xG90 = shrink(xG90, prior, matches, CONFIG.k_goals);
    const lambda = shrunk_xG90 * teamCtx.attack * oppCtx.defense * (availability.expected_minutes / 90);
    return lambda * pts;
}

function calculateAssists(player, availability, teamCtx, oppCtx) {
    const xA90 = player.expected_assists_per_90 ? parseFloat(player.expected_assists_per_90) : 0;
    const prior = 0.05; 
    const matches = player.minutes / 90;
    
    const shrunk_xA90 = shrink(xA90, prior, matches, CONFIG.k_assists);
    const lambda = shrunk_xA90 * teamCtx.attack * oppCtx.defense * (availability.expected_minutes / 90);
    return lambda * SCORING.assists;
}

function calculateCleanSheet(player, availability, teamCtx, oppCtx) {
    const pos = player.element_type;
    let pts = 0;
    if (pos === 1 || pos === 2) pts = SCORING.clean_sheets.GK;
    if (pos === 3) pts = SCORING.clean_sheets.MID;
    if (pts === 0) return 0;
    
    const opp_xG = oppCtx.attack * teamCtx.defense * 1.5; // baseline 1.5 goals
    const pCS = poissonPMF(opp_xG, 0);
    return pCS * availability.buckets.p60plus * pts;
}

function calculateGoalsConceded(player, availability, oppCtx) {
    const pos = player.element_type;
    if (!SCORING.goals_conceded.positions.includes(pos)) return 0;
    
    const opp_xG = oppCtx.attack * 1.5; 
    let expectedDeduction = 0;
    
    for (let k = 2; k <= 10; k++) {
        expectedDeduction += poissonPMF(opp_xG, k) * Math.floor(k / 2);
    }
    
    return -(expectedDeduction * (1 - availability.buckets.p0));
}

function calculateDefCon(player, availability, oppCtx) {
    const pos = player.element_type;
    if (pos === 1) return 0; // GK not eligible
    
    const threshold = (pos === 2) ? SCORING.defcon.threshold_def : SCORING.defcon.threshold_mid_fwd;
    const rawRate = player.defensive_contribution_per_90 ? parseFloat(player.defensive_contribution_per_90) : 0;
    const matches = player.minutes / 90;
    const prior = (pos === 2) ? 8.0 : 4.0;
    
    const shrunkRate = shrink(rawRate, prior, matches, CONFIG.k_defcon);
    const lambda = shrunkRate * oppCtx.possession * (availability.expected_minutes / 90);
    
    const pDefCon = pAtLeast(lambda, threshold);
    return pDefCon * SCORING.defcon.points;
}

function calculateSaves(player, availability, teamCtx, oppCtx) {
    if (player.element_type !== 1) return 0;
    
    const oppSOT = oppCtx.attack * 4.5; // Baseline 4.5 SOT
    const oppGoals = oppCtx.attack * teamCtx.defense * 1.5;
    const lambda_saves = Math.max(0, oppSOT - oppGoals);
    
    let expectedSavePoints = 0;
    for (let k = 3; k <= 15; k++) {
        expectedSavePoints += poissonPMF(lambda_saves, k) * Math.floor(k / 3);
    }
    
    return expectedSavePoints * SCORING.saves.points * (1 - availability.buckets.p0);
}

function calculateBonus(player, availability, teamCtx, oppCtx) {
    const rawRate = player.bonus ? player.bonus / (player.minutes / 90 || 1) : 0;
    const shrunkRate = shrink(rawRate, 0.1, player.minutes / 90, CONFIG.k_bonus);
    return shrunkRate * (availability.expected_minutes / 90);
}

function calculateCards(player, availability) {
    const ycRate = player.yellow_cards ? player.yellow_cards / (player.minutes / 90 || 1) : 0;
    const shrunkYC = shrink(ycRate, 0.15, player.minutes / 90, CONFIG.k_cards);
    
    const rcRate = player.red_cards ? player.red_cards / (player.minutes / 90 || 1) : 0;
    const shrunkRC = shrink(rcRate, 0.01, player.minutes / 90, CONFIG.k_cards);
    
    return (shrunkYC * SCORING.cards.yellow + shrunkRC * SCORING.cards.red) * (availability.expected_minutes / 90);
}

function calculatePenaltyMiss(player, availability) {
    return 0;
}

// --- Explainability ---
function buildExplainability(player, xPoints, availability, breakdown, sampleSizes, fixtureAdjustment) {
    let confScore = 0.5; // Baseline
    confScore += Math.min(1.0, (player.minutes || 0) / 900) * 0.3; // Up to 0.3 from minutes
    confScore *= (availability.buckets.p0 > 0.5 ? 0.5 : 1.0); // Penalty for low starting prob
    
    let confStr = "low";
    if (confScore > 0.4) confStr = "medium";
    if (confScore > 0.7) confStr = "high";

    return {
        player_id: player.id,
        xPoints: parseFloat(xPoints.toFixed(2)),
        expected_minutes: Math.round(availability.expected_minutes),
        minutes_bucket_probs: {
            p0: parseFloat(availability.buckets.p0.toFixed(2)),
            p1_59: parseFloat(availability.buckets.p1_59.toFixed(2)),
            p60plus: parseFloat(availability.buckets.p60plus.toFixed(2))
        },
        breakdown: {
            appearance: parseFloat((breakdown.appearance || 0).toFixed(2)),
            goals: parseFloat((breakdown.goals || 0).toFixed(2)),
            assists: parseFloat((breakdown.assists || 0).toFixed(2)),
            clean_sheet: parseFloat((breakdown.clean_sheet || 0).toFixed(2)),
            defcon: parseFloat((breakdown.defcon || 0).toFixed(2)),
            saves: parseFloat((breakdown.saves || 0).toFixed(2)),
            bonus: parseFloat((breakdown.bonus || 0).toFixed(2)),
            cards: parseFloat((breakdown.cards || 0).toFixed(2)),
            goals_conceded: parseFloat((breakdown.goals_conceded || 0).toFixed(2)),
            other: parseFloat(((breakdown.pen_miss || 0)).toFixed(2))
        },
        fixture_adjustment_pct: fixtureAdjustment,
        confidence: confStr,
        confidence_score: parseFloat(confScore.toFixed(2)),
        sample_sizes: {
            current_season_minutes: player.minutes || 0
        }
    };
}
