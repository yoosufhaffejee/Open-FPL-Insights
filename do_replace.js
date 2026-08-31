const fs = require('fs');

const code = `async function calculateSeasonPoints() {
    let seasonPoints = 0;
    let totalIdealPoints = 0;

    let history = null;
    if (managerId > 0) {
        history = await getManagerHistory(managerId);
    }

    function getLocalCookie(name) {
        const value = '; ' + document.cookie;
        const parts = value.split('; ' + name + '=');
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    for (let i = 0; i < gameweeks.length; i++) {
        const gw = gameweeks[i];
        let gwPoints = 0;

        let histEvent = history ? history.current.find(e => e.event === gw.id) : null;

        if (histEvent && histEvent.points > 0) {
            gwPoints += histEvent.points - histEvent.event_transfers_cost;
        }
        else {
            let myPlayersCookie = getLocalCookie('myPlayersGW' + gw.id);
            if (!myPlayersCookie) {
                for (let prevGw = gw.id - 1; prevGw >= gameweeks[0].id; prevGw--) {
                    myPlayersCookie = getLocalCookie('myPlayersGW' + prevGw);
                    if (myPlayersCookie) {
                        let gwTeam = JSON.parse(myPlayersCookie);
                        if (gwTeam.players.length >= 15) break;
                    }
                }
            }

            let tempPlayers = [];
            if (myPlayersCookie) {
                let gwTeam = JSON.parse(myPlayersCookie);
                if (gwTeam.players.length >= 15) {
                    gwTeam.players.forEach((pick) => {
                        let basePlayer = allPlayers.find(p => p.id == pick.id);
                        if (!basePlayer) return;
                        let player = { ...basePlayer, isCaptain: pick.isCaptain, isVice: pick.isVice, isSub: pick.isSub };
                        let fixture = getPlayerFixture(player, gw.id);
                        player.predicted_points = calculatePlayerPredictedPoints(player, fixture, gw.id);
                        tempPlayers.push(player);
                    });
                }
            }

            if (tempPlayers.length === 15) {
                const bestPlayers = optimizeTeam(tempPlayers);
                bestPlayers.forEach(player => {
                    gwPoints += player.isCaptain ? (player.predicted_points * 2) : player.predicted_points;
                });
            }
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
let script = fs.readFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/script.js', 'utf8');
const start = script.indexOf('async function calculateSeasonPoints()');
const end = script.indexOf('// Function to assign the next available slot to the player');
if(start !== -1 && end !== -1) {
    script = script.substring(0, start) + code + script.substring(end);
    fs.writeFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/script.js', script);
    console.log('script.js updated');
}

let managers = fs.readFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/pages/managers/managers.js', 'utf8');
const startM = managers.indexOf('async function calculateSeasonPoints()');
const endM = managers.indexOf('// Function to assign the next available slot to the player');
if (startM !== -1 && endM !== -1) {
    managers = managers.substring(0, startM) + code + managers.substring(endM);
    fs.writeFileSync('c:/Users/Yoosuf/Documents/Open-FPL-Insights/pages/managers/managers.js', managers);
    console.log('managers.js updated');
}
