const fs = require('fs');

const code = `async function calculateSeasonPoints() {
    let seasonPoints = 0;
    let totalIdealPoints = 0;

    let history = null;
    if (managerId > 0) {
        history = await getManagerHistory(managerId);
    }

    for (let i = 0; i < gameweeks.length; i++) {
        const gw = gameweeks[i];
        let gwPoints = 0;

        let histEvent = history ? history.current.find(e => e.event === gw.id) : null;

        if (histEvent && histEvent.points > 0) {
            gwPoints += histEvent.points - histEvent.event_transfers_cost;
        }
        else if (gw.id >= getUpcomingGameweek().id) {
            myPlayers.forEach(player => {
                let fixture = getPlayerFixture(player, gw.id);
                player.predicted_points = calculatePlayerPredictedPoints(player, fixture, gw.id);
            });

            const bestPlayers = optimizeTeam(myPlayers);
            bestPlayers.forEach(player => {
                gwPoints += player.isCaptain ? (player.predicted_points * 2) : player.predicted_points;
            });
        }

        let maxIdeal = getIdealMaxPointsForGW(gw.id, calculatePlayerPredictedPoints, allPlayers, fixtures);
        
        seasonPoints += gwPoints;
        totalIdealPoints += maxIdeal;
    }

    let overallRating = Math.min(100, (seasonPoints / totalIdealPoints) * 100);
    updateTeamInfo('Overall Rating', Math.round(overallRating) + '%');
    updateTeamInfo('Season Points', parseInt(seasonPoints));
}

`;
let managers = fs.readFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/pages/managers/managers.js', 'utf8');
const startM = managers.indexOf('async function calculateSeasonPoints()');
const endM = managers.indexOf('// Global object to track the number of players per position');
if (startM !== -1 && endM !== -1) {
    managers = managers.substring(0, startM) + code + managers.substring(endM);
    fs.writeFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/pages/managers/managers.js', managers);
    console.log('managers.js updated');
} else {
    console.log('bounds not found in managers.js');
}
