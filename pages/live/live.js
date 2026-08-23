async function loadLiveTeam() {
    const teamId = document.getElementById('fpl-team-id').value;
    if (!teamId) return;

    const resultsDiv = document.getElementById('live-results');
    resultsDiv.classList.add('opacity-50');

    try {
        const currentGameweek = gameweeks.find(gw => gw.is_current) || gameweeks.find(gw => gw.is_next);
        const gwId = currentGameweek ? currentGameweek.id : 1;
        document.getElementById('gw-label').textContent = `GW ${gwId}`;

        // Fetch picks and manager info
        const [picksData, managerData] = await Promise.all([
            getEntryEventPicks(teamId, gwId),
            getManager(teamId)
        ]);

        if (managerData) {
            document.getElementById('manager-name').textContent = `${managerData.player_first_name} ${managerData.player_last_name}`;
            
            // FPL overall rank from previous gameweek
            const prevRank = managerData.summary_overall_rank;
            document.getElementById('live-rank').textContent = prevRank ? prevRank.toLocaleString() : '-';
            document.getElementById('rank-movement').textContent = '(At start of GW)';
        }

        if (picksData && picksData.picks) {
            renderLivePitch(picksData.picks);
        }

        resultsDiv.classList.remove('d-none', 'opacity-50');
    } catch (e) {
        console.error(e);
        alert("Could not load team. Please check the ID.");
        resultsDiv.classList.remove('opacity-50');
    }
}

function renderLivePitch(picks) {
    const pitch = document.getElementById('live-pitch');
    const bench = document.getElementById('live-bench');
    pitch.innerHTML = '';
    bench.innerHTML = '';

    let totalPoints = 0;
    let playedCount = 0;

    const positions = { 1: [], 2: [], 3: [], 4: [] };
    const benchPlayers = [];

    picks.forEach(pick => {
        const player = allPlayers.find(p => p.id === pick.element);
        if (!player) return;

        const isCaptain = pick.is_captain;
        const isVice = pick.is_vice_captain;
        let points = player.event_points !== undefined ? player.event_points : 0;
        
        if (isCaptain) points *= pick.multiplier || 2; // Usually 2, could be 3 (TC)
        
        const team = teams.find(t => t.id === player.team);
        
        // Calculate minutes (we don't have exact live minutes easily without fetching element-summary, but we can assume played if points > 0 or we can just count 11)
        if (pick.multiplier > 0) {
            totalPoints += points;
            playedCount++;
        }

        const playerCard = `
            <div class="text-center" style="width: 80px;">
                <div class="position-relative d-inline-block">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}${player.element_type == 1 ? '_1' : ''}-110.webp" 
                         style="width: 50px;" class="drop-shadow" 
                         onerror="playerImgOnerror(this, ${player.team_code}, ${player.element_type})">
                    ${isCaptain ? '<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning text-dark border border-dark">C</span>' : ''}
                    ${isVice ? '<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-light text-dark border border-dark">V</span>' : ''}
                </div>
                <div class="bg-dark text-white fw-bold rounded-top border border-secondary border-bottom-0 mt-1" style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px;">
                    ${player.web_name}
                </div>
                <div class="${pick.multiplier > 0 ? 'bg-success' : 'bg-secondary'} text-white fw-bold rounded-bottom border border-secondary" style="font-size: 0.9rem;">
                    ${points}
                </div>
            </div>
        `;

        if (pick.multiplier === 0) {
            benchPlayers.push(playerCard);
        } else {
            positions[player.element_type].push(playerCard);
        }
    });

    document.getElementById('live-points').textContent = totalPoints;
    document.getElementById('active-players').textContent = `${playedCount} / 11`;

    // Render pitch rows
    [1, 2, 3, 4].forEach(posType => {
        if (positions[posType].length > 0) {
            const row = document.createElement('div');
            row.className = 'd-flex justify-content-around w-100 px-2';
            row.innerHTML = positions[posType].join('');
            pitch.appendChild(row);
        }
    });

    // Render bench
    bench.innerHTML = benchPlayers.join('');
}

// Add drop-shadow utility class if not present in css
const style = document.createElement('style');
style.textContent = `
    .drop-shadow { filter: drop-shadow(0 4px 3px rgba(0,0,0,0.5)); }
`;
document.head.appendChild(style);
