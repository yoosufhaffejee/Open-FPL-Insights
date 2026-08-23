document.addEventListener('DOMContentLoaded', async () => {
    await setupPage();
    if (!teams || teams.length === 0 || !gameweeks || gameweeks.length === 0) {
        setTimeout(initPlanner, 1000);
    } else {
        initPlanner();
    }
});

let upcomingGWs = [];
let plannerState = []; 
let selectedTransferOut = null; 
let baseSquadCache = [];
let initialBankCache = 0;

async function initPlanner() {
    upcomingGWs = gameweeks.filter(gw => !gw.finished).slice(0, 5); 
    if (upcomingGWs.length === 0) return;

    let baseSquad = [];
    let initialBank = 0;
    
    let managerIdStr = getCookie('managerId');
    if (managerIdStr && typeof getManagerPicks === 'function') {
        let managerId = parseInt(managerIdStr);
        let previousGw = selectedGW ? selectedGW.id : (upcomingGWs[0].id - 1);
        if (previousGw < 1) previousGw = 1;
        
        try {
            const picksData = await getManagerPicks(managerId, previousGw);
            if(picksData && picksData.picks) {
                baseSquad = picksData.picks.map(pick => {
                    const player = allPlayers.find(p => p.id === pick.element);
                    if (player) {
                        return { ...player, slotId: pick.position, isSub: pick.position > 11, isCaptain: pick.is_captain, isVice: pick.is_vice_captain };
                    }
                    return null;
                }).filter(p => p !== null);
                
                initialBank = (picksData.entry_history.bank / 10) || 0;
            }
        } catch(e) {
            console.error("Could not load manager picks", e);
        }
    }
    
    if (baseSquad.length === 0) {
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
    }
    
    baseSquadCache = baseSquad.map(p => ({...p}));
    initialBankCache = initialBank;

    let startingFTs = parseInt(document.getElementById('startFts')?.value || 1);

    plannerState = upcomingGWs.map((gw, index) => {
        return {
            gwId: gw.id,
            plannedTransfers: [],
            activeChip: null, 
            squad: [], 
            bank: 0,
            transfers: 0,
            hits: 0,
            pointsHit: 0
        };
    });
    
    recalculateState();

    
    
    document.getElementById('resetPlanBtn')?.addEventListener('click', () => {
        plannerState.forEach(state => {
            state.plannedTransfers = [];
            state.activeChip = null;
        });
        recalculateState();
        renderPlannerGrid();
    });
    
    document.getElementById('startFts')?.addEventListener('change', () => {
        recalculateState();
        renderPlannerGrid();
    });

    renderPlannerGrid();
    initPlannerSidebar();
    renderPlannerPlayers();
}

function recalculateState() {
    let startingFTs = parseInt(document.getElementById('startFts')?.value || 1);
    let currentSquad = baseSquadCache.map(p => ({...p}));
    let currentBank = initialBankCache;
    let currentFTs = startingFTs;

    for(let i = 0; i < plannerState.length; i++) {
        const state = plannerState[i];
        const isWC = state.activeChip === 'WC';
        const isFH = state.activeChip === 'FH';
        
        let bankBeforeTransfers = currentBank;
        let squadBeforeTransfers = currentSquad.map(p => ({...p}));
        let transfersMade = state.plannedTransfers.length;
        
        let newSquad = currentSquad.map(p => ({...p}));
        let newBank = currentBank;
        
        state.plannedTransfers.forEach(t => {
            const pOutIndex = newSquad.findIndex(p => p.slotId === t.slotId);
            const pIn = allPlayers.find(p => p.id === t.playerInId);
            if(pOutIndex !== -1 && pIn) {
                newBank += (newSquad[pOutIndex].now_cost / 10) - (pIn.now_cost / 10);
                newSquad[pOutIndex] = { ...pIn, slotId: t.slotId, isSub: newSquad[pOutIndex].isSub, isCaptain: newSquad[pOutIndex].isCaptain, isVice: newSquad[pOutIndex].isVice };
            }
        });
        
        let hits = 0;
        let pointsHit = 0;
        let nextFTs = currentFTs;
        
        if (isWC || isFH) {
            hits = 0;
            pointsHit = 0;
            nextFTs = Math.min(5, currentFTs + 1);
        } else {
            if (transfersMade > currentFTs) {
                hits = transfersMade - currentFTs;
                pointsHit = hits * 4;
                nextFTs = 1; 
            } else {
                nextFTs = Math.min(5, currentFTs - transfersMade + 1);
            }
        }
        
        state.squad = newSquad;
        state.bank = newBank;
        state.hits = hits;
        state.pointsHit = pointsHit;
        state.transfers = currentFTs;
        
        if (isFH) {
            currentSquad = squadBeforeTransfers;
            currentBank = bankBeforeTransfers;
        } else {
            currentSquad = newSquad;
            currentBank = newBank;
        }
        currentFTs = nextFTs;
    }
}

function calcPlayerGwPoints(player, gwId, state) {
    let matches = getPlayerFixtures(player, gwId);
    if (!matches || matches.length === 0 || typeof getExpectedPoints !== 'function') return 0;
    
    let totalPts = 0;
    matches.forEach(fixture => {
        let pts = getExpectedPoints(player, fixture);
        if (pts !== "?") {
            let isHome = fixture.team_h === player.team;
            const opponentTeam = teams.find(team => team.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a));
            
            if (opponentTeam) {
                if (opponentTeam.strength == 2 && pts <= 10) pts += (pts * 0.1);
                if (opponentTeam.strength == 4) pts -= (pts * 0.1);
                if (opponentTeam.strength == 5) pts -= (pts * 0.2);
            }
            if (!isHome && pts >= 2.5) pts -= (pts * 0.1);
            totalPts += pts;
        }
    });
    
    if (player.isCaptain) {
        let multiplier = state.activeChip === 'TC' ? 3 : 2;
        totalPts *= multiplier;
    }
    
    return Math.round(totalPts * 10) / 10;
}

function toggleChip(gwIndex, chip) {
    let state = plannerState[gwIndex];
    if (state.activeChip === chip) {
        state.activeChip = null;
    } else {
        state.activeChip = chip;
    }
    recalculateState();
    renderPlannerGrid();
}

function renderPlannerGrid() {
    const header = document.getElementById('plannerGridHeader');
    const body = document.getElementById('plannerGridBody');
    const footer = document.getElementById('plannerGridFooter');
    
    if(!header || !body || !footer) return;
    
    let headerHTML = '<th style="width: 25%; text-align: left;">Player</th>';
    upcomingGWs.forEach((gw, index) => {
        let state = plannerState[index];
        let chipHtml = `
            <div class="mt-1 d-flex justify-content-center gap-1">
                <button class="btn btn-xs ${state.activeChip === 'WC' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'} py-0 px-1" style="font-size: 0.65rem;" onclick="toggleChip(${index}, 'WC')" title="Wildcard">WC</button>
                <button class="btn btn-xs ${state.activeChip === 'FH' ? 'btn-primary fw-bold' : 'btn-outline-secondary'} py-0 px-1" style="font-size: 0.65rem;" onclick="toggleChip(${index}, 'FH')" title="Free Hit">FH</button>
                <button class="btn btn-xs ${state.activeChip === 'BB' ? 'btn-success fw-bold' : 'btn-outline-secondary'} py-0 px-1" style="font-size: 0.65rem;" onclick="toggleChip(${index}, 'BB')" title="Bench Boost">BB</button>
                <button class="btn btn-xs ${state.activeChip === 'TC' ? 'btn-danger fw-bold' : 'btn-outline-secondary'} py-0 px-1" style="font-size: 0.65rem;" onclick="toggleChip(${index}, 'TC')" title="Triple Captain">TC</button>
            </div>
        `;
        headerHTML += `<th>${gw.name} ${chipHtml}</th>`;
    });
    header.innerHTML = headerHTML;
    
    body.innerHTML = '';
    
    if(plannerState[0].squad.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center p-5">No squad found. Please select your team on the main page.</td></tr>';
        return;
    }

    let baseSquadSlots = plannerState[0].squad.sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type;
        return a.now_cost - b.now_cost;
    }).map(p => p.slotId);

    baseSquadSlots.forEach(slotId => {
        let tr = document.createElement('tr');
        
        const gw0Player = plannerState[0].squad.find(p => p.slotId === slotId);
        const teamObj = teams.find(t => t.id === gw0Player.team);
        const teamName = teamObj ? teamObj.short_name : 'UNK';
        
        let isTransferOutSelected = selectedTransferOut && selectedTransferOut.slotId === slotId;
        if(isTransferOutSelected) {
            tr.classList.add('transfer-out-selected');
        }
        
        let isCap = gw0Player.isCaptain ? 'text-warning fw-bold' : 'text-white-50';
        let isVice = gw0Player.isVice ? 'text-info fw-bold' : 'text-white-50';
        let subBadge = gw0Player.isSub ? '<span class="badge bg-secondary ms-1" style="font-size:0.5rem">Sub</span>' : '';
        
        let infoHTML = `
            <td style="text-align: left;">
                <div class="d-flex align-items-center">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${gw0Player.team_code}-110.webp" class="shirt cursor-pointer" onclick="selectTransferOut(${slotId}, 0)" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
                    <div>
                        <div class="fw-bold cursor-pointer" onclick="selectTransferOut(${slotId}, 0)">${gw0Player.web_name}${subBadge}</div>
                        <div class="small text-white-50">${teamName} - £${(gw0Player.now_cost/10).toFixed(1)}m</div>
                        <div class="small mt-1" style="font-size:0.7rem;">
                            <span class="cursor-pointer ${isCap}" onclick="setCaptain(${slotId}, true)" title="Set Captain" style="cursor: pointer;">[C]</span> 
                            <span class="cursor-pointer ${isVice} ms-1" onclick="setCaptain(${slotId}, false)" title="Set Vice Captain" style="cursor: pointer;">[V]</span>
                        </div>
                    </div>
                </div>
            </td>
        `;
        
        let gwsHTML = '';
        plannerState.forEach((state, gwIndex) => {
            const playerInSlot = state.squad.find(p => p.slotId === slotId);
            const gw = upcomingGWs[gwIndex];
            
            let matches = getPlayerFixtures(playerInSlot, gw.id);
            let pts = calcPlayerGwPoints(playerInSlot, gw.id, state);
            let fdrClass = 'fdr-3';
            let oppText = 'BLANK';
            
            if (matches.length > 0) {
                let totalStr = 0;
                let texts = matches.map(fixture => {
                    let isHome = fixture.team_h === playerInSlot.team;
                    const opponentTeam = teams.find(team => team.id === (fixture.team_a === playerInSlot.team ? fixture.team_h : fixture.team_a));
                    if (opponentTeam) totalStr += opponentTeam.strength;
                    else totalStr += 3;
                    return `${opponentTeam ? opponentTeam.short_name : 'UNK'} (${isHome ? 'H' : 'A'})`;
                });
                oppText = texts.join('<br>');
                let avgStr = Math.round(totalStr / matches.length);
                fdrClass = `fdr-${avgStr}`;
                
                if (matches.length > 1) {
                    // Slight visual tweak for DGW
                    fdrClass += ' border border-warning';
                }
            }
            
            let changedPlayerHtml = '';
            if(playerInSlot.id !== gw0Player.id) {
                changedPlayerHtml = `<div class="fw-bold text-warning" style="font-size: 0.7rem;">${playerInSlot.web_name}</div>`;
            }
            
            let isCellSelected = isTransferOutSelected && selectedTransferOut.gwIndex === gwIndex;
            let outline = isCellSelected ? 'outline: 2px solid #28a745; background-color: rgba(40, 167, 69, 0.15);' : '';
            
            let ptsDisplay = pts.toFixed(1);
            if(playerInSlot.isSub && state.activeChip !== 'BB') ptsDisplay = `<span class="text-white-50">(${ptsDisplay})</span>`;

            gwsHTML += `
                <td style="${outline} cursor: pointer; vertical-align: top;" onclick="selectTransferOut(${slotId}, ${gwIndex})">
                    <div class="gw-cell ${fdrClass} h-100 d-flex flex-column justify-content-between">
                        ${changedPlayerHtml}
                        <div class="opp lh-sm mb-1" style="font-size: 0.75rem;">${oppText}</div>
                        <div class="pts">${ptsDisplay} pts</div>
                    </div>
                </td>
            `;
        });
        
        tr.innerHTML = infoHTML + gwsHTML;
        body.appendChild(tr);
    });
    
    let footerHTML = '<tr><td style="text-align: right;"><strong>Expected Points</strong><br><span class="text-white-50">Transfers | Bank</span></td>';
    plannerState.forEach((state, gwIndex) => {
        let totalPts = 0;
        state.squad.forEach(p => {
            if(!p.isSub || state.activeChip === 'BB') {
                totalPts += calcPlayerGwPoints(p, upcomingGWs[gwIndex].id, state);
            }
        });
        
        let hitText = state.pointsHit > 0 ? ` <span class="text-danger">(-${state.pointsHit})</span>` : '';
        let finalPts = (totalPts - state.pointsHit).toFixed(1);
        let ftText = (state.activeChip === 'WC' || state.activeChip === 'FH') ? 'Unlimited' : `${state.transfers} FT`;
        
        footerHTML += `
            <td>
                <div>${finalPts}${hitText}</div>
                <div class="text-white-50 small">${ftText} | £${state.bank.toFixed(1)}m</div>
            </td>
        `;
    });
    footerHTML += '</tr>';
    footer.innerHTML = footerHTML;
}

function setCaptain(slotId, isCaptain) {
    baseSquadCache.forEach(p => {
        if(isCaptain) {
            if(p.slotId === slotId) { p.isCaptain = true; p.isVice = false; }
            else { p.isCaptain = false; }
        } else {
            if(p.slotId === slotId) { p.isVice = true; p.isCaptain = false; }
            else { p.isVice = false; }
        }
    });
    
    // Apply to current plannerState squad recursively
    plannerState.forEach(state => {
        state.squad.forEach(p => {
            if(isCaptain) {
                if(p.slotId === slotId) { p.isCaptain = true; p.isVice = false; }
                else { p.isCaptain = false; }
            } else {
                if(p.slotId === slotId) { p.isVice = true; p.isCaptain = false; }
                else { p.isVice = false; }
            }
        });
    });
    
    recalculateState();
    renderPlannerGrid();
}

function selectTransferOut(slotId, gwIndex = 0) {
    if(selectedTransferOut && selectedTransferOut.slotId === slotId && selectedTransferOut.gwIndex === gwIndex) {
        selectedTransferOut = null; 
    } else {
        selectedTransferOut = { slotId, gwIndex };
    }
    renderPlannerGrid();
    renderPlannerPlayers();
}


function initPlannerSidebar() {
    
    const viewFilter = document.getElementById('plannerViewFilter');
    if (viewFilter && viewFilter.querySelector('optgroup[label="Teams"]') === null) {
        let teamGroup = document.createElement('optgroup');
        teamGroup.label = "Teams";
        teams.forEach(t => {
            let opt = document.createElement('option');
            opt.value = 'team_' + t.id;
            opt.textContent = t.name;
            teamGroup.appendChild(opt);
        });
        viewFilter.appendChild(teamGroup);
    }

    const maxPriceSelect = document.getElementById('plannerMaxPrice');
    if (maxPriceSelect && maxPriceSelect.options.length <= 1) {
        for(let p = 15.0; p >= 4.0; p -= 0.5) {
            let opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `Max Price: £${p.toFixed(1)}m`;
            maxPriceSelect.appendChild(opt);
        }
    }
    
    const ids = ['plannerSearch', 'plannerViewFilter', 'plannerSortBy', 'plannerMaxPrice'];
    ids.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if(id === 'plannerSortBy') {
                    let lbl = document.getElementById('plannerSortLabel');
                    if(lbl) {
                        let text = el.options[el.selectedIndex].text;
                        lbl.textContent = text.length > 5 ? text.substring(0, 4) : text;
                    }
                }
                renderPlannerPlayers();
            });
            if(id === 'plannerSearch') {
                el.addEventListener('input', renderPlannerPlayers);
            }
        }
    });
    
    const resetBtn = document.getElementById('plannerResetFilters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            document.getElementById('plannerSearch').value = '';
            document.getElementById('plannerViewFilter').value = 'all';
            document.getElementById('plannerSortBy').value = 'total_points';
            document.getElementById('plannerMaxPrice').value = '999';
            let lbl = document.getElementById('plannerSortLabel');
            if(lbl) lbl.textContent = 'Pts';
            renderPlannerPlayers();
        });
    }
}


function renderPlannerPlayers() {
    const listContainer = document.getElementById('plannerPlayersList');
    if (!listContainer) return;

    const searchInput = document.getElementById('plannerSearch');
    const viewFilter = document.getElementById('plannerViewFilter');
    const sortBy = document.getElementById('plannerSortBy');
    const maxPrice = document.getElementById('plannerMaxPrice');
    
    let query = searchInput ? searchInput.value.toLowerCase() : '';
    let view = viewFilter ? viewFilter.value : 'all';
    let sort = sortBy ? sortBy.value : 'total_points';
    let max = maxPrice ? parseFloat(maxPrice.value) : 999;

    let filtered = allPlayers;
    
    let selectedGwId = upcomingGWs[0] ? upcomingGWs[0].id : 1;
    if (selectedTransferOut && upcomingGWs[selectedTransferOut.gwIndex]) {
        selectedGwId = upcomingGWs[selectedTransferOut.gwIndex].id;
    }

    // Assign predicted pts and fix formatting for form
    filtered.forEach(p => {
        p.predicted_pts = calcPlayerGwPoints(p, selectedGwId, {activeChip: null});
    });

    // Filter by name
    if (query) {
        filtered = filtered.filter(p => 
            (p.web_name && p.web_name.toLowerCase().includes(query)) || 
            (p.first_name && p.first_name.toLowerCase().includes(query)) || 
            (p.second_name && p.second_name.toLowerCase().includes(query))
        );
    }
    
    // Filter by position or team
    if (view.startsWith('pos_')) {
        let pos = parseInt(view.split('_')[1]);
        filtered = filtered.filter(p => p.element_type === pos);
    } else if (view.startsWith('team_')) {
        let teamId = parseInt(view.split('_')[1]);
        filtered = filtered.filter(p => p.team === teamId);
    }
    
    // Filter by max price
    if (max < 999) {
        filtered = filtered.filter(p => (p.now_cost / 10) <= max);
    }

    // Sort
    filtered = filtered.sort((a, b) => {
        let valA = parseFloat(a[sort]) || 0;
        let valB = parseFloat(b[sort]) || 0;
        return valB - valA; 
    });

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
        
        let posText = '';
        if(player.element_type === 1) posText = 'GKP';
        if(player.element_type === 2) posText = 'DEF';
        if(player.element_type === 3) posText = 'MID';
        if(player.element_type === 4) posText = 'FWD';
        
        const price = (player.now_cost / 10).toFixed(1);
        
        let sortVal = player[sort] || 0;
        if(sort === 'now_cost') sortVal = (sortVal / 10).toFixed(1);
        if(sort === 'predicted_pts') sortVal = sortVal.toFixed(1);
        
        let form = parseFloat(player.form).toFixed(1);
        let pts = player.total_points;
        let exp = player.predicted_pts.toFixed(1);
        
        // Injury/suspension status
        let statusIcon = '';
        if (player.status === 'i' || player.status === 's') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-danger" title="Injured/Suspended"></i>';
        } else if (player.status === 'd') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-warning" title="Doubtful"></i>';
        } else {
            statusIcon = '<i class="fas fa-info-circle text-white-50 cursor-pointer" onclick="showPlayerInfoById('+player.id+')"></i>';
        }

        const item = document.createElement('div');
        item.className = 'player-list-item transfer-in-candidate py-2 border-bottom border-secondary';
        
        item.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div class="me-2" style="width: 15px; text-align: center;">${statusIcon}</div>
                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}-110.webp" class="shirt me-2 cursor-pointer" onclick="showPlayerInfoById(${player.id})" style="width: 25px;" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="fw-bold text-white text-truncate cursor-pointer" onclick="showPlayerInfoById(${player.id})" style="font-size: 0.85rem;">${player.web_name}</div>
                    <div class="small text-white-50" style="font-size: 0.7rem;">${teamName} <span class="ms-1">${posText}</span></div>
                </div>
                <div style="width: 35px; text-align: center; font-size: 0.8rem;" class="text-white-50">${form}</div>
                <div style="width: 35px; text-align: center; font-size: 0.8rem;" class="text-white-50">${pts}</div>
                <div style="width: 45px; text-align: center; font-size: 0.8rem;" class="text-white-50">£${price}</div>
                <div style="width: 45px; text-align: center; font-size: 0.85rem;" class="fw-bold text-warning">${exp}</div>
                <div style="width: 35px; text-align: right;">
                    <button class="btn btn-sm btn-outline-success py-0 px-2 rounded-circle" onclick="planTransfer(${player.id})" title="Transfer In"><i class="fas fa-plus" style="font-size: 0.7rem;"></i></button>
                </div>
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
    const state = plannerState[gwIndex];
    
    const playerOut = state.squad.find(p => p.slotId === slotId);
    if(playerOut) {
        // If they click the exact same player they already had, it's an undo!
        let existingIndex = state.plannedTransfers.findIndex(t => t.slotId === slotId);
        if (existingIndex !== -1) {
            if (state.plannedTransfers[existingIndex].playerOutId === playerInId) {
                // Reverting the transfer
                state.plannedTransfers.splice(existingIndex, 1);
            } else {
                // Replacing the transfer
                state.plannedTransfers[existingIndex].playerInId = playerInId;
            }
        } else {
            // New transfer
            if (playerOut.id !== playerInId) {
                state.plannedTransfers.push({
                    slotId: slotId,
                    playerInId: playerInId,
                    playerOutId: playerOut.id
                });
            }
        }
    }
    
    selectedTransferOut = null;
    recalculateState();
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

function getPlayerFixtures(player, gameweekId) {
    return fixtures.filter(fixture => fixture.event === gameweekId &&
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

function showPlayerInfoById(id) {
    if(typeof showPlayerInfo === 'function') {
        const p = allPlayers.find(x => x.id === id);
        if(p) showPlayerInfo(p);
    }
}

let bankBalance = 100;
let myPlayers = [];
let filteredPlayers = [];
let managerPicks = [];
let currentLiveData = null;
let managerId = 0;
let rating = 0;
let points = 0;
let seasonPoints = 0;
let overallRating = 0;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let entryId = urlParams.get('entry');

    if (!entryId) {
        const match = document.cookie.match(new RegExp('(^| )managerId=([^;]+)'));
        if (match) {
            entryId = match[2];
        }
    }

    if (entryId) {
        try {
            managerId = entryId;
            const manager = await getManager(entryId);
            const managerTransfers = await getManagerTransfers(entryId);
            const managerHistory = await getManagerHistory(entryId);
        } catch (error) {
            console.error('Error fetching player data:', error);
        }
    } else {
        alert('No player ID provided.');
    }

    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of filteredPlayers
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});

function addPlayers(picks) {
    myPlayers = [];
    picks.forEach((pick, index) => {
        let player = allPlayers.find(p => p.id == pick.element);

        player.isCaptain = pick.is_captain;
        player.isVice = pick.is_vice_captain;

        if (index <= 10) {
            player.isSub = false;
        }
        else {
            player.isSub = true;
        }

        myPlayers.push(player);
    });

    updateTeamUI();
}

let selectedGameweek = 1;
const prevGameweekElement = document.getElementById('prevGameweek');

if (prevGameweekElement) {
    prevGameweekElement.addEventListener('click', () => {
        // Logic to go to the previous game week
        navigateGameweek('prev');
    });
} else {
    console.error('Element with ID "prevGameweek" does not exist.');
}

const nextGameweekElement = document.getElementById('nextGameweek');

if (nextGameweekElement) {
    nextGameweekElement.addEventListener('click', () => {
        // Logic to go to the next game week
        navigateGameweek('next');
    });
} else {
    console.error('Element with ID "nextGameweek" does not exist.');
}

// Function to handle next and previous gameweek navigation
function navigateGameweek(direction) {
    // Update selectedGameweek based on direction
    if (direction === 'next') {
        selectedGameweek++;
    } else if (direction === 'prev') {
        selectedGameweek--;
    }

    // Ensure selectedGameweek is within valid range
    if (selectedGameweek < gameweeks[0].id) {
        selectedGameweek = gameweeks[gameweeks.length - 1].id;
    } else if (selectedGameweek > gameweeks[gameweeks.length - 1].id) {
        selectedGameweek = gameweeks[0].id;
    }

    // Update gameweek info and deadline
    updateGameweekInfo();

    // Call your update function to refresh UI
    updateTeamUI();
}

// Function to update the gameweek info and deadline display
async function updateGameweekInfo() {
    const gameweekInfo = document.getElementById('gameweekInfo');

    if (!gameweekInfo) {
        return;
    }

    const gameweekDeadline = document.getElementById('gameweekDeadline');

    // Find the gameweek object for the current selected gameweek
    const currentGameweek = gameweeks.find(gw => gw.id === selectedGameweek);

    if (currentGameweek) {
        // Update the UI with the current gameweek info
        gameweekInfo.textContent = `Gameweek ${currentGameweek.id}`;
        gameweekDeadline.textContent = `Deadline: ${new Date(currentGameweek.deadline_time).toLocaleString()}`;
    }

    await calculateSeasonPoints();
    await getLatestPicks(currentGameweek.id);
}

async function getLatestPicks(gameweek) {
    managerPicks = [];
    currentLiveData = null;
    document.getElementById("points").hidden = true;

    if (gameweek <= getLastGameweekId() && managerId > 0) {
        managerPicks = await getManagerPicks(managerId, gameweek);
        currentLiveData = await getGameweek(gameweek);
    }

    rating = 0;
    points = 0;
    if (managerPicks.entry_history) {
        document.getElementById("points").hidden = false;
        points = managerPicks.entry_history.points;
        updateTeamInfo("Points", points);
        updateTeamInfo("Bank Balance", (managerPicks.entry_history.bank / 10) + 'm');
        rating = 100 - managerPicks.entry_history.percentile_rank;
        updateTeamInfo("GW Rating", rating + '%');
    }
    else
    {
        rating = (predictedPoints / 70) * 100;
        updateTeamInfo("GW Rating", parseInt(rating) + '%');
    }

    if (managerPicks.picks) {
        addPlayers(managerPicks.picks);
    }
}

async function calculateSeasonPoints() {
    let seasonPoints = 0;
    let overallRating = 0;

    // Normal for loop to handle async operations correctly
    for (let i = 0; i < gameweeks.length; i++) {
        const gw = gameweeks[i];

        let gwPoints = 0;
        let gwRating = 0;

        points = 0;
        await getLatestPicks(gw.id); // Will wait for this promise to resolve before continuing

        if (points > 0) {
            gwPoints += points;
        }
        else {
            myPlayers.forEach(player => {
                // Update fixtures and predicted points
                let fixture = getPlayerFixture(player, gw.id);
                player.predicted_points = calculatePlayerPredictedPoints(player, fixture, gw.id);
                //gwPoints += player.predicted_points;
            });

            const bestPlayers = optimizeTeam(myPlayers);
            bestPlayers.forEach(player => {
                gwPoints += player.predicted_points;
            });
        }

        if (gwRating <= 0) {
            gwRating = (gwPoints / 70) * 100;
        }

        seasonPoints += gwPoints;
        overallRating += gwRating;
    };

    updateTeamInfo("Overall Rating", parseInt(overallRating/gameweeks.length) + '%');
    updateTeamInfo("Season Points", parseInt(seasonPoints));
}

// Define a mapping of element types to position prefixes
const positionMap = {
    1: 'gk',  // Goalkeepers
    2: 'def', // Defenders
    3: 'mid', // Midfielders
    4: 'fwd'  // Forwards
};

// Global object to track the number of players per position
const filledSlots = {
    gk: 0,
    def: 0,
    mid: 0,
    fwd: 0
};

// Define the maximum allowed players per position
const maxSlots = {
    gk: 2,  // Max 2 Goalkeepers
    def: 5, // Max 5 Defenders
    mid: 5, // Max 5 Midfielders
    fwd: 3  // Max 3 Forwards
};

// Track available slots by position
const availableSlots = {
    gk: ['pos1', 'pos2'],
    def: ['pos3', 'pos4', 'pos5', 'pos6', 'pos7'],
    mid: ['pos8', 'pos9', 'pos10', 'pos11', 'pos12'],
    fwd: ['pos13', 'pos14', 'pos15']
};

let predictedPoints = 0;

 // Function to update the team UI
function updateTeamUI() {
    // Clear existing players from rows
    document.querySelectorAll('.row').forEach(row => row.innerHTML = '');

    predictedPoints = 0;
    let bankBalance = 100;
    let subs = 0;
    const filledPositions = {
        gk: 0,
        def: 0,
        mid: 0,
        fwd: 0
    };

    // Track available slot indices per position
    const availableSlotsCopy = {
        gk: [...availableSlots.gk],
        def: [...availableSlots.def],
        mid: [...availableSlots.mid],
        fwd: [...availableSlots.fwd]
    };

    // Iterate through each player and update the UI
    myPlayers.forEach(player => {
        const positionPrefix = positionMap[player.element_type];
        filledPositions[positionPrefix]++;
        if (player.isSub) subs++;

        // Assign a slot ID to the player
        assignSlotId(player, availableSlotsCopy);

        // Render the player element
        const playerElement = renderPlayerElement(player);

        // Determine the row based on the player's type and status
        const rowId = player.isSub ? 'subs' : getRowIdForElementType(player.element_type);

        // Append the player element to the appropriate row
        const row = document.getElementById(rowId);
        appendPlayerToRow(row, playerElement, player);

        // Update fixtures and predicted points
        predictedPoints = updatePlayerFixturesAndPoints(playerElement, player, predictedPoints);

        // Setup player actions (like swapping, removing, etc.)
        setupPlayerActions(playerElement, player);

        // Update bank balance
        bankBalance -= player.now_cost / 10;
        if (selectedGameweek >= getUpcomingGameweek().id) {
            updateTeamInfo("Bank Balance", `${bankBalance.toFixed(1)}m`);
        }
        updateTeamInfo("Predicted Points", predictedPoints.toFixed(0));
    });

    // Handle missing players/ghost players
    fillMissingPlayers(filledPositions, subs);
}

// Function to assign the next available slot to the player
function assignSlotId(player, availableSlotsCopy) {
    const positionPrefix = positionMap[player.element_type];
    if (!player.slotId) {
        player.slotId = availableSlotsCopy[positionPrefix].shift(); // Assign next available slot and remove from list
    }
}

// Function to render the HTML for the player element
function renderPlayerElement(player) {
    const playerElement = document.createElement('div');
    playerElement.className = 'player';
    playerElement.id = `player-${player.slotId}`;

    const isGK = player.element_type === 1;
    const shirtUrl = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}${isGK ? '_1' : ''}-110.webp`;
    const image = `<img src="${shirtUrl}" alt="${player.web_name}" onerror="if(!this.dataset.triedShirt){this.dataset.triedShirt='1';this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';}else{this.onerror=null;this.src='https://resources.premierleague.com/premierleague/photos/players/250x250/Photo-Missing.png';}">`;

    playerElement.innerHTML = `
        ${image}
        <h5>${player.web_name} ${player.isCaptain ? '(C)' : player.isVice ? '(V)' : ''}</h5>
        <h6>(${(player.now_cost / 10).toFixed(1)}m)</h6>
        <div class="fixtures">
            ${Array.from({ length: 3 }, (_, i) => `
                <div class="fixture">
                    <span class="predicted-points">0</span>
                    <span class="fixture-detail">FIX (H)</span>
                </div>
            `).join('')}
        </div>
        <div class="icon-buttons">
            <button class="icon-button"><i class="fas fa-exchange-alt"></i></button>
            <button class="icon-button"><i class="fas fa-trash"></i></button>
            <button class="icon-button"><i class="fas fa-crown ${player.isCaptain ? 'captain' : ''}"></i></button>
            <button class="icon-button"><i class="fas fa-star ${player.isVice ? 'vice' : ''}"></i></button>
            <button class="icon-button"><i class="fas fa-info-circle"></i></button>
        </div>
    `;

    return playerElement;
}

// Function to append the player to the correct row
function appendPlayerToRow(row, playerElement, player) {
    if (row) {
        if (player.isSub) {
            row.children[0].appendChild(playerElement);
        } else {
            row.appendChild(playerElement);
        }
    }
}

// Function to update player fixtures and predicted points
function updatePlayerFixturesAndPoints(playerElement, player, predictedPoints) {
    const upcomingGameweeks = gameweeks.filter(gw => gw.id >= selectedGameweek).slice(0, 3);

    playerElement.querySelectorAll('.fixture').forEach((fixtureElement, fixtureIndex) => {
        const upcomingGameweek = upcomingGameweeks[fixtureIndex];
        if (upcomingGameweek) {
            
            const playerFixture = getPlayerFixture(player, upcomingGameweek.id);
            if (playerFixture) {
                const opponentTeam = teams.find(team =>
                    team.id === (playerFixture.team_a === player.team ? playerFixture.team_h : playerFixture.team_a)
                );

                fixtureElement.querySelector('.fixture-detail').textContent = `${opponentTeam.short_name} (${playerFixture.team_a === player.team ? 'A' : 'H'})`;

                let playerPredictedPoints = calculatePlayerPredictedPoints(player, playerFixture, upcomingGameweek);

                // If it's the current gameweek and we have live data, show actual points
                let actualPoints = null;
                if (fixtureIndex === 0 && currentLiveData && currentLiveData.elements) {
                    let livePlayer = currentLiveData.elements.find(e => e.id === player.id);
                    if (livePlayer) {
                        let multiplier = 1;
                        if (managerPicks && managerPicks.picks) {
                            let pick = managerPicks.picks.find(p => p.element === player.id);
                            if (pick) multiplier = pick.multiplier;
                        }
                        actualPoints = livePlayer.stats.total_points * multiplier;
                    }
                }

                if (actualPoints !== null) {
                    fixtureElement.querySelector('.predicted-points').textContent = actualPoints;
                    fixtureElement.querySelector('.predicted-points').style.fontWeight = 'bold'; // Emphasize it's actual
                } else {
                    fixtureElement.querySelector('.predicted-points').textContent = playerPredictedPoints === '?' ? '?' : playerPredictedPoints.toFixed(1);
                    fixtureElement.querySelector('.predicted-points').style.fontWeight = 'normal';
                }

                if (fixtureIndex === 0 && !player.isSub) {
                    if (playerPredictedPoints !== '?') predictedPoints += playerPredictedPoints;
                }
            }
        }
    });

    return predictedPoints;
}

function getPlayerFixture(player, gameweekId) {
    return fixtures.find(fixture => fixture.event === gameweekId &&
                (fixture.team_a === player.team || fixture.team_h === player.team));
}

// Function to calculate predicted points for a player and a fixture
function calculatePlayerPredictedPoints(player, fixture, upcomingGameweek) {
    if (!fixture) return 0;

    let isHome = fixture.team_h === player.team;
    const opponentTeam = teams.find(team =>
        team.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a)
    );

    let playerPredictedPoints = getExpectedPoints(player, fixture);

    if (playerPredictedPoints === '?') return '?';

    if (getUpcomingGameweek() == upcomingGameweek) {
        player.fpl_ep_next = parseFloat(player.ep_next) || 0;
    }

    const strengthAdjustment2 = 0.10; // +10%
    const strengthAdjustment4 = 0.10; // -10%
    const strengthAdjustment5 = 0.20; // -20%
    const strengthAdjustmentAway = 0.10; // -10%

    // Adjust points based on opponent team strength
    if (opponentTeam.strength == 2 && playerPredictedPoints <= 10) {
        playerPredictedPoints += (playerPredictedPoints * strengthAdjustment2);
    }

    if (opponentTeam.strength == 4) {
        playerPredictedPoints -= (playerPredictedPoints * strengthAdjustment4);
    }

    if (opponentTeam.strength == 5) {
        playerPredictedPoints -= (playerPredictedPoints * strengthAdjustment5);
    }

    // Adjust points if player is away
    if (!isHome && playerPredictedPoints >= 2.5) {
        playerPredictedPoints -= (playerPredictedPoints * strengthAdjustmentAway);
    }

    // Round to 1 decimal place so the captain multiplier aligns perfectly with the UI display
    playerPredictedPoints = Math.round(playerPredictedPoints * 10) / 10;

    // Double the points if the player is the captain
    if (player.isCaptain) {
        playerPredictedPoints *= 2;
    }

    return playerPredictedPoints;
}

function fillMissingPlayers(filledPositions, subs) {
    // Define total players and substitutes
    const totalPlayers = 15;
    const numOfSubs = 4;
    const numOfOnFieldPlayers = totalPlayers - numOfSubs;

    // Calculate the number of players needed for each position
    const positions = ['gk', 'def', 'mid', 'fwd'];
    const missingPlayers = {};

    positions.forEach(pos => {
        missingPlayers[pos] = maxSlots[pos] - filledPositions[pos];
    });

    // Fill subs to ensure 4 substitutes, including 1 goalkeeper
    let remainingSubs = numOfSubs - subs;
    let remainingOnFieldPlayers = numOfOnFieldPlayers + subs - (filledPositions.gk + filledPositions.def + filledPositions.mid + filledPositions.fwd);

    // Generate list of players to add
    const playersToAdd = [];
    
    let count = 0;
    // Add remaining missing players as substitutes
    while (remainingSubs) {
        positions.forEach(pos => {
            const isMissing = missingPlayers[pos] > 0;
            if (isMissing && remainingSubs > 0) {
                const addToSubs = Math.min(1, remainingSubs);
                playersToAdd.push(...Array(addToSubs).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: true }));
                remainingSubs -= addToSubs;
                missingPlayers[pos] -= addToSubs;
            }
        });

        count++;
        if (count > 15) {
            break;
        }
    }

    // Add missing players to the field if there are still positions available
    positions.forEach(pos => {
        const missing = missingPlayers[pos];
        if (missing > 0 && remainingOnFieldPlayers > 0) {
            const addToField = Math.min(missing, remainingOnFieldPlayers);
            playersToAdd.push(...Array(addToField).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: false }));
            remainingOnFieldPlayers -= addToField;
            missingPlayers[pos] -= addToField;
        }
    });

    // Add empty placeholders if needed
    const maxPlayersPerPosition = {
        gk: maxSlots.gk - filledPositions.gk,
        def: maxSlots.def - filledPositions.def,
        mid: maxSlots.mid - filledPositions.mid,
        fwd: maxSlots.fwd - filledPositions.fwd
    };

    const fillPlaceholders = {
        gk: Math.max(0, maxPlayersPerPosition.gk),
        def: Math.max(0, maxPlayersPerPosition.def),
        mid: Math.max(0, maxPlayersPerPosition.mid),
        fwd: Math.max(0, maxPlayersPerPosition.fwd)
    };

    // Adjust for the total number of placeholders to fill
    const totalPlaceholders = {
        gk: fillPlaceholders.gk,
        def: fillPlaceholders.def,
        mid: fillPlaceholders.mid,
        fwd: fillPlaceholders.fwd,
        subs: numOfSubs - subs
    };

    if (playersToAdd.length > 0) {
        playersToAdd.forEach(player => {
            myPlayers.push(player);
        });
        updateTeamUI();
    }
    
    // Return the players to add and placeholders
    return {
        playersToAdd,
        totalPlaceholders
    };
}

// Helper function to determine the row ID based on player type
function getRowIdForElementType(elementType) {
    switch (elementType) {
        case 1: return 'goalkeepers';
        case 2: return 'defenders';
        case 3: return 'midfielders';
        case 4: return 'forwards';
        default: return 'subs'; // Default to subs if elementType is unknown
    }
}

playerSwap = [];

function setupPlayerActions(playerElement, player) {
    // Remove existing event listeners by cloning the node
    const newPlayerElement = playerElement.cloneNode(true);
    playerElement.replaceWith(newPlayerElement);

    // Set up captain button
    const captainButton = newPlayerElement.querySelector('.icon-button i.fa-crown').parentElement;
    if (captainButton) {
        captainButton.addEventListener('click', () => {
            captainPlayer(player);
        });
    }

    // Set up info button
    const infoButton = newPlayerElement.querySelector('.icon-button i.fa-info-circle').parentElement;
    if (infoButton) {
        infoButton.addEventListener('click', () => {
            showPlayerInfo(player);
        });
    }

    // Add other buttons' functionalities similarly
}

// Function to handle swap logic and queueing players for swap
function swapPlayer(player) {
    const index = myPlayers.findIndex(p => p.id === player.id);
    if (index === -1) return;

    // If no player is queued for swap, queue this player
    if (playerSwap.length === 0) {
        playerSwap.push(index);
        console.log(`Player at index ${index} queued for swap.`);
        return;
    }
    
    // If a player is already queued, swap with the currently queued player
    const index1 = playerSwap[0];
    const index2 = index;

    if (index1 === index2) {
        console.log('Cannot swap the same player.');
        removeSwapIndicator(index1); // Remove visual indicator if the same player is clicked twice
        playerSwap = [];
        return;
    }

    const player1 = myPlayers[index1];
    const player2 = myPlayers[index2];

    // Find the rows of the players
    const row1 = player1.isSub ? 'subs' : getRowForPlayer(player1);
    const row2 = player2.isSub ? 'subs' : getRowForPlayer(player2);

    // Allow swap if players are in the same row or one is a sub and the other is not
    if (row1 === row2 || (player1.isSub && !player2.isSub) || (!player1.isSub && player2.isSub)) {
        // Perform the swap in the array
        [myPlayers[index1], myPlayers[index2]] = [myPlayers[index2], myPlayers[index1]];

        // Swap the isSub status as well
        [myPlayers[index1].isSub, myPlayers[index2].isSub] = [myPlayers[index2].isSub, myPlayers[index1].isSub];

        // Recalculate the field and subs after swap
        const fieldPlayers = myPlayers.filter(player => !player.isSub);
        const playerCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // Count players of each type currently on the field
        fieldPlayers.forEach(player => {
            playerCounts[player.element_type]++;
        });

        const minConstraints = { 1: 1, 2: 3, 3: 2, 4: 1 };
        const maxConstraints = { 1: 1, 2: 5, 3: 5, 4: 3 };

        // Check for min and max constraints
        for (const type in playerCounts) {
            if (playerCounts[type] < minConstraints[type] || playerCounts[type] > maxConstraints[type]) {
                console.log('Invalid swap: This swap would violate formation constraints.');
                alert('Swap failed: Formation constraints violated.');
                // Swap back to original positions if constraints are violated
                [myPlayers[index1], myPlayers[index2]] = [myPlayers[index2], myPlayers[index1]];
                [myPlayers[index1].isSub, myPlayers[index2].isSub] = [myPlayers[index2].isSub, myPlayers[index1].isSub];
                removeSwapIndicator(index1); // Remove swap indicator
                removeSwapIndicator(index2);
                playerSwap = [];
                return;
            }
        }

        document.getElementById('saveButton').disabled = false;

        // After swapping, update the UI to reflect the new positions and statuses
        updateTeamUI();
        console.log(`Players swapped successfully between positions ${index1} and ${index2}.`);

        // Remove swap indicators after the swap is successful
        removeSwapIndicator(index1);
        removeSwapIndicator(index2);
        playerSwap = [];
    } else {
        console.log('Invalid swap: Players are not in the same row or cannot be swapped.');
        alert('Swap failed: Players are not in the same row or cannot be swapped.');
        removeSwapIndicator(index1); // Remove swap indicator
        removeSwapIndicator(index2);
        playerSwap = [];
    }
}

function setManager() {
    // Disable the button
    document.getElementById('setManagerButton').disabled = true;

    // Save the cookie
    document.cookie = `managerId=${managerId}; path=/; max-age=31536000`; // Cookie expires in 1 year
}

// Function to remove swap visual indicator
function removeSwapIndicator(index) {
    const playerElement = document.getElementById(`player-${myPlayers[index].slotId}`);
    if (playerElement) {
        playerElement.classList.remove('swap-queued');
    }
}

// Function to determine the row for a player
function getRowForPlayer(player) {
    if (player.element_type === 1) return 'goalkeepers';
    if (player.element_type === 2) return 'defenders';
    if (player.element_type === 3) return 'midfielders';
    if (player.element_type === 4) return 'forwards';
    return 'subs'; // Default case, should not be used for on-field players
}

// Function to update team info
function updateTeamInfo(label, newValue) {
    // Find all team info items
    const teamInfoItems = document.querySelectorAll('.team-info-item');
    
    // Iterate through the items to find the correct label
    teamInfoItems.forEach(item => {
        const itemLabel = item.querySelector('.label').textContent.trim();
        if (itemLabel === label) {
            item.querySelector('.value').textContent = newValue;
        }
    });
}

async function Initialize() {
    if (!gameweeks || gameweeks.length === 0) {
        document.body.innerHTML = `
            <div class="container mt-5 text-center text-white p-5 border border-danger rounded bg-dark">
                <h3 class="text-danger">Failed to load FPL Data</h3>
                <p>Your network might be blocking the API requests.</p>
                <p>Try switching from mobile data to Wi-Fi, or use a VPN.</p>
                <button class="btn btn-primary mt-3" onclick="window.location.reload()">Retry</button>
            </div>
        `;
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
        return;
    }
    filteredPlayers = allPlayers;

    selectedGameweek = getLastGameweekId();
    updateGameweekInfo();
}

// Function to fetch and show player info
