function selectBestTeam(players) {
    const budget = 100.0;
    const requiredTeam = {
        GK: 2,
        DEF: 5,
        MID: 5,
        FWD: 3
    };

    // Define weights for the composite score calculation
    const WEIGHTS = {
        total_points: 0.40,
        ep: 0.25,
        bonus: 0.20,
        selected_by_percent: 0.25,
        form: 0.15,
        points_per_cost: 0.10,
        value_for_money: 0.10
    };

    // Helper function to normalize data
    function normalize(players, field) {
        const max = Math.max(...players.map(player => player[field]));
        const min = Math.min(...players.map(player => player[field]));
        return players.map(player => ({
            ...player,
            [`${field}_norm`]: (player[field] - min) / (max - min)
        }));
    }

    // Normalize relevant fields
    const fieldsToNormalize = ['total_points', 'ep_this', 'ep_next', 'bonus', 'selected_by_percent', 'form'];
    fieldsToNormalize.forEach(field => {
        players = normalize(players, field);
    });

    // Calculate cost and composite score for each player
    players = players.map(player => {
        const cost = player.now_cost / 10.0;
        const pointsPerCost = (player.total_points_norm + player.ep_this_norm + player.ep_next_norm + player.bonus_norm) / cost;
        const valueForMoney = pointsPerCost / cost;
        const compositeScore = (
            WEIGHTS.total_points * player.total_points_norm +
            WEIGHTS.ep * (player.ep_this_norm + player.ep_next_norm) / 2 +
            WEIGHTS.bonus * player.bonus_norm +
            WEIGHTS.selected_by_percent * player.selected_by_percent_norm +
            WEIGHTS.form * player.form_norm +
            WEIGHTS.points_per_cost * pointsPerCost +
            WEIGHTS.value_for_money * valueForMoney
        );

        return { ...player, cost, compositeScore, valueForMoney };
    });

    // Adjust element_type to match positions
    const positionMap = {
        1: 'GK',
        2: 'DEF',
        3: 'MID',
        4: 'FWD'
    };

    // Helper function to build a team within budget with constraints
    function buildTeam(players, requiredTeam, randomFactor = 0) {
        const team = { GK: [], DEF: [], MID: [], FWD: [] };
        const teamCounts = {};
        let totalCost = 0;

        // Shuffle players for randomness
        if (randomFactor > 0) {
            players = players.sort(() => Math.random() - 0.5);
        }

        for (const player of players) {
            const position = positionMap[player.element_type];
            const playerTeam = player.team;

            // Ensure no more than 3 players from the same team
            if (!teamCounts[playerTeam]) teamCounts[playerTeam] = 0;
            if (teamCounts[playerTeam] < 3 && team[position].length < requiredTeam[position]) {
                team[position].push(player);
                teamCounts[playerTeam]++;
                totalCost += player.cost;
            }

            // Check if adding this player exceeds the budget
            if (totalCost > budget) {
                // Remove the least valuable player if needed
                while (totalCost > budget) {
                    for (const pos of Object.keys(team)) {
                        if (totalCost <= budget) break;
                        if (team[pos].length > 0) {
                            // Sort by composite score to remove the least valuable player
                            team[pos].sort((a, b) => a.compositeScore - b.compositeScore);
                            const removedPlayer = team[pos].shift();
                            teamCounts[removedPlayer.team]--;
                            totalCost -= removedPlayer.cost;
                        }
                    }
                }
            }
        }

        return { team: Object.values(team).flat(), totalCost };
    }

    // Multiple attempts to find a balanced team with a bit of randomness
    const numAttempts = 10;
    let bestResult = { team: [], totalCost: 0 };

    for (let i = 0; i < numAttempts; i++) {
        // Apply some randomness
        const randomFactor = Math.random();
        let result = buildTeam([...players], requiredTeam, randomFactor);

        // Update the best result if this one is better
        if (result.team.length === 15) {
            if (Math.abs(result.totalCost - budget) < Math.abs(bestResult.totalCost - budget)) {
                bestResult = result;
            }
        }
    }

    if (bestResult.team.length > 0) {
        console.log("Selected Team:");
        console.log("Cost: " + bestResult.totalCost);
        console.table(
            bestResult.team.map(player => ({
                web_name: player.web_name,
                position: positionMap[player.element_type],
                cost: player.cost,
                compositeScore: player.compositeScore
            }))
        );
        return bestResult.team;
    }

    console.log("Could not assemble a valid team within the budget.");
    return [];
}
