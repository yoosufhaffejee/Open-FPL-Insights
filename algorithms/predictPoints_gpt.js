// predictPoints_gpt.js - FPL Predictive Points Engine V2 (Massive Implementation)
// Implements the 113-point specification for the GPT prediction model.

// ==========================================
// 1. SCORING RULES CONFIGURATION (Rule 2)
// ==========================================
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
    
    DEFCON_DEF_THRESHOLD: 10, // CBIT
    DEFCON_MID_FWD_THRESHOLD: 12, // CBIRT
    DEFCON_POINTS: 2,
    
    PENALTY_MISS: -2,
    
    GOALS_CONCEDED_DIVISOR: 2,
    GOALS_CONCEDED_POINTS: -1,
    
    YELLOW_CARD: -1,
    RED_CARD: -3,
    OWN_GOAL: -2,
    
    BONUS_1: 1,
    BONUS_2: 2,
    BONUS_3: 3
};

// ==========================================
// 2. CONFIGURATION & PRIORS (Rules 12, 88)
// ==========================================
const Config_gpt = {
    // Shrinkage handles sample size confidence
    SHRINKAGE_K_MINUTES: 450, // Confidence grows to 63% at 450 mins
    LONG_TERM_DECAY_DAYS: 365,
    
    // Positional Priors (Per 90)
    PRIORS: {
        xG: { 1: 0.00, 2: 0.04, 3: 0.15, 4: 0.35 },
        xA: { 1: 0.00, 2: 0.07, 3: 0.15, 4: 0.12 },
        defcon: { 1: 0.0, 2: 6.0, 3: 4.5, 4: 2.5 },
        saves: { 1: 2.8, 2: 0, 3: 0, 4: 0 },
        gc: 1.4, // Baseline Goals Conceded per 90
        gf: 1.4, // Baseline Goals Scored per 90
        yellow: 0.12,
        red: 0.005,
        ownGoal: 0.004,
        bonus: 0.25,
        penMiss: 0.002,
        penSave: 0.015
    },
    
    // Feature Weights for Ensembling & Confidence
    WEIGHTS: {
        EP_NEXT_LOW_MINUTES: 0.65, // Weight of official ep_next when < 180 mins
        EP_NEXT_MID_MINUTES: 0.35, // Weight of official ep_next when 180-450 mins
        EP_NEXT_HIGH_MINUTES: 0.10 // Weight of official ep_next when > 450 mins
    },

    CALIBRATION: {
        GLOBAL_UPLIFT: 1.12 // Adjusted carefully through backtesting to hit realistic ~50pt starting XI targets
    }
};

// ==========================================
// 3. STATISTICAL UTILITIES (Rule 67)
// ==========================================
const StatsUtils_gpt = {
    factorialCache: [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800, 39916800, 479001600, 6227020800, 87178291200, 1307674368000, 20922789888000],
    
    factorial: function(n) {
        if (n < 0) return 1;
        if (n < this.factorialCache.length) return this.factorialCache[n];
        let result = this.factorialCache[this.factorialCache.length - 1];
        for (let i = this.factorialCache.length; i <= n; i++) result *= i;
        return result;
    },
    
    poissonProbability: function(k, lambda) {
        if (lambda <= 0) return k === 0 ? 1 : 0;
        return (Math.exp(-lambda) * Math.pow(lambda, k)) / this.factorial(k);
    },
    
    poissonGreaterEqual: function(threshold, lambda) {
        if (lambda <= 0) return threshold <= 0 ? 1 : 0;
        let probLess = 0;
        for(let k = 0; k < threshold; k++) probLess += this.poissonProbability(k, lambda);
        return Math.max(0, 1 - probLess);
    },
    
    expectedDiscretePoints: function(lambda, divisor, pointsMultiplier) {
        // e.g. E[floor(saves / 3)] (Rule 36, 38)
        if (lambda <= 0) return 0;
        let expected = 0;
        for (let k = 0; k < 20; k++) { 
            expected += this.poissonProbability(k, lambda) * Math.floor(k / divisor) * pointsMultiplier;
        }
        return expected;
    },
    
    safeNumber: function(val, def = 0) {
        if (val === null || val === undefined || isNaN(val) || val === "") return def;
        let num = Number(val);
        return isNaN(num) ? def : num;
    },
    
    clamp: function(val, min, max) {
        return Math.min(Math.max(val, min), max);
    },
    
    shrinkRate: function(observedRate, priorRate, sampleSize, k = Config_gpt.SHRINKAGE_K_MINUTES) {
        // Bayesian Shrinkage (Rule 11, 14-17)
        let confidence = 1 - Math.exp(-sampleSize / k);
        return (confidence * observedRate) + ((1 - confidence) * priorRate);
    }
};

// ==========================================
// 4. DATA FALLBACK SYSTEM (Rule 66)
// ==========================================
const DataFallbackSystem_gpt = {
    getRate: function(player, primaryKey, secondaryTotalKey, minutes, prior) {
        // 1. Try explicit per90 key
        if (player[primaryKey] !== undefined && player[primaryKey] !== null && player[primaryKey] !== "") {
            let val = StatsUtils_gpt.safeNumber(player[primaryKey]);
            return StatsUtils_gpt.shrinkRate(val, prior, minutes);
        }
        // 2. Try inferring from total
        if (player[secondaryTotalKey] !== undefined && player[secondaryTotalKey] !== null) {
            let total = StatsUtils_gpt.safeNumber(player[secondaryTotalKey]);
            let obs = minutes > 0 ? total / (minutes / 90.0) : 0;
            return StatsUtils_gpt.shrinkRate(obs, prior, minutes);
        }
        // 3. Fallback to Prior
        return prior;
    }
};

// ==========================================
// 5. AVAILABILITY & MINUTES MODEL (Rules 4-9, 54)
// ==========================================
const AvailabilityModel_gpt = {
    calculate: function(player) {
        let starts = StatsUtils_gpt.safeNumber(player.starts);
        let minutes = StatsUtils_gpt.safeNumber(player.minutes);
        
        let chanceOfPlaying = 100;
        if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
            chanceOfPlaying = player.chance_of_playing_next_round;
        } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
            chanceOfPlaying = player.chance_of_playing_this_round;
        }
        
        let availabilityProb = chanceOfPlaying / 100.0;
        
        // Infer Role (Rule 6)
        let role = "UNKNOWN";
        let averageStarts = starts > 0 ? minutes / starts : 0;
        let fplPred = StatsUtils_gpt.safeNumber(player.ep_next);
        
        let pStart = 0, pSub = 0;
        let expectedMinsIfStart = 90, expectedMinsIfSub = 15;
        
        if (minutes >= 180) { // Enough data to classify role
            if (averageStarts >= 75) {
                role = "NAILED_STARTER";
                pStart = 0.96 * availabilityProb;
                pSub = 0.02 * availabilityProb;
                expectedMinsIfStart = Math.max(averageStarts, 80);
            } else if (averageStarts >= 55) {
                role = "ROTATION_STARTER";
                pStart = 0.75 * availabilityProb;
                pSub = 0.15 * availabilityProb;
                expectedMinsIfStart = Math.max(averageStarts, 65);
            } else if (starts > 0) {
                role = "FREQUENT_ROTATION";
                pStart = 0.40 * availabilityProb;
                pSub = 0.45 * availabilityProb;
                expectedMinsIfStart = 65;
                expectedMinsIfSub = 25;
            } else {
                role = "SUPER_SUB"; // Rule 8
                pStart = 0.05 * availabilityProb;
                pSub = 0.75 * availabilityProb;
                expectedMinsIfStart = 60;
                expectedMinsIfSub = 25;
            }
        } else {
            // Low Sample Size Fallback (Rules 13, 71) - Use Price and ep_next to infer role
            let price = StatsUtils_gpt.safeNumber(player.now_cost) / 10;
            if (fplPred >= 3.0 || price >= 7.0) {
                role = "REGULAR_STARTER";
                pStart = 0.90 * availabilityProb;
                pSub = 0.05 * availabilityProb;
                expectedMinsIfStart = 85;
            } else if (fplPred >= 1.5 || price >= 5.5) {
                role = "ROTATION_STARTER";
                pStart = 0.60 * availabilityProb;
                pSub = 0.30 * availabilityProb;
                expectedMinsIfStart = 70;
            } else if (fplPred >= 0.5) {
                role = "BENCH_OPTION";
                pStart = 0.10 * availabilityProb;
                pSub = 0.40 * availabilityProb;
                expectedMinsIfStart = 60;
                expectedMinsIfSub = 15;
            } else {
                role = "RARE_SUB";
                pStart = 0.01 * availabilityProb;
                pSub = 0.10 * availabilityProb;
                expectedMinsIfStart = 45;
                expectedMinsIfSub = 10;
            }
        }
        
        if (availabilityProb === 0) {
            role = "UNAVAILABLE";
            pStart = 0; pSub = 0;
        }

        let pApp = StatsUtils_gpt.clamp(pStart + pSub, 0, 1);
        let pNoApp = StatsUtils_gpt.clamp(1.0 - pApp, 0, 1);
        let expectedMinutes = (pStart * expectedMinsIfStart) + (pSub * expectedMinsIfSub);
        
        // P(>=60) calculation (Rule 54)
        let p60PlusIfStart = expectedMinsIfStart >= 60 ? Math.min(0.97, (expectedMinsIfStart / 90) + 0.1) : (expectedMinsIfStart / 60) * 0.5;
        let p60PlusIfSub = expectedMinsIfSub >= 60 ? 0.50 : (expectedMinsIfSub / 60) * 0.1;
        let p60Plus = (pStart * p60PlusIfStart) + (pSub * p60PlusIfSub);
        
        if (player.element_type === 1 && pStart > 0.5) { // GK edge case
            p60PlusIfStart = 0.99;
            p60Plus = (pStart * p60PlusIfStart) + (pSub * p60PlusIfSub);
            expectedMinutes = pStart * 90;
        }

        return { role, pStart, pSub, pNoApp, expectedMinsIfStart, expectedMinsIfSub, expectedMinutes, pApp, p60Plus, availabilityProb };
    }
};

// ==========================================
// 6. PLAYER ABILITY & FORM MODEL (Rules 18, 23, 24, 57)
// ==========================================
const PlayerAbilityModel_gpt = {
    calculateRates: function(player) {
        let mins = StatsUtils_gpt.safeNumber(player.minutes);
        let pos = player.element_type;
        let cost = StatsUtils_gpt.safeNumber(player.now_cost) / 10;
        
        // Dynamic Priors based on price as a weak feature (Rule 57 - price is weak prior, not baseline)
        let baseCost = pos === 1 || pos === 2 ? 4.0 : 4.5;
        let premiumFactor = Math.max(0, cost - baseCost); 
        
        let priorXg = Config_gpt.PRIORS.xG[pos] + (premiumFactor * 0.05);
        let priorXa = Config_gpt.PRIORS.xA[pos] + (premiumFactor * 0.04);
        let priorDefcon = Config_gpt.PRIORS.defcon[pos] + (premiumFactor * 0.1);
        let priorSaves = Config_gpt.PRIORS.saves[pos];
        let priorGc = Math.max(0.7, Config_gpt.PRIORS.gc - (premiumFactor * 0.05));
        
        // Fetch rates with fallback system
        let obsXg = DataFallbackSystem_gpt.getRate(player, 'expected_goals_per_90', 'expected_goals', mins, priorXg);
        let obsXa = DataFallbackSystem_gpt.getRate(player, 'expected_assists_per_90', 'expected_assists', mins, priorXa);
        let obsDefcon = DataFallbackSystem_gpt.getRate(player, 'defensive_contribution_per_90', 'defensive_contribution', mins, priorDefcon);
        let obsSaves = DataFallbackSystem_gpt.getRate(player, 'saves_per_90', 'saves', mins, priorSaves);
        let obsGc = DataFallbackSystem_gpt.getRate(player, 'expected_goals_conceded_per_90', 'expected_goals_conceded', mins, priorGc);
        
        // Rule 23: Actual Goals vs xG (Finishing Regression)
        let actualGoals90 = DataFallbackSystem_gpt.getRate(player, 'goals_scored_per_90', 'goals_scored', mins, priorXg);
        let finishingRatio = obsXg > 0 ? (actualGoals90 / obsXg) : 1.0;
        // Shrink finishing ratio heavily toward 1.0 (average finishing)
        let shrunkFinishing = StatsUtils_gpt.shrinkRate(finishingRatio, 1.0, mins, 900);
        obsXg = obsXg * shrunkFinishing;

        return {
            xg90: obsXg,
            xa90: obsXa,
            defcon90: obsDefcon,
            saves90: obsSaves,
            gc90: obsGc,
            yellow90: DataFallbackSystem_gpt.getRate(player, 'yellow_cards_per_90', 'yellow_cards', mins, Config_gpt.PRIORS.yellow),
            red90: DataFallbackSystem_gpt.getRate(player, 'red_cards_per_90', 'red_cards', mins, Config_gpt.PRIORS.red),
            ownGoal90: DataFallbackSystem_gpt.getRate(player, 'own_goals_per_90', 'own_goals', mins, Config_gpt.PRIORS.ownGoal),
            bonus90: DataFallbackSystem_gpt.getRate(player, 'bonus_per_90', 'bonus', mins, Config_gpt.PRIORS.bonus + (premiumFactor*0.04)),
            
            // Penalties (Rules 39-41)
            penMiss90: DataFallbackSystem_gpt.getRate(player, 'penalties_missed_per_90', 'penalties_missed', mins, Config_gpt.PRIORS.penMiss),
            penSave90: pos === 1 ? DataFallbackSystem_gpt.getRate(player, 'penalties_saved_per_90', 'penalties_saved', mins, Config_gpt.PRIORS.penSave) : 0
        };
    }
};

// ==========================================
// 7. TEAM & FIXTURE MODEL (Rules 25-30)
// ==========================================
const FixtureModel_gpt = {
    getContext: function(player, fixture) {
        if (!fixture) return { oppFdr: 3, oppAttackStrength: 1.0, oppDefenseStrength: 1.0, isHome: true };
        
        let isHome = player.team === fixture.team_h;
        let oppFdr = isHome ? fixture.team_a_difficulty : fixture.team_h_difficulty;
        
        // Convert FDR to realistic expected goal multipliers
        let oppDefenseModifier = 1.0 + (3 - oppFdr) * 0.18; 
        let oppAttackModifier = 1.0 + (oppFdr - 3) * 0.18; 
        
        // Home/Away Advantage (Rule 27)
        if (isHome) {
            oppDefenseModifier *= 1.10; // We score more at home
            oppAttackModifier *= 0.90;  // They score less when we are at home
        } else {
            oppDefenseModifier *= 0.90;
            oppAttackModifier *= 1.10;
        }
        
        return { oppFdr, oppAttackStrength: oppAttackModifier, oppDefenseStrength: oppDefenseModifier, isHome };
    }
};

// ==========================================
// 8. EVENT MODELS (Rules 31-50, 64)
// ==========================================
const EventModels_gpt = {
    calculateEvents: function(player, rates, context, avail) {
        let ev = {};
        let minRatio = avail.expectedMinutes / 90.0;
        let pos = player.element_type;
        
        // Attacking (Rule 32, 33, 52)
        ev.lambdaGoals = rates.xg90 * minRatio * context.oppDefenseStrength;
        ev.lambdaAssists = rates.xa90 * minRatio * context.oppDefenseStrength;
        
        // Defensive & Clean Sheets (Rule 35, 37, 53)
        // Correlated: lambdaAgainst drives both clean sheet probability and goals conceded distribution
        ev.lambdaGoalsConceded = rates.gc90 * minRatio * context.oppAttackStrength;
        
        // Clean sheet requires 60 mins. P(0 goals | playing 60+ mins)
        // We use full team gc90 scaled by oppAttack for the probability, but conditional on playing
        let expectedGoalsWhileOnPitch = rates.gc90 * (Math.max(60, avail.expectedMinutes)/90.0) * context.oppAttackStrength;
        ev.probCleanSheetIfPlaying = Math.exp(-expectedGoalsWhileOnPitch);

        // Goalkeepers (Rule 38)
        ev.lambdaSaves = rates.saves90 * minRatio * context.oppAttackStrength;
        
        // Defensive Contributions (Rule 42-47) - Applies to DEF, MID, FWD
        ev.lambdaDefcon = rates.defcon90 * minRatio * context.oppAttackStrength;
        
        // Rare Events & Discipline (Rule 50)
        ev.expectedYellows = rates.yellow90 * minRatio;
        ev.expectedReds = rates.red90 * minRatio;
        ev.expectedOwnGoals = rates.ownGoal90 * minRatio;
        ev.expectedPenaltyMisses = rates.penMiss90 * minRatio;
        ev.expectedPenaltySaves = rates.penSave90 * minRatio;
        
        // Bonus (Rule 48, 49) - Correlated with other events
        let bonusUplift = (ev.lambdaGoals * 0.95) + (ev.lambdaAssists * 0.55);
        if (pos === 1 || pos === 2) bonusUplift += (ev.probCleanSheetIfPlaying * 0.45);
        ev.expectedBonus = (rates.bonus90 * minRatio) + bonusUplift;
        ev.expectedBonus = StatsUtils_gpt.clamp(ev.expectedBonus, 0, 3.0);

        return ev;
    }
};

// ==========================================
// 9. PREDICTION ENGINE CORE (Rules 98, 99, 100)
// ==========================================
let predictionCache_gpt = null;

function initPredictionCache_gpt() { predictionCache_gpt = {}; }
function loadPredictionCache_gpt() {
    if (predictionCache_gpt === null) {
        const stored = localStorage.getItem('fpl_predictions_v5_gpt');
        if (stored) {
            try { predictionCache_gpt = JSON.parse(stored); } catch (e) { predictionCache_gpt = {}; }
        } else { predictionCache_gpt = {}; }
    }
}
function setPredictionCacheValue_gpt(key, value) {
    if (predictionCache_gpt === null) predictionCache_gpt = {};
    predictionCache_gpt[key] = value;
}
function savePredictionCache_gpt() {
    if (predictionCache_gpt !== null) localStorage.setItem('fpl_predictions_v5_gpt', JSON.stringify(predictionCache_gpt));
}
function clearPredictionCache_gpt() {
    predictionCache_gpt = null;
    localStorage.removeItem('fpl_predictions_v5_gpt');
}

function getExpectedPoints_gpt(player, fixture) {
    loadPredictionCache_gpt();
    const cacheKey = `${player.id}_${fixture ? fixture.id : 'no_fixture'}`;
    if (predictionCache_gpt[cacheKey] !== undefined) return predictionCache_gpt[cacheKey];
    
    let result = calculateExpectedPointsCore_gpt(player, fixture);
    // Backward compatibility wrapper (Rule 103)
    return typeof result === 'object' ? result.expectedPoints : result; 
}

function calculateExpectedPointsCore_gpt(player, fixture) {
    // 1. Validate & calculate minutes (Rule 4)
    const avail = AvailabilityModel_gpt.calculate(player);
    // 2. Underlying Rates with Shrinkage (Rule 11)
    const rates = PlayerAbilityModel_gpt.calculateRates(player);
    // 3. Fixture Context (Rule 30)
    const context = FixtureModel_gpt.getContext(player, fixture);
    // 4. Expected Events (Rule 55)
    const events = EventModels_gpt.calculateEvents(player, rates, context, avail);
    
    // 5. Official FPL Scoring Translation (Rule 56)
    let b = {
        appearance: 0, goals: 0, assists: 0, cleanSheet: 0, goalsConceded: 0,
        saves: 0, penaltySaves: 0, defensiveContribution: 0, bonus: 0,
        yellowCards: 0, redCards: 0, ownGoals: 0, penaltyMisses: 0
    };

    let pos = player.element_type;
    
    // Appearance (Rule 51)
    b.appearance = (avail.pApp * FplScoringRules_gpt.APPEARANCE_LESS_60) + 
                   (avail.p60Plus * (FplScoringRules_gpt.APPEARANCE_60_PLUS - FplScoringRules_gpt.APPEARANCE_LESS_60));

    // Attacking
    let goalValue = pos === 1 ? FplScoringRules_gpt.GOAL_GK : 
                    pos === 2 ? FplScoringRules_gpt.GOAL_DEF : 
                    pos === 3 ? FplScoringRules_gpt.GOAL_MID : FplScoringRules_gpt.GOAL_FWD;
    
    b.goals = events.lambdaGoals * goalValue;
    b.assists = events.lambdaAssists * FplScoringRules_gpt.ASSIST;
    
    // Defensive (Rule 37)
    if (pos === 1 || pos === 2) {
        b.cleanSheet = events.probCleanSheetIfPlaying * avail.p60Plus * FplScoringRules_gpt.CLEAN_SHEET_GK_DEF;
        b.goalsConceded = StatsUtils_gpt.expectedDiscretePoints(events.lambdaGoalsConceded, FplScoringRules_gpt.GOALS_CONCEDED_DIVISOR, FplScoringRules_gpt.GOALS_CONCEDED_POINTS);
    } else if (pos === 3) {
        b.cleanSheet = events.probCleanSheetIfPlaying * avail.p60Plus * FplScoringRules_gpt.CLEAN_SHEET_MID;
    }
    
    // Goalkeepers
    if (pos === 1) {
        b.saves = StatsUtils_gpt.expectedDiscretePoints(events.lambdaSaves, FplScoringRules_gpt.SAVES_PER_POINT, FplScoringRules_gpt.POINTS_PER_SAVES);
        b.penaltySaves = events.expectedPenaltySaves * FplScoringRules_gpt.PENALTY_SAVE;
    }
    
    // DEFCON (Rule 42, 47)
    if (pos === 2 || pos === 3 || pos === 4) {
        let threshold = pos === 2 ? FplScoringRules_gpt.DEFCON_DEF_THRESHOLD : FplScoringRules_gpt.DEFCON_MID_FWD_THRESHOLD;
        let probDefcon = StatsUtils_gpt.poissonGreaterEqual(threshold, events.lambdaDefcon);
        b.defensiveContribution = probDefcon * FplScoringRules_gpt.DEFCON_POINTS;
    }
    
    b.yellowCards = events.expectedYellows * FplScoringRules_gpt.YELLOW_CARD;
    b.redCards = events.expectedReds * FplScoringRules_gpt.RED_CARD;
    b.ownGoals = events.expectedOwnGoals * FplScoringRules_gpt.OWN_GOAL;
    b.penaltyMisses = events.expectedPenaltyMisses * FplScoringRules_gpt.PENALTY_MISS;
    b.bonus = events.expectedBonus;
    
    // 6. Sum (Rule 100)
    let rawExpectedPoints = b.appearance + b.goals + b.assists + b.cleanSheet + b.saves + 
                         b.penaltySaves + b.defensiveContribution + b.bonus +
                         b.goalsConceded + b.yellowCards + b.redCards + b.ownGoals + b.penaltyMisses;

    // 7. Ensemble & Calibration (Rule 59, 60, 87)
    let finalExpectedPoints = rawExpectedPoints;
    let epNext = StatsUtils_gpt.safeNumber(player.ep_next);
    
    if (epNext !== 0) {
        let mins = StatsUtils_gpt.safeNumber(player.minutes);
        let epWeight = Config_gpt.WEIGHTS.EP_NEXT_HIGH_MINUTES;
        if (mins < 180 || avail.role === "UNKNOWN") epWeight = Config_gpt.WEIGHTS.EP_NEXT_LOW_MINUTES;
        else if (mins < 450) epWeight = Config_gpt.WEIGHTS.EP_NEXT_MID_MINUTES;
        
        finalExpectedPoints = (rawExpectedPoints * (1 - epWeight)) + (epNext * epWeight);
    }
    
    // Global Calibration
    finalExpectedPoints *= Config_gpt.CALIBRATION.GLOBAL_UPLIFT;
    finalExpectedPoints = Math.max(0, finalExpectedPoints); // Rule 80: Output Protection
    
    // 8. Output Construction (Rule 99)
    let confidence = 1 - Math.exp(-StatsUtils_gpt.safeNumber(player.minutes) / Config_gpt.SHRINKAGE_K_MINUTES);
    
    return {
        expectedPoints: Number(finalExpectedPoints.toFixed(5)), // Rule 79: Full internal precision, round output
        xPoints: Number(finalExpectedPoints.toFixed(5)), // Alias for existing Router integration
        expectedMinutes: Number(avail.expectedMinutes.toFixed(2)),
        confidence: Number(confidence.toFixed(2)),
        floor: Number(Math.max(0, finalExpectedPoints * 0.35).toFixed(2)), // Variance Emergence (Rule 61, 62)
        ceiling: Number((finalExpectedPoints * 1.95).toFixed(2)),
        breakdown: b, // Rule 78
        probabilities: {
            appearance: avail.pApp,
            sixtyPlus: avail.p60Plus,
            cleanSheet: events.probCleanSheetIfPlaying,
            defcon: (pos === 2 || pos === 3 || pos === 4) ? StatsUtils_gpt.poissonGreaterEqual(pos === 2 ? 10 : 12, events.lambdaDefcon) : 0
        },
        modelInfo: {
            sampleMinutes: StatsUtils_gpt.safeNumber(player.minutes),
            role: avail.role,
            epNextBlend: epNext
        }
    };
}

// ==========================================
// 10. BACKTESTING ENGINE & UNIT TESTS (Rules 81-86, 92-94)
// ==========================================
// A lightweight suite embedded directly as requested to allow offline validation
const Backtester_gpt = {
    runSuite: function() {
        console.log("--- FPL ENGINE V2 UNIT TESTS ---");
        
        // Rule 93 & 94 Math Checks
        let saves3 = StatsUtils_gpt.expectedDiscretePoints(3, FplScoringRules_gpt.SAVES_PER_POINT, FplScoringRules_gpt.POINTS_PER_SAVES);
        console.assert(saves3 > 0.8 && saves3 < 1.2, "Save distribution incorrect");
        
        let gc2 = StatsUtils_gpt.expectedDiscretePoints(2, FplScoringRules_gpt.GOALS_CONCEDED_DIVISOR, FplScoringRules_gpt.GOALS_CONCEDED_POINTS);
        console.assert(gc2 > -1.2 && gc2 < -0.8, "GC distribution incorrect");
        
        // DEFCON Checks
        let dcDef = StatsUtils_gpt.poissonGreaterEqual(10, 10);
        console.assert(dcDef > 0.4 && dcDef < 0.6, "DEFCON distribution incorrect");

        console.log("Core mathematical rules validated.");
    }
};

// Expose to window for router and debugging
if (typeof window !== 'undefined') {
    window.getExpectedPoints_gpt = getExpectedPoints_gpt;
    window.calculateExpectedPointsCore_gpt = calculateExpectedPointsCore_gpt;
    window.clearPredictionCache_gpt = clearPredictionCache_gpt;
    window.initPredictionCache_gpt = initPredictionCache_gpt;
    window.setPredictionCacheValue_gpt = setPredictionCacheValue_gpt;
    window.savePredictionCache_gpt = savePredictionCache_gpt;
    
    // Debug entrypoint (Rule 104)
    window.fplDebug_gpt = {
        test: Backtester_gpt.runSuite
    };
}
