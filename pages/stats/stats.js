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
                         class="me-3 shadow-sm bg-light" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';">
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
                    <div class="card-header border-secondary fw-bold fs-5">${dash.title} <i class="fas fa-chevron-right float-end mt-1 text-muted" style="font-size: 0.8rem;"></i></div>
                    <div class="card-body">
                        ${listHtml}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += colHtml;
    });
};

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
                 class="mb-3 bg-light shadow" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';">
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

const comparePlayers = () => {
    if (!player1 || !player2) return;

    document.getElementById('comparison-results').classList.remove('d-none');
    document.getElementById('comp-p1-name').textContent = player1.web_name;
    document.getElementById('comp-p2-name').textContent = player2.web_name;

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
    body.innerHTML = '';

    statsToCompare.forEach(stat => {
        const val1 = parseFloat(player1[stat.key]) || 0;
        const val2 = parseFloat(player2[stat.key]) || 0;
        
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
};

// --- League Table Logic ---
async function renderStandings() {
    const container = document.getElementById('league-table-container');
    const standingsData = await getPulseLiveStandings();
    
    if (!standingsData || !standingsData.tables || !standingsData.tables[0]) {
        if(container) container.innerHTML = '<div class="alert alert-warning">Could not load the league table.</div>';
        return;
    }

    const entries = standingsData.tables[0].entries;
    
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
                    <th scope="col" class="text-center fw-bold text-info">Pts</th>
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
                    </div>
                </td>
                <td class="text-center">${entry.overall.played}</td>
                <td class="text-center">${entry.overall.won}</td>
                <td class="text-center">${entry.overall.drawn}</td>
                <td class="text-center">${entry.overall.lost}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsFor}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsAgainst}</td>
                <td class="text-center">${entry.overall.goalsDifference > 0 ? '+' + entry.overall.goalsDifference : entry.overall.goalsDifference}</td>
                <td class="text-center fw-bold text-info fs-5">${entry.overall.points}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    if(container) container.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', () => {
    // We poll until 'allPlayers' is populated by data.js
    const initInterval = setInterval(() => {
        if (allPlayers && allPlayers.length > 0 && teams && teams.length > 0) {
            clearInterval(initInterval);
            renderDashboards();
            setupSearch('player1-search', 'player1-results', true);
            setupSearch('player2-search', 'player2-results', false);
            renderStandings();
        }
    }, 100);
});
