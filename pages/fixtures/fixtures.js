let currentGW = 1;

// Global countdown interval
let countdownInterval;
function startCountdowns() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        const timers = document.querySelectorAll('.countdown-timer');
        timers.forEach(timer => {
            const kickoff = new Date(timer.getAttribute('data-kickoff')).getTime();
            const now = new Date().getTime();
            const distance = kickoff - now;
            
            if (distance < 0) {
                timer.innerHTML = "Kickoff!";
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            let html = '';
            if(days > 0) html += `${days}d `;
            html += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timer.innerHTML = html;
        });
    }, 1000);
}

// Global live refresh interval
let liveRefreshInterval;
function startLiveRefresh() {
    if (liveRefreshInterval) clearInterval(liveRefreshInterval);
    const hasLiveGames = fixtures.some(f => f.started && !f.finished && !f.finished_provisional);
    if (!hasLiveGames) return;
    
    liveRefreshInterval = setInterval(async () => {
        try {
            const data = await getFixtures();
            fixtures = data.fixtures; // Update global
            
            // Only update DOM for live games
            fixtures.forEach(fixture => {
                if (fixture.started && !fixture.finished) {
                    const scoreDiv = document.querySelector(`#score-${fixture.code}`);
                    if (scoreDiv) {
                        scoreDiv.innerHTML = `
                            <div class="fw-bold fs-5">
                                ${fixture.team_h_score !== null ? fixture.team_h_score : '0'} - ${fixture.team_a_score !== null ? fixture.team_a_score : '0'}
                            </div>
                            ${!fixture.finished_provisional ?
                                `<span class="badge bg-success d-flex align-items-center justify-content-center gap-1 mx-auto mt-1" style="font-size:0.7rem; width:fit-content;">
                                    <span class="live-dot"></span> ${fixture.minutes}'
                                </span>` :
                                `<span class="badge bg-secondary mt-1" style="font-size:0.7rem;">FT</span>`}
                        `;
                    }
                }
            });
        } catch (e) {
            console.error("Live refresh failed", e);
        }
    }, 60000); // 60 seconds
}

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
        // Status class drives the left-border color via CSS
        let statusClass = '';
        if (fixture.started && !fixture.finished && !fixture.finished_provisional) {
            statusClass = 'fixture-live';
        } else if (fixture.finished || fixture.finished_provisional) {
            statusClass = 'fixture-finished';
        }
        fixtureRow.className = `accordion-item ${statusClass}`;
        fixtureRow.innerHTML = `
                <h2 class="accordion-header" id="heading${fixture.code}">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${fixture.code}" aria-expanded="true" aria-controls="collapse${fixture.code}">
                        <div class="d-flex justify-content-between w-100">
                            <div class="d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" class="team-logo me-2" alt="${homeTeam.short_name}">
                                <span>${homeTeam.short_name}</span>
                            </div>
                                                        <div class="text-center" id="score-${fixture.code}">
                                <div class="fw-bold fs-5">
                                    ${fixture.started ?
                                        `${fixture.team_h_score !== null ? fixture.team_h_score : '0'} - ${fixture.team_a_score !== null ? fixture.team_a_score : '0'}` :
                                        new Date(fixture.kickoff_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                ${fixture.started && !fixture.finished ?
                                    (!fixture.finished_provisional ?
                                        `<span class="badge bg-success d-flex align-items-center justify-content-center gap-1 mx-auto mt-1" style="font-size:0.7rem; width:fit-content;">
                                            <span class="live-dot"></span> ${fixture.minutes}'
                                        </span>` :
                                        `<span class="badge bg-secondary mt-1" style="font-size:0.7rem;">FT</span>`) :
                                    (fixture.finished ? `<span class="badge bg-secondary mt-1" style="font-size:0.7rem;">FT</span>` : '')}
                            </div>
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
                                <table class="table table-dark table-bordered">
                                    <thead>
                                        <tr>
                                            <th>Stat</th>
                                            <th>${homeTeam.short_name}</th>
                                            <th>${awayTeam.short_name}</th>
                                        </tr>
                                    </thead>
                                                                        <tbody>
                                        ${renderStatRow(fixture, 'goals_scored', 'Goals Scored')}
                                        ${renderStatRow(fixture, 'assists', 'Assists')}
                                        ${renderStatRow(fixture, 'yellow_cards', 'Yellow Cards')}
                                        ${renderStatRow(fixture, 'saves', 'Saves')}
                                        ${renderStatRow(fixture, 'bonus', 'Bonus')}
                                        ${renderStatRow(fixture, 'bps', 'BPS (Ranking)')}
                                        ${renderStatRow(fixture, 'defensive_contribution', 'Defensive Contributions')}
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
    startCountdowns();
    startLiveRefresh();
}

function renderStatRow(fixture, identifier, label) {
    const h = getStatDetails(fixture, identifier, 'h');
    const a = getStatDetails(fixture, identifier, 'a');
    const hasData = h !== 'None' || a !== 'None';
    const bgClass = hasData ? 'table-secondary' : '';
    return `
        <tr class="${bgClass}">
            <td class="${hasData ? 'fw-bold' : ''}">${label}</td>
            <td>${h}</td>
            <td>${a}</td>
        </tr>
    `;
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

// Quick win #15: Jump to current GW
document.getElementById('thisGW').addEventListener('click', () => {
    currentGW = selectedGW.id;
    isGwSet = false; // allow re-init
    updateGameweek();
});

// Quick win #15: Keyboard arrow navigation (only when no input is focused)
document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' && currentGW > 1) {
        currentGW--;
        updateGameweek();
    } else if (e.key === 'ArrowRight' && fixtures.some(f => f.event === currentGW + 1)) {
        currentGW++;
        updateGameweek();
    }
});

// Simple table sorting
let currentSortColumn = -1;
let sortAscending = true;
function sortRecentMatches(columnIndex) {
    const table = document.getElementById("recent-matches-table");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    
    // Toggle sort direction if clicking the same column
    if (currentSortColumn === columnIndex) {
        sortAscending = !sortAscending;
    } else {
        sortAscending = false; // Default to desc for stats
        currentSortColumn = columnIndex;
    }
    
    // Update header classes
    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, i) => {
        th.innerHTML = th.innerHTML.replace(/ ?| ?/g, '');
        if (i === columnIndex) {
            th.innerHTML += sortAscending ? ' ?' : ' ?';
        }
    });

    rows.sort((a, b) => {
        let aVal = a.cells[columnIndex].textContent.trim();
        let bVal = b.cells[columnIndex].textContent.trim();
        
        // Handle numeric sorting
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            aVal = aNum;
            bVal = bNum;
        }
        
        if (aVal < bVal) return sortAscending ? -1 : 1;
        if (aVal > bVal) return sortAscending ? 1 : -1;
        return 0;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

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
    const fplPredictedElem = document.getElementById('modal-fpl-predicted');
    const ourPredictedElem = document.getElementById('modal-our-predicted');
    
    // 1. Header with Photo & Key Stats
    document.getElementById('playerInfoModalLabel').innerHTML = `
        <div class="d-flex align-items-center gap-3 w-100">
            <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" 
                 style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; background: #eee;" 
                 onerror="playerImgOnerror(this, ${player.team_code})">
            <div>
                <h3 class="mb-0 fw-bold">${player.first_name} ${player.second_name}</h3>
                <div class="d-flex gap-2 text-muted fs-6 mt-1 align-items-center">
                    <span class="badge bg-secondary">${positionMap[player.element_type]}</span>
                    <span><i class="fas fa-pound-sign"></i> ${(player.now_cost / 10).toFixed(1)}m</span>
                    <span><i class="fas fa-users"></i> ${player.selected_by_percent}% owned</span>
                    <span><i class="fas fa-star text-warning"></i> ${player.total_points} pts</span>
                </div>
            </div>
        </div>
    `;

    // 2. Predictions
    if (fplPredictedElem && ourPredictedElem) {
        fplPredictedElem.textContent = player.ep_next ? player.ep_next : '0.0';
        fplPredictedElem.style.color = '#333';
        
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
        
        if (player.isCaptain && predictedPoints !== undefined) {
            predictedPoints = predictedPoints / 2;
        }

        ourPredictedElem.textContent = predictedPoints !== undefined ? predictedPoints.toFixed(1) : '0.0';
        ourPredictedElem.style.color = '#333';
    }

    // 3. Upcoming Fixtures (FDR Styled)
    const fixturesList = document.getElementById('upcoming-fixtures-list');
    fixturesList.innerHTML = '';
    const maxFixtures = 10; // Only show next 10 for compactness
    data.fixtures.slice(0, maxFixtures).forEach(fixture => {
        const opponentTeam = getTeamById(fixture.is_home ? fixture.team_a : fixture.team_h);
        const difficultyClass = getDifficultyClass(fixture.difficulty);
        const homeAway = fixture.is_home ? 'H' : 'A';

        const fixtureItem = document.createElement('div');
        fixtureItem.className = `p-2 flex-shrink-0 border rounded me-2 text-center text-dark ${difficultyClass}`;
        fixtureItem.style.width = '100px'; 
        fixtureItem.style.fontWeight = 'bold';

        fixtureItem.innerHTML = `
            <div style="font-size: 0.8rem; opacity: 0.8;">GW${fixture.event}</div>
            <div>
                <img src="https://resources.premierleague.com/premierleague/badges/100/t${opponentTeam.code}.png" 
                     alt="${opponentTeam.short_name}" 
                     style="width: 35px; height: 35px; margin: 4px 0;">
            </div>
            <div>${opponentTeam.short_name} (${homeAway})</div>
        `;
        fixturesList.appendChild(fixtureItem);
    });

    // 4. Recent Matches (Condensed)
    const recentMatchesTable = document.querySelector('#recent-matches-table tbody');
    recentMatchesTable.innerHTML = '';
    const sortedHistory = data.history.sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

    sortedHistory.forEach(match => {
        const opponentTeam = getTeamById(match.opponent_team);
        let resultBadge;
        if (match.team_h_score === match.team_a_score) {
            resultBadge = `<span class="badge bg-secondary">D</span>`;
        } else if ((match.was_home && match.team_h_score > match.team_a_score) ||
                (!match.was_home && match.team_a_score > match.team_h_score)) {
            resultBadge = `<span class="badge bg-success">W</span>`;
        } else {
            resultBadge = `<span class="badge bg-danger">L</span>`;
        }

        const score = match.was_home 
            ? `${match.team_h_score}-${match.team_a_score}`
            : `${match.team_a_score}-${match.team_h_score}`;

        // Create condensed row (FPL key stats only)
        const matchRow = `
        <tr>
            <td>${match.round}</td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${opponentTeam.code}.png" 
                         alt="${opponentTeam.short_name}" style="width: 25px; height: 25px;">
                    ${opponentTeam.short_name} ${match.was_home ? '(H)' : '(A)'}
                </div>
            </td>
            <td>${score} ${resultBadge}</td>
            <td class="fw-bold">${match.total_points}</td>
            <td>${match.minutes}</td>
            <td>${match.goals_scored}</td>
            <td>${match.assists}</td>
            <td>${match.clean_sheets}</td>
            <td>${match.saves}</td>
            <td>${match.bonus}</td>
            <td>${match.bps}</td>
        </tr>`;
        
        recentMatchesTable.insertAdjacentHTML('beforeend', matchRow);
    });

    // We've hidden past seasons or updated it similarly in HTML...
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

    renderTeamLineup(lineupData.home_team.players, lineupData.home_team.substitutes, fplFixture.team_h, document.getElementById(`home-starting-${fplFixtureId}`), document.getElementById(`home-bench-${fplFixtureId}`));
    renderTeamLineup(lineupData.away_team.players, lineupData.away_team.substitutes, fplFixture.team_a, document.getElementById(`away-starting-${fplFixtureId}`), document.getElementById(`away-bench-${fplFixtureId}`));
}

function renderTeamLineup(plPlayers, plSubstitutes, fplTeamId, startingContainer, benchContainer) {
    const teamPlayers = allPlayers.filter(p => p.team === fplTeamId);

        const buildPlayerHtml = (plPlayer, isBench) => {
        const fplPlayer = matchPlayer(plPlayer, teamPlayers);

        const displayName = plPlayer.name ? plPlayer.name.display : (plPlayer.knownName || plPlayer.lastName || '?');
        const shirtNum = plPlayer.matchShirtNumber || plPlayer.shirtNum || '-';
        const isCaptain = plPlayer.captain || plPlayer.isCaptain || false;

        let playerDisplay = displayName;
        let points = '-';
        let posPill = '';
        let statusIcon = '';

        if (fplPlayer) {
            playerDisplay = `<a href="#" onclick='showPlayerInfo(${JSON.stringify(fplPlayer)})'>${fplPlayer.web_name}</a>`;
            points = fplPlayer.event_points !== undefined ? fplPlayer.event_points : 0;
            
            const posNames = {1:'GK', 2:'DEF', 3:'MID', 4:'FWD'};
            const posColors = {1:'warning', 2:'primary', 3:'success', 4:'danger'};
            const posName = posNames[fplPlayer.element_type] || 'UNK';
            const posColor = posColors[fplPlayer.element_type] || 'secondary';
            posPill = `<span class="badge bg-${posColor} me-1" style="font-size:0.6rem;">${posName}</span>`;

            if (fplPlayer.status !== 'a') {
                const color = fplPlayer.status === 'i' ? 'danger' : 'warning';
                statusIcon = `<i class="fas fa-plus-square text-${color} ms-1" title="${fplPlayer.news}"></i>`;
            }
        }

        return `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div>
                    <span class="badge bg-secondary me-2" style="width: 25px;">${shirtNum}</span>
                    ${posPill}
                    ${playerDisplay} 
                    ${isCaptain ? '<span class="badge bg-warning text-dark ms-1">C</span>' : ''}
                    ${statusIcon}
                </div>
                <span class="fw-bold ${points > 0 ? 'text-success' : ''}">${points}</span>
            </div>
        `;
    };

    startingContainer.innerHTML = (plPlayers || []).map(p => buildPlayerHtml(p, false)).join('');
    benchContainer.innerHTML = (plSubstitutes || []).map(p => buildPlayerHtml(p, true)).join('');
}

function matchPlayer(plPlayer, teamPlayers) {
    const plDisplayName = (plPlayer.name ? plPlayer.name.display : (plPlayer.knownName || '')) || '';
    const plLastName = (plPlayer.name ? plPlayer.name.last : (plPlayer.lastName || '')) || '';

    const normDisplay = plDisplayName.toLowerCase().replace(/[^a-z]/g, '');
    const normLast = plLastName.toLowerCase().replace(/[^a-z]/g, '');
    
    // Some PL names are just last names, some have initials
    const plInitials = plDisplayName.split(' ').map(n => n[0]).join('').toLowerCase();

    let bestMatch = null;
    let bestScore = Infinity;

    teamPlayers.forEach(fplPlayer => {
        const fplName = `${fplPlayer.first_name} ${fplPlayer.second_name}`.toLowerCase().replace(/[^a-z]/g, '');
        const fplWebNameRaw = fplPlayer.web_name.toLowerCase();
        const fplWebName = fplWebNameRaw.replace(/[^a-z]/g, '');
        const fplLastName = fplPlayer.second_name.toLowerCase().replace(/[^a-z]/g, '');
        const fplFirstName = fplPlayer.first_name.toLowerCase().replace(/[^a-z]/g, '');
        
        // Exact matches (fast path)
        if (fplWebName === normLast || fplWebName === normDisplay || fplName === normDisplay) {
            bestMatch = fplPlayer;
            bestScore = -100;
            return;
        }
        
        // Handle "B.Fernandes" (FPL) matching "Bruno Fernandes" (PL)
        if (fplWebNameRaw.includes('.') && plDisplayName.toLowerCase().includes(fplWebNameRaw.split('.')[1].replace(/[^a-z]/g, ''))) {
            // e.g. b.fernandes -> fernandes, which is in "bruno fernandes"
            // check initial matches too
            if (fplWebNameRaw.split('.')[0] === plDisplayName.toLowerCase()[0]) {
                bestMatch = fplPlayer;
                bestScore = -50;
                return;
            }
        }
        
        // Handle "Matheus Cunha" matching "Cunha"
        if (normDisplay.includes(fplWebName) && fplWebName.length > 3) {
            let score = -10;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = fplPlayer;
            }
        }
        if (fplName.includes(normLast) && normLast.length > 3) {
            let score = -5;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = fplPlayer;
            }
        }

        const d1 = levenshtein(normDisplay, fplName);
        const d2 = levenshtein(normLast, fplWebName);
        const d3 = levenshtein(normDisplay, fplWebName);
        
        const score = Math.min(d1, d2, d3);
        
        if (score < 4 && score < bestScore) {
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











