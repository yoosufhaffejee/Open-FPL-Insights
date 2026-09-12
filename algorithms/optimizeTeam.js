function optimizeTeam(players) {

    // Find the existing captain and adjust their predicted points
    players.forEach(player => {
        if (player.isCaptain) {
              // Divide the captain's points by 2
        }
        player.isCaptain = false;  // Reset captain flag, we will assign a new one later
        player.isVice = false;     // Reset vice captain flag
    });

    // Categorize players by position (element_type)
    const gk = players.filter(p => p.element_type === 1).sort((a, b) => b.predicted_points - a.predicted_points);
    const def = players.filter(p => p.element_type === 2).sort((a, b) => b.predicted_points - a.predicted_points);
    const mid = players.filter(p => p.element_type === 3).sort((a, b) => b.predicted_points - a.predicted_points);
    const fwd = players.filter(p => p.element_type === 4).sort((a, b) => b.predicted_points - a.predicted_points);

    let bestTeam = [];
    let maxPoints = 0;

    // Try all valid formations (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
    for (let defCount = 3; defCount <= 5; defCount++) {
        for (let midCount = 2; midCount <= 5; midCount++) {
            for (let fwdCount = 1; fwdCount <= 3; fwdCount++) {
                // Ensure the total number of players is exactly 11
                if (1 + defCount + midCount + fwdCount === 11) {
                    // Select the top players for the current formation
                    const selectedGK = gk.slice(0, 1);
                    const selectedDEF = def.slice(0, defCount);
                    const selectedMID = mid.slice(0, midCount);
                    const selectedFWD = fwd.slice(0, fwdCount);

                    // Combine the selected players
                    const currentTeam = [...selectedGK, ...selectedDEF, ...selectedMID, ...selectedFWD];

                    // Calculate total points for the current team
                    const currentPoints = currentTeam.reduce((sum, player) => sum + player.predicted_points, 0);

                    // Check if this is the best team so far
                    if (currentPoints > maxPoints) {
                        maxPoints = currentPoints;
                        bestTeam = currentTeam;
                    }
                }
            }
        }
    }

    // Set the captain as the player with the highest predicted points, vice captain to second highest
    if (bestTeam.length > 0) {
        // Sort best team descending by predicted points
        let sortedTeam = [...bestTeam].sort((a, b) => b.predicted_points - a.predicted_points);
        let highestPointsPlayer = sortedTeam[0];
        let secondHighestPointsPlayer = sortedTeam.length > 1 ? sortedTeam[1] : null;

        bestTeam.forEach(player => {
            player.isCaptain = (player.id === highestPointsPlayer.id);
            player.isVice = (secondHighestPointsPlayer && player.id === secondHighestPointsPlayer.id);
        });
    }

    return bestTeam;
}
window.idealGWPointsCache = window.idealGWPointsCache || {};

function getIdealMaxPointsForGW(gwId, calculatePointsFn, allPlayersData, fixturesData) {
    if (window.idealGWPointsCache[gwId]) return window.idealGWPointsCache[gwId];
    
    let gwPlayers = [];
    allPlayersData.forEach(p => {
        let fixture = fixturesData.find(f => f.event === gwId && (f.team_a === p.team || f.team_h === p.team));
        let pts = calculatePointsFn(p, fixture, gwId);
        if (pts !== '?') {
            gwPlayers.push({ ...p, predicted_points: parseFloat(pts) });
        }
    });

    gwPlayers.sort((a, b) => b.predicted_points - a.predicted_points);
    
    let team = { 1: [], 2: [], 3: [], 4: [] };
    let required = { 1: 2, 2: 5, 3: 5, 4: 3 };
    let teamCounts = {};
    let totalCost = 0;
    
    for (let p of gwPlayers) {
        if (!teamCounts[p.team]) teamCounts[p.team] = 0;
        let pos = p.element_type;
        if (team[pos].length < required[pos] && teamCounts[p.team] < 3) {
            team[pos].push(p);
            teamCounts[p.team]++;
            totalCost += p.now_cost;
        }
    }
    
    let iterations = 0;
    while (totalCost > 1000 && iterations < 200) {
        iterations++;
        let replaceable = Object.values(team).flat();
        replaceable.sort((a, b) => b.now_cost - a.now_cost);
        let target = replaceable[0];
        
        team[target.element_type] = team[target.element_type].filter(p => p.id !== target.id);
        totalCost -= target.now_cost;
        teamCounts[target.team]--;
        
        let potentials = gwPlayers.filter(p => 
            p.element_type === target.element_type && 
            p.id !== target.id &&
            (!teamCounts[p.team] || teamCounts[p.team] < 3) &&
            !team[target.element_type].find(existing => existing.id === p.id) &&
            (totalCost + p.now_cost) <= 1000
        );
        
        if (potentials.length > 0) {
            potentials.sort((a, b) => b.predicted_points - a.predicted_points);
            let replacement = potentials[0];
            team[replacement.element_type].push(replacement);
            totalCost += replacement.now_cost;
            teamCounts[replacement.team]++;
        } else {
            let cheapestPotentials = gwPlayers.filter(p => 
                p.element_type === target.element_type && 
                p.id !== target.id &&
                (!teamCounts[p.team] || teamCounts[p.team] < 3) &&
                !team[target.element_type].find(existing => existing.id === p.id)
            );
            if (cheapestPotentials.length > 0) {
                cheapestPotentials.sort((a, b) => a.now_cost - b.now_cost);
                let cheapest = cheapestPotentials[0];
                team[cheapest.element_type].push(cheapest);
                totalCost += cheapest.now_cost;
                teamCounts[cheapest.team]++;
            } else {
                team[target.element_type].push(target);
                totalCost += target.now_cost;
                teamCounts[target.team]++;
                break;
            }
        }
    }
    
    let squad = Object.values(team).flat();
    if (squad.length < 15) {
        window.idealGWPointsCache[gwId] = 70;
        return 70; 
    }
    
    let best11 = optimizeTeam(squad);
    let maxPoints = 0;
    best11.forEach(p => {
        maxPoints += p.isCaptain ? (p.predicted_points * 2) : p.predicted_points;
    });
    
    window.idealGWPointsCache[gwId] = maxPoints;
    return maxPoints;
}
