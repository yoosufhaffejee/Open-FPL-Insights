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
// plannerState is an array of size 5 (one for each upcoming GW)
// Each element contains: { squad: [], bank: 0, transfers: 1 }
let plannerState = []; 

let selectedTransferOut = null; // { slotId: 1, gwIndex: 0 }

function initPlanner() {
    upcomingGWs = gameweeks.filter(gw => !gw.finished).slice(0, 5); 
    if (upcomingGWs.length === 0) return;

    let baseSquad = [];
    const savedPlayers = getCookie('myPlayers');
    if (savedPlayers) {
        const players = JSON.parse(savedPlayers);
        baseSquad = players.map(({ id, slotId, isSub, isCaptain, isVice }) => {
            const player = allPlayers.find(p => p.id === id);
            if (player) {
                return { ...player, slotId, isSub, isCaptain, isVice };
            }
            return null;
        }).filter(p => p !== null);
    }
    
    // Initialize state
    plannerState = upcomingGWs.map((gw, index) => {
        return {
            squad: index === 0 ? baseSquad.map(p => ({...p})) : [], 
            bank: index === 0 ? 0.0 : 0,
            transfers: index === 0 ? 1 : 1
        };
    });
    
    // Carry over state
    for(let i = 1; i < plannerState.length; i++) {
        plannerState[i].squad = plannerState[i-1].squad.map(p => ({...p}));
        plannerState[i].bank = plannerState[i-1].bank;
        plannerState[i].transfers = Math.min(5, plannerState[i-1].transfers + 1);
    }

    const searchInput = document.getElementById('plannerSearch');
    if (searchInput) searchInput.addEventListener('input', renderPlannerPlayers);
    
    document.getElementById('resetPlanBtn')?.addEventListener('click', initPlanner);

    renderPlannerGrid();
    renderPlannerPlayers();
}

function renderPlannerGrid() {
    const header = document.getElementById('plannerGridHeader');
    const body = document.getElementById('plannerGridBody');
    const footer = document.getElementById('plannerGridFooter');
    
    if(!header || !body || !footer) return;
    
    // Header
    let headerHTML = '<th style="width: 25%; text-align: left;">Player</th>';
    upcomingGWs.forEach(gw => {
        headerHTML += `<th>${gw.name}</th>`;
    });
    header.innerHTML = headerHTML;
    
    // Body
    body.innerHTML = '';
    
    if(plannerState[0].squad.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center p-5">No squad found. Please select your team on the main page.</td></tr>';
        return;
    }

    // Render slots based on GW0 squad order
    let baseSquadSlots = plannerState[0].squad.sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type;
        return a.now_cost - b.now_cost;
    }).map(p => p.slotId);

    baseSquadSlots.forEach(slotId => {
        let tr = document.createElement('tr');
        
        // Player Info column (based on GW0 player)
        const gw0Player = plannerState[0].squad.find(p => p.slotId === slotId);
        const teamObj = teams.find(t => t.id === gw0Player.team);
        const teamName = teamObj ? teamObj.short_name : 'UNK';
        
        let isTransferOutSelected = selectedTransferOut && selectedTransferOut.slotId === slotId;
        if(isTransferOutSelected) {
            tr.classList.add('transfer-out-selected');
        }
        
        let infoHTML = `
            <td style="text-align: left;">
                <div class="d-flex align-items-center" style="cursor:pointer;" onclick="selectTransferOut(${slotId}, 0)" title="Click to select for transfer">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${gw0Player.team_code}-110.webp" class="shirt" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
                    <div>
                        <div class="fw-bold">${gw0Player.web_name}</div>
                        <div class="small text-white-50">${teamName} - £${(gw0Player.now_cost/10).toFixed(1)}m</div>
                    </div>
                </div>
            </td>
        `;
        
        // GW Columns
        let gwsHTML = '';
        plannerState.forEach((state, gwIndex) => {
            const playerInSlot = state.squad.find(p => p.slotId === slotId);
            const gw = upcomingGWs[gwIndex];
            
            let fixture = getPlayerFixture(playerInSlot, gw.id);
            let predictedPoints = "?";
            let fdrClass = 'fdr-3';
            let oppText = 'BLANK';
            
            if (fixture) {
                let isHome = fixture.team_h === playerInSlot.team;
                const opponentTeam = teams.find(team =>
                    team.id === (fixture.team_a === playerInSlot.team ? fixture.team_h : fixture.team_a)
                );
                
                oppText = `${opponentTeam ? opponentTeam.short_name : 'UNK'} (${isHome ? 'H' : 'A'})`;
                fdrClass = opponentTeam ? `fdr-${opponentTeam.strength}` : 'fdr-3';
                
                if (typeof getExpectedPoints === 'function') {
                    predictedPoints = getExpectedPoints(playerInSlot, fixture);
                    if (predictedPoints !== "?") {
                        if (opponentTeam) {
                            if (opponentTeam.strength == 2 && predictedPoints <= 10) predictedPoints += (predictedPoints * 0.1);
                            if (opponentTeam.strength == 4) predictedPoints -= (predictedPoints * 0.1);
                            if (opponentTeam.strength == 5) predictedPoints -= (predictedPoints * 0.2);
                        }
                        if (!isHome && predictedPoints >= 2.5) predictedPoints -= (predictedPoints * 0.1);
                        predictedPoints = (Math.round(predictedPoints * 10) / 10).toFixed(1);
                    }
                }
            }
            
            let changedPlayerHtml = '';
            if(playerInSlot.id !== gw0Player.id) {
                changedPlayerHtml = `<div class="fw-bold text-warning" style="font-size: 0.7rem;">${playerInSlot.web_name}</div>`;
            }
            
            let isCellSelected = isTransferOutSelected && selectedTransferOut.gwIndex === gwIndex;
            let outline = isCellSelected ? 'outline: 2px solid #ff005a;' : '';

            gwsHTML += `
                <td style="${outline} cursor: pointer;" onclick="selectTransferOut(${slotId}, ${gwIndex})">
                    <div class="gw-cell ${fdrClass}">
                        ${changedPlayerHtml}
                        <span class="opp">${oppText}</span>
                        <span class="pts">${predictedPoints} pts</span>
                    </div>
                </td>
            `;
        });
        
        tr.innerHTML = infoHTML + gwsHTML;
        body.appendChild(tr);
    });
    
    // Footer (Totals)
    let footerHTML = '<tr><td style="text-align: right;"><strong>Expected Points</strong><br><span class="text-white-50">Transfers | Bank</span></td>';
    plannerState.forEach((state, gwIndex) => {
        let totalPts = 0;
        state.squad.forEach(p => {
            if(!p.isSub) {
                let fixture = getPlayerFixture(p, upcomingGWs[gwIndex].id);
                if(fixture && typeof getExpectedPoints === 'function') {
                    let pts = getExpectedPoints(p, fixture);
                    if(pts !== "?") totalPts += pts;
                }
            }
        });
        
        footerHTML += `
            <td>
                <div>${totalPts.toFixed(1)}</div>
                <div class="text-white-50 small">${state.transfers} FT | £${state.bank.toFixed(1)}m</div>
            </td>
        `;
    });
    footerHTML += '</tr>';
    footer.innerHTML = footerHTML;
}

function selectTransferOut(slotId, gwIndex = 0) {
    if(selectedTransferOut && selectedTransferOut.slotId === slotId && selectedTransferOut.gwIndex === gwIndex) {
        selectedTransferOut = null; // deselect
    } else {
        selectedTransferOut = { slotId, gwIndex };
    }
    renderPlannerGrid();
}

function renderPlannerPlayers() {
    const listContainer = document.getElementById('plannerPlayersList');
    if (!listContainer) return;

    const searchInput = document.getElementById('plannerSearch');
    let query = searchInput ? searchInput.value.toLowerCase() : '';

    let filtered = allPlayers;
    if (query) {
        filtered = allPlayers.filter(p => 
            (p.web_name && p.web_name.toLowerCase().includes(query)) || 
            (p.first_name && p.first_name.toLowerCase().includes(query)) || 
            (p.second_name && p.second_name.toLowerCase().includes(query))
        );
    }

    filtered = filtered.sort((a, b) => b.total_points - a.total_points);

    const maxResults = 50;
    const toRender = filtered.slice(0, maxResults);

    listContainer.innerHTML = '';

    if (toRender.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-white-50 mt-5"><p>No players found.</p></div>';
        return;
    }

    toRender.forEach(player => {
        const teamObj = teams.find(t => t.id === player.team);
        const teamName = teamObj ? teamObj.short_name : 'UNK';
        
        const price = (player.now_cost / 10).toFixed(1);
        const pts = player.total_points;
        
        const item = document.createElement('div');
        item.className = 'player-list-item transfer-in-candidate';
        
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}-110.webp" class="shirt" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
                <div>
                    <div class="fw-bold text-white">${player.web_name}</div>
                    <div class="small text-white-50">${teamName} - £${price}m</div>
                </div>
            </div>
            <div class="text-end">
                <div class="small text-white-50">${pts} pts</div>
                <button class="btn-transfer mt-1" onclick="planTransfer(${player.id})">In <i class="fas fa-exchange-alt ms-1"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function planTransfer(playerInId) {
    if(!selectedTransferOut) {
        alert("Please select a player row and gameweek in the grid to transfer out first.");
        return;
    }
    
    const { slotId, gwIndex } = selectedTransferOut;
    const playerIn = allPlayers.find(p => p.id === playerInId);
    if(!playerIn) return;
    
    // Execute transfer from gwIndex onwards
    for(let i = gwIndex; i < plannerState.length; i++) {
        const state = plannerState[i];
        
        const playerOutIndex = state.squad.findIndex(p => p.slotId === slotId);
        if(playerOutIndex === -1) continue;
        
        const playerOut = state.squad[playerOutIndex];
        
        if (i === gwIndex) {
            state.bank = state.bank + (playerOut.now_cost / 10) - (playerIn.now_cost / 10);
            state.transfers = Math.max(0, state.transfers - 1);
        } else {
            state.bank = plannerState[i-1].bank;
            state.transfers = Math.min(5, plannerState[i-1].transfers + 1);
        }
        
        state.squad[playerOutIndex] = {
            ...playerIn,
            slotId: playerOut.slotId,
            isSub: playerOut.isSub,
            isCaptain: playerOut.isCaptain,
            isVice: playerOut.isVice
        };
    }
    
    selectedTransferOut = null;
    renderPlannerGrid();
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
