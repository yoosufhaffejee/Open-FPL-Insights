let historicStatsCache = {};

async function loadHistoricStats() {
    // Check if db is loaded
    if (!db) {
        // Trigger calculateAllPredictions which loads DB, or we can load it silently here
        alert("Please run 'Recalculate Predictions' first to load the FPL database.");
        return;
    }

    const container = document.getElementById("historic-stats-content");
    container.innerHTML = "<h5 class='text-center'>Loading historic stats...</h5>";

    // 1. Identify upcoming gameweek
    const upcomingGameweek = gameweeks.find(gw => !gw.finished && !gw.is_current);
    if (!upcomingGameweek) {
        container.innerHTML = "<h5 class='text-center'>No upcoming gameweeks found.</h5>";
        return;
    }

    document.getElementById("historic-gw-indicator").textContent = `Gameweek ${upcomingGameweek.id} Historic Performance`;

    // Try cache
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

    // Calculate historic stats
    const results = [];
    const remainingFixtures = fixtures.filter(f => f.event === upcomingGameweek.id);

    for (let player of allPlayers) {
        const fixture = remainingFixtures.find(f => f.team_a === player.team || f.team_h === player.team);
        if (fixture) {
            const oppTeam = teams.find(t => t.id === (fixture.team_a === player.team ? fixture.team_h : fixture.team_a));
            
            const stats = getPlayerHistoricStatsAgainst(player, oppTeam.name);
            if (stats.matches.length > 0) {
                results.push({
                    player: player,
                    opponent: oppTeam,
                    stats: stats
                });
            }
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
        SELECT kickoff_time, total_points, minutes, goals_scored, assists, clean_sheets, goals_conceded
        FROM fpl_data 
        WHERE name = $name AND opp_team_name = $opp 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const stmt = db.prepare(query);
    stmt.bind({$name: playerName, $opp: oppTeamName});
    
    let matches = [];
    let totalPoints = 0;
    while(stmt.step()) {
        const row = stmt.get();
        matches.push({
            date: row[0],
            points: row[1],
            minutes: row[2],
            goals: row[3],
            assists: row[4],
            clean_sheets: row[5],
            goals_conceded: row[6]
        });
        totalPoints += parseFloat(row[1]);
    }
    stmt.free();

    return {
        matches: matches,
        avgPoints: matches.length > 0 ? totalPoints / matches.length : 0,
        totalPoints: totalPoints
    };
}

function loadHistoricCache() {
    const stored = localStorage.getItem('historic_stats_cache');
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
                localStorage.setItem('historic_stats_cache', JSON.stringify(historicStatsCache));
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
    localStorage.setItem('historic_stats_cache', JSON.stringify(historicStatsCache));
}

function renderHistoricStats(results) {
    const container = document.getElementById("historic-stats-content");
    
    if (results.length === 0) {
        container.innerHTML = "<h5 class='text-center mt-3'>No historic data found for this gameweek's fixtures.</h5>";
        return;
    }

    let html = `
        <div class="table-responsive mt-3">
            <table class="table table-dark table-striped table-hover align-middle">
                <thead>
                    <tr>
                        <th>Player</th>
                        <th>Pos</th>
                        <th>Opponent</th>
                        <th>Avg Pts (Last 5)</th>
                        <th>Matches Found</th>
                        <th>Details (Latest -> Oldest)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    results.forEach(res => {
        let posStr = res.player.element_type === 1 ? 'GK' : res.player.element_type === 2 ? 'DEF' : res.player.element_type === 3 ? 'MID' : 'FWD';
        let detailsHtml = res.stats.matches.map(m => `<span class="badge bg-secondary me-1" title="Mins: ${m.minutes}, G: ${m.goals}, A: ${m.assists}, CS: ${m.clean_sheets}">${m.points} pts</span>`).join("");
        
        html += `
            <tr>
                <td>
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${res.player.team_code}-66.webp" style="width: 25px; height: 33px; margin-right: 10px;">
                    <strong>${res.player.web_name}</strong>
                </td>
                <td>${posStr}</td>
                <td>${res.opponent.name}</td>
                <td><strong class="text-success">${res.stats.avgPoints.toFixed(1)}</strong></td>
                <td>${res.stats.matches.length}</td>
                <td>${detailsHtml}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
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
            } else if (db) {
                loadHistoricStats();
            }
        });
    }
});
