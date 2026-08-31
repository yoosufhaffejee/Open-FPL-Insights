function selectBestTeam(allPlayers, currentTeam = [], budget = 100.0) {
    const requiredTeam = {
        GK: 2,
        DEF: 5,
        MID: 5,
        FWD: 3
    };

    const positionMap = {
        1: 'GK',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };

    let currentCost = 0;
    let preSelectedIds = new Set();
    
    // Filter out ghost players before processing pre-selected players
    currentTeam = currentTeam.filter(p => p.id !== undefined && p.now_cost > 0);
    
    currentTeam.forEach(p => {
        currentCost += p.now_cost / 10.0;
        preSelectedIds.add(p.id);
    });

    // 1. Filter out pre-selected, injured, and low-selection players to improve quality
    let availablePlayers = allPlayers.filter(p => !preSelectedIds.has(p.id));
    availablePlayers = availablePlayers.filter(p => p.status === 'a' || p.chance_of_playing_next_round === 100);

    // Filter out absolute bench fodder that nobody owns if we want quality, 
    // but we might need cheap players. Let's rely on composite score instead.

    // 2. Define Weights
    const WEIGHTS = {
        total_points: 0.25,
        ep: 0.20,
        selected_by_percent: 0.35, // Heavily weight "highly selected" (template players)
        form: 0.10,
        value_for_money: 0.10
    };

    function normalize(players, field) {
        const max = Math.max(...players.map(player => parseFloat(player[field]) || 0));
        const min = Math.min(...players.map(player => parseFloat(player[field]) || 0));
        if (max === min) return players.map(p => ({ ...p, [`${field}_norm`]: 0 }));
        return players.map(player => ({
            ...player,
            [`${field}_norm`]: ((parseFloat(player[field]) || 0) - min) / (max - min)
        }));
    }

    const fieldsToNormalize = ['total_points', 'ep_this', 'ep_next', 'selected_by_percent', 'form'];
    fieldsToNormalize.forEach(field => {
        availablePlayers = normalize(availablePlayers, field);
    });

    availablePlayers = availablePlayers.map(player => {
        const cost = player.now_cost / 10.0;
        const pointsPerCost = ((player.total_points_norm + player.ep_this_norm + player.ep_next_norm) / 3) / cost;
        const valueForMoney = pointsPerCost;
        
        const compositeScore = (
            WEIGHTS.total_points * player.total_points_norm +
            WEIGHTS.ep * ((player.ep_this_norm + player.ep_next_norm) / 2) +
            WEIGHTS.selected_by_percent * player.selected_by_percent_norm +
            WEIGHTS.form * player.form_norm +
            WEIGHTS.value_for_money * valueForMoney
        );

        return { ...player, cost, compositeScore };
    });

    function buildTeam(players, preSelected, randomFactor) {
        const team = { GK: [], DEF: [], MID: [], FWD: [] };
        const teamCounts = {};
        let totalCost = 0;

        // Add preselected first
        preSelected.forEach(p => {
            const pos = positionMap[p.element_type];
            team[pos].push(p);
            totalCost += p.now_cost / 10.0;
            if (!teamCounts[p.team]) teamCounts[p.team] = 0;
            teamCounts[p.team]++;
        });

        // Add slight randomization to scores and sort descending
        let sortedPlayers = [...players].sort((a, b) => {
            let scoreA = a.compositeScore * (1 + (Math.random() * randomFactor - randomFactor / 2));
            let scoreB = b.compositeScore * (1 + (Math.random() * randomFactor - randomFactor / 2));
            return scoreB - scoreA;
        });

        for (const player of sortedPlayers) {
            const position = positionMap[player.element_type];
            const playerTeam = player.team;

            if (!teamCounts[playerTeam]) teamCounts[playerTeam] = 0;
            
            // Can we add this player?
            if (teamCounts[playerTeam] < 3 && team[position].length < requiredTeam[position]) {
                team[position].push(player);
                teamCounts[playerTeam]++;
                totalCost += player.cost;
            }
        }

        // If total cost exceeds budget, we need to iteratively replace the worst value players
        // with cheaper options until we are under budget.
        let iterations = 0;
        while (totalCost > budget && iterations < 100) {
            iterations++;
            // Find the most expensive non-preselected player with the lowest composite score
            let replaceablePlayers = [];
            for (const pos of Object.keys(team)) {
                team[pos].forEach(p => {
                    if (!preSelectedIds.has(p.id)) {
                        replaceablePlayers.push({ ...p, pos });
                    }
                });
            }
            
            if (replaceablePlayers.length === 0) break; // Can't remove preselected

            // Sort by cost descending to find the most expensive player to downgrade
            replaceablePlayers.sort((a, b) => b.cost - a.cost);
            let targetToRemove = replaceablePlayers[0];

            // Remove target
            team[targetToRemove.pos] = team[targetToRemove.pos].filter(p => p.id !== targetToRemove.id);
            totalCost -= targetToRemove.cost;
            teamCounts[targetToRemove.team]--;

            // Find a cheaper replacement for this position
            let replacementFound = false;
            let potentialReplacements = sortedPlayers.filter(p => 
                positionMap[p.element_type] === targetToRemove.pos && 
                p.id !== targetToRemove.id &&
                (!teamCounts[p.team] || teamCounts[p.team] < 3) &&
                !team[targetToRemove.pos].find(existing => existing.id === p.id)
            );
            
            // Sort potential replacements by score, but prefer those we can afford
            let affordable = potentialReplacements.filter(p => (totalCost + p.cost) <= budget);
            if (affordable.length > 0) {
                affordable.sort((a, b) => b.compositeScore - a.compositeScore);
                let bestReplacement = affordable[0];
                team[targetToRemove.pos].push(bestReplacement);
                totalCost += bestReplacement.cost;
                teamCounts[bestReplacement.team] = (teamCounts[bestReplacement.team] || 0) + 1;
                replacementFound = true;
            } else if (potentialReplacements.length > 0) {
                // If we still can't afford any, pick the absolute cheapest available to keep downgrading
                potentialReplacements.sort((a, b) => a.cost - b.cost);
                let cheapest = potentialReplacements[0];
                team[targetToRemove.pos].push(cheapest);
                totalCost += cheapest.cost;
                teamCounts[cheapest.team] = (teamCounts[cheapest.team] || 0) + 1;
                replacementFound = true;
            }
            
            if (!replacementFound) {
                // Failsafe: put them back if we couldn't find a replacement
                team[targetToRemove.pos].push(targetToRemove);
                totalCost += targetToRemove.cost;
                teamCounts[targetToRemove.team]++;
                break;
            }
        }

        return { team: Object.values(team).flat(), totalCost };
    }

    const numAttempts = 20;
    let bestResult = { team: [], totalCost: 999 };
    let bestScore = -1;

    for (let i = 0; i < numAttempts; i++) {
        // Random factor between 0.0 and 0.4 (10-40% score variance for diversity)
        let result = buildTeam(availablePlayers, currentTeam, 0.3);
        
        // Ensure valid team size and within budget (added small epsilon for floating point math)
        if (result.team.length === 15 && result.totalCost <= budget + 0.001) {
            // Calculate total composite score of non-preselected additions
            let addedScore = 0;
            result.team.forEach(p => {
                if (!preSelectedIds.has(p.id) && p.compositeScore) {
                    addedScore += p.compositeScore;
                }
            });

            if (addedScore > bestScore) {
                bestScore = addedScore;
                bestResult = result;
            }
        }
    }

    if (bestResult.team.length === 15) {
        console.log("Selected Team:", bestResult);
        return bestResult.team;
    }

    // Fallback if strict budget packing failed (just return what we got)
    console.log("Could not assemble a perfect team within the budget, returning best attempt.");
    return bestResult.team.length > 0 ? bestResult.team : currentTeam;
}
