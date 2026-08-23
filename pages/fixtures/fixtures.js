let currentGW = 1;

function renderFixtures() {
    const fixturesContent = document.getElementById('fixtures-content');
    const gameweekData = fixtures.filter(f => f.event == currentGW);
    fixturesContent.innerHTML = '';

    let currentDate = '';

    gameweekData.forEach(fixture => {
        const homeTeam = teams.find(team => team.id === fixture.team_h);
        const awayTeam = teams.find(team => team.id === fixture.team_a);

        const fixtureDate = formatFixtureDate(fixture.kickoff_time);
        let badgeClass = '';

        // Determine the badge class based on the fixture status
        if (fixture.finished) {
            badgeClass = 'bg-secondary'; // Grey for completed fixtures
        } else if (fixture.started) {
            badgeClass = 'bg-primary'; // Blue for in-progress fixtures
        } else {
            badgeClass = 'bg-success'; // Green for upcoming fixtures
        }

        if (currentDate !== fixtureDate) {
            const dateHeader = document.createElement('div');
            dateHeader.className = 'fixture-date my-3'; // Add some margin for spacing
            dateHeader.innerHTML = `
                    <span class="badge ${badgeClass} p-2">${fixtureDate}</span>
                `;
            fixturesContent.appendChild(dateHeader);
            currentDate = fixtureDate;
        }

        const fixtureRow = document.createElement('div');
        fixtureRow.className = 'accordion-item';
        fixtureRow.innerHTML = `
                <h2 class="accordion-header" id="heading${fixture.code}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${fixture.code}" aria-expanded="true" aria-controls="collapse${fixture.code}">
                        <div class="d-flex justify-content-between w-100">
                            <div class="d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" class="team-logo me-2" alt="${homeTeam.short_name}">
                                <span>${homeTeam.short_name}</span>
                            </div>
                            <div>${fixture.started ?
                `${fixture.team_h_score !== null ? fixture.team_h_score : '0'} - ${fixture.team_a_score !== null ? fixture.team_a_score : '0'}` :
                new Date(fixture.kickoff_time).toLocaleTimeString()}</div>
                            <div class="d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${awayTeam.code}.png" class="team-logo me-2" alt="${awayTeam.short_name}">
                                <span>${awayTeam.short_name}</span>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapse${fixture.code}" class="accordion-collapse collapse" aria-labelledby="heading${fixture.code}">
                    <div class="accordion-body">
                        <ul class="nav nav-tabs" id="myTab${fixture.code}" role="tablist">
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" id="stats-tab-${fixture.code}" data-bs-toggle="tab" data-bs-target="#stats-${fixture.code}" type="button" role="tab" aria-controls="stats-${fixture.code}" aria-selected="true">Player Stats</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="lineups-tab-${fixture.code}" data-bs-toggle="tab" data-bs-target="#lineups-${fixture.code}" type="button" role="tab" aria-controls="lineups-${fixture.code}" aria-selected="false" onclick="loadLineups(${fixture.id})">Lineups</button>
                            </li>
                        </ul>
                        <div class="tab-content mt-3" id="myTabContent${fixture.code}">
                            <div class="tab-pane fade show active" id="stats-${fixture.code}" role="tabpanel" aria-labelledby="stats-tab-${fixture.code}">
                                <table class="table table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Stat</th>
                                            <th>${homeTeam.short_name}</th>
                                            <th>${awayTeam.short_name}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Goals Scored</td>
                                            <td>${getStatDetails(fixture, 'goals_scored', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'goals_scored', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Assists</td>
                                            <td>${getStatDetails(fixture, 'assists', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'assists', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Yellow Cards</td>
                                            <td>${getStatDetails(fixture, 'yellow_cards', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'yellow_cards', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Saves</td>
                                            <td>${getStatDetails(fixture, 'saves', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'saves', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Bonus</td>
                                            <td>${getStatDetails(fixture, 'bonus', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'bonus', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Bonus Points System</td>
                                            <td>${getStatDetails(fixture, 'bps', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'bps', 'a')}</td>
                                        </tr>
                                        <tr>
                                            <td>Defensive Contributions</td>
                                            <td>${getStatDetails(fixture, 'defensive_contribution', 'h')}</td>
                                            <td>${getStatDetails(fixture, 'defensive_contribution', 'a')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div class="tab-pane fade" id="lineups-${fixture.code}" role="tabpanel" aria-labelledby="lineups-tab-${fixture.code}">
                                <div id="lineups-container-${fixture.id}" class="text-center p-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading lineups...</span>
                                    </div>
                                    <p class="mt-2 text-muted">Fetching live lineups...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        fixturesContent.appendChild(fixtureRow);
    });
}

function getStatDetails(fixture, identifier, teamName) {
    const stats = fixture.stats.find(stat => stat.identifier === identifier);
    if (!stats) return 'None';

    return stats[teamName].map(stat => {
        const player = allPlayers.find(p => p.id === stat.element);
        if (player) {
            // Pass player as an argument to showPlayerInfo
            return `<a href="#" onclick='showPlayerInfo(${JSON.stringify(player)})'>${player.web_name}</a> (${stat.value})`;
        }
        return `Unknown (${stat.value})`;
    }).join('<br>');
}

function updateGameweek() {
    initCurrentGW();
    document.getElementById('gameweek').textContent = `Gameweek ${currentGW}`;
    renderFixtures();
}

let isGwSet = false;
function initCurrentGW() {
    if (!isGwSet) {
        currentGW = selectedGW.id;
        isGwSet = true;
    }
}

document.getElementById('prevGW').addEventListener('click', () => {
    if (currentGW > 1) {
        currentGW--;
        updateGameweek();
    }
});

document.getElementById('nextGW').addEventListener('click', () => {
    if (fixtures.some(f => f.event === currentGW + 1)) {
        currentGW++;
        updateGameweek();
    }
});

// Function to fetch and show player info
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
    document.getElementById('playerInfoModalLabel').innerHTML = `
    <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;" onerror="this.onerror=null; this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp';">
    ${player.first_name} ${player.second_name}`;

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
        
        let predictedPoints = player.predicted_points;
        if (predictedPoints === undefined) {
            const upcomingGameweek = gameweeks.find(gw => gw.id >= currentGW);
            if (upcomingGameweek) {
                const fixture = getPlayerFixture(player, upcomingGameweek.id);
                if (fixture) {
                    predictedPoints = calculatePlayerPredictedPoints(player, fixture, upcomingGameweek.id);
                }
            }
        }
        
        // Always show the non-captained version in this menu
        if (player.isCaptain && predictedPoints !== undefined) {
            predictedPoints = predictedPoints / 2;
        }

        ourPredictedElem.textContent = predictedPoints !== undefined ? predictedPoints.toFixed(1) : '0.0';
        ourPredictedElem.style.color = '#333';
        ourPredictedElem.style.textShadow = 'none';
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

window.pulseLiveFixturesData = null;

async function loadLineups(fplFixtureId) {
    const container = document.getElementById(`lineups-container-${fplFixtureId}`);
    
    // Find FPL fixture
    const fplFixture = fixtures.find(f => f.id === fplFixtureId);
    if (!fplFixture) return;

    if (!window.pulseLiveFixturesData) {
        window.pulseLiveFixturesData = await getPulseLiveFixtures();
    }

    const homeTeam = teams.find(t => t.id === fplFixture.team_h);
    const awayTeam = teams.find(t => t.id === fplFixture.team_a);
    const fplKickoff = new Date(fplFixture.kickoff_time).getTime();

    // Find matching Pulse Live fixture
    const plMatch = window.pulseLiveFixturesData.find(pl => {
        // match by home team abbreviation and same day
        const plHomeTeam = pl.teams[0].team.club ? pl.teams[0].team.club.abbr : pl.teams[0].team.abbr;
        return plHomeTeam === homeTeam.short_name && Math.abs(pl.kickoff.millis - fplKickoff) < 86400000;
    });

    if (!plMatch) {
        container.innerHTML = '<div class="alert alert-warning">Lineups not available for this match yet.</div>';
        return;
    }

    const matchId = plMatch.id;
    const lineupData = await getPulseLiveLineup(matchId);

    if (!lineupData || !lineupData.home_team || !lineupData.away_team || !lineupData.home_team.players || lineupData.home_team.players.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Lineups have not been released yet (usually available 60 minutes before kickoff).</div>';
        return;
    }

    // Render lineups
    container.innerHTML = `
        <div class="row text-start">
            <div class="col-6 border-end">
                <h5 class="text-center mb-3">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" style="width:30px;">
                    ${homeTeam.short_name}
                </h5>
                <h6 class="text-muted border-bottom pb-1">Starting XI</h6>
                <div id="home-starting-${fplFixtureId}" class="mb-3"></div>
                <h6 class="text-muted border-bottom pb-1">Bench</h6>
                <div id="home-bench-${fplFixtureId}"></div>
            </div>
            <div class="col-6">
                <h5 class="text-center mb-3">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${awayTeam.code}.png" style="width:30px;">
                    ${awayTeam.short_name}
                </h5>
                <h6 class="text-muted border-bottom pb-1">Starting XI</h6>
                <div id="away-starting-${fplFixtureId}" class="mb-3"></div>
                <h6 class="text-muted border-bottom pb-1">Bench</h6>
                <div id="away-bench-${fplFixtureId}"></div>
            </div>
        </div>
    `;

    renderTeamLineup(lineupData.home_team.players, fplFixture.team_h, document.getElementById(`home-starting-${fplFixtureId}`), document.getElementById(`home-bench-${fplFixtureId}`));
    renderTeamLineup(lineupData.away_team.players, fplFixture.team_a, document.getElementById(`away-starting-${fplFixtureId}`), document.getElementById(`away-bench-${fplFixtureId}`));
}

function renderTeamLineup(plPlayers, fplTeamId, startingContainer, benchContainer) {
    const teamPlayers = allPlayers.filter(p => p.team === fplTeamId);
    
    let startingHtml = '';
    let benchHtml = '';

    plPlayers.forEach(plPlayer => {
        // Map to FPL player
        const fplPlayer = matchPlayer(plPlayer, teamPlayers);
        
        let playerDisplay = plPlayer.knownName || plPlayer.lastName;
        let points = '-';
        if (fplPlayer) {
            playerDisplay = `<a href="#" onclick='showPlayerInfo(${JSON.stringify(fplPlayer)})'>${fplPlayer.web_name}</a>`;
            points = fplPlayer.event_points !== undefined ? fplPlayer.event_points : 0;
        }

        const html = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div>
                    <span class="badge bg-secondary me-2" style="width: 25px;">${plPlayer.shirtNum || '-'}</span>
                    ${playerDisplay} ${plPlayer.isCaptain ? '<span class="badge bg-warning text-dark">C</span>' : ''}
                </div>
                <span class="fw-bold">${points}</span>
            </div>
        `;

        if (plPlayer.position === 'Substitute') {
            benchHtml += html;
        } else {
            startingHtml += html;
        }
    });

    startingContainer.innerHTML = startingHtml;
    benchContainer.innerHTML = benchHtml;
}

function matchPlayer(plPlayer, teamPlayers) {
    // Basic string matching using Levenshtein distance
    let bestMatch = null;
    let bestScore = Infinity;

    const plName = (plPlayer.knownName || `${plPlayer.firstName} ${plPlayer.lastName}`).toLowerCase().replace(/[^a-z]/g, '');
    const plLastName = (plPlayer.lastName).toLowerCase().replace(/[^a-z]/g, '');

    teamPlayers.forEach(fplPlayer => {
        const fplName = `${fplPlayer.first_name} ${fplPlayer.second_name}`.toLowerCase().replace(/[^a-z]/g, '');
        const fplWebName = fplPlayer.web_name.toLowerCase().replace(/[^a-z]/g, '');
        
        // Exact matches
        if (fplWebName === plLastName || fplWebName === plName || fplName === plName) {
            bestMatch = fplPlayer;
            bestScore = 0;
            return;
        }

        const d1 = levenshtein(plName, fplName);
        const d2 = levenshtein(plLastName, fplWebName);
        const score = Math.min(d1, d2);
        
        if (score < bestScore && score < 5) { // threshold for fuzzy match
            bestScore = score;
            bestMatch = fplPlayer;
        }
    });

    return bestMatch;
}

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

async function renderStandings() {
    const container = document.getElementById('league-table-container');
    const standingsData = await getPulseLiveStandings();
    
    if (!standingsData || !standingsData.tables || !standingsData.tables[0]) {
        if(container) container.innerHTML = '<div class="alert alert-warning">Could not load the league table.</div>';
        return;
    }

    const entries = standingsData.tables[0].entries;
    
    let html = `
        <table class="table table-dark table-striped table-hover align-middle">
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
                    <th scope="col" class="text-center fw-bold">Pts</th>
                </tr>
            </thead>
            <tbody>
    `;

    entries.forEach(entry => {
        // Try to match the FPL team for the badge code
        const fplTeam = teams.find(t => t.name === entry.team.name || t.short_name === entry.team.club.abbr);
        const badgeUrl = fplTeam ? `https://resources.premierleague.com/premierleague/badges/50/t${fplTeam.code}.png` : '';
        
        let rowClass = '';
        if (entry.position <= 4) rowClass = 'border-primary border-start border-4'; // Champions League
        else if (entry.position === 5) rowClass = 'border-warning border-start border-4'; // Europa
        else if (entry.position >= 18) rowClass = 'border-danger border-start border-4'; // Relegation

        html += `
            <tr>
                <td class="text-center ${rowClass}">${entry.position}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${badgeUrl}" alt="${entry.team.name}" style="width: 25px; height: 25px;" class="me-2">
                        <span class="d-none d-sm-inline">${entry.team.name}</span>
                        <span class="d-inline d-sm-none">${entry.team.shortName}</span>
                    </div>
                </td>
                <td class="text-center">${entry.overall.played}</td>
                <td class="text-center">${entry.overall.won}</td>
                <td class="text-center">${entry.overall.drawn}</td>
                <td class="text-center">${entry.overall.lost}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsFor}</td>
                <td class="text-center d-none d-md-table-cell">${entry.overall.goalsAgainst}</td>
                <td class="text-center">${entry.overall.goalsDifference > 0 ? '+' + entry.overall.goalsDifference : entry.overall.goalsDifference}</td>
                <td class="text-center fw-bold">${entry.overall.points}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    if(container) container.innerHTML = html;
}

// Call renderStandings when the page finishes loading data
window.addEventListener('DOMContentLoaded', () => {
    // We can delay it slightly to let fixtures load first
    setTimeout(renderStandings, 1000);
});
