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
            fixtures = data; // Update global
            
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
            
            // Also refresh the league table live
            await renderStandings();
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
    const bgClass = '';
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
            // Pass player ID as an argument to showPlayerInfo
            return `<a href="javascript:void(0)" onclick="showPlayerInfo(${player.id})">${player.web_name}</a> (${stat.value})`;
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
function showPlayerInfo(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) return;

    // Show modal immediately with loading state for instant feedback
    const modalElem = document.getElementById('playerInfoModal');
    let playerInfoModal = bootstrap.Modal.getInstance(modalElem);
    if (!playerInfoModal) {
        playerInfoModal = new bootstrap.Modal(modalElem);
    }
    
    // Save original modal body layout if not already saved
    if (!window.originalPlayerInfoModalHtml) {
        window.originalPlayerInfoModalHtml = document.getElementById('player-info-content').innerHTML;
    }
    
    document.getElementById('playerInfoModalLabel').innerHTML = `<h3 class="modal-title font-weight-bold">Loading...</h3>`;
    document.getElementById('player-info-content').innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>`;
    playerInfoModal.show();

    getPlayer(player.id)
        .then(response => {
            // Restore original HTML structure before populating
            document.getElementById('player-info-content').innerHTML = window.originalPlayerInfoModalHtml;
            // Populate the modal with the player info
            populatePlayerModal(response, player);
        })
        .catch(error => {
            console.log('Error fetching player info:', error);
            document.getElementById('player-info-content').innerHTML = `<div class="alert alert-danger">Failed to load player information.</div>`;
        });
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
        
        const upcomingGameweek = gameweeks.find(gw => gw.id >= selectedGameweek);
        const gwNum = upcomingGameweek ? upcomingGameweek.id : selectedGameweek;
        
        const fplTitle = document.getElementById('modal-fpl-title');
        const ourTitle = document.getElementById('modal-our-title');
        if (fplTitle) fplTitle.textContent = `FPL Model (GW${gwNum})`;
        if (ourTitle) ourTitle.textContent = `Our Algorithm (GW${gwNum})`;
        
        let predictedPoints = player.predicted_points;
        if (predictedPoints === undefined) {
            const upcomingGameweek = gameweeks.find(gw => gw.id >= selectedGameweek);
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
function updateTeamInfo(label, newValue) {
    // Find all team info items
    const teamInfoItems = document.querySelectorAll('.team-info-item');
    
    // Iterate through the items to find the correct label
    teamInfoItems.forEach(item => {
        const itemLabel = item.querySelector('.label').textContent.trim();
        if (itemLabel === label) {
            item.querySelector('.value').textContent = newValue;
        }
    });
}

// Usage examples
// updateTeamInfo("Overall Rating", overallRating + "%");
// updateTeamInfo("Predicted Points", predictedPoints);
// updateTeamInfo("GW Rating", "83%");
// updateTeamInfo("Bank Balance", bankBalance + "m");

function loadPlayers(gameweek = selectedGameweek) {
    filledSlots["gk"] = 0;
    filledSlots["def"] = 0;
    filledSlots["mid"] = 0;
    filledSlots["fwd"] = 0;

    // Function to parse cookies
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Attempt to load the cookie for the specified gameweek
    let myPlayersCookie = getCookie(`myPlayersGW${gameweek}`);

    // If no data exists for the specified gameweek, load the last saved gameweek
    if (!myPlayersCookie) {
        // Loop backwards through gameweeks to find the most recent saved team
        for (let gw = gameweek - 1; gw >= gameweeks[0].id; gw--) {
            myPlayersCookie = getCookie(`myPlayersGW${gw}`);
            if (myPlayersCookie) {
                let gwTeam = JSON.parse(myPlayersCookie);
                if (gwTeam.players.length >= 15) {
                    break;
                }
            }
        }
    }
    else {
        let gwTeam = JSON.parse(myPlayersCookie);
        if (gwTeam.players.length < 15) {
            // Loop backwards through gameweeks to find the most recent saved team
            for (let gw = gameweek - 1; gw >= gameweeks[0].id; gw--) {
                myPlayersCookie = getCookie(`myPlayersGW${gw}`);
                if (myPlayersCookie) {
                    let gwTeam = JSON.parse(myPlayersCookie);
                    if (gwTeam.players.length >= 15) {
                        break;
                    }
                }
            }
        }
    }

    // If still no data found, default to the upcoming gameweek
    if (!myPlayersCookie) {
        const upcomingGameweek = getUpcomingGameweek();
        if (upcomingGameweek) {
            myPlayersCookie = getCookie(`myPlayersGW${upcomingGameweek.id}`);
        }
    }

    if (myPlayersCookie) {
        // Parse the JSON string
        const { players } = JSON.parse(myPlayersCookie);

        // Reconstruct myPlayers using player IDs from allPlayers
        myPlayers = players.map(({ id, slotId, isSub, isCaptain, isVice }) => {
            const player = allPlayers.find(player => player.id === id);
            if (player) {
                player.slotId = slotId;
                player.isSub = isSub; // Set the isSub property
                player.isCaptain = isCaptain;
                player.isVice = isVice;

                // Calculate filled slots
                const positionPrefix = pitchPositionMap[player.element_type];
                if (positionPrefix) {
                    filledSlots[positionPrefix]++;
                }
            }
            return player;
        }).filter(player => player !== undefined); // Filter out any undefined players
        
        

        // Update the UI to reflect the loaded team
        updateTeamUI();
    } else {
        // No data found for any gameweek, handle this case if needed
        console.log('No saved team data available.');
    }
}

function savePlayers() {
    // Disable the Save button
    document.getElementById('saveButton').disabled = true;

    // Extract player IDs, slotIds, and isSub from the myPlayers array
    const playerData = myPlayers.map(player => ({
        id: player.id,
        slotId: player.slotId,
        isSub: player.isSub, // Include the isSub property
        isCaptain : player.isCaptain,
        isVice: player.isVice
    }));

    // Convert the playerData array to a JSON string
    const dataJSON = JSON.stringify({ selectedGameweek, players: playerData });

    // Save the JSON string in a cookie
    document.cookie = `myPlayersGW${selectedGameweek}=${dataJSON}; path=/; max-age=31536000`; // Cookie expires in 1 year
}

function loadManagerId() {
    const cookies = document.cookie.split('; ');
    
    for (let cookie of cookies) {
        if (cookie.startsWith('managerId=')) {
            managerId = cookie.split('=')[1];
            return;
        }
    }

    console.log('No manager ID found in cookie.');
}

function resetPlayers() {
    // Reset your myPlayers array (example: clear all players)
    myPlayers = [];

    // Reset filledSlots count for each position
    for (let position in filledSlots) {
        filledSlots[position] = 0;
    }

    // Enable the Save and Auto Pick buttons again
    document.getElementById('saveButton').disabled = false;
    document.getElementById('autoPickButton').disabled = false;

    updateTeamUI();

    // Update Grid if needed
    if (typeof grid !== 'undefined') {
        grid.refreshCells();
    }
}

// Function to auto-pick players
function autoPickPlayers() {
    document.getElementById('autoPickButton').disabled = true;

    if (allPlayers) {
        // Select the best team from allPlayers while keeping existing picks
        myPlayers = selectBestTeam(allPlayers, myPlayers || []);

        // Reset filledSlots before re-assigning
        for (let position in filledSlots) {
            filledSlots[position] = 0;
        }

        // First pass: mark already slotted players
        myPlayers.forEach(player => {
            if (player.slotId) {
                const positionPrefix = pitchPositionMap[player.element_type];
                filledSlots[positionPrefix]++;
            }
        });

        // Second pass: assign slots to new players
        myPlayers.forEach(player => {
            if (!player.slotId) {
                const positionPrefix = pitchPositionMap[player.element_type];
                // Find next available slot
                for (let i = 0; i < availableSlots[positionPrefix].length; i++) {
                    const candidateSlot = availableSlots[positionPrefix][i];
                    if (!myPlayers.find(p => p.slotId === candidateSlot)) {
                        player.slotId = candidateSlot;
                        player.isSub = ['pos2', 'pos7', 'pos12', 'pos15'].includes(candidateSlot);
                        filledSlots[positionPrefix]++;
                        break;
                    }
                }
            }
        });
        if (grid) { grid.updateGridOptions({ rowData: filteredPlayers }); }

        updateTeamUI();
    }
}

let grid = null;
// Function to display filteredPlayers (you can customize this)
function displayPlayers(filteredPlayers) {
    if (typeof getPredictedPointsForGW === 'function' && typeof selectedGameweek !== 'undefined') {
        filteredPlayers.forEach(p => {
            p.custom_exp_pts = getPredictedPointsForGW(p, selectedGameweek);
            p.custom_exp_pts_next = getPredictedPointsForGW(p, selectedGameweek + 1);
        });
    }
    filteredPlayers.sort((a, b) => b.total_points - a.total_points);

    if (grid) {
        grid.updateGridOptions({
            rowData: filteredPlayers
        });
        return;
    }
    
    setupGridOptions(filteredPlayers);

    // Your Javascript code to create the Data Grid
    const myGridElement = document.querySelector('#myGrid');
    if (myGridElement) {
        grid = agGrid.createGrid(myGridElement, gridOptions);
    }
}

async function Initialize() {
    if (!gameweeks || gameweeks.length === 0) {
        document.body.innerHTML = `
            <div class="container mt-5 text-center text-white p-5 border border-danger rounded bg-dark">
                <h3 class="text-danger">Failed to load FPL Data</h3>
                <p>Your network might be blocking the API requests.</p>
                <p>Try switching from mobile data to Wi-Fi, or use a VPN.</p>
                <button class="btn btn-primary mt-3" onclick="window.location.reload()">Retry</button>
            </div>
        `;
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
        return;
    }

    populateTeamFilter();
    filteredPlayers = allPlayers;

    loadManagerId();
    await calculateSeasonPoints();
    
    selectedGameweek = getUpcomingGameweek().id;
    await updateGameweekInfo();

    // Load the players from the cookie when the page loads
    loadPlayers();
                
    // Initial display of all filteredPlayers
    displayPlayers(filteredPlayers); 
}


window.predictedPointsCache = {};
function getPredictedPointsForGW(player, gwId) {
    if (!window.predictedPointsCache[gwId]) window.predictedPointsCache[gwId] = {};
    if (window.predictedPointsCache[gwId][player.id] !== undefined) {
        return window.predictedPointsCache[gwId][player.id];
    }
    const gw = gameweeks.find(g => g.id === gwId);
    if (!gw) return 0;
    const fixture = getPlayerFixture(player, gwId);
    let pts = calculatePlayerPredictedPoints(player, fixture, gw);
    pts = pts === '?' ? 0 : parseFloat(pts);
    window.predictedPointsCache[gwId][player.id] = pts;
    return pts;
}