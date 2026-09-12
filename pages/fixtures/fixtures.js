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

function renderScoreBlock(fixture) {
    if (!fixture.started) {
        return `<div class="fw-bold fs-5 score-display">${new Date(fixture.kickoff_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>`;
    }

    const hScore = fixture.team_h_score !== null ? fixture.team_h_score : '0';
    const aScore = fixture.team_a_score !== null ? fixture.team_a_score : '0';

    let badgeHtml = '';
    if (!fixture.finished) {
        if (!fixture.finished_provisional) {
            badgeHtml = `<span class="badge bg-success fixture-status-badge d-flex align-items-center justify-content-center gap-1 mx-auto mt-1" style="font-size:0.7rem; width:fit-content;">
                <span class="live-dot"></span> ${fixture.minutes}'
            </span>`;
        } else {
            badgeHtml = `<span class="badge bg-secondary fixture-status-badge mt-1" style="font-size:0.7rem;">FT</span>`;
        }
    } else {
        badgeHtml = `<span class="badge bg-secondary fixture-status-badge mt-1" style="font-size:0.7rem;">FT</span>`;
    }

    return `
        <div class="fw-bold fs-5 score-display d-flex align-items-center justify-content-center">
            <span class="score-num">${hScore}</span>
            <span class="score-dash">-</span>
            <span class="score-num">${aScore}</span>
        </div>
        ${badgeHtml}
    `;
}

// Global live refresh interval
let liveRefreshInterval;
function startLiveRefresh() {
    if (liveRefreshInterval) clearInterval(liveRefreshInterval);
    const hasLiveGames = fixtures.some(f => f.started && !f.finished && !f.finished_provisional);
    if (!hasLiveGames) return;
    
    liveRefreshInterval = setInterval(async () => {
        try {
            const data = await getFixtures(true);
            fixtures = data; // Update global
            
            // Only update DOM for live games
            fixtures.forEach(fixture => {
                if (fixture.started && !fixture.finished) {
                    const scoreDiv = document.querySelector(`#score-${fixture.code}`);
                    if (scoreDiv) {
                        scoreDiv.innerHTML = renderScoreBlock(fixture);
                    }
                    const statsTbody = document.querySelector(`#stats-tbody-${fixture.code}`);
                    if (statsTbody) {
                        statsTbody.innerHTML = `
                            ${renderStatRow(fixture, 'goals_scored', 'Goals Scored', 'fa-futbol', '#4ade80')}
                            ${renderStatRow(fixture, 'assists', 'Assists', 'fa-hands-helping', '#38bdf8')}
                            ${renderStatRow(fixture, 'yellow_cards', 'Yellow Cards', 'fa-square', '#facc15')}
                            ${renderStatRow(fixture, 'red_cards', 'Red Cards', 'fa-square', '#ef4444')}
                            ${renderStatRow(fixture, 'penalties_saved', 'Penalties Saved', 'fa-hands', '#3b82f6')}
                            ${renderStatRow(fixture, 'penalties_missed', 'Penalties Missed', 'fa-xmark', '#f87171')}
                            ${renderStatRow(fixture, 'saves', 'Saves', 'fa-hand', '#a78bfa')}
                            ${renderStatRow(fixture, 'bonus', 'Bonus', 'fa-star', '#fb923c')}
                            ${renderDefconRow(fixture, 'DEFCON', 'fa-user-shield', '#ec4899')}
                            ${renderStatRow(fixture, 'bps', 'BPS (Ranking)', '', '')}
                            ${renderStatRow(fixture, 'defensive_contribution', 'Defensive Contributions', '', '')}
                        `;
                    }
                    
                    const eventsTabPane = document.getElementById(`events-${fixture.code}`);
                    if (eventsTabPane && eventsTabPane.classList.contains('active')) {
                        loadLiveEvents(fixture.id);
                    }
                    
                    const teamStatsTabPane = document.getElementById(`teamstats-${fixture.code}`);
                    if (teamStatsTabPane && teamStatsTabPane.classList.contains('active')) {
                        loadTeamStats(fixture.id);
                    }
                }
            });
            
            // Also refresh the league table live
            await renderStandings(true);
        } catch (e) {
            console.error("Live refresh failed", e);
        }
    }, 120000); // 2 minutes
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
                        <div class="fixture-header d-flex justify-content-between w-100">
                            <div class="fixture-team fixture-team-home d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" class="team-logo me-2" alt="${homeTeam.short_name}">
                                <span>${homeTeam.short_name}</span>
                            </div>
                            <div class="text-center fixture-score" id="score-${fixture.code}">
                                ${renderScoreBlock(fixture)}
                            </div>
                            <div class="fixture-team fixture-team-away d-flex align-items-center">
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
                                <button class="nav-link" id="teamstats-tab-${fixture.code}" data-bs-toggle="tab" data-bs-target="#teamstats-${fixture.code}" type="button" role="tab" aria-controls="teamstats-${fixture.code}" aria-selected="false" onclick="loadTeamStats(${fixture.id})">Team Stats</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="lineups-tab-${fixture.code}" data-bs-toggle="tab" data-bs-target="#lineups-${fixture.code}" type="button" role="tab" aria-controls="lineups-${fixture.code}" aria-selected="false" onclick="loadLineups(${fixture.id})">Lineups</button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" id="events-tab-${fixture.code}" data-bs-toggle="tab" data-bs-target="#events-${fixture.code}" type="button" role="tab" aria-controls="events-${fixture.code}" aria-selected="false" onclick="loadLiveEvents(${fixture.id})">Live Events</button>
                            </li>
                        </ul>
                        <div class="tab-content mt-3" id="myTabContent${fixture.code}">
                            <div class="tab-pane fade show active" id="stats-${fixture.code}" role="tabpanel" aria-labelledby="stats-tab-${fixture.code}">
                                <div class="p-2">
                                    <div class="d-flex align-items-center justify-content-between mb-3 px-1" style="border-bottom:1px solid #2b2b2b; padding-bottom:8px;">
                                        <span style="color:#0dcaf0; font-size:0.8rem; font-weight:600;">
                                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0dcaf0;margin-right:5px;"></span>
                                            ${homeTeam.short_name} <span style="color:#555; font-size:0.65rem; font-weight:400;">(Home)</span>
                                        </span>
                                        <span style="color:#555; font-size:0.7rem; letter-spacing:1px;">PLAYER STATS</span>
                                        <span style="color:#fb923c; font-size:0.8rem; font-weight:600;">
                                            <span style="color:#555; font-size:0.65rem; font-weight:400;">(Away)</span> ${awayTeam.short_name}
                                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fb923c;margin-left:5px;"></span>
                                        </span>
                                    </div>
                                     <div id="stats-tbody-${fixture.code}">
                                        ${renderStatRow(fixture, 'goals_scored', 'Goals Scored', 'fa-futbol', '#4ade80')}
                                        ${renderStatRow(fixture, 'assists', 'Assists', 'fa-hands-helping', '#38bdf8')}
                                        ${renderStatRow(fixture, 'yellow_cards', 'Yellow Cards', 'fa-square', '#facc15')}
                                        ${renderStatRow(fixture, 'red_cards', 'Red Cards', 'fa-square', '#ef4444')}
                                        ${renderStatRow(fixture, 'penalties_saved', 'Penalties Saved', 'fa-hands', '#3b82f6')}
                                        ${renderStatRow(fixture, 'penalties_missed', 'Penalties Missed', 'fa-xmark', '#f87171')}
                                        ${renderStatRow(fixture, 'saves', 'Saves', 'fa-hand', '#a78bfa')}
                                        ${renderStatRow(fixture, 'bonus', 'Bonus', 'fa-star', '#fb923c')}
                                        ${renderDefconRow(fixture, 'DEFCON', 'fa-user-shield', '#ec4899')}
                                        ${renderStatRow(fixture, 'bps', 'BPS (Ranking)', '', '')}
                                        ${renderStatRow(fixture, 'defensive_contribution', 'Defensive Contributions', '', '')}
                                    </div>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="teamstats-${fixture.code}" role="tabpanel" aria-labelledby="teamstats-tab-${fixture.code}">
                                <div id="teamstats-container-${fixture.id}" class="p-3">
                                    <div class="text-center p-4">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading team stats...</span>
                                        </div>
                                        <p class="mt-2 text-muted">Fetching match stats...</p>
                                    </div>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="lineups-${fixture.code}" role="tabpanel" aria-labelledby="lineups-tab-${fixture.code}">
                                <div id="lineups-container-${fixture.id}" class="text-center p-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading lineups...</span>
                                    </div>
                                    <p class="mt-2 text-muted">Fetching live lineups...</p>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="events-${fixture.code}" role="tabpanel" aria-labelledby="events-tab-${fixture.code}">
                                <div id="events-container-${fixture.id}" class="text-start p-2" style="max-height: 400px; overflow-y: auto;">
                                    <div class="text-center p-4">
                                        <div class="spinner-border text-primary" role="status">
                                            <span class="visually-hidden">Loading events...</span>
                                        </div>
                                        <p class="mt-2 text-muted">Fetching live events...</p>
                                    </div>
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

function renderStatRow(fixture, identifier, label, icon = 'fa-chart-bar', iconColor = '#888') {
    const h = getStatPlayers(fixture, identifier, 'h');
    const a = getStatPlayers(fixture, identifier, 'a');
    const hasData = h.length > 0 || a.length > 0;
    if (!hasData) return '';

    const HOME_COLOR = '#0dcaf0';
    const AWAY_COLOR = '#fb923c';

    const renderPlayers = (players, color, align) => {
        if (players.length === 0) return '';
        return players.map(p => {
            const badgeStyle = `display:inline-block; background:${color}18; color:${color}; font-size:0.72rem; font-weight:700; padding:1px 7px; border-radius:10px; border:1px solid ${color}40; flex-shrink:0;`;
            const link = p.id
                ? `<a href="javascript:void(0)" onclick="showPlayerInfo(${p.id})" class="player-stat-link">${p.name}</a>`
                : `<span style="color:#888; font-size:0.8rem;">${p.name}</span>`;
            const badge = `<span style="${badgeStyle}">${p.value}</span>`;
            // Home: name → badge (left to right). Away: badge → name (badge first, hugs divider)
            const row = align === 'right'
                ? `${link}<span style="margin-left:5px;">${badge}</span>`
                : `${badge}<span style="margin-left:5px;">${link}</span>`;
            return `<div style="display:flex; align-items:center; justify-content:${align === 'right' ? 'flex-end' : 'flex-start'}; margin-bottom:3px;">${row}</div>`;
        }).join('');
    };

    return `
        <div style="border-bottom:1px solid #1e1e1e; padding:8px 4px;">
            <div style="display:flex; align-items:center; ${icon ? 'gap:6px;' : ''} margin-bottom:7px;">
                ${icon ? `<i class="fas ${icon} fa-sm" style="color:${iconColor}; width:14px; text-align:center; flex-shrink:0;"></i>` : ''}
                <span style="color:#555; font-size:0.73rem; text-transform:uppercase; letter-spacing:1.2px; font-weight:600;">${label}</span>
            </div>
            <div class="row g-0">
                <div class="col-6" style="padding-right:10px; text-align:right; border-right:1px solid #252525;">
                    ${renderPlayers(h, HOME_COLOR, 'right')}
                </div>
                <div class="col-6" style="padding-left:10px;">
                    ${renderPlayers(a, AWAY_COLOR, 'left')}
                </div>
            </div>
        </div>
    `;
}

function renderDefconRow(fixture, label = 'DEFCON Points', icon = 'fa-user-shield', iconColor = '#ec4899') {
    const identifier = 'defensive_contribution';
    const stats = fixture.stats.find(stat => stat.identifier === identifier);
    if (!stats) return '';

    const processTeam = (teamData) => {
        if (!teamData) return [];
        return teamData.map(stat => {
            const player = allPlayers.find(p => p.id === stat.element);
            if (!player) return null;
            // 1: GK, 2: DEF, 3: MID, 4: FWD
            let defconPoints = 0;
            if (player.element_type === 2 && stat.value >= 10) {
                defconPoints = 2;
            } else if ((player.element_type === 3 || player.element_type === 4) && stat.value >= 12) {
                defconPoints = 2;
            }
            if (defconPoints > 0) {
                return {
                    id: player.id,
                    name: player.web_name,
                    value: `${stat.value} (+${defconPoints})`
                };
            }
            return null;
        }).filter(p => p !== null);
    };

    const h = processTeam(stats.h);
    const a = processTeam(stats.a);
    const hasData = h.length > 0 || a.length > 0;
    if (!hasData) return '';

    const HOME_COLOR = '#0dcaf0';
    const AWAY_COLOR = '#fb923c';

    const renderPlayers = (players, color, align) => {
        if (players.length === 0) return '';
        return players.map(p => {
            const badgeStyle = `display:inline-block; background:${color}18; color:${color}; font-size:0.72rem; font-weight:700; padding:1px 7px; border-radius:10px; border:1px solid ${color}40; flex-shrink:0;`;
            const link = `<a href="javascript:void(0)" onclick="showPlayerInfo(${p.id})" class="player-stat-link">${p.name}</a>`;
            const badge = `<span style="${badgeStyle}">${p.value}</span>`;
            const row = align === 'right'
                ? `${link}<span style="margin-left:5px;">${badge}</span>`
                : `${badge}<span style="margin-left:5px;">${link}</span>`;
            return `<div style="display:flex; align-items:center; justify-content:${align === 'right' ? 'flex-end' : 'flex-start'}; margin-bottom:3px;">${row}</div>`;
        }).join('');
    };

    return `
        <div style="border-bottom:1px solid #1e1e1e; padding:8px 4px;">
            <div style="display:flex; align-items:center; ${icon ? 'gap:6px;' : ''} margin-bottom:7px;">
                ${icon ? `<i class="fas ${icon} fa-sm" style="color:${iconColor}; width:14px; text-align:center; flex-shrink:0;"></i>` : ''}
                <span style="color:#555; font-size:0.73rem; text-transform:uppercase; letter-spacing:1.2px; font-weight:600;">${label}</span>
            </div>
            <div class="row g-0">
                <div class="col-6" style="padding-right:10px; text-align:right; border-right:1px solid #252525;">
                    ${renderPlayers(h, HOME_COLOR, 'right')}
                </div>
                <div class="col-6" style="padding-left:10px;">
                    ${renderPlayers(a, AWAY_COLOR, 'left')}
                </div>
            </div>
        </div>
    `;
}

function getStatPlayers(fixture, identifier, teamName) {
    const stats = fixture.stats.find(stat => stat.identifier === identifier);
    if (!stats || !stats[teamName]) return [];
    return stats[teamName].map(stat => {
        const player = allPlayers.find(p => p.id === stat.element);
        let displayValue = stat.value;
        
        if (player) {
            let pts = null;
            if (identifier === 'goals_scored') {
                if (player.element_type === 1 || player.element_type === 2) pts = 6 * stat.value;
                else if (player.element_type === 3) pts = 5 * stat.value;
                else pts = 4 * stat.value;
            } else if (identifier === 'assists') {
                pts = 3 * stat.value;
            } else if (identifier === 'yellow_cards') {
                pts = -1 * stat.value;
            } else if (identifier === 'red_cards') {
                pts = -3 * stat.value;
            } else if (identifier === 'penalties_saved') {
                pts = 5 * stat.value;
            } else if (identifier === 'penalties_missed') {
                pts = -2 * stat.value;
            } else if (identifier === 'bonus') {
                pts = stat.value;
                const bpsStat = fixture.stats.find(s => s.identifier === 'bps');
                let bpsValue = 0;
                if (bpsStat) {
                    const bpsPlayer = (bpsStat.a || []).concat(bpsStat.h || []).find(s => s.element === stat.element);
                    if (bpsPlayer) bpsValue = bpsPlayer.value;
                }
                displayValue = `${bpsValue} (+${pts})`;
                pts = null; // Prevent default formatting
            } else if (identifier === 'saves') {
                pts = Math.floor(stat.value / 3);
            }

            if (pts !== null) {
                const sign = pts >= 0 ? '+' : '';
                displayValue = `${stat.value} (${sign}${pts})`;
            }
        }

        return {
            id: player ? player.id : null,
            name: player ? player.web_name : 'Unknown',
            value: displayValue
        };
    });
}

function getStatDetails(fixture, identifier, teamName) {
    const players = getStatPlayers(fixture, identifier, teamName);
    if (players.length === 0) return 'None';
    return players.map(p => {
        if (p.id) return `<a href="javascript:void(0)" onclick="showPlayerInfo(${p.id})">${p.name}</a> (${p.value})`;
        return `${p.name} (${p.value})`;
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
        
        const upcomingGameweek = gameweeks.find(gw => gw.id >= (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id));
        const gwNum = upcomingGameweek ? upcomingGameweek.id : (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id);
        
        const fplTitle = document.getElementById('modal-fpl-title');
        const ourTitle = document.getElementById('modal-our-title');
        if (fplTitle) fplTitle.textContent = `FPL Model (GW${gwNum})`;
        if (ourTitle) ourTitle.textContent = `Our Algorithm (GW${gwNum})`;
        
        let predictedPoints = player.predicted_points;
        if (predictedPoints === undefined) {
            const upcomingGameweek = gameweeks.find(gw => gw.id >= (typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id));
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
        const algoTitle = document.getElementById('modal-algo-breakdown-title');
        if (breakdownCard && breakdownBody) {
            breakdownCard.style.display = 'block';
            if (algoTitle) algoTitle.textContent = 'Algorithm Breakdown (GW' + gwNum + ')';
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

        const pointsBreakdownCard = document.getElementById('modal-points-breakdown-card');
        const pointsBreakdownBody = document.getElementById('modal-points-breakdown');
        const pointsBreakdownTitle = document.getElementById('modal-points-breakdown-title');
        if (pointsBreakdownCard && pointsBreakdownBody) {
            const gwHistory = data.history.find(h => h.round === gwNum);
            if (gwHistory) {
                pointsBreakdownCard.style.display = 'block';
                if (pointsBreakdownTitle) pointsBreakdownTitle.textContent = 'Points Breakdown (GW' + gwNum + ')';
                pointsBreakdownBody.innerHTML = generatePointsBreakdown(gwHistory, player.element_type);
            } else {
                pointsBreakdownCard.style.display = 'none';
            }
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

    let upcomingId = typeof upcomingGameweek === 'object' ? upcomingGameweek.id : upcomingGameweek;
    if (getUpcomingGameweek() && getUpcomingGameweek().id == upcomingId) {
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

    container.innerHTML = `
        <div class="row text-start">
            <div class="col-12 col-md-6 border-md-end mb-4 mb-md-0">
                <h5 class="text-center mb-0">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" style="width:30px;">
                    ${homeTeam.short_name}
                </h5>
                ${lineupData.home_team.formation ? `<div class="text-center text-muted small mb-3">${lineupData.home_team.formation}</div>` : '<div class="mb-3"></div>'}
                <h6 class="text-muted border-bottom pb-1">Starting XI</h6>
                <div id="home-starting-${fplFixtureId}" class="mb-3"></div>
                <h6 class="text-muted border-bottom pb-1">Bench</h6>
                <div id="home-bench-${fplFixtureId}"></div>
            </div>
            <div class="col-12 col-md-6">
                <h5 class="text-center mb-0">
                    <img src="https://resources.premierleague.com/premierleague/badges/100/t${awayTeam.code}.png" style="width:30px;">
                    ${awayTeam.short_name}
                </h5>
                ${lineupData.away_team.formation ? `<div class="text-center text-muted small mb-3">${lineupData.away_team.formation}</div>` : '<div class="mb-3"></div>'}
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

    const enrichPlayer = (p) => {
        const fplPlayer = matchPlayer(p, teamPlayers);
        const shirtNum = parseInt(p.matchShirtNumber || p.shirtNum) || 999;
        const posType = fplPlayer ? fplPlayer.element_type : 5; // 1:GK, 2:DEF, 3:MID, 4:FWD, 5:Unknown
        return { plPlayer: p, fplPlayer, shirtNum, posType };
    };

    const sortFn = (a, b) => {
        if (a.posType !== b.posType) return a.posType - b.posType;
        return a.shirtNum - b.shirtNum;
    };

    const starting = (plPlayers || []).map(enrichPlayer).sort(sortFn);
    const bench = (plSubstitutes || []).map(enrichPlayer).sort(sortFn);

    const buildPlayerHtml = ({ plPlayer, fplPlayer }, isBench) => {
        const displayName = plPlayer.name ? plPlayer.name.display : (plPlayer.knownName || plPlayer.lastName || '?');
        const shirtNum = plPlayer.matchShirtNumber || plPlayer.shirtNum || '-';
        const isCaptain = plPlayer.captain || plPlayer.isCaptain || false;

        let playerDisplay = displayName;
        let points = '-';
        let posPill = '';
        let statusIcon = '';

        if (fplPlayer) {
            playerDisplay = `<a href="javascript:void(0)" onclick="showPlayerInfo(${fplPlayer.id})">${fplPlayer.web_name}</a>`;
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
                <div class="d-flex align-items-center flex-grow-1 pe-1" style="min-width: 0;">
                    <span class="badge bg-secondary me-1 flex-shrink-0" style="width: 25px;">${shirtNum}</span>
                    <span class="flex-shrink-0">${posPill}</span>
                    <div class="text-truncate">
                        ${playerDisplay}
                    </div>
                    <span class="flex-shrink-0">
                        ${isCaptain ? '<span class="badge bg-warning text-dark ms-1">C</span>' : ''}
                        ${statusIcon}
                    </span>
                </div>
                <span class="fw-bold flex-shrink-0 ${points > 0 ? 'text-success' : ''}">${points}</span>
            </div>
        `;
    };

    startingContainer.innerHTML = starting.map(p => buildPlayerHtml(p, false)).join('');
    benchContainer.innerHTML = bench.map(p => buildPlayerHtml(p, true)).join('');
}

window.liveEventsState = window.liveEventsState || {};

async function loadLiveEvents(fplFixtureId, loadMore = false) {
    const container = document.getElementById(`events-container-${fplFixtureId}`);
    if (!container) return;

    if (!window.liveEventsState[fplFixtureId]) {
        window.liveEventsState[fplFixtureId] = { page: 0, events: [], hasMore: true, isFetching: false };
    }
    const state = window.liveEventsState[fplFixtureId];

    if (state.isFetching) return;
    state.isFetching = true;

    // Show loading spinner if it's the very first load
    if (state.events.length === 0 && !loadMore) {
        container.innerHTML = `
            <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading events...</span></div>
                <p class="mt-2 text-muted">Fetching live events...</p>
            </div>
        `;
    } else if (loadMore) {
        const loadMoreBtn = document.getElementById(`load-more-events-${fplFixtureId}`);
        if (loadMoreBtn) loadMoreBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    }

    if (!window.pulseLiveFixturesData) {
        window.pulseLiveFixturesData = await getPulseLiveFixtures();
    }
    
    const fplFixture = fixtures.find(f => f.id === fplFixtureId);
    if (!fplFixture) {
        state.isFetching = false;
        return;
    }

    const homeTeam = teams.find(t => t.id === fplFixture.team_h);
    const fplKickoff = new Date(fplFixture.kickoff_time).getTime();

    const plMatch = window.pulseLiveFixturesData.find(pl => {
        const plHomeTeam = pl.teams[0].team.club ? pl.teams[0].team.club.abbr : pl.teams[0].team.abbr;
        return plHomeTeam === homeTeam.short_name && Math.abs(pl.kickoff.millis - fplKickoff) < 86400000;
    });

    if (!plMatch) {
        container.innerHTML = '<div class="alert alert-warning">Events not available for this match.</div>';
        state.isFetching = false;
        return;
    }

    const pageToFetch = loadMore ? state.page + 1 : 0;
    const eventsData = await getPulseLiveEvents(plMatch.id, pageToFetch, 20);
    const fetchedEvents = eventsData.content || [];
    
    if (fetchedEvents.length === 0 && state.events.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No live events reported yet.</div>';
        state.isFetching = false;
        return;
    }

    if (!loadMore) {
        // Prepend only new events to preserve any older events the user loaded
        const newEvents = fetchedEvents.filter(fe => !state.events.some(se => se.id === fe.id));
        state.events = [...newEvents, ...state.events];
    } else {
        // Append older events
        const olderEvents = fetchedEvents.filter(fe => !state.events.some(se => se.id === fe.id));
        state.events = [...state.events, ...olderEvents];
        state.page = pageToFetch;
    }

    if (eventsData.pageInfo && state.page >= eventsData.pageInfo.numPages - 1) {
        state.hasMore = false;
    }

    // Map events to HTML
    let eventsHtml = '<ul class="list-group list-group-flush">';
    state.events.forEach(ev => {
        let displayLabel = ev.time ? ev.time.label + "'" : '';
        if (ev.type && ev.type.toLowerCase() === 'end 14') {
            displayLabel = 'FT'; // PulseLive weirdly sends '01' for Match Ends
        } else if (ev.type && ev.type.toLowerCase() === 'half time') {
            displayLabel = 'HT';
        }
        
        const timeLabel = displayLabel ? `<span class="badge bg-secondary me-3" style="width: 45px;">${displayLabel}</span>` : '';
        let iconHtml = '<i class="fas fa-info-circle text-muted me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        
        const typeMatch = (ev.type || '').toLowerCase();
        if (typeMatch.includes('goal')) iconHtml = '<i class="fas fa-futbol text-success me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('yellow card')) iconHtml = '<span class="me-3" style="display:inline-block; width:14px; height:18px; background-color:gold; border-radius:2px; margin-left:3px; margin-right:3px;"></span>';
        else if (typeMatch.includes('red card')) iconHtml = '<span class="me-3" style="display:inline-block; width:14px; height:18px; background-color:red; border-radius:2px; margin-left:3px; margin-right:3px;"></span>';
        else if (typeMatch.includes('substitution')) iconHtml = '<i class="fas fa-exchange-alt text-info me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('foul')) iconHtml = '<i class="fas fa-exclamation-circle text-warning me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('corner')) iconHtml = '<i class="fas fa-flag text-light me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('free kick')) iconHtml = '<i class="fas fa-shoe-prints text-info me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('save') || typeMatch.includes('attempt')) iconHtml = '<i class="fas fa-hand-paper text-primary me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('miss')) iconHtml = '<i class="fas fa-times text-danger me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('offside')) iconHtml = '<i class="fas fa-flag-checkered text-warning me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('post') || typeMatch.includes('woodwork')) iconHtml = '<i class="fas fa-arrows-alt-v text-light me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        else if (typeMatch.includes('start') || typeMatch.includes('end') || typeMatch.includes('half') || typeMatch.includes('time')) iconHtml = '<i class="fas fa-stopwatch text-secondary me-3 fs-5" style="width: 20px; text-align: center;"></i>';
        
        let textContent = ev.text || '';
        
        // Highlight player names using Regex: Name (Team)
        textContent = textContent.replace(/([A-ZÀ-ÿ][a-zA-ZÀ-ÿ\s'-]+)\s\((.*?)\)/g, (match, p1, p2) => {
            let prefix = '';
            if (p1.startsWith('Foul by ')) {
                prefix = 'Foul by ';
                p1 = p1.substring(8);
            }
            return `${prefix}<strong class="text-white">${p1}</strong> <span class="text-muted" style="font-size:0.75rem;">(${p2})</span>`;
        });
        
        eventsHtml += `
            <li class="list-group-item bg-transparent text-light border-secondary d-flex align-items-center py-3 px-1">
                <div class="d-flex align-items-center flex-shrink-0">${timeLabel}${iconHtml}</div>
                <div class="flex-grow-1">
                    <div class="small fw-bold text-uppercase text-muted mb-1" style="font-size: 0.65rem; letter-spacing: 0.5px;">${ev.type || 'Event'}</div>
                    <div style="font-size: 0.9rem; line-height: 1.3;">${textContent}</div>
                </div>
            </li>
        `;
    });
    eventsHtml += '</ul>';
    
    if (state.hasMore) {
        eventsHtml += `
            <div class="text-center mt-3 mb-2">
                <button id="load-more-events-${fplFixtureId}" class="btn btn-outline-secondary btn-sm" onclick="loadLiveEvents(${fplFixtureId}, true)">Load Older Events</button>
            </div>
        `;
    }
    
    // Save current scroll position
    const previousScroll = container.scrollTop;
    const previousHeight = container.scrollHeight;
    
    container.innerHTML = eventsHtml;
    
    // Restore scroll position if loading more
    if (loadMore) {
        container.scrollTop = previousScroll + (container.scrollHeight - previousHeight);
    }
    
    state.isFetching = false;
}

async function loadTeamStats(fplFixtureId) {
    const container = document.getElementById(`teamstats-container-${fplFixtureId}`);
    if (!container) return;

    if (!window.pulseLiveFixturesData) {
        window.pulseLiveFixturesData = await getPulseLiveFixtures();
    }
    
    const fplFixture = fixtures.find(f => f.id === fplFixtureId);
    if (!fplFixture) return;

    const homeTeam = teams.find(t => t.id === fplFixture.team_h);
    const awayTeam = teams.find(t => t.id === fplFixture.team_a);
    const fplKickoff = new Date(fplFixture.kickoff_time).getTime();

    const plMatch = window.pulseLiveFixturesData.find(pl => {
        const plHomeTeam = pl.teams[0].team.club ? pl.teams[0].team.club.abbr : pl.teams[0].team.abbr;
        return plHomeTeam === homeTeam.short_name && Math.abs(pl.kickoff.millis - fplKickoff) < 86400000;
    });

    if (!plMatch) {
        container.innerHTML = '<div class="alert alert-warning">Stats not available for this match.</div>';
        return;
    }

    const matchStatsData = await getPulseLiveMatchStats(plMatch.id);
    if (!matchStatsData || !matchStatsData.data || !matchStatsData.entity) {
        container.innerHTML = '<div class="alert alert-info">Match stats are not available yet.</div>';
        return;
    }

    const plHomeTeamId = matchStatsData.entity.teams[0].team.id;
    const plAwayTeamId = matchStatsData.entity.teams[1].team.id;

    const homeTeamData = matchStatsData.data[plHomeTeamId]?.M;
    const awayTeamData = matchStatsData.data[plAwayTeamId]?.M;

    if (!homeTeamData || !awayTeamData) {
        container.innerHTML = '<div class="alert alert-info">Match stats are not available yet.</div>';
        return;
    }

    const getStat = (teamStatsArray, name) => {
        const stat = teamStatsArray.find(s => s.name === name);
        return stat ? stat.value : 0;
    };

    const statsConfig = [
        { key: 'possession_percentage', label: 'Possession',  icon: 'fa-circle-dot',    formatter: v => v.toFixed(1) + '%', group: 'Attacking' },
        { key: 'total_scoring_att',     label: 'Total Shots', icon: 'fa-futbol',         group: 'Attacking' },
        { key: 'ontarget_scoring_att',  label: 'On Target',   icon: 'fa-crosshairs',     group: 'Attacking' },
        { key: 'big_chance_created',    label: 'Big Chances', icon: 'fa-star',           group: 'Attacking' },
        { key: 'won_corners',           label: 'Corners',     icon: 'fa-flag',           group: 'Attacking' },
        { key: 'total_pass',            label: 'Passes',      icon: 'fa-arrows-turn-right', group: 'Passing' },
        { key: 'accurate_pass',         label: 'Accurate',    icon: 'fa-check',          group: 'Passing' },
        { key: 'total_long_balls',      label: 'Long Balls',  icon: 'fa-arrow-up-long',  group: 'Passing' },
        { key: 'total_tackle',          label: 'Tackles',     icon: 'fa-shield-halved',  group: 'Defending' },
        { key: 'interception_won',      label: 'Interceptions',icon: 'fa-hand',          group: 'Defending' },
        { key: 'effective_clearance',   label: 'Clearances',  icon: 'fa-ban',            group: 'Defending' },
        { key: 'total_offside',         label: 'Offsides',    icon: 'fa-flag',           group: 'Discipline', lowerBetter: true },
        { key: 'fk_foul_lost',          label: 'Fouls',       icon: 'fa-person-falling', group: 'Discipline', lowerBetter: true },
        { key: 'total_yel_card',        label: 'Yellow Cards', icon: 'fa-square',        iconStyle: 'color:#ffd700',        group: 'Discipline', lowerBetter: true },
        { key: 'total_red_card',        label: 'Red Cards',   icon: 'fa-square',         iconStyle: 'color:#e90052',        group: 'Discipline', lowerBetter: true },
    ];

    const groups = ['Attacking', 'Passing', 'Defending', 'Discipline'];

    let html = '';
    // Legend header
    html += `
        <div class="d-flex align-items-center justify-content-between mb-3 px-1" style="border-bottom: 1px solid #2b2b2b; padding-bottom: 8px;">
            <span style="color:#00ff85; font-size:0.8rem; font-weight:600;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#00ff85;margin-right:5px;"></span>
                ${homeTeam.short_name || homeTeam.name}
            </span>
            <span style="color:#888; font-size:0.7rem; letter-spacing:1px;">MATCH STATS</span>
            <span style="color:#e90052; font-size:0.8rem; font-weight:600;">
                ${awayTeam.short_name || awayTeam.name}
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#e90052;margin-left:5px;"></span>
            </span>
        </div>
    `;

    groups.forEach(group => {
        const groupStats = statsConfig.filter(c => c.group === group);
        const validStats = groupStats.filter(cfg => {
            const hV = getStat(homeTeamData, cfg.key);
            const aV = getStat(awayTeamData, cfg.key);
            return !(hV === 0 && aV === 0);
        });
        if (validStats.length === 0) return;

        html += `<div class="mb-1" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:2px;color:#555;font-weight:600;margin-bottom:6px!important;">${group}</div>`;

        validStats.forEach(cfg => {
            const hVal = getStat(homeTeamData, cfg.key);
            const aVal = getStat(awayTeamData, cfg.key);

            const total = hVal + aVal;
            const hPct = total > 0 ? (hVal / total) * 100 : 50;
            const aPct = total > 0 ? (aVal / total) * 100 : 50;

            const hDisplay = cfg.formatter ? cfg.formatter(hVal) : hVal;
            const aDisplay = cfg.formatter ? cfg.formatter(aVal) : aVal;

            const isLowerBetter = cfg.lowerBetter || false;
            const hWinner = isLowerBetter ? (hVal < aVal) : (hVal > aVal);
            const aWinner = isLowerBetter ? (aVal < hVal) : (aVal > hVal);

            const hTextStyle = hWinner ? 'color:#00ff85;font-weight:700;' : (hVal === aVal ? 'color:#ffffff;font-weight:600;' : 'color:#666;');
            const aTextStyle = aWinner ? 'color:#e90052;font-weight:700;' : (hVal === aVal ? 'color:#ffffff;font-weight:600;' : 'color:#666;');

            const iconStyle = cfg.iconStyle ? ` style="${cfg.iconStyle}"` : ' class="text-muted"';
            const iconHtml = `<i class="fas ${cfg.icon} fa-xs"${iconStyle}></i>`;

            const hBarGlow = hWinner ? 'box-shadow:0 0 4px #00ff85;' : '';
            const aBarGlow = aWinner ? 'box-shadow:0 0 4px #e90052;' : '';

            html += `
                <div class="mb-3">
                    <div class="d-flex align-items-center mb-1 px-1" style="font-size:0.82rem;">
                        <span style="${hTextStyle} flex:1; text-align:left;">${hDisplay}</span>
                        <span style="flex:1; text-align:center; color:#777; font-size:0.72rem; letter-spacing:0.5px; display:flex; align-items:center; justify-content:center; gap:5px;">
                            ${iconHtml} ${cfg.label}
                        </span>
                        <span style="${aTextStyle} flex:1; text-align:right;">${aDisplay}</span>
                    </div>
                    <div class="progress" style="height:5px; background-color:#1e1e1e; border-radius:3px;">
                        <div class="progress-bar" role="progressbar" style="width:${hPct}%; background-color:#00ff85; ${hBarGlow} border-right:${hPct > 0 && aPct > 0 ? '1px solid #121212' : 'none'};" aria-valuenow="${hPct}" aria-valuemin="0" aria-valuemax="100"></div>
                        <div class="progress-bar" role="progressbar" style="width:${aPct}%; background-color:#e90052; ${aBarGlow}" aria-valuenow="${aPct}" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                </div>
            `;
        });

        html += `<div style="border-top:1px solid #1e1e1e; margin-bottom:12px;"></div>`;
    });

    container.innerHTML = html;
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

async function renderStandings(bypassCache = false) {
    const container = document.getElementById('league-table-container');
    const standingsData = await getPulseLiveStandings(bypassCache);
    
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
                    <th scope="col" class="text-center fw-bold text-info" style="position: sticky; right: 0; background-color: #212529; z-index: 2;">Pts</th>
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
                <td class="text-nowrap">
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

// Call renderStandings when the page finishes loading data
window.addEventListener('DOMContentLoaded', () => {
    // We can delay it slightly to let fixtures load first
    setTimeout(renderStandings, 1000);
});











