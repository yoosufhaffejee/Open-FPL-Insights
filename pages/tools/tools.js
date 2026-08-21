// Tab Switching Logic
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('#tools-nav .list-group-item');
    const sections = document.querySelectorAll('.tool-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // Remove active from all tabs and sections
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-tool'));

            // Add active to clicked tab
            e.currentTarget.classList.add('active');

            // Show corresponding section
            const toolId = e.currentTarget.getAttribute('data-tool');
            document.getElementById(`tool-${toolId}`).classList.add('active-tool');

            // Trigger specific logic if needed
            if (toolId === 'template' && !templateLoaded) {
                loadTemplateTeam();
            }
        });
    });
});

let templateLoaded = false;
let positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

// Main entry point called by data.js
async function Initialize() {
    if (!allPlayers || allPlayers.length === 0) return;

    renderDefCon();
    renderExpectedData();
    renderSetPieces();
    renderTopTransfers();
}

function getTeamName(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unknown';
}

function getTeamCode(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.code : 0;
}

function renderDefCon() {
    const tbody = document.getElementById('defcon-tbody');
    
    // Filter Defenders and GKs with > 0 def con
    let defenders = allPlayers.filter(p => (p.element_type === 1 || p.element_type === 2) && parseFloat(p.defensive_contribution) > 0);
    
    // Sort by defensive_contribution_per_90 descending
    defenders.sort((a, b) => parseFloat(b.defensive_contribution_per_90) - parseFloat(a.defensive_contribution_per_90));
    
    // Take top 50
    defenders = defenders.slice(0, 50);

    tbody.innerHTML = defenders.map(p => `
        <tr>
            <td>
                <div class="player-name-cell">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}-66.webp" alt="shirt">
                    ${p.web_name}
                </div>
            </td>
            <td>${getTeamName(p.team)}</td>
            <td class="text-center fw-bold text-success">${p.defensive_contribution}</td>
            <td class="text-center">${p.defensive_contribution_per_90}</td>
            <td class="text-center">${p.clearances_blocks_interceptions}</td>
            <td class="text-center">${p.recoveries}</td>
            <td class="text-center">${p.tackles}</td>
        </tr>
    `).join('');
}

function renderExpectedData() {
    const tbody = document.getElementById('expected-tbody');
    
    // Filter players with minutes > 0
    let players = allPlayers.filter(p => p.minutes > 0);
    
    // Sort by expected_goal_involvements_per_90 descending
    players.sort((a, b) => parseFloat(b.expected_goal_involvements_per_90) - parseFloat(a.expected_goal_involvements_per_90));
    
    players = players.slice(0, 100);

    tbody.innerHTML = players.map(p => `
        <tr>
            <td>
                <div class="player-name-cell">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}-66.webp" alt="shirt">
                    ${p.web_name}
                </div>
            </td>
            <td>${positionMap[p.element_type]}</td>
            <td class="text-center fw-bold text-info">${p.expected_goal_involvements_per_90}</td>
            <td class="text-center">${p.expected_goals_per_90}</td>
            <td class="text-center">${p.expected_assists_per_90}</td>
            <td class="text-center">${p.expected_goals}</td>
            <td class="text-center">${p.expected_assists}</td>
        </tr>
    `).join('');
}

function renderSetPieces() {
    const container = document.getElementById('setpieces-container');
    
    let html = '';
    
    // Group by team
    teams.forEach(team => {
        let teamPlayers = allPlayers.filter(p => p.team === team.id);
        
        let pens = teamPlayers.filter(p => p.penalties_order).sort((a,b) => a.penalties_order - b.penalties_order);
        let fks = teamPlayers.filter(p => p.direct_freekicks_order).sort((a,b) => a.direct_freekicks_order - b.direct_freekicks_order);
        let corners = teamPlayers.filter(p => p.corners_and_indirect_freekicks_order).sort((a,b) => a.corners_and_indirect_freekicks_order - b.corners_and_indirect_freekicks_order);
        
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="set-piece-card">
                    <h5>
                        <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-66.webp" style="width:25px; margin-right:5px;">
                        ${team.name}
                    </h5>
                    <ul class="set-piece-list">
                        <li>
                            <span class="sp-type">Penalties</span>
                            <span class="sp-taker">${pens.length > 0 ? pens.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                        <li>
                            <span class="sp-type">Free Kicks</span>
                            <span class="sp-taker">${fks.length > 0 ? fks.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                        <li>
                            <span class="sp-type">Corners</span>
                            <span class="sp-taker">${corners.length > 0 ? corners.map(p => p.web_name).join(', ') : 'Unknown'}</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderTopTransfers() {
    const inBody = document.getElementById('transfers-in-tbody');
    const outBody = document.getElementById('transfers-out-tbody');
    
    let sortedIn = [...allPlayers].sort((a, b) => b.transfers_in_event - a.transfers_in_event).slice(0, 20);
    let sortedOut = [...allPlayers].sort((a, b) => b.transfers_out_event - a.transfers_out_event).slice(0, 20);
    
    inBody.innerHTML = sortedIn.map(p => `
        <tr>
            <td>
                <div class="player-name-cell">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}-66.webp" alt="shirt">
                    ${p.web_name}
                </div>
            </td>
            <td class="text-end fw-bold text-success">+${p.transfers_in_event.toLocaleString()}</td>
        </tr>
    `).join('');
    
    outBody.innerHTML = sortedOut.map(p => `
        <tr>
            <td>
                <div class="player-name-cell">
                    <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}-66.webp" alt="shirt">
                    ${p.web_name}
                </div>
            </td>
            <td class="text-end fw-bold text-danger">-${p.transfers_out_event.toLocaleString()}</td>
        </tr>
    `).join('');
}

// Template Team (Top 50) Scraper
async function loadTemplateTeam() {
    templateLoaded = true; // Prevent re-running
    
    // Check session storage cache
    const cached = sessionStorage.getItem('templateTeam');
    if (cached) {
        renderTemplatePitch(JSON.parse(cached));
        return;
    }

    try {
        // 1. Fetch Top 50 Managers from Overall League (314)
        const standingsRes = await fetch('https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?url=https://fantasy.premierleague.com/api/leagues-classic/314/standings/');
        const standingsData = await standingsRes.json();
        
        const top50 = standingsData.standings.results.slice(0, 50);
        
        // Find current Gameweek
        const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next);
        if (!currentEvent) throw new Error("No active gameweek found.");
        
        // 2. Fetch picks for all 50 managers in parallel
        const pickPromises = top50.map(manager => 
            fetch(`https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?url=https://fantasy.premierleague.com/api/entry/${manager.entry}/event/${currentEvent.id}/picks/`)
                .then(res => res.json())
                .catch(err => null) // Ignore failed fetches
        );
        
        const picksData = await Promise.all(pickPromises);
        
        // 3. Tally Ownership
        const ownershipCount = {};
        let validManagersCount = 0;
        
        picksData.forEach(managerPicks => {
            if (managerPicks && managerPicks.picks) {
                validManagersCount++;
                managerPicks.picks.forEach(pick => {
                    ownershipCount[pick.element] = (ownershipCount[pick.element] || 0) + 1;
                });
            }
        });
        
        // 4. Convert to array and calculate percentage
        const templatePlayers = [];
        for (let playerId in ownershipCount) {
            const playerInfo = allPlayers.find(p => p.id == playerId);
            if (playerInfo) {
                templatePlayers.push({
                    ...playerInfo,
                    eo_percent: Math.round((ownershipCount[playerId] / validManagersCount) * 100)
                });
            }
        }
        
        // Sort by EO descending
        templatePlayers.sort((a, b) => b.eo_percent - a.eo_percent);
        
        // 5. Select Best Valid 15-man Squad from the highest EO players
        const squad = selectTemplateSquad(templatePlayers);
        
        // Cache and Render
        sessionStorage.setItem('templateTeam', JSON.stringify(squad));
        renderTemplatePitch(squad);

    } catch (error) {
        console.error("Failed to load template team", error);
        document.getElementById('template-loading').innerHTML = `
            <div class="alert alert-danger" role="alert">
                Failed to scrape live data. The FPL API might be updating or blocking requests. Please try again later.
            </div>
        `;
    }
}

function selectTemplateSquad(rankedPlayers) {
    const required = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const squad = [];
    
    for (const player of rankedPlayers) {
        const pos = positionMap[player.element_type];
        if (counts[pos] < required[pos]) {
            squad.push(player);
            counts[pos]++;
        }
        if (squad.length === 15) break;
    }
    
    return squad;
}

function renderTemplatePitch(squad) {
    document.getElementById('template-loading').style.display = 'none';
    document.getElementById('template-pitch-wrapper').style.display = 'block';
    
    const pitch = document.getElementById('template-pitch');
    
    const posGroups = {
        GK: squad.filter(p => p.element_type === 1).slice(0, 1),
        DEF: squad.filter(p => p.element_type === 2).slice(0, 4), // Example formation 4-4-2 or similar for display
        MID: squad.filter(p => p.element_type === 3).slice(0, 4),
        FWD: squad.filter(p => p.element_type === 4).slice(0, 2),
        SUBS: []
    };
    
    // Put remaining players on bench
    squad.forEach(p => {
        let isStarting = false;
        Object.keys(posGroups).forEach(pos => {
            if (pos !== 'SUBS' && posGroups[pos].find(s => s.id === p.id)) isStarting = true;
        });
        if (!isStarting) posGroups['SUBS'].push(p);
    });

    // Helper to generate row HTML
    const getRowHtml = (players, className) => {
        return `
            <div class="row ${className}">
                ${players.map(p => `
                    <div class="player">
                        <img class="shirt" src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}${p.element_type===1?'_1':''}-110.webp" alt="shirt">
                        <div class="player-info">
                            <h5>${p.web_name}</h5>
                            <div class="ownership-badge">${p.eo_percent}%</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    pitch.innerHTML = `
        ${getRowHtml(posGroups.GK, 'gk')}
        ${getRowHtml(posGroups.DEF, 'defense')}
        ${getRowHtml(posGroups.MID, 'midfield')}
        ${getRowHtml(posGroups.FWD, 'attack')}
        
        <div class="subs-container mt-4">
            <h6 class="text-center mb-2">Bench Template</h6>
            <div class="subs">
                ${posGroups.SUBS.map(p => `
                    <div class="player">
                        <img class="shirt" src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${getTeamCode(p.team)}${p.element_type===1?'_1':''}-110.webp" alt="shirt">
                        <div class="player-info">
                            <h5>${p.web_name}</h5>
                            <div class="ownership-badge" style="background:#555;color:#fff;">${p.eo_percent}%</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
