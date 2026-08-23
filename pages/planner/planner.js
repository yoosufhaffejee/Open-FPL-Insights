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
                            <span class="cursor-pointer ${isCap}" onclick="setCaptain(${slotId}, true)" title="Set Captain">[C]</span> 
                            <span class="cursor-pointer ${isVice} ms-1" onclick="setCaptain(${slotId}, false)" title="Set Vice Captain">[V]</span>
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
            let outline = isCellSelected ? 'outline: 2px solid #ff005a;' : '';
            
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
}


function initPlannerSidebar() {
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
    
    // Filter by name
    if (query) {
        filtered = filtered.filter(p => 
            (p.web_name && p.web_name.toLowerCase().includes(query)) || 
            (p.first_name && p.first_name.toLowerCase().includes(query)) || 
            (p.second_name && p.second_name.toLowerCase().includes(query))
        );
    }
    
    // Filter by position
    if (view.startsWith('pos_')) {
        let pos = parseInt(view.split('_')[1]);
        filtered = filtered.filter(p => p.element_type === pos);
    }
    
    // Filter by max price
    if (max < 999) {
        filtered = filtered.filter(p => (p.now_cost / 10) <= max);
    }

    // Sort
    filtered = filtered.sort((a, b) => {
        let valA = parseFloat(a[sort]) || 0;
        let valB = parseFloat(b[sort]) || 0;
        // Specific case for now_cost if we wanted cheapest first, but FPL usually sorts most expensive first
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
        
        // Injury/suspension status
        let statusIcon = '';
        if (player.status === 'i' || player.status === 's') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-danger" title="Injured/Suspended"></i>';
        } else if (player.status === 'd') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-warning" title="Doubtful"></i>';
        } else {
            statusIcon = '<i class="fas fa-info-circle text-white-50"></i>';
        }

        const item = document.createElement('div');
        item.className = 'player-list-item transfer-in-candidate py-2 border-bottom border-secondary';
        
        item.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <div class="me-2" style="width: 15px; text-align: center;">${statusIcon}</div>
                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}-110.webp" class="shirt me-2" style="width: 25px;" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'">
                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="fw-bold text-white text-truncate" style="font-size: 0.85rem;">${player.web_name}</div>
                    <div class="small text-white-50" style="font-size: 0.7rem;">${teamName} <span class="ms-1">${posText}</span></div>
                </div>
                <div style="width: 40px; text-align: center; font-size: 0.8rem;" class="text-white-50">
                    £${price}
                </div>
                <div style="width: 40px; text-align: center; font-size: 0.85rem;" class="fw-bold">
                    ${sortVal}
                </div>
                <div style="width: 40px; text-align: right;">
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
