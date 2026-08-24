let historicStatsCache = {};

async function loadHistoricStats() {
    const container = document.getElementById("historic-stats-content");

    // 1. Identify upcoming gameweek
    const upcomingGameweek = gameweeks.find(gw => !gw.finished && !gw.is_current);
    if (!upcomingGameweek) {
        container.innerHTML = "<h5 class='text-center mt-3'>No upcoming gameweeks found.</h5>";
        return;
    }

    document.getElementById("historic-gw-indicator").textContent = `Gameweek ${upcomingGameweek.id} Historic Performance`;

    // Try cache first
    loadHistoricCache();
    if (historicStatsCache[upcomingGameweek.id]) {
        let cachedData = historicStatsCache[upcomingGameweek.id];
        if (document.getElementById("filter-my-team").checked) {
            const myPlayerIds = myPlayers.map(p => p.id);
            cachedData = cachedData.filter(d => myPlayerIds.includes(d.player.id));
        }
        renderHistoricStats(cachedData);
        return;
    }

    // Check if db is loaded
    if (!db) {
        container.innerHTML = `
            <div class="text-center mt-4 mb-4">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <h5 class="mt-3" id="historic-dl-status">Downloading Database (37MB)... 0%</h5>
            </div>
        `;
        try {
            const sqlPromise = initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            const response = await fetch(getBasePath() + "fpl_data.sqlite");
            const reader = response.body.getReader();
            const contentLength = +response.headers.get("Content-Length") || 37015552;
            let receivedLength = 0;
            let chunks = [];

            const statusText = document.getElementById("historic-dl-status");

            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                let percent = Math.round((receivedLength / contentLength) * 100);
                if (statusText) statusText.textContent = `Downloading Database (37MB)... ${percent}%`;
            }

            if (statusText) statusText.textContent = "Loading Database into Memory...";
            
            // Allow UI to update
            await new Promise(r => setTimeout(r, 50));
            
            let buf = new Uint8Array(receivedLength);
            let position = 0;
            for(let chunk of chunks) {
                buf.set(chunk, position);
                position += chunk.length;
            }

            const [SQL] = await Promise.all([sqlPromise]);
            db = new SQL.Database(buf);
            
            if (statusText) statusText.textContent = "Calculating Historic Stats...";
            await new Promise(r => setTimeout(r, 50));
            
        } catch (e) {
            console.error("Failed to load DB for historic stats", e);
            container.innerHTML = "<h5 class='text-center text-danger mt-3'>Failed to load database.</h5>";
            return;
        }
    } else {
        container.innerHTML = "<h5 class='text-center mt-3'>Calculating historic stats...</h5>";
        await new Promise(r => setTimeout(r, 50));
    }

    // Calculate historic stats
    const results = [];
    const remainingFixtures = fixtures.filter(f => f.event === upcomingGameweek.id);

    for (let player of allPlayers) {
        const fixture = remainingFixtures.find(f => f.team_a === player.team || f.team_h === player.team);
        if (fixture) {
            const oppTeam = teams.find(t => t.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a));
            
            const stats = getPlayerHistoricStatsAgainst(player, oppTeam.name);
            results.push({
                player: player,
                opponent: oppTeam,
                stats: stats
            });
        }
    }

    // Sort by average points descending
    results.sort((a, b) => b.stats.avgPoints - a.stats.avgPoints);

    historicStatsCache[upcomingGameweek.id] = results;
    saveHistoricCache();

    let dataToRender = results;
    if (document.getElementById("filter-my-team").checked) {
        const myPlayerIds = myPlayers.map(p => p.id);
        dataToRender = results.filter(d => myPlayerIds.includes(d.player.id));
    }
    renderHistoricStats(dataToRender);
}

function getPlayerHistoricStatsAgainst(player, oppTeamName) {
    const playerName = player.first_name + " " + player.second_name;
    
    const query = `
        SELECT kickoff_time, total_points, minutes, goals_scored, assists, clean_sheets, goals_conceded, expected_goals, expected_assists, bps, bonus
        FROM fpl_data 
        WHERE name = $name AND opp_team_name = $opp 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const stmt = db.prepare(query);
    stmt.bind({$name: playerName, $opp: oppTeamName});
    
    let matches = [];
    let totalPoints = 0;
    let totalMins = 0;
    let totalXg = 0;
    let totalXa = 0;
    let totalBps = 0;
    let totalBonus = 0;
    let totalGoals = 0;
    let totalAssists = 0;

    while(stmt.step()) {
        const row = stmt.get();
        matches.push({
            date: row[0],
            points: row[1],
            minutes: row[2],
            goals: row[3],
            assists: row[4],
            clean_sheets: row[5],
            goals_conceded: row[6],
            xg: row[7],
            xa: row[8],
            bps: row[9],
            bonus: row[10]
        });
        totalPoints += parseFloat(row[1] || 0);
        totalMins += parseInt(row[2] || 0);
        totalGoals += parseInt(row[3] || 0);
        totalAssists += parseInt(row[4] || 0);
        totalXg += parseFloat(row[7] || 0);
        totalXa += parseFloat(row[8] || 0);
        totalBps += parseInt(row[9] || 0);
        totalBonus += parseInt(row[10] || 0);
    }
    stmt.free();

    const matchesCount = matches.length;
    return {
        matches: matches,
        avgPoints: matchesCount > 0 ? totalPoints / matchesCount : 0,
        totalPoints: totalPoints,
        avgMins: matchesCount > 0 ? totalMins / matchesCount : 0,
        totalGoals: totalGoals,
        totalAssists: totalAssists,
        totalXg: totalXg,
        totalXa: totalXa,
        avgBps: matchesCount > 0 ? totalBps / matchesCount : 0,
        totalBonus: totalBonus
    };
}

function loadHistoricCache() {
    const stored = localStorage.getItem('historic_stats_cache_v3');
    if (stored) {
        try {
            historicStatsCache = JSON.parse(stored);
            // enforce 3 gameweek limit
            const keys = Object.keys(historicStatsCache);
            if (keys.length > 3) {
                // sort numeric keys
                keys.sort((a, b) => parseInt(a) - parseInt(b));
                // remove oldest
                delete historicStatsCache[keys[0]];
                localStorage.setItem('historic_stats_cache_v3', JSON.stringify(historicStatsCache));
            }
        } catch (e) {
            historicStatsCache = {};
        }
    }
}

function saveHistoricCache() {
    const keys = Object.keys(historicStatsCache);
    if (keys.length > 3) {
        keys.sort((a, b) => parseInt(a) - parseInt(b));
        delete historicStatsCache[keys[0]];
    }
    localStorage.setItem('historic_stats_cache_v3', JSON.stringify(historicStatsCache));
}

let historicGridOptions = null;
let historicGridApi = null;

function renderHistoricStats(results) {
    const container = document.getElementById("historic-stats-content");
    
    if (results.length === 0) {
        if (historicGridOptions && historicGridApi) {
            historicGridApi.destroy();
            historicGridOptions = null;
        }
        container.className = "";
        container.style.height = "auto";
        container.innerHTML = "<h5 class='text-center mt-3'>No historic data found for this gameweek's fixtures.</h5>";
        return;
    }

    const rowData = results.map(res => {
        let posStr = res.player.element_type === 1 ? 'GK' : res.player.element_type === 2 ? 'DEF' : res.player.element_type === 3 ? 'MID' : 'FWD';
        return {
            player: res.player,
            web_name: res.player.web_name,
            team_code: res.player.team_code,
            team: teams.find(t => t.id === res.player.team)?.short_name || '',
            pos: posStr,
            opponent: res.opponent.name,
            price: res.player.now_cost / 10,
            form: parseFloat(res.player.form),
            tsb: parseFloat(res.player.selected_by_percent),
            avgPts: res.stats.avgPoints,
            matches: res.stats.matches.length,
            avgMins: res.stats.avgMins,
            g_a: res.stats.totalGoals + ' / ' + res.stats.totalAssists,
            xg_xa: (res.stats.totalXg || 0).toFixed(2) + ' / ' + (res.stats.totalXa || 0).toFixed(2),
            avgBps: res.stats.avgBps,
            bonus: res.stats.totalBonus,
            history: res.stats.matches
        };
    });

    if (historicGridOptions && historicGridApi) {
        historicGridApi.setGridOption('rowData', rowData);
        return;
    }

    container.innerHTML = "";
    container.className = "ag-theme-alpine-dark mt-3";
    container.style.height = "500px";

    const columnDefs = [
        { 
            headerName: 'Player', 
            field: 'web_name', 
            pinned: 'left',
            minWidth: 150,
            cellRenderer: params => {
                return `<div class="d-flex align-items-center mt-1">
                            <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${params.data.team_code}-66.webp" style="width: 20px; margin-right: 8px;">
                            <strong>${params.value}</strong>
                        </div>`;
            }
        },
        { headerName: 'Team', field: 'team', width: 90 },
        { headerName: 'Pos', field: 'pos', width: 80 },
        { headerName: 'Opponent', field: 'opponent', width: 120 },
        { headerName: 'Price (£)', field: 'price', width: 100 },
        { headerName: 'Form', field: 'form', width: 90, cellClass: params => params.value >= 5 ? 'text-success fw-bold' : (params.value >= 3 ? 'text-warning' : '') },
        { headerName: 'TSB %', field: 'tsb', width: 100 },
        { 
            headerName: 'Avg Pts', 
            field: 'avgPts', 
            width: 100, 
            sort: 'desc',
            valueFormatter: params => params.value.toFixed(1),
            cellClass: params => params.value >= 6 ? 'text-success fw-bold' : (params.value >= 4 ? 'text-warning' : '')
        },
        { headerName: 'Matches', field: 'matches', width: 100 },
        { headerName: 'Avg Mins', field: 'avgMins', width: 100, valueFormatter: params => Math.round(params.value) },
        { headerName: 'G / A', field: 'g_a', width: 100 },
        { headerName: 'xG / xA', field: 'xg_xa', width: 120 },
        { headerName: 'Avg BPS', field: 'avgBps', width: 100, valueFormatter: params => params.value.toFixed(1) },
        { headerName: 'Bonus', field: 'bonus', width: 90 },
        {
            headerName: 'History (Latest -> Oldest)',
            field: 'history',
            minWidth: 250,
            flex: 1,
            sortable: false,
            filter: false,
            cellRenderer: params => {
                return '<div class="mt-1">' + params.value.map(m => `<span class="badge bg-secondary me-1" title="Mins: ${m.minutes}, G: ${m.goals}, A: ${m.assists}, CS: ${m.clean_sheets}, xG: ${m.xg}, xA: ${m.xa}, BPS: ${m.bps}">${m.points} pts</span>`).join("") + '</div>';
            }
        }
    ];

    historicGridOptions = {
        
        rowData: rowData,
        columnDefs: columnDefs,
        defaultColDef: { sortable: true, filter: true, resizable: true },
        rowHeight: 35
    };

    historicGridApi = agGrid.createGrid(container, historicGridOptions);
}

document.addEventListener("DOMContentLoaded", () => {
    const filterCheckbox = document.getElementById("filter-my-team");
    if (filterCheckbox) {
        filterCheckbox.addEventListener("change", () => {
            const upcomingGameweek = gameweeks.find(gw => !gw.finished && !gw.is_current);
            if (upcomingGameweek && historicStatsCache[upcomingGameweek.id]) {
                const isChecked = document.getElementById("filter-my-team").checked;
                let data = historicStatsCache[upcomingGameweek.id];
                if (isChecked) {
                    const myPlayerIds = myPlayers.map(p => p.id);
                    data = data.filter(d => myPlayerIds.includes(d.player.id));
                }
                renderHistoricStats(data);
            }
        });
    }
});



