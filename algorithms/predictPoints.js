const startingPoints = 1;
const goalPointsGK = 10;
const goalPointsDEF = 6;
const goalPointsMID = 5;
const goalPointsFWD = 4;
const assistPoints = 3;
const cleanSheetPoints = 4;
const cleanSheetPointsMID = 1;
const sixtyMinutesPlayedPoints = 1;
const yellowCardPointsDeduction = 1;
const redCardPointsDeduction = 3;
const ownGoalPointsDeduction = 2;
const penaltyMissPointsDeduction = 2;
const twoGoalsConcededPointsDeduction = 2;
const threeShotsSavedPoints = 1;
const penaltySavedPoints = 5;
const bonusPoints1 = 1;
const bonusPoints2 = 2;
const bonusPoints3 = 3;

let predictionCache = null;

function loadPredictionCache() {
    if (predictionCache === null) {
        const stored = localStorage.getItem('fpl_predictions_v5');
        if (stored) {
            try {
                predictionCache = JSON.parse(stored);
            } catch (e) {
                predictionCache = {};
            }
        } else {
            predictionCache = {};
        }
    }
}

function clearPredictionCache() {
    predictionCache = null;
    localStorage.removeItem('fpl_predictions_v5');
}

function getExpectedPoints(player, fixture) {
    loadPredictionCache();
    const cacheKey = `${player.id}_${fixture ? fixture.id : 'no_fixture'}`;
    if (predictionCache[cacheKey] !== undefined) {
        return predictionCache[cacheKey];
    }
    return '?';
}

function calculateExpectedPointsCore(player, fixture) {
    let expectedPoints = 0;
    expectedPoints += startingPoints;

    let minutes_per_90 = player.starts == 0 ? 0 : player.minutes / player.starts;
    if (minutes_per_90 >= 60) {
        expectedPoints += sixtyMinutesPlayedPoints;
    }

    let own_goals_per_90 = player.own_goals == 0 ? 0 : player.own_goals / (player.minutes / 90);
    expectedPoints -= (ownGoalPointsDeduction * own_goals_per_90);

    let yellow_cards_per_90 = player.yellow_cards == 0 ? 0 : player.yellow_cards / (player.minutes / 90);
    expectedPoints -= (yellowCardPointsDeduction * yellow_cards_per_90);

    let red_cards_per_90 = player.red_cards == 0 ? 0 : player.red_cards / (player.minutes / 90);
    expectedPoints -= (redCardPointsDeduction * red_cards_per_90);

    let bonus_per_90 = player.bonus == 0 ? 0 : player.bonus / (player.minutes / 90);
    expectedPoints += bonus_per_90;

    let penalties = player.penalties_saved == 0 ? 0 : player.penalties_saved + player.penalties_missed;
    let penaltiesPer90 = penalties / (player.minutes / 90);

    let assistsPer90 = player.expected_assists_per_90 !== undefined && player.expected_assists_per_90 !== 0 ? parseFloat(player.expected_assists_per_90) : 0;
    expectedPoints += assistsPer90 * assistPoints;

    // Defensive Contribution Points (DEF and MID only)
    if (player.element_type === 2 || player.element_type === 3) {
        let defConPer90 = parseFloat(player.defensive_contribution_per_90);
        if (!isNaN(defConPer90) && defConPer90 > 0) {
            // Defenders need 10 actions, Mid need 12 actions
            let threshold = (player.element_type === 2) ? 10 : 12;
            // Approximate the probability of hitting the threshold in a single match
            let prob = Math.pow(defConPer90 / threshold, 2) * 0.5;
            if (prob > 0.95) prob = 0.95; // Cap at 95% certainty (1.9 points)
            expectedPoints += (prob * 2); // 2 points awarded
        }
    }

    if (player.element_type === 1) {
        // Goalkeeper
        let cleanSheetPointsPer90 = player.clean_sheets_per_90 !== undefined && player.clean_sheets_per_90 !== 0 ? player.clean_sheets_per_90 * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let savePointsPer90 = player.saves_per_90 !== undefined && player.saves_per_90 !== 0 ? player.saves_per_90 * (threeShotsSavedPoints / 3) : 0;
        expectedPoints += savePointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? parseFloat(player.expected_goals_conceded_per_90) / 2 : 0;
        expectedPoints -= goalsConcededPointsPer90;
    
        let penaltiesSavedPer90 = player.penalties_saved !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_saved / (player.minutes / 90) : 0;
        let penaltySavePointsPer90 = penaltiesSavedPer90 * penaltySavedPoints;
        expectedPoints += penaltySavePointsPer90;
    
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsGK : 0;
        expectedPoints += goalPointsPer90;
    }
    
    if (player.element_type === 2) {
        // Defender
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsDEF : 0;
        expectedPoints += goalPointsPer90;
    
        let cleanSheetPointsPer90 = player.clean_sheets_per_90 !== undefined && player.clean_sheets_per_90 !== 0 ? player.clean_sheets_per_90 * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? parseFloat(player.expected_goals_conceded_per_90) / 2 : 0;
        expectedPoints -= goalsConcededPointsPer90;
    }
    
    if (player.element_type === 3) {
        // Midfielder
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsMID : 0;
        expectedPoints += goalPointsPer90;
    
        let cleanSheetPointsPer90 = player.clean_sheets_per_90 !== undefined && player.clean_sheets_per_90 !== 0 ? player.clean_sheets_per_90 * cleanSheetPointsMID : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        correctPenaltiesOrder(player, allPlayers);
    
        let penaltiesMissedPer90 = player.penalties_missed !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_missed / (player.minutes / 90) : 0;
        let penaltyMissPointsPer90 = penaltiesMissedPer90 * penaltyMissPointsDeduction;
        expectedPoints -= penaltyMissPointsPer90;
    }
    
    if (player.element_type === 4) {
        // Forward
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsFWD : 0;
        expectedPoints += goalPointsPer90;
    
        correctPenaltiesOrder(player, allPlayers);
    
        let penaltiesMissedPer90 = player.penalties_missed !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_missed / (player.minutes / 90) : 0;
        let penaltyMissPointsPer90 = penaltiesMissedPer90 * penaltyMissPointsDeduction;
        expectedPoints -= penaltyMissPointsPer90;
    }

    let lastFiveData = getLastFive(player, fixture);
    if(lastFiveData.averagePoints > 0 && lastFiveData.count > 0) {
        let formWeight = Math.min(lastFiveData.count, 5) * 0.1;
        expectedPoints = (expectedPoints * (1 - formWeight)) + (lastFiveData.averagePoints * formWeight);
    }

    // Incorporate chance of playing
    let chanceOfPlaying = 100;
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
        chanceOfPlaying = player.chance_of_playing_next_round;
    } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
        chanceOfPlaying = player.chance_of_playing_this_round;
    }
    expectedPoints = expectedPoints * (chanceOfPlaying / 100);

    
    // Regress to mean for small sample sizes (less than 3 full games played) to prevent early-season anomalies
    if (player.minutes !== undefined && player.minutes < 270) {
        let weight = player.minutes / 270;
        
        // Use price as a proxy for expected performance baseline early in the season
        let cost = player.now_cost / 10;
        let baseline = cost * 0.65; // e.g., 10.0m -> 6.5 pts, 5.0m -> 3.25 pts, 4.0m -> 2.6 pts
        
        // If FPL model explicitly predicts this player will blank (e.g., bench warmer, injured), trust it
        let fplPred = parseFloat(player.ep_next);
        if (!isNaN(fplPred) && fplPred < 1.0) {
            baseline = fplPred;
        } else if (!isNaN(fplPred) && player.minutes === 0) {
            // For brand new players who haven't played a minute, blend price baseline with FPL prediction
            baseline = (baseline * 0.5) + (fplPred * 0.5);
        }
        
        expectedPoints = (expectedPoints * weight) + (baseline * (1 - weight));
    }
    
    // Apply Fixture Difficulty Multiplier and Pulse Live Standings Blend
    if (fixture) {
        let fdr = 3;
        if (player.team === fixture.team_h) fdr = fixture.team_h_difficulty;
        else if (player.team === fixture.team_a) fdr = fixture.team_a_difficulty;
        
        let fdrMultiplier = 1.0;
        if (fdr === 1) fdrMultiplier = 1.30;
        else if (fdr === 2) fdrMultiplier = 1.15;
        else if (fdr === 3) fdrMultiplier = 1.00;
        else if (fdr === 4) fdrMultiplier = 0.85;
        else if (fdr === 5) fdrMultiplier = 0.70;
        
        let finalMultiplier = fdrMultiplier;

        // Try to fetch Pulse Live Standings to blend real-time stats
        if (typeof pulseStandings !== 'undefined' && pulseStandings && pulseStandings.tables && typeof teams !== 'undefined') {
            let oppTeamId = (player.team === fixture.team_h) ? fixture.team_a : fixture.team_h;
            let oppTeamFPL = teams.find(t => t.id === oppTeamId);
            
            if (oppTeamFPL) {
                let oppPulseEntry = pulseStandings.tables[0].entries.find(e => e.team.name === oppTeamFPL.name || e.team.club.abbr === oppTeamFPL.short_name);
                
                if (oppPulseEntry) {
                    // Check if opponent is playing Home or Away this fixture
                    let oppStats = (player.team === fixture.team_h) ? oppPulseEntry.away : oppPulseEntry.home;
                    
                    if (oppStats && oppStats.played >= 3) {
                        let pulseMultiplier = 1.0;
                        if (player.element_type === 1 || player.element_type === 2) {
                            // GK/DEF: We care about Opponent's Goals FOR (how lethal are they?)
                            let oppGF = oppStats.goalsFor / oppStats.played;
                            pulseMultiplier = 1.0 + (1.5 - oppGF) * 0.3; 
                        } else {
                            // MID/FWD: We care about Opponent's Goals AGAINST (how leaky are they?)
                            let oppGA = oppStats.goalsAgainst / oppStats.played;
                            pulseMultiplier = 1.0 + (oppGA - 1.5) * 0.3;
                        }
                        
                        // Bound multiplier to sane limits
                        pulseMultiplier = Math.max(0.70, Math.min(1.30, pulseMultiplier));
                        
                        // 60% Pulse Live real-time stats, 40% FPL FDR
                        finalMultiplier = (pulseMultiplier * 0.6) + (fdrMultiplier * 0.4);
                    }
                }
            }
        }
        
        expectedPoints = expectedPoints * finalMultiplier;
    }

    // Blend with FPL's ep_next at 15% weight to smooth outliers without dragging down our aggressive model too much
    const fplPred = parseFloat(player.ep_next);
    if (!isNaN(fplPred) && fplPred > 0) {
        expectedPoints = (expectedPoints * 0.85) + (fplPred * 0.15);
    }
    
    // Add bump to overall team expected points to reach ~60 average
    // Apply this AFTER the FPL blend so the conservative FPL score doesn't undo the bump
    expectedPoints = expectedPoints * 1.25;
    
    return expectedPoints;
}

function getLastFive(player, fixture) {
    const playerName = player.first_name + " " + player.second_name;
    
    if (!db) return { averagePoints: 0, count: 0 };

    const overallQuery = `
        SELECT total_points 
        FROM fpl_data 
        WHERE name = $name AND minutes >= 10 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const overallStmt = db.prepare(overallQuery);
    overallStmt.bind({$name: playerName});
    
    let overallCount = 0;
    let overallPoints = 0;
    while(overallStmt.step()) {
        overallPoints += parseFloat(overallStmt.get()[0]);
        overallCount++;
    }
    overallStmt.free();

    let averagePoints = 0;
    if (overallCount > 0) {
        averagePoints = overallPoints / overallCount;
    }

    if (!fixture) {
        return { averagePoints, count: overallCount };
    }

    const opponentTeam = getOpponentTeam(player.team, fixture);

    const fixtureQuery = `
        SELECT total_points, kickoff_time 
        FROM fpl_data 
        WHERE name = $name AND opp_team_name = $opp AND minutes >= 10 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const fixtureStmt = db.prepare(fixtureQuery);
    fixtureStmt.bind({$name: playerName, $opp: opponentTeam});
    
    let fixtureCount = 0;
    let fixturePoints = 0;
    const twoYearsAgo = new Date().getTime() - (2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago in ms
    
    while(fixtureStmt.step()) {
        const row = fixtureStmt.get();
        const pts = parseFloat(row[0]);
        const matchTime = new Date(row[1]).getTime();
        
        // Only count historical opponent fixtures if they occurred within the last 2 years
        if (!isNaN(matchTime) && matchTime > twoYearsAgo) {
            fixturePoints += pts;
            fixtureCount++;
        }
    }
    fixtureStmt.free();

    if (overallCount > 0 && fixtureCount > 0) {
        // Bump opponent specific weight to 50% (was 30%)
        averagePoints = ((overallPoints / overallCount) * 0.5) + ((fixturePoints / fixtureCount) * 0.5);
    }
    
    return { averagePoints, count: overallCount };
}

function correctPenaltiesOrder(player, allPlayers) {

    if (!player.penalties_order) {
        return;
    }

    // Step 1: Filter out players belonging to the same team as the input player
    const teamPlayers = allPlayers.filter(p => p.team === player.team);

    // Step 2: Filter players with non-null, non-zero, and non-empty string penalties_order
    const playersWithPenalties = teamPlayers.filter(p => 
        p.penalties_order !== null && 
        p.penalties_order !== 0 && 
        p.penalties_order !== ""
    );

    // Step 3: Sort players by their penalties_order
    playersWithPenalties.sort((a, b) => a.penalties_order - b.penalties_order);

    // Step 4: Correct the penalties order
    playersWithPenalties.forEach((p, index) => {
        p.penalties_order = index + 1; // Reassign penalties_order starting from 1
    });

    // Update pen order
    player.penalties_order = playersWithPenalties.find(_ => _.id === player.id).penalties_order;
}
