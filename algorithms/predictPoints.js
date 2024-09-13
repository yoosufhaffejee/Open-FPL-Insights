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

function getExpectedPoints (player, fixture) {
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

    let assistsPer90 = player.expected_assists_per_90 == 0 ? 0 : player.assists / (player.minutes / 90);
    expectedPoints += assistsPer90 * assistPoints;

    if (player.element_type === 1) {
        // Goalkeeper
        let cleanSheetPointsPer90 = player.clean_sheets_per_90 !== undefined && player.clean_sheets_per_90 !== 0 ? player.clean_sheets_per_90 * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let savePointsPer90 = player.saves_per_90 !== undefined && player.saves_per_90 !== 0 ? player.saves_per_90 * (threeShotsSavedPoints / 3) : 0;
        expectedPoints += savePointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? player.expected_goals_conceded_per_90 / (twoGoalsConcededPointsDeduction / 2) : 0;
        expectedPoints -= goalsConcededPointsPer90;
    
        let penaltiesSavedPer90 = player.penalties_saved !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_saved / (player.minutes / 90) : 0;
        let penaltySavePointsPer90 = penaltiesSavedPer90 * penaltySavedPoints;
        expectedPoints += penaltySavePointsPer90;
    
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? player.expected_goals_per_90 * goalPointsGK : 0;
        expectedPoints += goalPointsPer90;
    }
    
    if (player.element_type === 2) {
        // Defender
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? player.expected_goals_per_90 * goalPointsDEF : 0;
        expectedPoints += goalPointsPer90;
    
        let cleanSheetPointsPer90 = player.clean_sheets_per_90 !== undefined && player.clean_sheets_per_90 !== 0 ? player.clean_sheets_per_90 * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? player.expected_goals_conceded_per_90 / (twoGoalsConcededPointsDeduction / 2) : 0;
        expectedPoints -= goalsConcededPointsPer90;
    }
    
    if (player.element_type === 3) {
        // Midfielder
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? player.expected_goals_per_90 * goalPointsMID : 0;
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
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? player.expected_goals_per_90 * goalPointsMID : 0;
        expectedPoints += goalPointsPer90;
    
        correctPenaltiesOrder(player, allPlayers);
    
        let penaltiesMissedPer90 = player.penalties_missed !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_missed / (player.minutes / 90) : 0;
        let penaltyMissPointsPer90 = penaltiesMissedPer90 * penaltyMissPointsDeduction;
        expectedPoints -= penaltyMissPointsPer90;
    }

    let averagePoints = getLastFive(player, fixture);
    if(averagePoints > 0) {
        expectedPoints = (expectedPoints + averagePoints) / 2;
    }

    return expectedPoints;
}

function getLastFive(player, fixture) {
    let playerName = player.first_name + " " + player.second_name;
    let playerFixtureHistory = historicalData.filter(h => playerName == h.name && h.opp_team_name == getOpponentTeam(player.team, fixture));

    let count = 0;
    let historicPoints = 0;
    playerFixtureHistory.forEach(fixtureHistory => {
        if (fixtureHistory.minutes >= 10) {
            count++;
            historicPoints += parseFloat(fixtureHistory.total_points);
        }
    });

    if (count > 0 ) {
        return historicPoints/count;
    }
    
    return 0;
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
