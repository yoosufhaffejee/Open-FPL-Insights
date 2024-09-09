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
                            <div>${fixture.finished ?
                `${fixture.team_h_score ? fixture.team_h_score : '0'} - ${fixture.team_a_score ? fixture.team_a_score : '0'}` :
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
                            </tbody>
                        </table>
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
    <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
    ${player.first_name} ${player.second_name}`;

    // Clear previous data
    const fixturesList = document.getElementById('upcoming-fixtures-list');
    const recentMatchesTable = document.querySelector('#recent-matches-table tbody');
    const pastSeasonsTable = document.querySelector('#past-seasons-table tbody');

    fixturesList.innerHTML = '';
    recentMatchesTable.innerHTML = '';
    pastSeasonsTable.innerHTML = '';

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