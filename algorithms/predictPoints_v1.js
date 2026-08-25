const startingPoints = 1;
const goalPointsGK = 10;
const goalPointsDEF = 6;
const goalPointsMID = 5;
const goalPointsFWD = 4;
const assistPoints = 3;
const cleanSheetPoints = 4;
const cleanSheetPointsMID = 1;
const sixtyMinutesPlayedPoints = 1;
const yellowCardPointsDeduction = 1;
const redCardPointsDeduction = 3;
const ownGoalPointsDeduction = 2;
const penaltyMissPointsDeduction = 2;
const twoGoalsConcededPointsDeduction = 2;
const threeShotsSavedPoints = 1;
const penaltySavedPoints = 5;
const bonusPoints1 = 1;
const bonusPoints2 = 2;
const bonusPoints3 = 3;

let predictionCache_v1 = null;

function loadPredictionCache_v1() {
    if (predictionCache_v1 === null) {
        const stored = localStorage.getItem('fpl_predictions_v11_v1');
        if (stored) {
            try {
                predictionCache_v1 = JSON.parse(stored);
            } catch (e) {
                predictionCache_v1 = {};
            }
        } else {
            predictionCache_v1 = {};
        }
    }
}

function clearPredictionCache_v1() {
    predictionCache_v1 = null;
    localStorage.removeItem('fpl_predictions_v11_v1');
}

function getExpectedPoints_v1(player, fixture) {
    loadPredictionCache_v1();
    const cacheKey = `${player.id}_${fixture ? fixture.id : 'no_fixture'}`;
    if (predictionCache_v1[cacheKey] !== undefined) {
        return predictionCache_v1[cacheKey];
    }
    return '?';
}

function calculateExpectedPointsCore_v1(player, fixture) {
    let expectedPoints = 0;
    expectedPoints += startingPoints;

    let minutes_per_90 = player.starts == 0 ? 0 : player.minutes / player.starts;
    if (minutes_per_90 >= 60) {
        expectedPoints += sixtyMinutesPlayedPoints;
    }

    let own_goals_per_90 = player.own_goals == 0 ? 0 : player.own_goals / (player.minutes / 90);
    expectedPoints -= (ownGoalPointsDeduction * own_goals_per_90);

    let yellow_cards_per_90 = player.yellow_cards == 0 ? 0 : player.yellow_cards / (player.minutes / 90);
    expectedPoints -= (yellowCardPointsDeduction * yellow_cards_per_90);

    let red_cards_per_90 = player.red_cards == 0 ? 0 : player.red_cards / (player.minutes / 90);
    expectedPoints -= (redCardPointsDeduction * red_cards_per_90);

    // Calculate expected bonus points by ranking players in this fixture by projected BPS
    let expectedBonus = 0;
    if (fixture && typeof allPlayers !== 'undefined') {
        let oppTeamId = (player.team === fixture.team_h) ? fixture.team_a : fixture.team_h;
        let matchPlayers = allPlayers.filter(p => p.team === player.team || p.team === oppTeamId);
        
        let playerBPSProjections = matchPlayers.map(p => {
            let bps90 = (p.minutes !== undefined && p.minutes > 0) ? (p.bps / (p.minutes / 90)) : 0;
            let form = parseFloat(p.form) || 0;
            return { id: p.id, projBPS: bps90 + form };
        });
        
        // Sort descending by projected BPS
        playerBPSProjections.sort((a, b) => b.projBPS - a.projBPS);
        
        if (playerBPSProjections.length > 0 && playerBPSProjections[0].id === player.id) expectedBonus = 2.5;
        else if (playerBPSProjections.length > 1 && playerBPSProjections[1].id === player.id) expectedBonus = 1.5;
        else if (playerBPSProjections.length > 2 && playerBPSProjections[2].id === player.id) expectedBonus = 0.8;
        else if (playerBPSProjections.length > 3 && playerBPSProjections[3].id === player.id) expectedBonus = 0.4;
        else if (playerBPSProjections.length > 4 && playerBPSProjections[4].id === player.id) expectedBonus = 0.2;
        
        // Blend with historical bonus to smooth out match-specific harshness
        let histBonus = (player.minutes > 0) ? (player.bonus / (player.minutes / 90)) : 0;
        expectedBonus = (expectedBonus + histBonus) / 2;
        expectedBonus = Math.min(2.0, expectedBonus);
    } else {
        // Fallback if fixture not available
        expectedBonus = (player.minutes > 0) ? (player.bonus / (player.minutes / 90)) : 0;
        expectedBonus = Math.min(1.5, expectedBonus);
    }
    expectedPoints += expectedBonus;

    let penalties = player.penalties_saved == 0 ? 0 : player.penalties_saved + player.penalties_missed;
    let penaltiesPer90 = penalties / (player.minutes / 90);

    let assistsPer90 = player.expected_assists_per_90 !== undefined && player.expected_assists_per_90 !== 0 ? parseFloat(player.expected_assists_per_90) : 0;
    expectedPoints += assistsPer90 * assistPoints;

    // Defensive Contribution Points (DEF and MID only)
    if (player.element_type === 2 || player.element_type === 3) {
        let defConPer90 = parseFloat(player.defensive_contribution_per_90);
        if (!isNaN(defConPer90) && defConPer90 > 0) {
            // Defenders need 10 actions, Mid need 12 actions
            let threshold = (player.element_type === 2) ? 10 : 12;
            let prob = defConPer90 / threshold;
            if (prob > 1.0) prob = 1.0; // Cap at 100%
            expectedPoints += prob; // 1 expected point max for averaging the threshold (matches 0.36pts for 4.3)
        }
    }

    if (player.element_type === 1) {
        // Goalkeeper
        let cappedCS = player.clean_sheets_per_90 !== undefined ? Math.min(1.0, player.clean_sheets_per_90) : 0;
        let cleanSheetPointsPer90 = cappedCS !== 0 ? cappedCS * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let savePointsPer90 = player.saves_per_90 !== undefined && player.saves_per_90 !== 0 ? player.saves_per_90 * (threeShotsSavedPoints / 3) : 0;
        expectedPoints += savePointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? parseFloat(player.expected_goals_conceded_per_90) / 2 : 0;
        expectedPoints -= goalsConcededPointsPer90;
    
        let penaltiesSavedPer90 = player.penalties_saved !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_saved / (player.minutes / 90) : 0;
        let penaltySavePointsPer90 = penaltiesSavedPer90 * penaltySavedPoints;
        expectedPoints += penaltySavePointsPer90;
    
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsGK : 0;
        expectedPoints += goalPointsPer90;
    }
    
    if (player.element_type === 2) {
        // Defender
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsDEF : 0;
        expectedPoints += goalPointsPer90;
    
        let cappedCS = player.clean_sheets_per_90 !== undefined ? Math.min(1.0, player.clean_sheets_per_90) : 0;
        let cleanSheetPointsPer90 = cappedCS !== 0 ? cappedCS * cleanSheetPoints : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        let goalsConcededPointsPer90 = player.expected_goals_conceded_per_90 !== undefined && player.expected_goals_conceded_per_90 !== 0 ? parseFloat(player.expected_goals_conceded_per_90) / 2 : 0;
        expectedPoints -= goalsConcededPointsPer90;
    }
    
    if (player.element_type === 3) {
        // Midfielder
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsMID : 0;
        expectedPoints += goalPointsPer90;
    
        let cappedCS = player.clean_sheets_per_90 !== undefined ? Math.min(1.0, player.clean_sheets_per_90) : 0;
        let cleanSheetPointsPer90 = cappedCS !== 0 ? cappedCS * cleanSheetPointsMID : 0;
        expectedPoints += cleanSheetPointsPer90;
    
        correctPenaltiesOrder_v1(player, allPlayers);
    
        let penaltiesMissedPer90 = player.penalties_missed !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_missed / (player.minutes / 90) : 0;
        let penaltyMissPointsPer90 = penaltiesMissedPer90 * penaltyMissPointsDeduction;
        expectedPoints -= penaltyMissPointsPer90;
    }
    
    if (player.element_type === 4) {
        // Forward
        let goalPointsPer90 = player.expected_goals_per_90 !== undefined && player.expected_goals_per_90 !== 0 ? parseFloat(player.expected_goals_per_90) * goalPointsFWD : 0;
        expectedPoints += goalPointsPer90;
    
        correctPenaltiesOrder_v1(player, allPlayers);
    
        let penaltiesMissedPer90 = player.penalties_missed !== undefined && player.minutes !== undefined && player.minutes !== 0 ? player.penalties_missed / (player.minutes / 90) : 0;
        let penaltyMissPointsPer90 = penaltiesMissedPer90 * penaltyMissPointsDeduction;
        expectedPoints -= penaltyMissPointsPer90;
    }

    let lastFiveData = getLastFive_v1(player, fixture);
    if(lastFiveData.averagePoints > 0 && lastFiveData.count > 0) {
        // Form weight is scaled by total minutes played in those games (max 450 mins = 50% weight)
        // A single 90-min game = 10% weight. Five 20-min cameos = 11% weight. A single 15-min cameo = 1.6% weight.
        let formWeight = (lastFiveData.totalMinutes / 450) * 0.5;
        formWeight = Math.max(0, Math.min(0.5, formWeight)); // Cap at 50%
        
        expectedPoints = (expectedPoints * (1 - formWeight)) + (lastFiveData.averagePoints * formWeight);
    }

    // Incorporate chance of playing
    let chanceOfPlaying = 100;
    let chanceOverridden = false;
    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) {
        chanceOfPlaying = player.chance_of_playing_next_round;
    } else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) {
        chanceOfPlaying = player.chance_of_playing_this_round;
    }
    
    // Project post-injury chance of playing for future fixtures
    if (chanceOfPlaying === 0 && player.news && player.news.includes("Expected back") && fixture && fixture.kickoff_time) {
        let match = player.news.match(/Expected back (\d{1,2}\s+[A-Za-z]+)/);
        if (match && match[1]) {
            let currentYear = new Date().getFullYear();
            let expectedBackDate = new Date(`${match[1]} ${currentYear}`);
            
            // Handle year wrap around (e.g. injured in Dec, expected back in Jan)
            if (!isNaN(expectedBackDate) && expectedBackDate < new Date(new Date().setMonth(new Date().getMonth() - 6))) {
                 expectedBackDate.setFullYear(currentYear + 1);
            }
            
            let fixtureDate = new Date(fixture.kickoff_time);
            
            if (!isNaN(fixtureDate) && fixtureDate >= expectedBackDate) {
                let daysPostReturn = (fixtureDate - expectedBackDate) / (1000 * 60 * 60 * 24);
                
                // Base cautious chance: 50%
                let projectedChance = 50; 
                
                // 1. Adjust based on how far past their return date this fixture is (+33% per week)
                projectedChance += (daysPostReturn / 7) * 33;
                
                // 2. Adjust based on FPL Price (proxy for First Team importance)
                let cost = player.now_cost / 10;
                if (cost >= 7.0) projectedChance += 25; // Premium: Fast-tracked
                else if (cost >= 5.5) projectedChance += 10; // Mid: Likely starter
                else if (cost <= 4.5) projectedChance -= 15; // Budget: Unlikely to rush
                
                // 3. Cap max projected chance to 85% to maintain uncertainty
                chanceOfPlaying = Math.max(0, Math.min(85, projectedChance));
                chanceOverridden = true;
            }
        }
    }
    
    // Regress to mean for small sample sizes (less than 3 full games played) to prevent early-season anomalies
    if (player.minutes !== undefined && player.minutes < 270) {
        let weight = player.minutes / 270;
        
        // Use price as a proxy for expected performance baseline early in the season
        let cost = player.now_cost / 10;
        let baseline = cost * 0.65;
        
        // Adjust price scaling based on position because a 7.0m DEF is equivalent to a 10.0m+ MID
        if (player.element_type === 1) { // GK
            // GKs range 4.0 to 5.5. A 5.5m GK is premium.
            baseline = 3.0 + ((cost - 4.0) * 0.8);
        } else if (player.element_type === 2) { // DEF
            // DEFs range 4.0 to 7.5. A 7.0m DEF is hyper premium.
            baseline = 2.5 + ((cost - 4.0) * 0.8); 
        } else if (player.element_type === 3) { // MID
            // MIDs range 4.5 to 13.0+.
            baseline = 2.0 + ((cost - 4.5) * 0.6);
        } else if (player.element_type === 4) { // FWD
            // FWDs range 4.5 to 15.0+.
            baseline = 2.0 + ((cost - 4.5) * 0.55);
        }
        
        // Blend with team-position average if available (e.g. average points per 90 of Arsenal DEFs)
        if (typeof allPlayers !== 'undefined') {
            let teamPosStarters = allPlayers.filter(p => p.team === player.team && p.element_type === player.element_type && p.id !== player.id && p.minutes > 270);
            if (teamPosStarters.length > 0) {
                // Construct a positional baseline that heavily weights team-wide defensive/attacking form, 
                // but dampens individual anomalies (like Gabriel's set piece goals) for new players.
                let avgPtsPer90 = teamPosStarters.reduce((sum, p) => {
                    let pts = 2.0; // Starting points
                    let xG = parseFloat(p.expected_goals_per_90) || 0;
                    let xA = parseFloat(p.expected_assists_per_90) || 0;
                    let xGC = parseFloat(p.expected_goals_conceded_per_90) || 0;
                    
                    if (p.element_type === 1 || p.element_type === 2) {
                        // DEF/GK: heavily prioritize xGC (Clean Sheets), dampen xG/xA by 50%
                        pts += (xG * 6 * 0.5) + (xA * 3 * 0.5);
                        let csProb = Math.max(0, 1 - (xGC / 1.5)); // rough estimate of CS prob
                        pts += (csProb * 4);
                    } else if (p.element_type === 3) {
                        // MID: prioritize xG/xA, standard CS weight
                        pts += (xG * 5) + (xA * 3);
                        let csProb = Math.max(0, 1 - (xGC / 1.5));
                        pts += (csProb * 1);
                    } else {
                        // FWD: purely xG/xA
                        pts += (xG * 4) + (xA * 3);
                    }
                    
                    // Add standard bonus/bps baseline
                    pts += 0.5;
                    return sum + pts;
                }, 0) / teamPosStarters.length;
                
                // Blend 50/50 with the original Price Proxy baseline
                baseline = (baseline * 0.5) + (avgPtsPer90 * 0.5);
            }
        }
        
        // If FPL model explicitly predicts this player will blank (e.g., bench warmer, injured), trust it
        let fplPred = parseFloat(player.ep_next);
        
        if (!chanceOverridden && !isNaN(fplPred) && fplPred < 1.0) {
            baseline = fplPred;
        } else if (!chanceOverridden && !isNaN(fplPred) && player.minutes === 0) {
            // For brand new players who haven't played a minute, blend price baseline with FPL prediction
            baseline = (baseline * 0.5) + (fplPred * 0.5);
        } else if (lastFiveData.count > 0 && lastFiveData.averagePoints !== undefined) {
            // Blend recent form into the baseline based on minutes played
            baseline = (baseline * ((270 - player.minutes) / 270)) + (lastFiveData.averagePoints * (player.minutes / 270));
        }
        
        expectedPoints = (expectedPoints * weight) + (baseline * (1 - weight));
    }
    
    // Apply Fixture Difficulty Multiplier and Pulse Live Standings Blend
    if (fixture) {
        let fdr = 3;
        if (player.team === fixture.team_h) fdr = fixture.team_h_difficulty;
        else if (player.team === fixture.team_a) fdr = fixture.team_a_difficulty;
        
        let fdrMultiplier = 1.0;
        if (fdr === 1) fdrMultiplier = 1.30;
        else if (fdr === 2) fdrMultiplier = 1.15;
        else if (fdr === 3) fdrMultiplier = 1.00;
        else if (fdr === 4) fdrMultiplier = 0.85;
        else if (fdr === 5) fdrMultiplier = 0.70;
        
        let oppTeamId = (player.team === fixture.team_h) ? fixture.team_a : fixture.team_h;
        
        // Calculate dynamic opponent stats from underlying player data (xGC and xG)
        let oppGks = allPlayers.filter(p => p.team === oppTeamId && p.element_type === 1);
        let oppMins = oppGks.reduce((sum, gk) => sum + (gk.minutes || 0), 0);
        
        if (oppMins > 0) {
            let oppXGC = oppGks.reduce((sum, gk) => sum + (parseFloat(gk.expected_goals_conceded) || 0), 0) / (oppMins / 90);
            
            let oppOutfielders = allPlayers.filter(p => p.team === oppTeamId && p.element_type !== 1);
            // Rough approximation of team xG by summing outfielders
            // (Note: FPL outfielders' xG is individual, so we just sum them to get total team xG)
            let oppXG = oppOutfielders.reduce((sum, p) => sum + (parseFloat(p.expected_goals) || 0), 0) / (oppMins / 90);

            let dynamicMultiplier = 1.0;
            if (player.element_type === 1 || player.element_type === 2) {
                // GK/DEF: We care about Opponent's xG (how lethal are they?)
                dynamicMultiplier = 1.0 + (1.5 - oppXG) * 0.3; 
            } else {
                // MID/FWD: We care about Opponent's xGC (how leaky are they?)
                dynamicMultiplier = 1.0 + (oppXGC - 1.5) * 0.3;
            }
            
            // Bound multiplier to sane limits
            dynamicMultiplier = Math.max(0.70, Math.min(1.30, dynamicMultiplier));
            
            // Blend FDR with our dynamic underlying stats multiplier (50/50 early on)
            fdrMultiplier = (dynamicMultiplier * 0.5) + (fdrMultiplier * 0.5);
        }

        let finalMultiplier = fdrMultiplier;

        // Try to fetch Pulse Live Standings to blend real-time stats
        if (typeof pulseStandings !== 'undefined' && pulseStandings && pulseStandings.tables && typeof teams !== 'undefined') {
            let oppTeamId = (player.team === fixture.team_h) ? fixture.team_a : fixture.team_h;
            let oppTeamFPL = teams.find(t => t.id === oppTeamId);
            
            if (oppTeamFPL) {
                let oppPulseEntry = pulseStandings.tables[0].entries.find(e => e.team.name === oppTeamFPL.name || e.team.club.abbr === oppTeamFPL.short_name);
                
                if (oppPulseEntry) {
                    // Check if opponent is playing Home or Away this fixture
                    let oppStats = (player.team === fixture.team_h) ? oppPulseEntry.away : oppPulseEntry.home;
                    
                    if (oppStats && oppStats.played >= 3) {
                        let pulseMultiplier = 1.0;
                        if (player.element_type === 1 || player.element_type === 2) {
                            // GK/DEF: We care about Opponent's Goals FOR (how lethal are they?)
                            let oppGF = oppStats.goalsFor / oppStats.played;
                            pulseMultiplier = 1.0 + (1.5 - oppGF) * 0.3; 
                        } else {
                            // MID/FWD: We care about Opponent's Goals AGAINST (how leaky are they?)
                            let oppGA = oppStats.goalsAgainst / oppStats.played;
                            pulseMultiplier = 1.0 + (oppGA - 1.5) * 0.3;
                        }
                        
                        // Bound multiplier to sane limits
                        pulseMultiplier = Math.max(0.70, Math.min(1.30, pulseMultiplier));
                        
                        // 60% Pulse Live real-time stats, 40% FPL FDR
                        finalMultiplier = (pulseMultiplier * 0.6) + (fdrMultiplier * 0.4);
                    }
                }
            }
        }
        
        expectedPoints = expectedPoints * finalMultiplier;
    }

    // Blend with FPL's ep_next at 15% weight to smooth outliers without dragging down our aggressive model too much
    const fplPredFinal = parseFloat(player.ep_next);
    if (!chanceOverridden && !isNaN(fplPredFinal) && fplPredFinal > 0) {
        expectedPoints = (expectedPoints * 0.85) + (fplPredFinal * 0.15);
    }
    
    // Add bump to overall team expected points to reach ~60 average
    // Apply this AFTER the FPL blend so the conservative FPL score doesn't undo the bump
    expectedPoints = expectedPoints * 1.25;
    
    // Determine a dynamic "Starter Confidence" probability for rotation risks
    let startProb = 1.0;
    if (typeof allPlayers !== 'undefined') {
        let teammates = allPlayers.filter(p => p.team === player.team);
        let maxStarts = Math.max(...teammates.map(p => p.starts || 0), 1);
        let startPercentage = (player.starts || 0) / maxStarts;
        
        let form = parseFloat(player.form) || 0;
        let selected = parseFloat(player.selected_by_percent) || 0;
        
        // Boost start probability if they have elite form or high ownership (e.g. nailed new signings)
        if (form >= 6.0 || selected >= 15.0) {
            startProb = Math.max(startPercentage, 0.9);
        } else if (form >= 3.0 || selected >= 5.0) {
            startProb = Math.max(startPercentage, 0.7);
        } else {
            startProb = startPercentage;
        }
        
        // Soften the penalty so we don't completely tank rotation players, just slightly downgrade
        startProb = Math.max(0.2, Math.pow(startProb, 0.5));
    }
    
    let truePlayProb = (chanceOfPlaying / 100) * startProb;
    expectedPoints = expectedPoints * truePlayProb;
    
    return expectedPoints;
}

function getLastFive_v1(player, fixture) {
    const playerName = player.first_name + " " + player.second_name;
    
    if (!db) return { averagePoints: 0, count: 0, totalMinutes: 0 };

    const overallQuery = `
        SELECT total_points, minutes 
        FROM fpl_data 
        WHERE name = $name AND minutes >= 10 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const overallStmt = db.prepare(overallQuery);
    overallStmt.bind({$name: playerName});
    
    let overallCount = 0;
    let overallPoints = 0;
    let overallMinutes = 0;
    while(overallStmt.step()) {
        const row = overallStmt.get();
        overallPoints += parseFloat(row[0]);
        let mins = parseInt(row[1] || 0);
        if (mins >= 70) mins = 90; // Treat 70+ mins as a full game
        overallMinutes += mins;
        overallCount++;
    }
    overallStmt.free();

    let averagePoints = 0;
    if (overallCount > 0) {
        averagePoints = overallPoints / overallCount;
    }

    if (!fixture) {
        return { averagePoints, count: overallCount, totalMinutes: overallMinutes };
    }

    const opponentTeam = getOpponentTeam(player.team, fixture);

    const fixtureQuery = `
        SELECT total_points, kickoff_time 
        FROM fpl_data 
        WHERE name = $name AND opp_team_name = $opp AND minutes >= 10 
        ORDER BY kickoff_time DESC 
        LIMIT 5
    `;
    const fixtureStmt = db.prepare(fixtureQuery);
    fixtureStmt.bind({$name: playerName, $opp: opponentTeam});
    
    let fixtureCount = 0;
    let fixturePoints = 0;
    const twoYearsAgo = new Date().getTime() - (2 * 365 * 24 * 60 * 60 * 1000); // 2 years ago in ms
    
    while(fixtureStmt.step()) {
        const row = fixtureStmt.get();
        const pts = parseFloat(row[0]);
        const matchTime = new Date(row[1]).getTime();
        
        // Only count historical opponent fixtures if they occurred within the last 2 years
        if (!isNaN(matchTime) && matchTime > twoYearsAgo) {
            fixturePoints += pts;
            fixtureCount++;
        }
    }
    fixtureStmt.free();

    if (overallCount > 0 && fixtureCount > 0) {
        // Bump opponent specific weight to 50% (was 30%)
        averagePoints = ((overallPoints / overallCount) * 0.5) + ((fixturePoints / fixtureCount) * 0.5);
    }
    
    return { averagePoints, count: overallCount, totalMinutes: overallMinutes };
}

function correctPenaltiesOrder_v1(player, allPlayers) {

    if (!player.penalties_order) {
        return;
    }

    // Step 1: Filter out players belonging to the same team as the input player
    const teamPlayers = allPlayers.filter(p => p.team === player.team);

    // Step 2: Filter players with non-null, non-zero, and non-empty string penalties_order
    const playersWithPenalties = teamPlayers.filter(p => 
        p.penalties_order !== null && 
        p.penalties_order !== 0 && 
        p.penalties_order !== ""
    );

    // Step 3: Sort players by their penalties_order
    playersWithPenalties.sort((a, b) => a.penalties_order - b.penalties_order);

    // Step 4: Correct the penalties order
    playersWithPenalties.forEach((p, index) => {
        p.penalties_order = index + 1; // Reassign penalties_order starting from 1
    });

    // Update pen order
    player.penalties_order = playersWithPenalties.find(_ => _.id === player.id).penalties_order;
}
