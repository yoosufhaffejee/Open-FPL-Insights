// --- Image helpers ---
// 3-tier fallback: face photo → team shirt → Photo-Missing.png


// Inline onerror string for use in innerHTML – tries shirt then silhouette
const playerOnerrorAttr = (teamCode, elementType) => {
    return `onerror="playerImgOnerror(this, ${teamCode}, ${elementType})"`;
};

// --- Player Dashboard Logic ---
const renderDashboards = () => {
    const dashboards = [
        { title: 'Goals', key: 'goals_scored' },
        { title: 'Assists', key: 'assists' },
        { title: 'Total Points', key: 'total_points' },
        { title: 'Bonus Points', key: 'bonus' }
    ];

    const container = document.getElementById('stats-dashboards');
    container.innerHTML = '';

    dashboards.forEach(dash => {
        // Sort players by key descending
        const sorted = [...allPlayers].sort((a, b) => b[dash.key] - a[dash.key]).slice(0, 5);
        
        let listHtml = '';
        sorted.forEach((p, index) => {
            const team = teams.find(t => t.id === p.team);
            listHtml += `
                <div class="d-flex align-items-center mb-3">
                    <div class="me-3 fs-5 text-muted fw-bold" style="width: 20px;">${index + 1}</div>
                    <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" 
                         style="width: 40px; height: 50px; object-fit: cover; border-radius: 5px; background-color: #f0f0f0;" 
                         class="me-3 shadow-sm bg-light" ${playerOnerrorAttr(team.code, p.element_type)}>
                    <div class="flex-grow-1">
                        <div class="fw-bold text-light">${p.web_name}</div>
                        <div class="text-muted small">
                            <img src="https://resources.premierleague.com/premierleague/badges/50/t${team.code}.png" style="width: 15px;" class="me-1">
                            ${team.short_name}
                        </div>
                    </div>
                    <div class="fs-4 fw-bold text-info">${p[dash.key]}</div>
                </div>
            `;
        });

        const colHtml = `
            <div class="col">
                <div class="card h-100 bg-dark border-secondary">
                    <div class="card-header border-secondary fw-bold fs-5 d-flex justify-content-between align-items-center">
                        ${dash.title}
                        <button class="btn btn-sm btn-outline-info" onclick="openViewAll('${dash.key}', '${dash.title}')">View All</button>
                    </div>
                    <div class="card-body">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += colHtml;
    });
};

// --- View All Logic ---
let currentViewAllKey = '';
let currentViewAllData = [];
let sortCol = 'stat';
let sortAsc = false;

const openViewAll = (key, title) => {
    currentViewAllKey = key;
    document.getElementById('viewAllModalLabel').textContent = `All Players - ${title}`;
    document.getElementById('viewAllStatHeader').innerHTML = `${title} <i class="fas fa-sort text-muted ms-1"></i>`;
    
    // Populate team filter
    const teamFilter = document.getElementById('viewAllTeamFilter');
    if (teamFilter.options.length === 1) {
        teams.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            teamFilter.appendChild(opt);
        });
    }
    
    // Reset filters
    document.getElementById('viewAllSearch').value = '';
    document.getElementById('viewAllTeamFilter').value = '';
    document.getElementById('viewAllPositionFilter').value = '';
    sortCol = 'stat';
    sortAsc = false;

    applyViewAllFilters();
    
    const viewAllModal = new bootstrap.Modal(document.getElementById('viewAllModal'));
    viewAllModal.show();
};

const applyViewAllFilters = () => {
    const search = document.getElementById('viewAllSearch').value.toLowerCase();
    const teamId = document.getElementById('viewAllTeamFilter').value;
    const posId = document.getElementById('viewAllPositionFilter').value;

    currentViewAllData = allPlayers.filter(p => {
        const matchSearch = p.web_name.toLowerCase().includes(search) || `${p.first_name} ${p.second_name}`.toLowerCase().includes(search);
        const matchTeam = teamId ? p.team == teamId : true;
        const matchPos = posId ? p.element_type == posId : true;
        return matchSearch && matchTeam && matchPos;
    });

    renderViewAllTable();
};

const sortViewAll = (col) => {
    if (sortCol === col) {
        sortAsc = !sortAsc;
    } else {
        sortCol = col;
        sortAsc = false;
    }
    renderViewAllTable();
};

const renderViewAllTable = () => {
    // Sort
    currentViewAllData.sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];

        if (sortCol === 'stat') {
            valA = parseFloat(a[currentViewAllKey]) || 0;
            valB = parseFloat(b[currentViewAllKey]) || 0;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    const body = document.getElementById('viewAllBody');
    body.innerHTML = '';

    // Render up to 100 to prevent lag, or implement simple pagination
    const toRender = currentViewAllData.slice(0, 200);

    toRender.forEach(p => {
        const team = teams.find(t => t.id === p.team);
        const statVal = p[currentViewAllKey];
        
        body.innerHTML += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" 
                             style="width: 30px; height: 35px; object-fit: cover; border-radius: 5px;" 
                             class="me-2 bg-light shadow-sm" ${playerOnerrorAttr(team.code, p.element_type)}>
                        ${p.web_name}
                    </div>
                </td>
                <td>
                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${team.code}.png" style="width: 20px;" class="me-1">
                    ${team.name}
                </td>
                <td>${getPosName(p.element_type)}</td>
                <td class="fw-bold fs-5 text-info">${statVal}</td>
            </tr>
        `;
    });
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('viewAllSearch')?.addEventListener('input', applyViewAllFilters);
    document.getElementById('viewAllTeamFilter')?.addEventListener('change', applyViewAllFilters);
    document.getElementById('viewAllPositionFilter')?.addEventListener('change', applyViewAllFilters);
});

// --- Player Comparison Logic ---
let player1 = null;
let player2 = null;

const setupSearch = (inputId, resultsId, isPlayer1) => {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        results.innerHTML = '';
        if (query.length < 2) return;

        const matches = allPlayers.filter(p => p.web_name.toLowerCase().includes(query) || `${p.first_name} ${p.second_name}`.toLowerCase().includes(query)).slice(0, 10);
        
        matches.forEach(p => {
            const team = teams.find(t => t.id === p.team);
            const a = document.createElement('a');
            a.href = '#';
            a.className = 'list-group-item list-group-item-action bg-dark text-white border-secondary d-flex align-items-center';
            a.innerHTML = `
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" style="width: 30px; border-radius: 50%;" class="me-2 bg-light">
                ${p.web_name} <span class="text-muted ms-2 small">(${team.short_name})</span>
            `;
            a.addEventListener('click', (ev) => {
                ev.preventDefault();
                input.value = '';
                results.innerHTML = '';
                if (isPlayer1) {
                    player1 = p;
                    updatePlayerCard('player1-card', p);
                } else {
                    player2 = p;
                    updatePlayerCard('player2-card', p);
                }
                comparePlayers();
            });
            results.appendChild(a);
        });
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target !== input) results.innerHTML = '';
    });
};

const updatePlayerCard = (cardId, player) => {
    const card = document.getElementById(cardId);
    const team = teams.find(t => t.id === player.team);
    card.innerHTML = `
        <div class="card-body text-center p-4">
            <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" 
                 style="width: 100px; height: 120px; object-fit: cover; border-radius: 10px; background-color: #f0f0f0;" 
                 class="mb-3 bg-light shadow" ${playerOnerrorAttr(team.code, player.element_type)}>
            <h4 class="mb-1 text-light">${player.web_name}</h4>
            <div class="text-muted mb-2">
                <img src="https://resources.premierleague.com/premierleague/badges/50/t${team.code}.png" style="width: 20px;" class="me-1">
                ${team.name}
            </div>
            <span class="badge bg-secondary">${getPosName(player.element_type)}</span>
        </div>
    `;
};

const getPosName = (type) => {
    const pos = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };
    return pos[type] || 'Unknown';
}

let isFormMode = false;

const toggleComparisonForm = (isForm) => {
    isFormMode = isForm;
    comparePlayers();
};

const comparePlayers = async () => {
    if (!player1 || !player2) return;

    document.getElementById('comparison-results').classList.remove('d-none');
    document.getElementById('comp-p1-name').textContent = player1.web_name;
    document.getElementById('comp-p2-name').textContent = player2.web_name;
    document.getElementById('past-p1-name').textContent = player1.web_name;
    document.getElementById('past-p2-name').textContent = player2.web_name;

    const statsToCompare = [
        { label: 'Total Points', key: 'total_points' },
        { label: 'Goals', key: 'goals_scored' },
        { label: 'Assists', key: 'assists' },
        { label: 'Clean Sheets', key: 'clean_sheets' },
        { label: 'Minutes Played', key: 'minutes' },
        { label: 'Expected Goals (xG)', key: 'expected_goals' },
        { label: 'Expected Assists (xA)', key: 'expected_assists' },
        { label: 'Expected Goal Inv (xGI)', key: 'expected_goal_involvements' },
        { label: 'Bonus Points', key: 'bonus' },
        { label: 'BPS', key: 'bps' },
        { label: 'ICT Index', key: 'ict_index' }
    ];

    const body = document.getElementById('comparison-body');
    body.innerHTML = '<tr><td colspan="3"><div class="spinner-border text-primary my-4"></div></td></tr>';

    try {
        const [p1Data, p2Data] = await Promise.all([
            getPlayer(player1.id),
            getPlayer(player2.id)
        ]);

        body.innerHTML = '';
        
        let p1History = p1Data.history || [];
        let p2History = p2Data.history || [];
        
        // If form mode, slice the last 4 matches
        if (isFormMode) {
            p1History = p1History.slice(-4);
            p2History = p2History.slice(-4);
        }

        const calcTotal = (history, key) => {
            return history.reduce((sum, match) => sum + (parseFloat(match[key]) || 0), 0);
        };

        statsToCompare.forEach(stat => {
            let val1 = 0, val2 = 0;
            
            if (isFormMode) {
                val1 = calcTotal(p1History, stat.key);
                val2 = calcTotal(p2History, stat.key);
                
                // Format float for expected stats
                if (stat.key.includes('expected') || stat.key === 'ict_index') {
                    val1 = parseFloat(val1.toFixed(2));
                    val2 = parseFloat(val2.toFixed(2));
                }
            } else {
                val1 = parseFloat(player1[stat.key]) || 0;
                val2 = parseFloat(player2[stat.key]) || 0;
            }
            
            let c1 = '', c2 = '';
            if (val1 > val2) c1 = 'text-success fw-bold';
            else if (val2 > val1) c2 = 'text-success fw-bold';

            body.innerHTML += `
                <tr class="fs-5">
                    <td class="${c1}">${val1}</td>
                    <td class="text-muted small text-uppercase" style="font-size: 0.9rem;">${stat.label}</td>
                    <td class="${c2}">${val2}</td>
                </tr>
            `;
        });

        // --- Render Past Seasons ---
        const pastBody = document.getElementById('past-comparison-body');
        pastBody.innerHTML = '';
        
        const p1HistoryPast = p1Data.history_past || [];
        const p2HistoryPast = p2Data.history_past || [];

        // Collect all seasons
        const seasons = new Set();
        p1HistoryPast.forEach(s => seasons.add(s.season_name));
        p2HistoryPast.forEach(s => seasons.add(s.season_name));
        
        const sortedSeasons = Array.from(seasons).sort().reverse();

        if (sortedSeasons.length === 0) {
            pastBody.innerHTML = '<tr><td colspan="3" class="text-muted">No past season data available for these players.</td></tr>';
        } else {
            sortedSeasons.forEach(seasonName => {
                const s1 = p1HistoryPast.find(s => s.season_name === seasonName);
                const s2 = p2HistoryPast.find(s => s.season_name === seasonName);
                
                const pts1 = s1 ? s1.total_points : '-';
                const pts2 = s2 ? s2.total_points : '-';

                let c1 = '', c2 = '';
                if (pts1 !== '-' && pts2 !== '-') {
                    if (pts1 > pts2) c1 = 'text-success fw-bold';
                    else if (pts2 > pts1) c2 = 'text-success fw-bold';
                }

                pastBody.innerHTML += `
                    <tr class="fs-5">
                        <td class="${c1}">${pts1} <span class="fs-6 text-muted ms-2">${s1 ? '(' + s1.minutes + ' mins)' : ''}</span></td>
                        <td class="text-muted fw-bold">${seasonName}</td>
                        <td class="${c2}">${pts2} <span class="fs-6 text-muted ms-2">${s2 ? '(' + s2.minutes + ' mins)' : ''}</span></td>
                    </tr>
                `;
            });
        }

    } catch (e) {
        console.error(e);
        body.innerHTML = '<tr><td colspan="3" class="text-danger">Error loading comparison data.</td></tr>';
        document.getElementById('past-comparison-body').innerHTML = '<tr><td colspan="3" class="text-danger">Error loading past seasons.</td></tr>';
    }
};

// --- League Table Logic ---
async function renderStandings() {
    const container = document.getElementById('league-table-container');
    const standingsData = await getPulseLiveStandings();
    
    if (!standingsData || !standingsData.tables || !standingsData.tables[0]) {
        if(container) container.innerHTML = '<div class="alert alert-warning">Could not load the league table.</div>';
        return;
    }

    let entries = JSON.parse(JSON.stringify(standingsData.tables[0].entries));
    
    // Calculate live overrides from fixtures
    entries.forEach(entry => {
        const fplTeam = teams.find(t => t.name === entry.team.name || t.short_name === entry.team.club.abbr);
        if (!fplTeam) return;

        // Check if team is currently playing live
        entry.isLive = fixtures.some(f => f.started && !f.finished && !f.finished_provisional && (f.team_h === fplTeam.id || f.team_a === fplTeam.id));

        // Find all FPL fixtures for this team that have started and have a score
        const teamFixtures = fixtures.filter(f => f.started && (f.team_h === fplTeam.id || f.team_a === fplTeam.id) && f.team_h_score !== null && f.team_a_score !== null);
        
        // FPL scores update live. If teamFixtures > entry.overall.played, PulseLive hasn't updated yet.
        if (teamFixtures.length > entry.overall.played) {
            const missingFixtures = teamFixtures.slice(entry.overall.played);
            missingFixtures.forEach(f => {
                const isHome = f.team_h === fplTeam.id;
                const goalsFor = isHome ? f.team_h_score : f.team_a_score;
                const goalsAgainst = isHome ? f.team_a_score : f.team_h_score;
                
                entry.overall.played += 1;
                entry.overall.goalsFor += goalsFor;
                entry.overall.goalsAgainst += goalsAgainst;
                entry.overall.goalsDifference += (goalsFor - goalsAgainst);
                
                if (goalsFor > goalsAgainst) {
                    entry.overall.won += 1;
                    entry.overall.points += 3;
                } else if (goalsFor === goalsAgainst) {
                    entry.overall.drawn += 1;
                    entry.overall.points += 1;
                } else {
                    entry.overall.lost += 1;
                }
            });
        }
    });

    // Re-sort the entries array by points, then goal difference, then goals scored
    entries.sort((a, b) => {
        if (b.overall.points !== a.overall.points) return b.overall.points - a.overall.points;
        if (b.overall.goalsDifference !== a.overall.goalsDifference) return b.overall.goalsDifference - a.overall.goalsDifference;
        return b.overall.goalsFor - a.overall.goalsFor;
    });

    // Update positions
    entries.forEach((entry, index) => {
        entry.position = index + 1;
    });
    
    let html = `
        <table class="table table-dark table-striped table-hover align-middle shadow-sm">
            <thead>
                <tr>
                    <th scope="col" class="text-center">Pos</th>
                    <th scope="col">Club</th>
                    <th scope="col" class="text-center">Pl</th>
                    <th scope="col" class="text-center">W</th>
                    <th scope="col" class="text-center">D</th>
                    <th scope="col" class="text-center">L</th>
                    <th scope="col" class="text-center d-none d-md-table-cell">GF</th>
                    <th scope="col" class="text-center d-none d-md-table-cell">GA</th>
                    <th scope="col" class="text-center">GD</th>
                    <th scope="col" class="text-center fw-bold text-info" style="position: sticky; right: 0; background-color: #212529; z-index: 2;">Pts</th>
                </tr>
            </thead>
            <tbody>
    `;

    entries.forEach(entry => {
        const fplTeam = teams.find(t => t.name === entry.team.name || t.short_name === entry.team.club.abbr);
        const badgeUrl = fplTeam ? `https://resources.premierleague.com/premierleague/badges/50/t${fplTeam.code}.png` : '';
        
        let rowClass = '';
        if (entry.position <= 4) rowClass = 'border-primary border-start border-4';
        else if (entry.position === 5) rowClass = 'border-warning border-start border-4';
        else if (entry.position >= 18) rowClass = 'border-danger border-start border-4';

        html += `
            <tr>
                <td class="text-center ${rowClass}">${entry.position}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${badgeUrl}" alt="${entry.team.name}" style="width: 25px; height: 25px;" class="me-2">
                        <span class="d-none d-sm-inline fw-semibold">${entry.team.name}</span>
                        <span class="d-inline d-sm-none fw-semibold">${entry.team.shortName}</span>
                        ${entry.isLive ? '<span class="spinner-grow text-success spinner-grow-sm ms-2" role="status" style="width: 0.5rem; height: 0.5rem;" title="Playing Now"><span class="visually-hidden">Live</span></span>' : ''}
                    </div>
                </td>
                <td class="text-center">${entry.overall.played}</td>
                <td class="text-center">${entry.overall.won}</td>
                <td class="text-center">${entry.overall.drawn}</td>
                <td class="text-center">${entry.overall.lost}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsFor}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsAgainst}</td>
                <td class="text-center">${entry.overall.goalsDifference > 0 ? '+' + entry.overall.goalsDifference : entry.overall.goalsDifference}</td>
                <td class="text-center fw-bold text-info fs-5" style="position: sticky; right: 0; background-color: #212529; z-index: 1;">${entry.overall.points}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    if(container) container.innerHTML = html;
}

// --- Advanced Visualizations Logic ---
let scatterChart = null;

const renderScatterChart = () => {
    const ctx = document.getElementById('xgScatterChart').getContext('2d');
    
    // Filter to only forwards and midfielders who have played significant minutes
    const dataPoints = allPlayers.filter(p => (p.element_type === 3 || p.element_type === 4) && p.minutes > 90)
        .map(p => ({
            x: parseFloat(p.expected_goals) || 0,
            y: parseFloat(p.goals_scored) || 0,
            player: p
        }));

    if (scatterChart) {
        scatterChart.destroy();
    }

    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Goals vs xG',
                data: dataPoints,
                backgroundColor: 'rgba(13, 202, 240, 0.6)',
                borderColor: '#0dcaf0',
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const p = context.raw.player;
                            return `${p.web_name} | Goals: ${context.raw.y}, xG: ${context.raw.x.toFixed(2)}`;
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Expected Goals (xG)', color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#adb5bd' }
                },
                y: {
                    title: { display: true, text: 'Actual Goals', color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#adb5bd' }
                }
            }
        },
        plugins: [{
            id: 'diagonalLine',
            beforeDraw: chart => {
                const { ctx, chartArea: { top, right, bottom, left }, scales: { x, y } } = chart;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x.getPixelForValue(0), y.getPixelForValue(0));
                // Draw a 1:1 diagonal line indicating performing exactly to xG
                const maxVal = Math.min(x.max, y.max);
                ctx.lineTo(x.getPixelForValue(maxVal), y.getPixelForValue(maxVal));
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.restore();
            }
        }]
    });
};

const renderTeamDefense = () => {
    const teamStats = teams.map(team => {
        // Find all goalkeepers for this team
        const gks = allPlayers.filter(p => p.team === team.id && p.element_type === 1);
        // Team xGC is approx the sum of xGC of all their GKs (since exactly 1 GK plays at a time)
        const teamXGC = gks.reduce((sum, gk) => sum + (parseFloat(gk.expected_goals_conceded) || 0), 0);
        // Team Clean Sheets is sum of GK clean sheets
        const teamCS = gks.reduce((sum, gk) => sum + (parseInt(gk.clean_sheets) || 0), 0);
        
        return {
            team: team,
            xGC: parseFloat(teamXGC.toFixed(2)),
            cs: teamCS
        };
    });

    // Sort by worst defense (highest xGC)
    teamStats.sort((a, b) => b.xGC - a.xGC);

    const body = document.getElementById('team-defense-body');
    body.innerHTML = '';

    teamStats.forEach((stat, index) => {
        body.innerHTML += `
            <tr>
                <td class="fw-bold">${index + 1}</td>
                <td>
                    <img src="https://resources.premierleague.com/premierleague/badges/50/t${stat.team.code}.png" style="width: 25px;" class="me-2 drop-shadow">
                    <span class="fw-bold">${stat.team.name}</span>
                </td>
                <td class="fs-5 text-warning fw-bold">${stat.xGC.toFixed(2)}</td>
                <td class="fs-5">${stat.cs}</td>
            </tr>
        `;
    });
};

// Add drop-shadow utility class if not present in css
const style = document.createElement('style');
style.textContent = `
    .drop-shadow { filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
`;
document.head.appendChild(style);

window.addEventListener('DOMContentLoaded', () => {
    // We poll until 'allPlayers' is populated by data.js
    const initInterval = setInterval(() => {
        if (allPlayers && allPlayers.length > 0 && teams && teams.length > 0) {
            clearInterval(initInterval);
            renderDashboards();
            setupSearch('player1-search', 'player1-results', true);
            setupSearch('player2-search', 'player2-results', false);
            renderStandings();
            renderScatterChart();
            renderTeamDefense();
            
            // Live refresh for the league table
            setInterval(async () => {
                const hasLiveGames = fixtures.some(f => f.started && !f.finished && !f.finished_provisional);
                if (!hasLiveGames) return;
                
                try {
                    const data = await getFixtures();
                    fixtures = data; // Update global
                    await renderStandings();
                } catch (e) {
                    console.error("Live table refresh failed", e);
                }
            }, 60000);
        }
    }, 100);
});
