if (typeof positionMap === 'undefined') { var positionMap = {1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD'}; }
// Tab Switching Logic
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('#tools-nav .list-group-item');
    const sections = document.querySelectorAll('.tool-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Remove active from all tabs and sections
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-tool'));

            // Add active to clicked tab
            e.currentTarget.classList.add('active');

            // Show corresponding section
            const toolId = e.currentTarget.getAttribute('data-tool');
            document.getElementById(`tool-${toolId}`).classList.add('active-tool');

            // Trigger specific logic if needed
            if (toolId === 'template' && !templateLoaded) {
                loadTemplateTeam();
            }
            
            // Force AG Grid to recalculate its dimensions when its container becomes visible
            setTimeout(() => {
                if (toolId === 'defcon' && typeof defconGridOptions !== 'undefined' && defconGridApi) {
                    defconGridApi.sizeColumnsToFit();
                } else if (toolId === 'expected' && typeof expectedGridOptions !== 'undefined' && expectedGridApi) {
                    expectedGridApi.sizeColumnsToFit();
                } else if (toolId === 'transfers' && typeof transfersInGridOptions !== 'undefined' && transfersInGridApi) {
                    transfersInGridApi.sizeColumnsToFit();
                    transfersOutGridApi.sizeColumnsToFit();
                }
            }, 50);
        });
    });
});

let templateLoaded = false;
function init() {
    // Tab switching is already handled by DOMContentLoaded listener above
    renderMarketTrends();
}

const renderMarketTrends = () => {
    // Risers (Highest net transfers in)
    const risers = [...allPlayers].sort((a, b) => (b.transfers_in_event - b.transfers_out_event) - (a.transfers_in_event - a.transfers_out_event)).slice(0, 5);
    
    // Fallers (Highest net transfers out)
    const fallers = [...allPlayers].sort((a, b) => (a.transfers_in_event - a.transfers_out_event) - (b.transfers_in_event - b.transfers_out_event)).slice(0, 5);

    const formatRiser = (p) => `
        <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}-110.webp" style="width: 25px;" class="me-2 drop-shadow" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';">
                <span>${p.web_name}</span>
            </div>
            <span class="badge bg-success rounded-pill">+${(p.transfers_in_event - p.transfers_out_event).toLocaleString()} net</span>
        </div>
    `;

    const formatFaller = (p) => `
        <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}-110.webp" style="width: 25px;" class="me-2 drop-shadow" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';">
                <span>${p.web_name}</span>
            </div>
            <span class="badge bg-danger rounded-pill">${(p.transfers_in_event - p.transfers_out_event).toLocaleString()} net</span>
        </div>
    `;

    document.getElementById('price-risers').innerHTML = risers.map(formatRiser).join('');
    document.getElementById('price-fallers').innerHTML = fallers.map(formatFaller).join('');
};


// Main entry point called by data.js
async function Initialize() {
    if (!allPlayers || allPlayers.length === 0) return;

    init(); // render market trends etc.
    renderDefCon();
    renderExpectedData();
    renderSetPieces();
    renderTopTransfers();
}

function getTeamName(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown';
}

function getTeamCode(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.code : 0;
}


let defconGridOptions;
let defconGridApi;
function renderDefCon() {
    let defenders = allPlayers.filter(p => (p.element_type === 1 || p.element_type === 2) && parseFloat(p.defensive_contribution) > 0);
    defenders.sort((a, b) => parseFloat(b.defensive_contribution) - parseFloat(a.defensive_contribution));
    defenders = defenders.slice(0, 50);

    const columnDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Team', field: 'team', filter: true, floatingFilter: true, valueGetter: params => getTeamName(params.data.team) },
        { headerName: 'Total Contribution', field: 'defensive_contribution', filter: true, floatingFilter: true, cellClass: 'text-success fw-bold', initialSort: 'desc' },
        { headerName: 'Per 90', field: 'defensive_contribution_per_90', filter: true, floatingFilter: true },
        { headerName: 'CBI', field: 'clearances_blocks_interceptions', filter: true, floatingFilter: true },
        { headerName: 'Recoveries', field: 'recoveries', filter: true, floatingFilter: true },
        { headerName: 'Tackles', field: 'tackles', filter: true, floatingFilter: true }
    ];

    defconGridOptions = {
        rowData: defenders,
        columnDefs: columnDefs,
        defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 }
    };
    defconGridApi = agGrid.createGrid(document.getElementById('defconGrid'), defconGridOptions);
}


let expectedGridOptions;
let expectedGridApi;
function renderExpectedData() {
    let players = allPlayers.filter(p => parseFloat(p.expected_goal_involvements) > 0);
    players.sort((a, b) => parseFloat(b.expected_goal_involvements_per_90) - parseFloat(a.expected_goal_involvements_per_90));
    players = players.slice(0, 50);

    const columnDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Pos', field: 'element_type', filter: true, floatingFilter: true, valueGetter: params => positionMap[params.data.element_type] },
        { headerName: 'xGI / 90', field: 'expected_goal_involvements_per_90', filter: true, floatingFilter: true, cellClass: 'text-info fw-bold' },
        { headerName: 'xG / 90', field: 'expected_goals_per_90', filter: true, floatingFilter: true },
        { headerName: 'xA / 90', field: 'expected_assists_per_90', filter: true, floatingFilter: true },
        { headerName: 'xG Total', field: 'expected_goals', filter: true, floatingFilter: true },
        { headerName: 'xA Total', field: 'expected_assists', filter: true, floatingFilter: true }
    ];

    expectedGridOptions = {
        rowData: players,
        columnDefs: columnDefs,
        defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 }
    };
    expectedGridApi = agGrid.createGrid(document.getElementById('expectedGrid'), expectedGridOptions);
}

function renderSetPieces() {
    const container = document.getElementById('setpieces-container');
    
    let html = '';
    
    // Group by team
    teams.forEach(team => {
        let teamPlayers = allPlayers.filter(p => p.team === team.id);
        
        let pens = teamPlayers.filter(p => p.penalties_order).sort((a,b) => a.penalties_order - b.penalties_order);
        let fks = teamPlayers.filter(p => p.direct_freekicks_order).sort((a,b) => a.direct_freekicks_order - b.direct_freekicks_order);
        let corners = teamPlayers.filter(p => p.corners_and_indirect_freekicks_order).sort((a,b) => a.corners_and_indirect_freekicks_order - b.corners_and_indirect_freekicks_order);
        
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="set-piece-card">
                    <h5>
                        <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-66.webp" style="width:25px; margin-right:5px;">
                        ${team.name}
                    </h5>
                    <ul class="set-piece-list">
                        <li>
                            <span class="sp-type">Penalties</span>
                            <span class="sp-taker">${pens.length > 0 ? pens.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                        <li>
                            <span class="sp-type">Free Kicks</span>
                            <span class="sp-taker">${fks.length > 0 ? fks.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                        <li>
                            <span class="sp-type">Corners</span>
                            <span class="sp-taker">${corners.length > 0 ? corners.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}


let transfersInGridOptions, transfersOutGridOptions;
let transfersInGridApi, transfersOutGridApi;
function renderTopTransfers() {
    let isPreseason = allPlayers.every(p => p.transfers_in_event === 0);
    let sortedIn = [...allPlayers];
    let sortedOut = [...allPlayers];
    
    if (isPreseason) {
        sortedIn.sort(() => Math.random() - 0.5);
        sortedOut.sort(() => Math.random() - 0.5);
    } else {
        sortedIn.sort((a, b) => b.transfers_in_event - a.transfers_in_event);
        sortedOut.sort((a, b) => b.transfers_out_event - a.transfers_out_event);
    }
    
    sortedIn = sortedIn.slice(0, 50);
    sortedOut = sortedOut.slice(0, 50);

    const inDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Transfers In', field: 'transfers_in_event', filter: true, floatingFilter: true, cellClass: 'text-success fw-bold', cellRenderer: params => '+' + (params.value || 0).toLocaleString() }
    ];
    
    const outDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Transfers Out', field: 'transfers_out_event', filter: true, floatingFilter: true, cellClass: 'text-danger fw-bold', cellRenderer: params => '-' + (params.value || 0).toLocaleString() }
    ];

    transfersInGridOptions = {
 rowData: sortedIn, columnDefs: inDefs, defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 } };
    transfersOutGridOptions = {
 rowData: sortedOut, columnDefs: outDefs, defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 } };
    
    transfersInGridApi = agGrid.createGrid(document.getElementById('transfersInGrid'), transfersInGridOptions);
    transfersOutGridApi = agGrid.createGrid(document.getElementById('transfersOutGrid'), transfersOutGridOptions);
}

// Template Team (Top 50) Scraper
async function loadTemplateTeam() {
    templateLoaded = true; // Prevent re-running
    
    // Check session storage cache
    const cached = sessionStorage.getItem('templateTeam');
    if (cached) {
        renderTemplatePitch(JSON.parse(cached));
        return;
    }

    try {
        // 1. Fetch Top 50 Managers from Overall League (314)
        const standingsRes = await fetch('https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?https://fantasy.premierleague.com/api/leagues-classic/314/standings/');
        const standingsData = await standingsRes.json();
        
        const top50 = standingsData.standings.results.slice(0, 50);
        
        // Find current Gameweek
        const currentEvent = gameweeks.find(e => e.is_current) || gameweeks.find(e => e.is_next);
        if (!currentEvent) throw new Error("No active gameweek found.");
        
        // 2. Fetch picks for all 50 managers in parallel
        const pickPromises = top50.map(manager => 
            fetch(`https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${currentEvent.id}/picks/`)
                .then(res => res.json())
                .catch(err => null) // Ignore failed fetches
        );
        
        const picksData = await Promise.all(pickPromises);
        
        // 3. Tally Ownership
        const ownershipCount = {};
        let validManagersCount = 0;
        
        picksData.forEach(managerPicks => {
            if (managerPicks && managerPicks.picks) {
                validManagersCount++;
                managerPicks.picks.forEach(pick => {
                    ownershipCount[pick.element] = (ownershipCount[pick.element] || 0) + 1;
                });
            }
        });
        
        // 4. Convert to array and calculate percentage
        const templatePlayers = [];
        for (let playerId in ownershipCount) {
            const playerInfo = allPlayers.find(p => p.id == playerId);
            if (playerInfo) {
                templatePlayers.push({
                    ...playerInfo,
                    eo_percent: Math.round((ownershipCount[playerId] / validManagersCount) * 100)
                });
            }
        }
        
        // Sort by EO descending
        templatePlayers.sort((a, b) => b.eo_percent - a.eo_percent);
        
        // 5. Select Best Valid 15-man Squad from the highest EO players
        const squad = selectTemplateSquad(templatePlayers);
        
        if (squad.length === 0) {
            throw new Error("No player picks are publicly available yet. Teams remain hidden until the Gameweek 1 deadline passes.");
        }
        
        // Cache and Render
        sessionStorage.setItem('templateTeam', JSON.stringify(squad));
        renderTemplatePitch(squad);

    } catch (error) {
        console.error("Failed to load template team", error);
        document.getElementById('template-loading').innerHTML = `
            <div class="alert alert-danger" role="alert">
                ${error.message.includes("publicly available") ? error.message : "Failed to scrape live data. The FPL API might be updating or blocking requests. Please try again later."}
            </div>
        `;
    }
}

function selectTemplateSquad(rankedPlayers) {
    const required = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const teamCounts = {};
    const squad = [];
    
    for (const player of rankedPlayers) {
        const pos = positionMap[player.element_type];
        
        teamCounts[player.team] = teamCounts[player.team] || 0;
        if (teamCounts[player.team] >= 3) continue;

        if (counts[pos] < required[pos]) {
            squad.push(player);
            counts[pos]++;
            teamCounts[player.team]++;
        }
        if (squad.length === 15) break;
    }
    
    return squad;
}

function renderTemplatePitch(squad) {
    document.getElementById('template-loading').style.display = 'none';
    document.getElementById('template-pitch-wrapper').style.display = 'block';
    
    const pitch = document.getElementById('template-pitch');
    
    const posGroups = {
        GK: squad.filter(p => p.element_type === 1).slice(0, 1),
        DEF: squad.filter(p => p.element_type === 2).slice(0, 4), // Example formation 4-4-2 or similar for display
        MID: squad.filter(p => p.element_type === 3).slice(0, 4),
        FWD: squad.filter(p => p.element_type === 4).slice(0, 2),
        SUBS: []
    };
    
    // Put remaining players on bench
    squad.forEach(p => {
        let isStarting = false;
        Object.keys(posGroups).forEach(pos => {
            if (pos !== 'SUBS' && posGroups[pos].find(s => s.id === p.id)) isStarting = true;
        });
        if (!isStarting) posGroups['SUBS'].push(p);
    });
    
    // Sort bench by position (GK first)
    posGroups.SUBS.sort((a, b) => a.element_type - b.element_type);

    // Helper to generate row HTML
    const getRowHtml = (players, className) => {
        return `
            <div class="row ${className}">
                ${players.map(p => `
                    <div class="player">
                        <img class="shirt" src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}${p.element_type===1?'_1':''}-110.webp" alt="shirt">
                        <div class="player-info">
                            <h5>${p.web_name}</h5>
                            <div class="ownership-badge">${p.eo_percent}%</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    pitch.innerHTML = `
        ${getRowHtml(posGroups.GK, 'gk')}
        ${getRowHtml(posGroups.DEF, 'defense')}
        ${getRowHtml(posGroups.MID, 'midfield')}
        ${getRowHtml(posGroups.FWD, 'attack')}
        
        <div class="subs-container mt-4">
            <h6 class="text-center mb-2">Bench Template</h6>
            <div class="subs">
                ${posGroups.SUBS.map(p => `
                    <div class="player">
                        <img class="shirt" src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}${p.element_type===1?'_1':''}-110.webp" alt="shirt">
                        <div class="player-info">
                            <h5>${p.web_name}</h5>
                            <div class="ownership-badge" style="background:#555;color:#fff;">${p.eo_percent}%</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}




