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
        const stored = localStorage.getItem('fpl_predictions');
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
    localStorage.removeItem('fpl_predictions');
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

    // Defensive Contribution Points (Outfield players only)
    if (player.element_type !== 1) {
        let defConPer90 = parseFloat(player.defensive_contribution_per_90);
        if (!isNaN(defConPer90) && defConPer90 > 0) {
            // Defenders need 10 actions, Mid/Fwd need 12 actions
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
        let baseline = parseFloat(player.ep_next);
        if (isNaN(baseline)) baseline = (player.minutes > 0 ? 1.0 : 0.0);
        expectedPoints = (expectedPoints * weight) + (baseline * (1 - weight));
    }
    
    // Add small bump to overall team expected points to reach ~60 average (algorithm naturally outputs ~45)
    expectedPoints = expectedPoints * 1.15;
    
    // Blend with FPL's ep_next at 25% weight to smooth outliers
    // (FPL's model is conservative but catches edge cases we might miss)
    const fplPred = parseFloat(player.ep_next);
    if (!isNaN(fplPred) && fplPred > 0) {
        expectedPoints = (expectedPoints * 0.75) + (fplPred * 0.25);
    }
    
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
        SELECT total_points 
        FROM fpl_data 
        WHERE name = $name AND opp_team_name = $opp AND minutes >= 10 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const fixtureStmt = db.prepare(fixtureQuery);
    fixtureStmt.bind({$name: playerName, $opp: opponentTeam});
    
    let fixtureCount = 0;
    let fixturePoints = 0;
    while(fixtureStmt.step()) {
        fixturePoints += parseFloat(fixtureStmt.get()[0]);
        fixtureCount++;
    }
    fixtureStmt.free();

    if (overallCount > 0 && fixtureCount > 0) {
        averagePoints = ((overallPoints / overallCount) * 0.7) + ((fixturePoints / fixtureCount) * 0.3);
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
