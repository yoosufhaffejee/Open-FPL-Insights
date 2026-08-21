document.addEventListener('DOMContentLoaded', async () => {
    await setupPage(); // Assumes data.js is loaded
    
    // Check if data is loaded, otherwise wait a bit (setupPage should handle it though)
    if (!teams || teams.length === 0) {
        setTimeout(initFDR, 1000);
    } else {
        initFDR();
    }
});

let gwRangeSelect;
let sortTeamsSelect;

function initFDR() {
    gwRangeSelect = document.getElementById('gwRange');
    sortTeamsSelect = document.getElementById('sortTeams');

    gwRangeSelect.addEventListener('change', renderFDR);
    sortTeamsSelect.addEventListener('change', renderFDR);
    document.getElementById('toggleProjectedGoals').addEventListener('change', renderFDR);
    document.getElementById('toggleProjectedCS').addEventListener('change', renderFDR);

    renderFDR();
}

function renderFDR() {
    const tableHead = document.getElementById('fdrHeaderRow');
    const tableBody = document.getElementById('fdrBody');
    
    // Find current gameweek
    let currentGW = gameweeks.find(gw => !gw.finished) || gameweeks[0];
    let startGwId = currentGW.id;
    let range = parseInt(gwRangeSelect.value) || 5;
    
    // Clear headers except the first one
    while (tableHead.children.length > 1) {
        tableHead.removeChild(tableHead.lastChild);
    }
    
    // Generate headers
    for (let i = 0; i < range; i++) {
        let gwId = startGwId + i;
        if (gwId > 38) break;
        
        let th = document.createElement('th');
        th.innerHTML = `GW ${gwId}`;
        tableHead.appendChild(th);
    }
    
    // Get team fixtures and calculate scores
    let teamData = teams.map(team => {
        let rowFixtures = [];
        let totalDifficulty = 0;
        
        // Check toggles
        let useGoals = document.getElementById('toggleProjectedGoals').checked;
        let useCS = document.getElementById('toggleProjectedCS').checked;
        
        for (let i = 0; i < range; i++) {
            let gwId = startGwId + i;
            if (gwId > 38) break;
            
            // Find fixture for this team in this GW
            // Some GWs might have blanks or double gameweeks
            let gwFixtures = fixtures.filter(f => f.event === gwId && (f.team_h === team.id || f.team_a === team.id));
            
            if (gwFixtures.length === 0) {
                rowFixtures.push({ text: 'BLANK', difficulty: 5, blank: true });
                totalDifficulty += 5; // Punish blanks
            } else {
                // For simplicity in a basic FDR, just take the first fixture (or average if DGW)
                let f = gwFixtures[0];
                let isHome = f.team_h === team.id;
                let opponentId = isHome ? f.team_a : f.team_h;
                let opponent = teams.find(t => t.id === opponentId);
                let oppShort = opponent ? opponent.short_name : '???';
                
                let difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
                
                // Fallback bounds 1-5
                difficulty = Math.max(1, Math.min(5, difficulty));
                
                let cellText = `${oppShort} (${isHome ? 'H' : 'A'})`;
                
                // Attack vs Defense Specific (FPL API removed exact strength values for 2024, so we project stats based on FDR)
                const projectedMap = {
                    1: { xG: 2.5, cs: 50 },
                    2: { xG: 2.1, cs: 40 },
                    3: { xG: 1.5, cs: 25 },
                    4: { xG: 1.1, cs: 15 },
                    5: { xG: 0.8, cs: 5  }
                };
                
                if (useGoals && !useCS) {
                    cellText += `<br><small style="font-size: 0.8em; font-weight: 600;">${projectedMap[difficulty].xG} xG</small>`;
                } else if (useCS && !useGoals) {
                    cellText += `<br><small style="font-size: 0.8em; font-weight: 600;">${projectedMap[difficulty].cs}% CS</small>`;
                } else if (useCS && useGoals) {
                    cellText += `<br><small style="font-size: 0.75em; font-weight: 600;">${projectedMap[difficulty].xG} xG | ${projectedMap[difficulty].cs}% CS</small>`;
                }
                
                rowFixtures.push({
                    text: cellText,
                    difficulty: difficulty
                });
                totalDifficulty += difficulty;
            }
        }
        
        return {
            team,
            fixtures: rowFixtures,
            totalDifficulty
        };
    });
    
    // Sort
    let sortVal = sortTeamsSelect.value;
    if (sortVal === 'easiest') {
        teamData.sort((a, b) => a.totalDifficulty - b.totalDifficulty);
    } else {
        teamData.sort((a, b) => b.totalDifficulty - a.totalDifficulty);
    }
    
    // Render Body
    tableBody.innerHTML = '';
    teamData.forEach(data => {
        let tr = document.createElement('tr');
        
        let tdName = document.createElement('td');
        tdName.className = 'team-name-cell';
        tdName.innerHTML = '<img src="https://resources.premierleague.com/premierleague/badges/50/t' + data.team.code + '.png" class="team-logo" onerror="this.src=\'../../assets/empty-jersey.png\'"><span>' + data.team.name + '</span>';
        tr.appendChild(tdName);
        
        data.fixtures.forEach(fix => {
            let td = document.createElement('td');
            if (fix.blank) {
                td.innerHTML = `<div class="fdr-cell fdr-5">BLANK</div>`;
            } else {
                let diffClass = `fdr-${Math.min(5, Math.max(2, fix.difficulty))}`;
                td.innerHTML = `<div class="fdr-cell ${diffClass}">${fix.text}</div>`;
            }
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
}
