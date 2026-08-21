document.addEventListener('DOMContentLoaded', async () => {
    await setupPage(); // Assumes data.js is loaded
    
    // Check if data is loaded, otherwise wait a bit
    if (!teams || teams.length === 0 || !gameweeks || gameweeks.length === 0) {
        setTimeout(initPlanner, 1000);
    } else {
        initPlanner();
    }
});

let upcomingGWs = [];
let currentPlanIndex = 0;
let plannerState = {}; // { gwId: { squad: [], bank: 100, transfers: 1, chip: null } }

function initPlanner() {
    // 1. Get upcoming gameweeks
    upcomingGWs = gameweeks.filter(gw => !gw.finished).slice(0, 5); // Plan next 5 GWs
    if (upcomingGWs.length === 0) return; // Season over

    // 2. Load base squad from cookie
    let baseSquad = [];
    const savedPlayers = getCookie('myPlayers');
    if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        baseSquad = players.map(({ id, slotId, isSub, isCaptain, isVice }) => {
            const player = allPlayers.find(p => p.id === id);
            if (player) {
                // Clone player object for state
                let pClone = { ...player };
                pClone.slotId = slotId;
                pClone.isSub = isSub;
                pClone.isCaptain = isCaptain;
                pClone.isVice = isVice;
                return pClone;
            }
            return null;
        }).filter(p => p !== null);
    }

    // 3. Initialize state for upcoming gameweeks
    upcomingGWs.forEach((gw, index) => {
        plannerState[gw.id] = {
            squad: index === 0 ? baseSquad.map(p => ({...p})) : [], // Only GW1 has squad initially, others carry over
            bank: index === 0 ? 0.0 : 0, // In reality we'd pull real bank, for now default
            transfers: index === 0 ? 1 : 1, // Assume 1 FT per week
            chip: null
        };
    });

    // 4. Setup listeners
    document.getElementById('prevPlanGw').addEventListener('click', () => changeGw(-1));
    document.getElementById('nextPlanGw').addEventListener('click', () => changeGw(1));

    renderPlanner();
}

function changeGw(dir) {
    if (currentPlanIndex + dir >= 0 && currentPlanIndex + dir < upcomingGWs.length) {
        
        // Before moving, if we are moving forward, copy squad to next if it's empty
        let currentGwId = upcomingGWs[currentPlanIndex].id;
        let nextGwId = upcomingGWs[currentPlanIndex + dir].id;
        
        if (dir > 0 && plannerState[nextGwId].squad.length === 0) {
            plannerState[nextGwId].squad = plannerState[currentGwId].squad.map(p => ({...p}));
            plannerState[nextGwId].bank = plannerState[currentGwId].bank;
        }

        currentPlanIndex += dir;
        renderPlanner();
    }
}

function renderPlanner() {
    let currentGW = upcomingGWs[currentPlanIndex];
    document.getElementById('planGwTitle').textContent = currentGW.name;
    
    // Disable/Enable buttons
    document.getElementById('prevPlanGw').disabled = currentPlanIndex === 0;
    document.getElementById('nextPlanGw').disabled = currentPlanIndex === upcomingGWs.length - 1;

    let state = plannerState[currentGW.id];
    
    if (state.squad.length === 0) {
        if (currentPlanIndex > 0) {
            // Safety fallback if navigated forward and state wasn't pushed
            let prevGwId = upcomingGWs[currentPlanIndex - 1].id;
            state.squad = plannerState[prevGwId].squad.map(p => ({...p}));
        } else {
            console.log("No squad available. Loading empty pitch.");
        }
    }

    // Clear pitch
    document.getElementById('goalkeepers').innerHTML = '';
    document.getElementById('defenders').innerHTML = '';
    document.getElementById('midfielders').innerHTML = '';
    document.getElementById('forwards').innerHTML = '';
    document.getElementById('subs').innerHTML = '';

    let totalPoints = 0;

    state.squad.forEach(player => {
        // Calculate points
        let fixture = getPlayerFixture(player, currentGW.id);
        let predictedPoints = 0;
        
        if (fixture) {
            let isHome = fixture.team_h === player.team;
            const opponentTeam = teams.find(team =>
                team.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a)
            );
            
            // Re-use logic
            predictedPoints = getExpectedPoints(player, fixture);
            
            if (opponentTeam) {
                if (opponentTeam.strength == 2 && predictedPoints <= 10) predictedPoints += (predictedPoints * 0.1);
                if (opponentTeam.strength == 4) predictedPoints -= (predictedPoints * 0.1);
                if (opponentTeam.strength == 5) predictedPoints -= (predictedPoints * 0.2);
            }
            if (!isHome && predictedPoints >= 2.5) predictedPoints -= (predictedPoints * 0.1);
            
            predictedPoints = Math.round(predictedPoints * 10) / 10;
            
            if (player.isCaptain) predictedPoints *= 2;
        }
        
        if (!player.isSub) {
            totalPoints += predictedPoints;
        }

        // Render player HTML
        let rowId = player.isSub ? 'subs' : getRowForPlayer(player);
        let row = document.getElementById(rowId);
        
        let oppText = fixture ? `${getOpponentTeam(player.team, fixture)} (${fixture.team_h === player.team ? 'H' : 'A'})` : 'BLANK';
        
        let pDiv = document.createElement('div');
        pDiv.className = 'player';
        pDiv.innerHTML = `
            <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}-110.webp" class="shirt" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
            <div class="player-info">
                <h5>${player.web_name} ${player.isCaptain ? '(C)' : ''}</h5>
                <div class="fixture-info">
                    <span class="predicted-points">${predictedPoints.toFixed(1)}</span>
                    <span class="fixture-detail">${oppText}</span>
                </div>
            </div>
        `;
        row.appendChild(pDiv);
    });

    document.getElementById('planPredicted').textContent = totalPoints.toFixed(1) + ' pts';
    document.getElementById('planBank').textContent = `£${state.bank.toFixed(1)}m`;
    document.getElementById('planTransfers').textContent = state.transfers;
}

function getRowForPlayer(player) {
    if (player.element_type === 1) return 'goalkeepers';
    if (player.element_type === 2) return 'defenders';
    if (player.element_type === 3) return 'midfielders';
    if (player.element_type === 4) return 'forwards';
    return 'subs'; 
}

function getOpponentTeam(playerTeamId, fixture) {
    if(!fixture) return '';
    const opponentTeamId = fixture.team_h === playerTeamId ? fixture.team_a : fixture.team_h;
    const opponentTeam = teams.find(team => team.id === opponentTeamId);
    return opponentTeam ? opponentTeam.short_name : 'Unknown';
}

function getPlayerFixture(player, gameweekId) {
    return fixtures.find(fixture => fixture.event === gameweekId &&
                (fixture.team_a === player.team || fixture.team_h === player.team));
}

// Cookie helper (duplicated for planner if not loaded properly, though script.js usually has it, 
// but we don't want to load script.js here because it auto-initializes the main page)
function getCookie(name) {
    let cookieArr = document.cookie.split(";");
    for(let i = 0; i < cookieArr.length; i++) {
        let cookiePair = cookieArr[i].split("=");
        if(name == cookiePair[0].trim()) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    return null;
}
