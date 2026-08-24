// predictPoints_gpt.js - FPL Predictive Points Engine V2

const FplScoringRules_gpt = {
    APPEARANCE_LESS_60: 1,
    APPEARANCE_60_PLUS: 2,
    GOAL_GK: 10,
    GOAL_DEF: 6,
    GOAL_MID: 5,
    GOAL_FWD: 4,
    ASSIST: 3,
    CLEAN_SHEET_GK_DEF: 4,
    CLEAN_SHEET_MID: 1,
    SAVES_PER_POINT: 3,
    POINTS_PER_SAVES: 1,
    PENALTY_SAVE: 5,
    DEFCON_DEF_THRESHOLD: 10,
    DEFCON_MID_FWD_THRESHOLD: 12,
    DEFCON_POINTS: 2,
    PENALTY_MISS: -2,
    GOALS_CONCEDED_DIVISOR: 2,
    GOALS_CONCEDED_POINTS: -1,
    YELLOW_CARD: -1,
    RED_CARD: -3,
    OWN_GOAL: -2
};

const Config_gpt = {
    SHRINKAGE_K_MINUTES: 450, // Confidence curve constant
    PRIOR_XG_90_FWD: 0.40,
    PRIOR_XG_90_MID: 0.15,
    PRIOR_XG_90_DEF: 0.05,
    PRIOR_XG_90_GK: 0.00,
    PRIOR_XA_90_FWD: 0.15,
    PRIOR_XA_90_MID: 0.15,
    PRIOR_XA_90_DEF: 0.10,
    PRIOR_XA_90_GK: 0.00,
    PRIOR_SAVES_90: 2.5,
    PRIOR_DEFCON_90_DEF: 6.0,
    PRIOR_DEFCON_90_MID: 4.0,
    PRIOR_DEFCON_90_FWD: 2.0,
    PRIOR_YELLOW_90: 0.15,
    PRIOR_RED_90: 0.005,
    PRIOR_OWN_GOAL_90: 0.005,
    PRIOR_BONUS_90: 0.25,
    PRIOR_GC_90: 1.5 // Expected goals conceded per 90 baseline
};

const StatsUtils_gpt = {
    factorial: function(n) {
        if (n === 0 || n === 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
    },
    poissonProbability: function(k, lambda) {
        if (lambda <= 0) return k === 0 ? 1 : 0;
        // e^-lambda * lambda^k / k!
        return (Math.exp(-lambda) * Math.pow(lambda, k)) / this.factorial(k);
    },
    poissonGreaterEqual: function(threshold, lambda) {
        if (lambda <= 0) return 0;
        let probLess = 0;
        for(let k = 0; k < threshold; k++){
            probLess += this.poissonProbability(k, lambda);
        }
        return Math.max(0, 1 - probLess);
    },
    expectedDiscretePoints: function(lambda, divisor, pointsMultiplier) {
        if (lambda <= 0) return 0;
        let expected = 0;
        // Summing up to 20 is sufficient for FPL discrete scoring decay
        for (let k = 0; k < 20; k++) {
            expected += this.poissonProbability(k, lambda) * Math.floor(k / divisor) * pointsMultiplier;
        }
        return expected;
    },
    safeNumber: function(val, def = 0) {
        if (val === null || val === undefined || isNaN(val)) return def;
        return Number(val);
    },
    clamp: function(val, min, max) {
        return Math.min(Math.max(val, min), max);
    },
    shrinkRate: function(observedRate, priorRate, sampleSize, k = Config_gpt.SHRINKAGE_K_MINUTES) {
        let confidence = 1 - Math.exp(-sampleSize / k);
        return (confidence * observedRate) + ((1 - confidence) * priorRate);
    }
};

const AvailabilityModel_gpt = {
    calculateExpectedMinutes: function(player) {
        let starts = StatsUtils_gpt.safeNumber(player.starts);
        let minutes = StatsUtils_gpt.safeNumber(player.minutes);
        
        let chanceOfPlaying = 100;
        if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
            chanceOfPlaying = player.chance_of_playing_next_round;
        } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
            chanceOfPlaying = player.chance_of_playing_this_round;
        }
        
        let availabilityProb = chanceOfPlaying / 100;
        let role = "UNKNOWN";
        let averageStarts = starts > 0 ? minutes / starts : 0;
        
        let pStart = 0, pSub = 0;
        let expectedMinsIfStart = 90, expectedMinsIfSub = 15;
        
        if (minutes >= 270 && starts > 0) {
            if (averageStarts >= 80) {
                role = "NAILED_STARTER";
                pStart = 0.90 * availabilityProb;
                pSub = 0.05 * availabilityProb;
                expectedMinsIfStart = averageStarts;
            } else if (averageStarts >= 60) {
                role = "ROTATION_STARTER";
                pStart = 0.70 * availabilityProb;
                pSub = 0.20 * availabilityProb;
                expectedMinsIfStart = averageStarts;
            } else {
                role = "SUPER_SUB";
                pStart = 0.15 * availabilityProb;
                pSub = 0.60 * availabilityProb;
                expectedMinsIfStart = 60;
                expectedMinsIfSub = 25;
            }
        } else {
            let fplPred = StatsUtils_gpt.safeNumber(player.ep_next);
            if (fplPred > 3.0) {
                role = "REGULAR_STARTER";
                pStart = 0.85 * availabilityProb;
                pSub = 0.10 * availabilityProb;
                expectedMinsIfStart = 85;
            } else if (fplPred > 1.5) {
                role = "ROTATION_STARTER";
                pStart = 0.50 * availabilityProb;
                pSub = 0.30 * availabilityProb;
                expectedMinsIfStart = 65;
            } else {
                role = "BENCH_OPTION";
                pStart = 0.10 * availabilityProb;
                pSub = 0.30 * availabilityProb;
                expectedMinsIfStart = 60;
                expectedMinsIfSub = 15;
            }
        }
        
        if (availabilityProb === 0) {
            role = "UNAVAILABLE";
            pStart = 0; pSub = 0;
        }

        let pNoApp = StatsUtils_gpt.clamp(1.0 - (pStart + pSub), 0, 1);
        let expectedMinutes = (pStart * expectedMinsIfStart) + (pSub * expectedMinsIfSub);
        
        // P(>=60 minutes) logic
        let p60PlusIfStart = expectedMinsIfStart >= 60 ? 0.85 : (expectedMinsIfStart / 60) * 0.5;
        let p60PlusIfSub = expectedMinsIfSub >= 60 ? 0.50 : 0.05;
        let p60Plus = (pStart * p60PlusIfStart) + (pSub * p60PlusIfSub);
        let pApp = pStart + pSub;
        
        return {
            role,
            pStart, pSub, pNoApp,
            expectedMinsIfStart, expectedMinsIfSub,
            expectedMinutes,
            pApp, p60Plus,
            availabilityProb
        };
    }
};

const PlayerAbilityModel_gpt = {
    calculateRates: function(player) {
        let mins = StatsUtils_gpt.safeNumber(player.minutes);
        let pos = player.element_type;
        
        let priorXg = pos===4 ? Config_gpt.PRIOR_XG_90_FWD : pos===3 ? Config_gpt.PRIOR_XG_90_MID : pos===2 ? Config_gpt.PRIOR_XG_90_DEF : Config_gpt.PRIOR_XG_90_GK;
        let priorXa = pos===4 ? Config_gpt.PRIOR_XA_90_FWD : pos===3 ? Config_gpt.PRIOR_XA_90_MID : pos===2 ? Config_gpt.PRIOR_XA_90_DEF : Config_gpt.PRIOR_XA_90_GK;
        let priorDefcon = pos===2 ? Config_gpt.PRIOR_DEFCON_90_DEF : pos===3 ? Config_gpt.PRIOR_DEFCON_90_MID : pos===4 ? Config_gpt.PRIOR_DEFCON_90_FWD : 0;
        let priorSaves = pos===1 ? Config_gpt.PRIOR_SAVES_90 : 0;
        
        let obsXg = mins > 0 ? StatsUtils_gpt.safeNumber(player.expected_goals) / (mins/90) : 0;
        if (player.expected_goals_per_90) obsXg = StatsUtils_gpt.safeNumber(player.expected_goals_per_90);
        
        let obsXa = mins > 0 ? StatsUtils_gpt.safeNumber(player.expected_assists) / (mins/90) : 0;
        if (player.expected_assists_per_90) obsXa = StatsUtils_gpt.safeNumber(player.expected_assists_per_90);
        
        let obsDefcon = mins > 0 ? StatsUtils_gpt.safeNumber(player.defensive_contribution_per_90) : 0;
        let obsSaves = mins > 0 ? StatsUtils_gpt.safeNumber(player.saves_per_90) : 0;
        
        let obsGc = mins > 0 ? StatsUtils_gpt.safeNumber(player.expected_goals_conceded_per_90) : Config_gpt.PRIOR_GC_90;
        
        return {
            xg90: StatsUtils_gpt.shrinkRate(obsXg, priorXg, mins),
            xa90: StatsUtils_gpt.shrinkRate(obsXa, priorXa, mins),
            defcon90: StatsUtils_gpt.shrinkRate(obsDefcon, priorDefcon, mins),
            saves90: StatsUtils_gpt.shrinkRate(obsSaves, priorSaves, mins),
            gc90: StatsUtils_gpt.shrinkRate(obsGc, Config_gpt.PRIOR_GC_90, mins),
            yellow90: StatsUtils_gpt.shrinkRate(mins>0?StatsUtils_gpt.safeNumber(player.yellow_cards)/(mins/90):0, Config_gpt.PRIOR_YELLOW_90, mins),
            red90: StatsUtils_gpt.shrinkRate(mins>0?StatsUtils_gpt.safeNumber(player.red_cards)/(mins/90):0, Config_gpt.PRIOR_RED_90, mins),
            ownGoal90: StatsUtils_gpt.shrinkRate(mins>0?StatsUtils_gpt.safeNumber(player.own_goals)/(mins/90):0, Config_gpt.PRIOR_OWN_GOAL_90, mins),
            bonus90: StatsUtils_gpt.shrinkRate(mins>0?StatsUtils_gpt.safeNumber(player.bonus)/(mins/90):0, Config_gpt.PRIOR_BONUS_90, mins),
            penMiss90: mins>0?StatsUtils_gpt.safeNumber(player.penalties_missed)/(mins/90):0,
            penSave90: mins>0?StatsUtils_gpt.safeNumber(player.penalties_saved)/(mins/90):0
        };
    }
};

const FixtureModel_gpt = {
    getContext: function(player, fixture) {
        if (!fixture) return { oppFdr: 3, oppAttackStrength: 1.0, oppDefenseStrength: 1.0 };
        
        let isHome = player.team === fixture.team_h;
        let oppFdr = isHome ? fixture.team_a_difficulty : fixture.team_h_difficulty;
        
        // Convert FDR to a modifier.
        // FDR 2 (easy opponent): they concede more (defense weak), they score less (attack weak)
        let oppDefenseStrength = 1.0 + (3 - oppFdr) * 0.15; // FDR 2 -> 1.15 multiplier for our attackers
        let oppAttackStrength = 1.0 + (oppFdr - 3) * 0.15; // FDR 5 -> 1.30 multiplier for their attackers
        
        // Home advantage
        if (isHome) {
            oppDefenseStrength *= 1.05;
            oppAttackStrength *= 0.95;
        } else {
            oppDefenseStrength *= 0.95;
            oppAttackStrength *= 1.05;
        }
        
        return { oppFdr, oppAttackStrength, oppDefenseStrength };
    }
};

const EventModels_gpt = {
    calculateEvents: function(player, rates, context, avail) {
        let ev = {};
        
        // Expected Event Rates conditional on expected minutes
        let minRatio = avail.expectedMinutes / 90.0;
        
        // Attacking
        ev.lambdaGoals = rates.xg90 * minRatio * context.oppDefenseStrength;
        ev.lambdaAssists = rates.xa90 * minRatio * context.oppDefenseStrength;
        
        // Defensive
        ev.lambdaGoalsConceded = rates.gc90 * minRatio * context.oppAttackStrength;
        // Clean sheet probability is primarily derived from team lambda against, but conditional on playing
        ev.probCleanSheetIfPlaying = Math.exp(-(rates.gc90 * context.oppAttackStrength));
        
        // GK Saves
        ev.lambdaSaves = rates.saves90 * minRatio * context.oppAttackStrength;
        
        // Defcon
        ev.lambdaDefcon = rates.defcon90 * minRatio * context.oppAttackStrength;
        
        // Rare events (linear expectation is fine here as they are extremely rare)
        ev.expectedYellows = rates.yellow90 * minRatio;
        ev.expectedReds = rates.red90 * minRatio;
        ev.expectedOwnGoals = rates.ownGoal90 * minRatio;
        ev.expectedPenaltyMisses = rates.penMiss90 * minRatio;
        ev.expectedPenaltySaves = rates.penSave90 * minRatio;
        ev.expectedBonus = rates.bonus90 * minRatio;

        return ev;
    }
};

let predictionCache_gpt = null;

function loadPredictionCache_gpt() {
    if (predictionCache_gpt === null) {
        const stored = localStorage.getItem('fpl_predictions_v5_gpt');
        if (stored) {
            try {
                predictionCache_gpt = JSON.parse(stored);
            } catch (e) {
                predictionCache_gpt = {};
            }
        } else {
            predictionCache_gpt = {};
        }
    }
}

function initPredictionCache_gpt() {
    predictionCache_gpt = {};
}

function setPredictionCacheValue_gpt(key, value) {
    if (predictionCache_gpt === null) {
        predictionCache_gpt = {};
    }
    predictionCache_gpt[key] = value;
}

function savePredictionCache_gpt() {
    if (predictionCache_gpt !== null) {
        localStorage.setItem('fpl_predictions_v5_gpt', JSON.stringify(predictionCache_gpt));
    }
}

function clearPredictionCache_gpt() {
    predictionCache_gpt = null;
    localStorage.removeItem('fpl_predictions_v5_gpt');
}

function getExpectedPoints_gpt(player, fixture) {
    loadPredictionCache_gpt();
    const cacheKey = `${player.id}_${fixture ? fixture.id : 'no_fixture'}`;
    if (predictionCache_gpt[cacheKey] !== undefined) {
        return predictionCache_gpt[cacheKey];
    }
    
    // Fallback if not cached: calculate directly
    let result = calculateExpectedPointsCore_gpt(player, fixture);
    // Add backward compatible numeric return type handling if callers expect a number
    return typeof result === 'object' ? result.expectedPoints : result; 
}

function calculateExpectedPointsCore_gpt(player, fixture) {
    // 1. Validate & calculate availability/minutes
    const avail = AvailabilityModel_gpt.calculateExpectedMinutes(player);
    
    // 2. Underlying Rates with Bayesian Shrinkage
    const rates = PlayerAbilityModel_gpt.calculateRates(player);
    
    // 3. Fixture Context
    const context = FixtureModel_gpt.getContext(player, fixture);
    
    // 4. Expected Event Distributions
    const events = EventModels_gpt.calculateEvents(player, rates, context, avail);
    
    // 5. Apply FPL Scoring Rules
    let b = {
        appearance: 0,
        goals: 0,
        assists: 0,
        cleanSheet: 0,
        goalsConceded: 0,
        saves: 0,
        penaltySaves: 0,
        defensiveContribution: 0,
        bonus: 0,
        yellowCards: 0,
        redCards: 0,
        ownGoals: 0,
        penaltyMisses: 0
    };

    // Appearance points (Probabilistic)
    b.appearance = (avail.pApp * FplScoringRules_gpt.APPEARANCE_LESS_60) + 
                   (avail.p60Plus * (FplScoringRules_gpt.APPEARANCE_60_PLUS - FplScoringRules_gpt.APPEARANCE_LESS_60));

    // Attacking points
    let pos = player.element_type;
    let goalValue = pos===1 ? FplScoringRules_gpt.GOAL_GK : 
                    pos===2 ? FplScoringRules_gpt.GOAL_DEF : 
                    pos===3 ? FplScoringRules_gpt.GOAL_MID : FplScoringRules_gpt.GOAL_FWD;
    
    b.goals = events.lambdaGoals * goalValue;
    b.assists = events.lambdaAssists * FplScoringRules_gpt.ASSIST;
    
    // Defensive points
    if (pos === 1 || pos === 2) {
        // GK & DEF: Clean sheet and GC deductions
        b.cleanSheet = events.probCleanSheetIfPlaying * avail.p60Plus * FplScoringRules_gpt.CLEAN_SHEET_GK_DEF;
        b.goalsConceded = StatsUtils_gpt.expectedDiscretePoints(events.lambdaGoalsConceded, FplScoringRules_gpt.GOALS_CONCEDED_DIVISOR, FplScoringRules_gpt.GOALS_CONCEDED_POINTS);
    } else if (pos === 3) {
        // MID: Clean sheet only (1 point)
        b.cleanSheet = events.probCleanSheetIfPlaying * avail.p60Plus * FplScoringRules_gpt.CLEAN_SHEET_MID;
    }
    
    // Goalkeeper specific
    if (pos === 1) {
        b.saves = StatsUtils_gpt.expectedDiscretePoints(events.lambdaSaves, FplScoringRules_gpt.SAVES_PER_POINT, FplScoringRules_gpt.POINTS_PER_SAVES);
    }
    
    // DEFCON
    if (pos === 2 || pos === 3 || pos === 4) {
        let threshold = pos === 2 ? FplScoringRules_gpt.DEFCON_DEF_THRESHOLD : FplScoringRules_gpt.DEFCON_MID_FWD_THRESHOLD;
        let probDefcon = StatsUtils_gpt.poissonGreaterEqual(threshold, events.lambdaDefcon);
        b.defensiveContribution = probDefcon * FplScoringRules_gpt.DEFCON_POINTS;
    }
    
    // Other actions
    b.penaltySaves = events.expectedPenaltySaves * FplScoringRules_gpt.PENALTY_SAVE;
    b.penaltyMisses = events.expectedPenaltyMisses * FplScoringRules_gpt.PENALTY_MISS;
    b.yellowCards = events.expectedYellows * FplScoringRules_gpt.YELLOW_CARD;
    b.redCards = events.expectedReds * FplScoringRules_gpt.RED_CARD;
    b.ownGoals = events.expectedOwnGoals * FplScoringRules_gpt.OWN_GOAL;
    b.bonus = events.expectedBonus;
    
    // 6. Sum Expected Points
    let expectedPoints = b.appearance + b.goals + b.assists + b.cleanSheet + b.saves + 
                         b.penaltySaves + b.defensiveContribution + b.bonus +
                         b.goalsConceded + b.yellowCards + b.redCards + b.ownGoals + b.penaltyMisses;
                         
    // Clamp to non-negative realistically unless they genuinely project negative
    expectedPoints = Math.max(0, expectedPoints);
    
    // 7. Confidence Score
    let confidence = 1 - Math.exp(-StatsUtils_gpt.safeNumber(player.minutes) / Config_gpt.SHRINKAGE_K_MINUTES);
    
    // 8. Output object
    return {
        expectedPoints: Number(expectedPoints.toFixed(5)),
        xPoints: Number(expectedPoints.toFixed(5)), // Alias for data.js compatibility
        expectedMinutes: Number(avail.expectedMinutes.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        floor: Number(Math.max(0, expectedPoints * 0.4).toFixed(2)),
        ceiling: Number((expectedPoints * 1.8).toFixed(2)),
        breakdown: b,
        probabilities: {
            appearance: avail.pApp,
            sixtyPlus: avail.p60Plus,
            cleanSheet: events.probCleanSheetIfPlaying,
            defcon: (pos === 2 || pos === 3 || pos === 4) ? StatsUtils_gpt.poissonGreaterEqual(pos === 2 ? 10 : 12, events.lambdaDefcon) : 0
        },
        modelInfo: {
            sampleMinutes: StatsUtils_gpt.safeNumber(player.minutes),
            role: avail.role
        }
    };
}

// Attach to window or module exports depending on environment so Router can use it
if (typeof window !== 'undefined') {
    window.getExpectedPoints_gpt = getExpectedPoints_gpt;
    window.calculateExpectedPointsCore_gpt = calculateExpectedPointsCore_gpt;
    window.clearPredictionCache_gpt = clearPredictionCache_gpt;
    window.initPredictionCache_gpt = initPredictionCache_gpt;
    window.setPredictionCacheValue_gpt = setPredictionCacheValue_gpt;
    window.savePredictionCache_gpt = savePredictionCache_gpt;
}
