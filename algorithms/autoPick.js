function selectBestTeam(allPlayers, currentTeam = [], budget = 100.0) {
    const requiredTeam = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
    const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    let currentCost = 0;
    let preSelectedIds = new Set();
    
    // Filter out ghost players before processing pre-selected players
    currentTeam = currentTeam.filter(p => p.id !== undefined && p.now_cost > 0);
    
    currentTeam.forEach(p => {
        currentCost += p.now_cost / 10.0;
        preSelectedIds.add(p.id);
    });

    let availablePlayers = allPlayers.filter(p => !preSelectedIds.has(p.id));
    availablePlayers = availablePlayers.filter(p => p.status === 'a' || p.chance_of_playing_next_round === 100);

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

    // Templates to provide a wide variety of good teams
    const templates = [
        { name: 'Balanced', weights: { tp: 0.2, ep: 0.2, sel: 0.4, form: 0.1, vfm: 0.1 }, boost: {} },
        { name: 'Strong Attack', weights: { tp: 0.2, ep: 0.2, sel: 0.3, form: 0.2, vfm: 0.1 }, boost: { MID: 1.3, FWD: 1.3 } },
        { name: 'Strong Defense', weights: { tp: 0.2, ep: 0.2, sel: 0.3, form: 0.2, vfm: 0.1 }, boost: { GK: 1.3, DEF: 1.3 } },
        { name: 'Premium Bias', weights: { tp: 0.3, ep: 0.3, sel: 0.4, form: 0.0, vfm: 0.0 }, boost: { PREMIUM: 1.5 } },
        { name: 'Form Chaser', weights: { tp: 0.1, ep: 0.1, sel: 0.2, form: 0.6, vfm: 0.0 }, boost: {} }
    ];

    function buildTeam(players, preSelected, randomFactor, protectPremiums) {
        const team = { GK: [], DEF: [], MID: [], FWD: [] };
        const teamCounts = {};
        let totalCost = 0;

        preSelected.forEach(p => {
            const pos = positionMap[p.element_type];
            team[pos].push(p);
            totalCost += p.now_cost / 10.0;
            if (!teamCounts[p.team]) teamCounts[p.team] = 0;
            teamCounts[p.team]++;
        });

        let sortedPlayers = [...players].sort((a, b) => {
            let scoreA = a.compositeScore * (1 + (Math.random() * randomFactor - randomFactor / 2));
            let scoreB = b.compositeScore * (1 + (Math.random() * randomFactor - randomFactor / 2));
            return scoreB - scoreA;
        });

        for (const player of sortedPlayers) {
            const position = positionMap[player.element_type];
            const playerTeam = player.team;

            if (!teamCounts[playerTeam]) teamCounts[playerTeam] = 0;
            
            if (teamCounts[playerTeam] < 3 && team[position].length < requiredTeam[position]) {
                team[position].push(player);
                teamCounts[playerTeam]++;
                totalCost += player.cost;
            }
        }

        let iterations = 0;
        while (totalCost > budget && iterations < 100) {
            iterations++;
            let replaceablePlayers = [];
            for (const pos of Object.keys(team)) {
                team[pos].forEach(p => {
                    if (!preSelectedIds.has(p.id)) {
                        replaceablePlayers.push({ ...p, pos });
                    }
                });
            }
            
            if (replaceablePlayers.length === 0) break;

            // Sort by true value to identify who to downgrade
            replaceablePlayers.sort((a, b) => b.compositeScore - a.compositeScore);
            let vulnerablePlayers = replaceablePlayers;
            
            // If the template specifically biases premiums, protect the absolute best 2 players (e.g. Haaland/Salah)
            if (protectPremiums) {
                vulnerablePlayers = replaceablePlayers.length > 2 ? replaceablePlayers.slice(2) : replaceablePlayers;
            }

            let downgradeable = vulnerablePlayers.filter(p => p.cost > 4.5);
            if (downgradeable.length === 0) downgradeable = vulnerablePlayers;
            
            downgradeable.sort((a, b) => (a.compositeScore / a.cost) - (b.compositeScore / b.cost));
            let poolSize = Math.min(3, downgradeable.length);
            let targetToRemove = downgradeable[Math.floor(Math.random() * poolSize)];

            team[targetToRemove.pos] = team[targetToRemove.pos].filter(p => p.id !== targetToRemove.id);
            totalCost -= targetToRemove.cost;
            teamCounts[targetToRemove.team]--;

            let replacementFound = false;
            let potentialReplacements = sortedPlayers.filter(p => 
                positionMap[p.element_type] === targetToRemove.pos && 
                p.id !== targetToRemove.id &&
                (!teamCounts[p.team] || teamCounts[p.team] < 3) &&
                !team[targetToRemove.pos].find(existing => existing.id === p.id)
            );
            
            let affordable = potentialReplacements.filter(p => (totalCost + p.cost) <= budget);
            if (affordable.length > 0) {
                affordable.sort((a, b) => b.compositeScore - a.compositeScore);
                let bestReplacement = affordable[0];
                team[targetToRemove.pos].push(bestReplacement);
                totalCost += bestReplacement.cost;
                teamCounts[bestReplacement.team] = (teamCounts[bestReplacement.team] || 0) + 1;
                replacementFound = true;
            } else if (potentialReplacements.length > 0) {
                potentialReplacements.sort((a, b) => a.cost - b.cost);
                let cheapest = potentialReplacements[0];
                team[targetToRemove.pos].push(cheapest);
                totalCost += cheapest.cost;
                teamCounts[cheapest.team] = (teamCounts[cheapest.team] || 0) + 1;
                replacementFound = true;
            }
            
            if (!replacementFound) {
                team[targetToRemove.pos].push(targetToRemove);
                totalCost += targetToRemove.cost;
                teamCounts[targetToRemove.team]++;
                break;
            }
        }

        return { team: Object.values(team).flat(), totalCost };
    }

    const numAttempts = 40; 
    let validResults = [];

    for (let i = 0; i < numAttempts; i++) {
        // Pick a random template
        let template = templates[Math.floor(Math.random() * templates.length)];
        
        // Calculate composite score based on the template
        let scoredPlayers = availablePlayers.map(player => {
            const cost = player.now_cost / 10.0;
            const pointsPerCost = ((player.total_points_norm + player.ep_this_norm + player.ep_next_norm) / 3) / cost;
            
            let compositeScore = (
                template.weights.tp * player.total_points_norm +
                template.weights.ep * ((player.ep_this_norm + player.ep_next_norm) / 2) +
                template.weights.sel * player.selected_by_percent_norm +
                template.weights.form * player.form_norm +
                template.weights.vfm * pointsPerCost
            );

            // Apply position boosts
            const pos = positionMap[player.element_type];
            if (template.boost[pos]) {
                compositeScore *= template.boost[pos];
            }

            // Apply premium boosts (for highly selected expensive players like Haaland/Salah)
            if (template.boost.PREMIUM && cost >= 10.0) {
                compositeScore *= template.boost.PREMIUM;
            }

            // Calculate a raw true score to evaluate the final team purely (independent of template bias)
            const trueStandardScore = player.total_points_norm + ((player.ep_this_norm + player.ep_next_norm) / 2) + player.selected_by_percent_norm + player.form_norm;

            return { ...player, cost, compositeScore, trueStandardScore };
        });

        let protectPremiums = (template.name === 'Premium Bias');
        let result = buildTeam(scoredPlayers, currentTeam, 0.4, protectPremiums);
        
        if (result.team.length === 15 && result.totalCost <= budget + 0.001) {
            let standardScore = 0;
            result.team.forEach(p => {
                if (!preSelectedIds.has(p.id) && p.trueStandardScore) {
                    standardScore += p.trueStandardScore;
                }
            });

            validResults.push({ result, standardScore, templateName: template.name });
        }
    }

    if (validResults.length > 0) {
        // Sort all valid generated teams by their true un-biased score descending
        validResults.sort((a, b) => b.standardScore - a.standardScore);
        
        // Pick randomly from the top 10 to give massive variety
        let topN = Math.min(10, validResults.length);
        let randomIndex = Math.floor(Math.random() * topN);
        
        let finalResult = validResults[randomIndex].result;
        console.log("Selected Auto-Pick Team:", validResults[randomIndex].templateName, finalResult);
        return finalResult.team;
    }

    console.log("Could not assemble a perfect team within the budget, returning best attempt.");
    // Fallback: Just try one balanced team with no noise
    let fallbackScored = availablePlayers.map(player => {
        const cost = player.now_cost / 10.0;
        return { ...player, cost, compositeScore: player.total_points_norm };
    });
    let fallback = buildTeam(fallbackScored, currentTeam, 0.0, false);
    return fallback.team.length > 0 ? fallback.team : currentTeam;
}
