
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
                } else if (toolId === 'market' && typeof transfersInGridOptions !== 'undefined' && transfersInGridApi) {
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
    // Risers (Highest price change percentage)
    const risers = [...allPlayers]
        .filter(p => parseFloat(p.price_change_percent) > 0)
        .sort((a, b) => parseFloat(b.price_change_percent) - parseFloat(a.price_change_percent))
        .slice(0, 5);
    
    // Fallers (Lowest price change percentage)
    const fallers = [...allPlayers]
        .filter(p => parseFloat(p.price_change_percent) < 0)
        .sort((a, b) => parseFloat(a.price_change_percent) - parseFloat(b.price_change_percent))
        .slice(0, 5);

    const formatRiser = (p) => {
        let pct = parseFloat(p.price_change_percent).toFixed(1);
        let statusClass = pct >= 100 ? 'bg-success' : 'bg-success bg-opacity-75';
        let net = (p.transfers_in_event - p.transfers_out_event).toLocaleString();
        let hourly = p.price_change_hourly_rate ? p.price_change_hourly_rate.toLocaleString() : 0;
        return `
            <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}${p.element_type == 1 ? '_1' : ''}-110.webp" style="width: 25px;" class="me-2 drop-shadow" onerror="playerImgOnerror(this, ${p.team_code}, ${p.element_type})">
                    <div class="d-flex flex-column">
                        <span>${p.web_name}</span>
                        <small class="text-muted" style="font-size: 0.7em;">${net} net | ${hourly}/hr</small>
                    </div>
                </div>
                <span class="badge ${statusClass} rounded-pill">${pct}%</span>
            </div>
        `;
    };

    const formatFaller = (p) => {
        let pct = parseFloat(p.price_change_percent).toFixed(1);
        let statusClass = pct <= -100 ? 'bg-danger' : 'bg-danger bg-opacity-75';
        let net = (p.transfers_in_event - p.transfers_out_event).toLocaleString();
        let hourly = p.price_change_hourly_rate ? p.price_change_hourly_rate.toLocaleString() : 0;
        return `
            <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}${p.element_type == 1 ? '_1' : ''}-110.webp" style="width: 25px;" class="me-2 drop-shadow" onerror="playerImgOnerror(this, ${p.team_code}, ${p.element_type})">
                    <div class="d-flex flex-column">
                        <span>${p.web_name}</span>
                        <small class="text-muted" style="font-size: 0.7em;">${net} net | ${hourly}/hr</small>
                    </div>
                </div>
                <span class="badge ${statusClass} rounded-pill">${pct}%</span>
            </div>
        `;
    };

    document.getElementById('price-risers').innerHTML = risers.length > 0 ? risers.map(formatRiser).join('') : '<div class="list-group-item bg-dark text-white border-secondary text-muted">No risers</div>';
    document.getElementById('price-fallers').innerHTML = fallers.length > 0 ? fallers.map(formatFaller).join('') : '<div class="list-group-item bg-dark text-white border-secondary text-muted">No fallers</div>';

    // Recent Changes with Pagination
    const PAGE_SIZE = 10;
    let risersPage = 1;
    let fallersPage = 1;

    const recentRisers = [...allPlayers]
        .filter(p => p.cost_change_event > 0)
        .sort((a, b) => b.cost_change_event - a.cost_change_event);
        
    const recentFallers = [...allPlayers]
        .filter(p => p.cost_change_event < 0)
        .sort((a, b) => a.cost_change_event - b.cost_change_event);

    const formatRecentRiser = (p) => {
        return `
            <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center px-3 py-2">
                <div class="d-flex align-items-center" style="width: 40%;">
                    <i class="fas fa-chevron-circle-up text-success me-2"></i>
                    <span>${p.web_name}</span>
                </div>
                <div style="width: 30%;" class="text-center text-muted small">${getTeamShortName(p.team)}</div>
                <div style="width: 30%;" class="text-end fw-bold">${(p.now_cost / 10).toFixed(1)}</div>
            </div>
        `;
    };

    const formatRecentFaller = (p) => {
        return `
            <div class="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center px-3 py-2">
                <div class="d-flex align-items-center" style="width: 40%;">
                    <i class="fas fa-chevron-circle-down text-danger me-2"></i>
                    <span>${p.web_name}</span>
                </div>
                <div style="width: 30%;" class="text-center text-muted small">${getTeamShortName(p.team)}</div>
                <div style="width: 30%;" class="text-end fw-bold">${(p.now_cost / 10).toFixed(1)}</div>
            </div>
        `;
    };

    const renderRisersPage = () => {
        const start = (risersPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginated = recentRisers.slice(start, end);
        
        document.getElementById('recent-risers').innerHTML = paginated.length > 0 ? paginated.map(formatRecentRiser).join('') : '<div class="list-group-item bg-dark text-white border-secondary text-center text-muted">No recent price rises</div>';
        
        const totalPages = Math.ceil(recentRisers.length / PAGE_SIZE) || 1;
        document.getElementById('risers-page-info').innerText = `Page ${risersPage} of ${totalPages}`;
        
        const paginationContainer = document.getElementById('risers-pagination');
        if (recentRisers.length > PAGE_SIZE) {
            paginationContainer.style.setProperty('display', 'flex', 'important');
            document.getElementById('risers-prev').disabled = risersPage === 1;
            document.getElementById('risers-next').disabled = risersPage === totalPages;
        } else {
            paginationContainer.style.setProperty('display', 'none', 'important');
        }
    };

    const renderFallersPage = () => {
        const start = (fallersPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginated = recentFallers.slice(start, end);
        
        document.getElementById('recent-fallers').innerHTML = paginated.length > 0 ? paginated.map(formatRecentFaller).join('') : '<div class="list-group-item bg-dark text-white border-secondary text-center text-muted">No recent price falls</div>';
        
        const totalPages = Math.ceil(recentFallers.length / PAGE_SIZE) || 1;
        document.getElementById('fallers-page-info').innerText = `Page ${fallersPage} of ${totalPages}`;
        
        const paginationContainer = document.getElementById('fallers-pagination');
        if (recentFallers.length > PAGE_SIZE) {
            paginationContainer.style.setProperty('display', 'flex', 'important');
            document.getElementById('fallers-prev').disabled = fallersPage === 1;
            document.getElementById('fallers-next').disabled = fallersPage === totalPages;
        } else {
            paginationContainer.style.setProperty('display', 'none', 'important');
        }
    };

    renderRisersPage();
    renderFallersPage();

    document.getElementById('risers-prev').addEventListener('click', () => { if (risersPage > 1) { risersPage--; renderRisersPage(); } });
    document.getElementById('risers-next').addEventListener('click', () => { if (risersPage < Math.ceil(recentRisers.length / PAGE_SIZE)) { risersPage++; renderRisersPage(); } });
    
    document.getElementById('fallers-prev').addEventListener('click', () => { if (fallersPage > 1) { fallersPage--; renderFallersPage(); } });
    document.getElementById('fallers-next').addEventListener('click', () => { if (fallersPage < Math.ceil(recentFallers.length / PAGE_SIZE)) { fallersPage++; renderFallersPage(); } });

    // Countdown to Next Price Change (around 01:15 AM UK Time)
    const updateCountdown = () => {
        const now = new Date();
        const ukTimeStr = now.toLocaleString("en-US", { timeZone: "Europe/London" });
        const ukTime = new Date(ukTimeStr);
        
        let targetUKTime = new Date(ukTime);
        targetUKTime.setHours(1, 15, 0, 0); // 1:15 AM
        
        if (ukTime > targetUKTime) {
            targetUKTime.setDate(targetUKTime.getDate() + 1); // Next day
        }
        
        const diffMs = targetUKTime - ukTime;
        if (diffMs <= 0) {
            const timerEl = document.getElementById('price-countdown');
            if(timerEl) timerEl.innerText = "00:00:00";
            return;
        }

        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        const formatZero = (num) => num.toString().padStart(2, '0');
        
        const timerEl = document.getElementById('price-countdown');
        if (timerEl) {
            timerEl.innerText = `Next Price Changes Happen in: ${formatZero(h)}:${formatZero(m)}:${formatZero(s)}`;
        }
        
        // Calculate the local time it happens at
        const targetTimeEl = document.getElementById('price-target-time');
        if (targetTimeEl) {
            const localTargetTime = new Date(now.getTime() + diffMs);
            const options = { hour: '2-digit', minute: '2-digit' };
            targetTimeEl.innerText = `Next Price Change at: ${localTargetTime.toLocaleTimeString([], options)} (Local Time)`;
        }
    };
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
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
async function loadDefConStats(players) {
    if (!players || players.length === 0) return;
    
    // Fetch element summaries in parallel
    const promises = players.map(async (p) => {
        try {
            const data = await getPlayer(p.id);
            let times = 0;
            let points = 0;
            
            if (data && data.history) {
                data.history.forEach(match => {
                    if (match.minutes > 0 && match.defensive_contribution !== undefined && match.defensive_contribution !== null) {
                        let dc = parseFloat(match.defensive_contribution);
                        if (p.element_type === 2 && dc >= 10) {
                            times++;
                            points += 2;
                        } else if ((p.element_type === 3 || p.element_type === 4) && dc >= 12) {
                            times++;
                            points += 2;
                        }
                    }
                });
            }
            p.defcon_times = times;
            p.defcon_pts = points;
        } catch (err) {
            console.error('Error fetching defcon for player', p.id, err);
            p.defcon_times = 0;
            p.defcon_pts = 0;
        }
    });
    
    await Promise.all(promises);
    
    // Refresh the grid
    if (defconGridApi) {
        defconGridApi.setGridOption('rowData', [...players]);
    }
}

function renderDefCon() {
    let defenders = allPlayers.filter(p => p.element_type !== 1 && parseFloat(p.defensive_contribution) > 0);
    defenders.sort((a, b) => parseFloat(b.defensive_contribution) - parseFloat(a.defensive_contribution));
    defenders = defenders.slice(0, 50);

    // Initialize with loading placeholders
    defenders.forEach(p => {
        p.defcon_times = '...';
        p.defcon_pts = '...';
    });

    const numComparator = (valueA, valueB) => parseFloat(valueA || 0) - parseFloat(valueB || 0);

    const columnDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Team', field: 'team', filter: true, floatingFilter: true, valueGetter: params => getTeamName(params.data.team) },
        { headerName: 'DefCon Count', field: 'defcon_times', filter: true, floatingFilter: true, cellClass: 'text-info fw-bold', comparator: numComparator },
        { headerName: 'DefCon Pts', field: 'defcon_pts', filter: true, floatingFilter: true, cellClass: 'text-warning fw-bold', comparator: numComparator },
        { headerName: 'Total Contribution', field: 'defensive_contribution', filter: true, floatingFilter: true, cellClass: 'text-success fw-bold', initialSort: 'desc', comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'Per 90', field: 'defensive_contribution_per_90', filter: true, floatingFilter: true, comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'CBI', field: 'clearances_blocks_interceptions', filter: true, floatingFilter: true, comparator: numComparator },
        { headerName: 'Recoveries', field: 'recoveries', filter: true, floatingFilter: true, comparator: numComparator },
        { headerName: 'Tackles', field: 'tackles', filter: true, floatingFilter: true, comparator: numComparator }
    ];

    defconGridOptions = {
        rowData: defenders,
        columnDefs: columnDefs,
        defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 }
    };
    defconGridApi = agGrid.createGrid(document.getElementById('defconGrid'), defconGridOptions);
    
    // Trigger async load
    loadDefConStats(defenders);
}


let expectedGridOptions;
let expectedGridApi;
function renderExpectedData() {
    let players = allPlayers.filter(p => parseFloat(p.expected_goal_involvements) > 0);
    players.sort((a, b) => parseFloat(b.expected_goal_involvements_per_90) - parseFloat(a.expected_goal_involvements_per_90));
    players = players.slice(0, 50);

    const numComparator = (valueA, valueB) => parseFloat(valueA || 0) - parseFloat(valueB || 0);

    const columnDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Pos', field: 'element_type', filter: true, floatingFilter: true, valueGetter: params => positionMap[params.data.element_type] },
        { headerName: 'xGI / 90', field: 'expected_goal_involvements_per_90', filter: true, floatingFilter: true, cellClass: 'text-info fw-bold', comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'xG / 90', field: 'expected_goals_per_90', filter: true, floatingFilter: true, comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'xA / 90', field: 'expected_assists_per_90', filter: true, floatingFilter: true, comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'xG Total', field: 'expected_goals', filter: true, floatingFilter: true, comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' },
        { headerName: 'xA Total', field: 'expected_assists', filter: true, floatingFilter: true, comparator: numComparator, valueFormatter: params => params.value ? parseFloat(params.value).toFixed(2) : '0.00' }
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
        { headerName: 'Transfers In', field: 'transfers_in_event', filter: true, floatingFilter: true, cellClass: 'text-success fw-bold', cellRenderer: params => '+' + (params.value || 0).toLocaleString() },
        { headerName: 'Price Target %', colId: 'price_change_percent', filter: true, floatingFilter: true, valueGetter: params => params.data.price_change_percent ? parseFloat(params.data.price_change_percent) : 0, valueFormatter: params => params.value.toFixed(1) + '%' },
        { headerName: 'Hourly Rate', field: 'price_change_hourly_rate', filter: true, floatingFilter: true, valueFormatter: params => (params.value || 0).toLocaleString() + '/hr' }
    ];
    
    const outDefs = [
        { headerName: 'Player', field: 'web_name', filter: true, floatingFilter: true, cellRenderer: params => '<div class="player-name-cell"><img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_' + getTeamCode(params.data.team) + '-66.webp" alt="shirt" style="width:25px;margin-right:5px;">' + params.value + '</div>' },
        { headerName: 'Transfers Out', field: 'transfers_out_event', filter: true, floatingFilter: true, cellClass: 'text-danger fw-bold', cellRenderer: params => '-' + (params.value || 0).toLocaleString() },
        { headerName: 'Price Target %', colId: 'price_change_percent', filter: true, floatingFilter: true, valueGetter: params => params.data.price_change_percent ? parseFloat(params.data.price_change_percent) : 0, valueFormatter: params => params.value.toFixed(1) + '%' },
        { headerName: 'Hourly Rate', field: 'price_change_hourly_rate', filter: true, floatingFilter: true, valueFormatter: params => (params.value || 0).toLocaleString() + '/hr' }
    ];

    transfersInGridOptions = {
 rowData: sortedIn, columnDefs: inDefs, defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 } };
    transfersOutGridOptions = {
 rowData: sortedOut, columnDefs: outDefs, defaultColDef: { sortable: true, filter: true, resizable: true, wrapHeaderText: true, autoHeaderHeight: true, minWidth: 100 } };
    
    transfersInGridApi = agGrid.createGrid(document.getElementById('transfersInGrid'), transfersInGridOptions);
    transfersOutGridApi = agGrid.createGrid(document.getElementById('transfersOutGrid'), transfersOutGridOptions);
}

// Template Team (Top 20) Scraper
async function loadTemplateTeam() {
    templateLoaded = true; // Prevent re-running
    
    // Check session storage cache
    const cached = sessionStorage.getItem('templateTeam_v3');
    if (cached) {
        renderTemplatePitch(JSON.parse(cached));
        return;
    }

    try {
        // 1. Fetch Top 20 Managers from Overall League (314)
        const standingsRes = await fetch('https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?https://fantasy.premierleague.com/api/leagues-classic/314/standings/');
        const standingsData = await standingsRes.json();
        
        const top20 = standingsData.standings.results.slice(0, 20);
        
        // Find current Gameweek
        const currentEvent = gameweeks.find(e => e.is_current) || gameweeks.find(e => e.is_next);
        if (!currentEvent) throw new Error("No active gameweek found.");
        
        // 2. Fetch picks for all 20 managers in parallel
        const pickPromises = top20.map(manager => 
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
        sessionStorage.setItem('templateTeam_v3', JSON.stringify(squad));
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
                        <div class="player-info-card">
                            <div class="player-header">
                                <span class="player-name">${p.web_name}</span>
                                <span class="player-price">${p.eo_percent}%</span>
                            </div>
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
                        <div class="player-info-card">
                            <div class="player-header">
                                <span class="player-name">${p.web_name}</span>
                                <span class="player-price">${p.eo_percent}%</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}




