let upcomingGWs = [];
let plannerState = []; 
let selectedTransferOut = null; 
let baseSquadCache = [];
let initialBankCache = 0;

async function Initialize() {
    let currentGW = getUpcomingGameweek();
    if (currentGW && currentGW.id <= 19) {
        upcomingGWs = gameweeks.slice(0, 19);
    } else {
        upcomingGWs = gameweeks.slice(19, 38);
    } 
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
                        let p = { ...player, slotId: pick.position, isSub: pick.position > 11, isCaptain: pick.is_captain, isVice: pick.is_vice_captain };
                        if (pick.purchase_price !== undefined) p.purchase_price = pick.purchase_price;
                        if (pick.selling_price !== undefined) p.selling_price = pick.selling_price;
                        if (pick.purchase_value !== undefined) p.purchase_price = pick.purchase_value;
                        if (pick.selling_value !== undefined) p.selling_price = pick.selling_value;
                        return p;
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
        let myPlayersCookie = null;
        const currentId = getUpcomingGameweek() ? getUpcomingGameweek().id : 1;
        for (let i = currentId; i >= 1; i--) {
            myPlayersCookie = getCookie('myPlayersGW' + i);
            if (myPlayersCookie) break;
        }
        if (!myPlayersCookie) {
            for (let i = currentId + 1; i <= 38; i++) {
                myPlayersCookie = getCookie('myPlayersGW' + i);
                if (myPlayersCookie) break;
            }
        }
        if (!myPlayersCookie) myPlayersCookie = getCookie('myPlayers'); // absolute fallback

        if (myPlayersCookie) {
            const parsed = JSON.parse(myPlayersCookie);
            const players = parsed.players ? parsed.players : parsed;

            baseSquad = players.map(({ id, slotId, isSub, isCaptain, isVice }) => {
                const player = allPlayers.find(p => p.id === id);
                if (player) {
                    return { ...player, slotId, isSub, isCaptain, isVice };
                }
                return null;
            }).filter(p => p !== null);
        }
    }
    
    // Ensure all slotIds are strictly unique to fix malformed cookie duplicates
    baseSquad.forEach((p, idx) => {
        p.slotId = 'pos' + (idx + 1);
    });

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
    
    loadPlannerState();
    recalculateState();

    
    
    document.getElementById('resetPlanBtn')?.addEventListener('click', () => {
        plannerState.forEach(state => {
            state.plannedTransfers = [];
            state.activeChip = null;
            state.captainOverride = null;
            state.viceOverride = null;
        });
        localStorage.removeItem('fpl_planner_save');
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
        
        // Handle per-GW captain override
        if (state.captainOverride) {
            newSquad.forEach(p => {
                if (p.slotId === state.captainOverride) {
                    p.isCaptain = true;
                    p.isVice = false;
                } else if (p.isCaptain) {
                    p.isCaptain = false;
                }
            });
        }
        if (state.viceOverride) {
            newSquad.forEach(p => {
                if (p.slotId === state.viceOverride) {
                    p.isVice = true;
                    p.isCaptain = false;
                } else if (p.isVice) {
                    p.isVice = false;
                }
            });
        }
        
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
    
    // Auto-save whenever state recalculates
    if (typeof savePlannerState === 'function') {
        savePlannerState();
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
    
    let headerHTML = '<th style="text-align: left;">Player</th>';
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
        body.innerHTML = '<tr><td colspan="6" class="text-center p-5">No squad found. Please select a team via the managers page. leagues > managers, see help and setup for more info.</td></tr>';
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
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${gw0Player.team_code}${gw0Player.element_type == 1 ? '_1' : ''}-110.webp" class="shirt cursor-pointer" onclick="selectTransferOut('${slotId}', 0)" onerror="playerImgOnerror(this, ${gw0Player.team_code}, ${gw0Player.element_type})">
                    <div>
                        <div class="fw-bold cursor-pointer" onclick="selectTransferOut('${slotId}', 0)">${gw0Player.web_name}${subBadge}</div>
                        <div class="small text-white-50">${teamName} - £${(gw0Player.now_cost/10).toFixed(1)}m</div>
                        <div class="small mt-1" style="font-size:0.7rem;">
                            <span class="cursor-pointer ${isCap}" onclick="setCaptain('${slotId}', true)" title="Set Captain" style="cursor: pointer;">[C]</span> 
                            <span class="cursor-pointer ${isVice} ms-1" onclick="setCaptain('${slotId}', false)" title="Set Vice Captain" style="cursor: pointer;">[V]</span>
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
            
            let cellCapClass = playerInSlot.isCaptain ? 'text-warning fw-bold' : 'text-white-50 opacity-50';
            let cellViceClass = playerInSlot.isVice ? 'text-info fw-bold' : 'text-white-50 opacity-50';

            gwsHTML += `
                <td style="${outline} cursor: pointer; vertical-align: top;" onclick="selectTransferOut('${slotId}', ${gwIndex})">
                    <div class="gw-cell ${fdrClass} h-100 d-flex flex-column justify-content-between">
                        ${changedPlayerHtml}
                        <div class="opp lh-sm mb-1" style="font-size: 0.75rem;">${oppText}</div>
                        <div class="pts">${ptsDisplay} pts</div>
                        <div class="d-flex justify-content-center gap-2 mt-1" style="font-size: 0.65rem;">
                            <span class="cursor-pointer ${cellCapClass}" onclick="event.stopPropagation(); setCaptain('${slotId}', true, ${gwIndex})" title="Set Captain">[C]</span>
                            <span class="cursor-pointer ${cellViceClass}" onclick="event.stopPropagation(); setCaptain('${slotId}', false, ${gwIndex})" title="Set Vice Captain">[V]</span>
                        </div>
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
        
        if (state.activeChip === 'BB') {
            state.squad.forEach(p => {
                totalPts += calcPlayerGwPoints(p, upcomingGWs[gwIndex].id, state);
            });
        } else {
            let playersWithPts = state.squad.map(p => ({
                ...p,
                gwPts: calcPlayerGwPoints(p, upcomingGWs[gwIndex].id, state)
            }));
            
            const gk = playersWithPts.filter(p => p.element_type === 1).sort((a, b) => b.gwPts - a.gwPts);
            const def = playersWithPts.filter(p => p.element_type === 2).sort((a, b) => b.gwPts - a.gwPts);
            const mid = playersWithPts.filter(p => p.element_type === 3).sort((a, b) => b.gwPts - a.gwPts);
            const fwd = playersWithPts.filter(p => p.element_type === 4).sort((a, b) => b.gwPts - a.gwPts);
            
            let maxPoints = -999;
            
            for (let defCount = 3; defCount <= 5; defCount++) {
                for (let midCount = 2; midCount <= 5; midCount++) {
                    for (let fwdCount = 1; fwdCount <= 3; fwdCount++) {
                        if (1 + defCount + midCount + fwdCount === 11) {
                            let pts = 0;
                            if (gk.length > 0) pts += gk[0].gwPts;
                            for (let i = 0; i < defCount; i++) if (def[i]) pts += def[i].gwPts;
                            for (let i = 0; i < midCount; i++) if (mid[i]) pts += mid[i].gwPts;
                            for (let i = 0; i < fwdCount; i++) if (fwd[i]) pts += fwd[i].gwPts;
                            
                            if (pts > maxPoints) {
                                maxPoints = pts;
                            }
                        }
                    }
                }
            }
            totalPts = maxPoints !== -999 ? maxPoints : 0;
        }
        
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

function setCaptain(slotId, isCaptain, gwIndex = null) {
    if (gwIndex === null) {
        // Global update via left sidebar
        baseSquadCache.forEach(p => {
            if (isCaptain) {
                if(p.slotId === slotId) { p.isCaptain = true; p.isVice = false; }
                else { p.isCaptain = false; }
            } else {
                if(p.slotId === slotId) { p.isVice = true; p.isCaptain = false; }
                else { p.isVice = false; }
            }
        });
        // Clear all future overrides so the base takes over
        plannerState.forEach(state => {
            if (isCaptain) state.captainOverride = null;
            else state.viceOverride = null;
        });
    } else {
        // Per-gameweek update
        let state = plannerState[gwIndex];
        if (isCaptain) {
            state.captainOverride = slotId;
            if (state.viceOverride === slotId) state.viceOverride = null;
        } else {
            state.viceOverride = slotId;
            if (state.captainOverride === slotId) state.captainOverride = null;
        }
    }
    
    recalculateState();
    renderPlannerGrid();
    if (typeof savePlannerState === 'function') savePlannerState();
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
        listContainer.innerHTML = '<tr><td colspan="7" class="text-center text-white-50 mt-5 pt-5 border-0"><p>No players found.</p></td></tr>';
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
        let sel = parseFloat(player.selected_by_percent).toFixed(1) + '%';
        
        // Injury/suspension status
        let statusIcon = '';
        if (player.status === 'i' || player.status === 's') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-danger" title="Injured/Suspended"></i>';
        } else if (player.status === 'd') {
            statusIcon = '<i class="fas fa-exclamation-triangle text-warning" title="Doubtful"></i>';
        } else {
            statusIcon = '<i class="fas fa-info-circle text-white-50 cursor-pointer" onclick="showPlayerInfoById('+player.id+')"></i>';
        }

        const item = document.createElement('tr');
        item.className = 'transfer-in-candidate';
        
        item.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <div class="me-2" style="width: 15px; text-align: center;">${statusIcon}</div>
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}${player.element_type == 1 ? '_1' : ''}-110.webp" class="shirt me-2 cursor-pointer" onclick="showPlayerInfoById(${player.id})" style="width: 25px;" onerror="playerImgOnerror(this, ${player.team_code}, ${player.element_type})">
                    <div class="flex-grow-1" style="min-width: 0;">
                        <div class="fw-bold text-white text-truncate cursor-pointer" onclick="showPlayerInfoById(${player.id})" style="font-size: 0.85rem; max-width: 120px;">${player.web_name}</div>
                        <div class="small text-white-50" style="font-size: 0.7rem;">${teamName} <span class="ms-1">${posText}</span></div>
                    </div>
                </div>
            </td>
            <td class="text-center fw-bold text-warning" style="font-size: 0.85rem;">${exp}</td>
            <td class="text-center text-white-50" style="font-size: 0.8rem;">${pts}</td>
            <td class="text-center text-white-50" style="font-size: 0.8rem;">£${price}</td>
            <td class="text-center text-white-50" style="font-size: 0.8rem;">${form}</td>
            <td class="text-center text-white-50" style="font-size: 0.8rem;">${sel}</td>
            <td style="position: sticky; right: 0; background-color: #212529; text-align: center; border-left: 1px solid #495057;">
                <button class="btn btn-sm btn-outline-success rounded-circle d-inline-flex align-items-center justify-content-center p-0" style="width: 24px; height: 24px; margin: auto;" onclick="planTransfer(${player.id})" title="Transfer In">
                    <i class="fas fa-plus" style="font-size: 0.7rem; display: block;"></i>
                </button>
            </td>
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

function showPlayerInfo(player) {
    getPlayer(player.id)
        .then(response => {
            // Populate the modal with the player info
            populatePlayerModal(response, player);
            // Show the modal
            const playerInfoModal = new bootstrap.Modal(document.getElementById('playerInfoModal'));
            playerInfoModal.show();
        })
        .catch(error => console.log('Error fetching player info:', error));
}

// Function to populate the modal with player data
function populatePlayerModal(data, player) {
    // Set the player name in the modal title
    const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    document.getElementById('playerInfoModalLabel').innerHTML = `
        <div class="d-flex align-items-center gap-3 w-100">
            <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" 
                 style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; background: #eee;" 
                 onerror="playerImgOnerror(this, ${player.team_code}, ${player.element_type})">
            <div>
                <h3 class="mb-1 fw-bold">${player.first_name} ${player.second_name}</h3>
                <div class="d-flex flex-wrap align-items-center gap-3 text-muted" style="font-size: 0.9rem;">
                    <span class="badge bg-secondary px-2 py-1">${positionMap[player.element_type]}</span>
                    <span><i class="fas fa-pound-sign me-1"></i>${(player.now_cost / 10).toFixed(1)}m</span>
                    <span><i class="fas fa-users me-1 text-secondary"></i>${player.selected_by_percent}% owned</span>
                    <span><i class="fas fa-star text-warning me-1"></i>${player.total_points} pts</span>
                </div>
            </div>
        </div>
    `;

    // Clear previous data
    const fixturesList = document.getElementById('upcoming-fixtures-list');
    const recentMatchesTable = document.querySelector('#recent-matches-table tbody');
    const pastSeasonsTable = document.querySelector('#past-seasons-table tbody');

    fixturesList.innerHTML = '';
    recentMatchesTable.innerHTML = '';
    pastSeasonsTable.innerHTML = '';

    const fplPredictedElem = document.getElementById('modal-fpl-predicted');
    const ourPredictedElem = document.getElementById('modal-our-predicted');
    
    if (fplPredictedElem && ourPredictedElem) {
        fplPredictedElem.textContent = player.ep_next ? player.ep_next : '0.0';
        fplPredictedElem.style.color = '#333';
        fplPredictedElem.style.textShadow = 'none';
        
        const upcomingGameweek = gameweeks.find(gw => gw.id >= (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id));
        const gwNum = upcomingGameweek ? upcomingGameweek.id : (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id);
        
        const fplTitle = document.getElementById('modal-fpl-title');
        const ourTitle = document.getElementById('modal-our-title');
        if (fplTitle) fplTitle.textContent = `FPL Model (GW${gwNum})`;
        if (ourTitle) ourTitle.textContent = `Our Algorithm (GW${gwNum})`;
        
        let predictedPoints = player.predicted_points;
        if (predictedPoints === undefined) {
            const upcomingGameweek = gameweeks.find(gw => gw.id >= (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id));
            if (upcomingGameweek) {
                const fixture = getPlayerFixture(player, upcomingGameweek.id);
                if (fixture) {
                    predictedPoints = calculatePlayerPredictedPoints(player, fixture, upcomingGameweek.id);
                }
            }
        }
        
        // Always show the non-captained version in this menu
        // Raw predicted points are non-captained by default now.

        ourPredictedElem.textContent = (predictedPoints !== undefined && predictedPoints !== '?') ? Number(predictedPoints).toFixed(1) : (predictedPoints === '?' ? '?' : '0.0');
        ourPredictedElem.style.color = '#333';
                        ourPredictedElem.style.textShadow = 'none';
        
        // Populate Breakdown Card
        const breakdownCard = document.getElementById('modal-breakdown-card');
        const breakdownBody = document.getElementById('modal-our-breakdown');
        if (breakdownCard && breakdownBody) {
            breakdownCard.style.display = 'block';
            let playChance = 100;
            if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) playChance = player.chance_of_playing_next_round;
            else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) playChance = player.chance_of_playing_this_round;
            
            let html = '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Play Prob & App Base:</span><span class="text-success">60m+ <span class="text-white-50 small">(2.0 pts)</span> | <span class="text-info">' + playChance + '% prob</span></span></div>';
            
            // Goals
            let xG = parseFloat(player.expected_goals_per_90) || 0;
            if (xG > 0) {
                let ptsPerGoal = player.element_type === 1 ? 10 : (player.element_type === 2 ? 6 : (player.element_type === 3 ? 5 : 4));
                let expectedGoalPts = (xG * ptsPerGoal).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>xG Base:</span><span class="text-success">' + xG.toFixed(2) + ' <span class="text-white-50 small">(' + expectedGoalPts + ' pts)</span></span></div>';
            }
            
            // Assists
            let xA = parseFloat(player.expected_assists_per_90) || 0;
            if (xA > 0) {
                let expectedAssistPts = (xA * 3).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>xA Base:</span><span class="text-success">' + xA.toFixed(2) + ' <span class="text-white-50 small">(' + expectedAssistPts + ' pts)</span></span></div>';
            }
            
            // Clean Sheets
            let xCS = parseFloat(player.clean_sheets_per_90) || 0;
            if (xCS > 0 && player.element_type !== 4) { // Not for forwards
                let displayCS = Math.min(1.0, xCS);
                let ptsPerCS = player.element_type === 3 ? 1 : 4;
                let expectedCSPts = (displayCS * ptsPerCS).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Clean Sheet:</span><span class="text-success">' + (displayCS*100).toFixed(0) + '% <span class="text-white-50 small">(' + expectedCSPts + ' pts)</span></span></div>';
            }

            // DEFCON (Only for DEF/MID)
            let defCon = parseFloat(player.defensive_contribution_per_90) || 0;
            if (defCon > 0 && (player.element_type === 2 || player.element_type === 3)) {
                let threshold = (player.element_type === 2) ? 10 : 12;
                let prob = defCon / threshold;
                if (prob > 1.0) prob = 1.0;
                let expectedDefconPts = prob.toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>DEFCON / 90:</span><span class="text-warning">' + defCon.toFixed(1) + ' <span class="text-white-50 small">(' + expectedDefconPts + ' pts)</span></span></div>';
            }

            // Saves (Only for GK)
            let saves = parseFloat(player.saves_per_90) || 0;
            if (saves > 0 && player.element_type === 1) {
                let expectedSavesPts = (saves * (1/3)).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Saves / 90:</span><span class="text-warning">' + saves.toFixed(1) + ' <span class="text-white-50 small">(' + expectedSavesPts + ' pts)</span></span></div>';
            }
            
            // Goals Conceded (Only for GK/DEF)
            let xGC = parseFloat(player.expected_goals_conceded_per_90) || 0;
            if (xGC > 0 && (player.element_type === 1 || player.element_type === 2)) {
                let expectedGcPts = (xGC / 2).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>xGC Base:</span><span class="text-danger">' + xGC.toFixed(2) + ' <span class="text-white-50 small">(-' + expectedGcPts + ' pts)</span></span></div>';
            }
            
            // Cards Deduction
            if (player.minutes > 0) {
                let y_per_90 = player.yellow_cards / (player.minutes / 90);
                let r_per_90 = player.red_cards / (player.minutes / 90);
                let expectedCardPts = (y_per_90 + (3 * r_per_90)).toFixed(2);
                if (expectedCardPts > 0) {
                    html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Cards / 90:</span><span class="text-danger"> <span class="text-white-50 small">(-' + expectedCardPts + ' pts)</span></span></div>';
                }
            }
            
            // Exp Bonus
            let expectedBonus = 0;
            const fixture = getPlayerFixture(player, upcomingGameweek.id);
            if (fixture && typeof allPlayers !== 'undefined') {
                let oppTeamId = (player.team === fixture.team_h) ? fixture.team_a : fixture.team_h;
                let matchPlayers = allPlayers.filter(p => p.team === player.team || p.team === oppTeamId);
                let playerBPSProjections = matchPlayers.map(p => {
                    let bps90 = (p.minutes !== undefined && p.minutes > 0) ? (p.bps / (p.minutes / 90)) : 0;
                    let form = parseFloat(p.form) || 0;
                    return { id: p.id, projBPS: bps90 + form };
                });
                playerBPSProjections.sort((a, b) => b.projBPS - a.projBPS);
                if (playerBPSProjections.length > 0 && playerBPSProjections[0].id === player.id) expectedBonus = 2.5;
                else if (playerBPSProjections.length > 1 && playerBPSProjections[1].id === player.id) expectedBonus = 1.5;
                else if (playerBPSProjections.length > 2 && playerBPSProjections[2].id === player.id) expectedBonus = 0.8;
                else if (playerBPSProjections.length > 3 && playerBPSProjections[3].id === player.id) expectedBonus = 0.4;
                else if (playerBPSProjections.length > 4 && playerBPSProjections[4].id === player.id) expectedBonus = 0.2;
                
                let histBonus = (player.minutes > 0) ? (player.bonus / (player.minutes / 90)) : 0;
                expectedBonus = (expectedBonus + histBonus) / 2;
                expectedBonus = Math.min(2.0, expectedBonus);
            } else {
                expectedBonus = (player.minutes > 0) ? (player.bonus / (player.minutes / 90)) : 0;
                expectedBonus = Math.min(1.5, expectedBonus);
            }

            if (expectedBonus > 0) {
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Exp Bonus:</span><span class="text-success">Proj Rank <span class="text-white-50 small">(+' + expectedBonus.toFixed(1) + ' pts)</span></span></div>';
            }
            
            let fdr = 3;
            if (fixture && fixture.team_h === player.team) fdr = fixture.team_h_difficulty;
            else if (fixture && fixture.team_a === player.team) fdr = fixture.team_a_difficulty;
            let formStr = parseFloat(player.form).toFixed(1);
            let fdrColor = fdr <= 2 ? 'text-success' : (fdr >= 4 ? 'text-danger' : 'text-warning');
            
            html += `<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary">
                        <span>Form & FDR Adj:</span>
                        <span class="text-white-50 small">
                            Form: <span class="text-info">${formStr}</span> | 
                            FDR: <span class="${fdrColor}">${fdr}</span> 
                            <i class="fa-solid fa-circle-check text-success ms-1" title="Multipliers Applied"></i>
                        </span>
                     </div>`;
            
            if (predictedPoints !== undefined) {
                html += '<div class="d-flex justify-content-between pt-1 mt-1 border-top border-secondary fw-bold text-white"><span>Final Prediction:</span><span class="text-success">' + (predictedPoints === '?' ? '?' : predictedPoints.toFixed(1)) + ' pts</span></div>';
            }
            
            breakdownBody.innerHTML = html;
        }
    }



    // Populate Upcoming Fixtures
    const maxFixtures = 38;
    data.fixtures.slice(0, maxFixtures).forEach(fixture => {
        const opponentTeam = getTeamById(fixture.is_home ? fixture.team_a : fixture.team_h);
        const difficultyClass = getDifficultyClass(fixture.difficulty);
        const homeAway = fixture.is_home ? 'H' : 'A';

        const fixtureItem = document.createElement('div');
        fixtureItem.classList.add('p-2', 'flex-shrink-0', 'border', 'rounded', 'me-2');
        fixtureItem.style.width = '150px'; // Adjust width as needed for better visibility

        // Create the fixture item content
        fixtureItem.innerHTML = `
            <div><strong>GW${fixture.event}:</strong> ${opponentTeam.short_name} (${homeAway})</div>
            <div>
                <img src="https://resources.premierleague.com/premierleague/badges/100/t${opponentTeam.code}.png" 
                     alt="${opponentTeam.short_name}" 
                     style="width: 40px; height: 40px;">
            </div>
            <div><span class="badge ${difficultyClass}">${fixture.difficulty}</span></div>
            <div>${formatFixtureDateTime(fixture.kickoff_time)}</div>
        `;

        fixturesList.appendChild(fixtureItem);
    });

    // Populate Recent Matches
    // Sort matches by date, with the most recent match first
    const sortedHistory = data.history.sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

    sortedHistory.forEach(match => {
        const opponentTeam = getTeamById(match.opponent_team); // Get the opponent team by ID

        // Determine the match result: Win, Loss, or Draw
        let resultBadge;
        if (match.team_h_score === match.team_a_score) {
            resultBadge = `<span class="badge bg-secondary">D</span>`;  // Draw badge (grey)
        } else if ((match.was_home && match.team_h_score > match.team_a_score) ||
                (!match.was_home && match.team_a_score > match.team_h_score)) {
            resultBadge = `<span class="badge bg-success">W</span>`;  // Win badge (green)
        } else {
            resultBadge = `<span class="badge bg-danger">L</span>`;  // Loss badge (red)
        }

        // Format score as "HomeTeamScore-AwayTeamScore"
        const score = match.was_home 
            ? `${match.team_h_score}-${match.team_a_score}`
            : `${match.team_a_score}-${match.team_h_score}`;

        // Create table row with opponent image, score, and result
        const matchRow = `
        <tr>
            <td>${match.round}</td>
            <td>${formatFixtureDateTime(match.kickoff_time)}</td>
            <td>
                <div class="d-flex flex-column align-items-center">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${opponentTeam.code}.png" 
                         alt="${opponentTeam.short_name}" style="width: 30px; height: 30px;">
                    <span>${opponentTeam.short_name}</span>
                </div>
            </td>
            <td>${score}</td>
            <td>${resultBadge}</td>
            <td>${match.total_points}</td>
            <td>${match.bonus}</td>
            <td>${(match.value/10).toFixed(1)}m</td>
            <td>${match.minutes}</td>
            <td>${match.goals_scored}</td>
            <td>${match.assists}</td>
            <td>${match.saves}</td>
            <td>${match.clean_sheets}</td>
            <td>${match.goals_conceded}</td>
            <td>${match.expected_goals}</td>
            <td>${match.expected_goal_involvements}</td>
            <td>${match.expected_assists}</td>
            <td>${match.expected_goals_conceded}</td>
            <td>${match.yellow_cards}</td>
            <td>${match.red_cards}</td>
            <td>${match.own_goals}</td>
            <td>${match.penalties_saved}</td>
            <td>${match.penalties_missed}</td>
            <td>${match.bps}</td>
            <td>${match.defensive_contribution}</td>
            <td>${match.influence}</td>
            <td>${match.creativity}</td>
            <td>${match.threat}</td>
            <td>${match.ict_index}</td>
            <td>${match.starts}</td>
            <td>${match.selected}</td>
            <td>${match.transfers_in}</td>
            <td>${match.transfers_out}</td>
        </tr>`;
        
        recentMatchesTable.insertAdjacentHTML('beforeend', matchRow);
    });

    // Populate Past Seasons
    data.history_past.forEach(season => {
        const pastSeasonRow = `
            <tr>
                <td>${season.season_name}</td>
                <td>${(season.start_cost/10).toFixed(1)}m</td>
                <td>${(season.end_cost/10).toFixed(1)}m</td>
                <td>${season.total_points}</td>
                <td>${season.minutes}</td>
                <td>${season.goals_scored}</td>
                <td>${season.assists}</td>
                <td>${season.clean_sheets}</td>
                <td>${season.goals_conceded}</td>
                <td>${season.own_goals}</td>
                <td>${season.penalties_saved}</td>
                <td>${season.penalties_missed}</td>
                <td>${season.yellow_cards}</td>
                <td>${season.red_cards}</td>
                <td>${season.saves}</td>
                <td>${season.bonus}</td>
                <td>${season.bps}</td>
                <td>${season.influence}</td>
                <td>${season.creativity}</td>
                <td>${season.threat}</td>
                <td>${season.ict_index}</td>
                <td>${season.expected_goals}</td>
                <td>${season.expected_assists}</td>
                <td>${season.expected_goal_involvements}</td>
                <td>${season.expected_goals_conceded}</td>
            </tr>
        `;
        const pastSeasonsTable = document.getElementById('past-seasons-table').querySelector('tbody');
        pastSeasonsTable.insertAdjacentHTML('beforeend', pastSeasonRow);
    });
}

// Function to update team info

function calculatePlayerPredictedPoints(player, fixture, upcomingGameweek) {
    if (!fixture) return 0;

    let isHome = fixture.team_h === player.team;
    const opponentTeam = teams.find(team =>
        team.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a)
    );

    let playerPredictedPoints = getExpectedPoints(player, fixture);

    if (playerPredictedPoints === '?') return '?';

    let upcomingId = typeof upcomingGameweek === 'object' ? upcomingGameweek.id : upcomingGameweek;
    if (getUpcomingGameweek() && getUpcomingGameweek().id == upcomingId) {
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

    // FPL Model averaging removed
    return playerPredictedPoints;
}


function savePlannerState() {
    if (!plannerState || plannerState.length === 0) return;
    
    let savedData = {
        startingFTs: parseInt(document.getElementById('startFts')?.value || 0),
        baseSquadIds: baseSquadCache.map(p => p.id).sort().join(','),
        weeks: plannerState.map(state => ({
            gwId: state.gwId,
            activeChip: state.activeChip,
            plannedTransfers: state.plannedTransfers.map(t => ({...t})),
            captainOverride: state.captainOverride || null,
            viceOverride: state.viceOverride || null
        }))
    };
    
    localStorage.setItem('fpl_planner_save', JSON.stringify(savedData));
}

function loadPlannerState() {
    let raw = localStorage.getItem('fpl_planner_save');
    if (!raw) return false;
    
    try {
        let savedData = JSON.parse(raw);
        let currentBaseIds = baseSquadCache.map(p => p.id).sort().join(',');
        
        // If the squad fundamentally changed, don't load the plan
        if (savedData.baseSquadIds !== currentBaseIds) return false;
        
        let startFtsInput = document.getElementById('startFts');
        if (startFtsInput) startFtsInput.value = savedData.startingFTs;
        
        savedData.weeks.forEach((savedWeek, index) => {
            if (index < plannerState.length && plannerState[index].gwId === savedWeek.gwId) {
                plannerState[index].activeChip = savedWeek.activeChip;
                plannerState[index].plannedTransfers = savedWeek.plannedTransfers;
                plannerState[index].captainOverride = savedWeek.captainOverride;
                plannerState[index].viceOverride = savedWeek.viceOverride;
            }
        });
        return true;
    } catch(e) {
        console.error('Failed to load planner state', e);
        return false;
    }
}

