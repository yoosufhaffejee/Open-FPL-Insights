const pitchPositionMap = { 1: 'gk', 2: 'def', 3: 'mid', 4: 'fwd' };
let bankBalance = 100;
let myPlayers = [];
let filteredPlayers = [];
let managerPicks = [];
let currentLiveData = null;
let managerId = 0;
let rating = 0;
let points = 0;
let seasonPoints = 0;
let overallRating = 0;
let isPreviewMode = false;



function addPlayers(picks) {
    myPlayers = [];
    picks.forEach((pick, index) => {
        let basePlayer = allPlayers.find(p => p.id == pick.element);
        if (!basePlayer) return;
        
        let player = { ...basePlayer }; // Create a copy so we don't mutate the global object

        player.isCaptain = pick.is_captain;
        player.isVice = pick.is_vice_captain;

        if (pick.purchase_price !== undefined) player.purchase_price = pick.purchase_price;
        if (pick.selling_price !== undefined) player.selling_price = pick.selling_price;
        
        if (pick.purchase_value !== undefined) player.purchase_price = pick.purchase_value;
        if (pick.selling_value !== undefined) player.selling_price = pick.selling_value;

        if (index <= 10) {
            player.isSub = false;
        }
        else {
            player.isSub = true;
        }

        myPlayers.push(player);
    });

    updateTeamUI();
}

let selectedGameweek = 1;
const prevGameweekElement = document.getElementById('prevGameweek');

if (prevGameweekElement) {
    prevGameweekElement.addEventListener('click', () => {
        // Logic to go to the previous game week
        navigateGameweek('prev');
    });
} else {
    console.error('Element with ID "prevGameweek" does not exist.');
}

const nextGameweekElement = document.getElementById('nextGameweek');

if (nextGameweekElement) {
    nextGameweekElement.addEventListener('click', () => {
        // Logic to go to the next game week
        navigateGameweek('next');
    });
} else {
    console.error('Element with ID "nextGameweek" does not exist.');
}

// Function to handle next and previous gameweek navigation
async function navigateGameweek(direction) {
    // Update selectedGameweek based on direction
    if (direction === 'next') {
        selectedGameweek++;
    } else if (direction === 'prev') {
        selectedGameweek--;
    }

    // Ensure selectedGameweek is within valid range
    if (selectedGameweek < gameweeks[0].id) {
        selectedGameweek = gameweeks[gameweeks.length - 1].id;
    } else if (selectedGameweek > gameweeks[gameweeks.length - 1].id) {
        selectedGameweek = gameweeks[0].id;
    }

    // Update gameweek info and deadline
    await updateGameweekInfo();
}

// Function to update the gameweek info and deadline display
async function updateGameweekInfo() {
    const gameweekInfo = document.getElementById('gameweekInfo');

    if (!gameweekInfo) {
        return;
    }

    const gameweekDeadline = document.getElementById('gameweekDeadline');

    // Find the gameweek object for the current selected gameweek
    const currentGameweek = gameweeks.find(gw => gw.id === selectedGameweek);

    if (currentGameweek) {
        // Update the UI with the current gameweek info
        gameweekInfo.textContent = `Gameweek ${currentGameweek.id}`;
        gameweekDeadline.textContent = `Deadline: ${new Date(currentGameweek.deadline_time).toLocaleString()}`;
    }

    await calculateSeasonPoints();
    await getLatestPicks(currentGameweek.id);
}

async function getLatestPicks(gameweek) {
    currentLiveData = null;
    document.getElementById("points").hidden = true;

    if (managerId > 0) {
        let gwToFetch = gameweek <= getLastGameweekId() ? gameweek : getLastGameweekId();
        if (gwToFetch > 0) {
            managerPicks = await getManagerPicks(managerId, gwToFetch) || [];
            if (gameweek <= getLastGameweekId()) {
                currentLiveData = await getGameweek(gameweek);
            }
        } else {
            managerPicks = [];
        }
    } else {
        managerPicks = [];
    }

    if (!isPreviewMode) {
        if (managerPicks.picks) {
            addPlayers(managerPicks.picks);
        }
    } else {
        autoSelectStartingXI(gameweek);
        updateTeamUI();
    }

    rating = 0;
    points = 0;
    if (managerPicks.entry_history && gameweek <= getLastGameweekId() && !isPreviewMode) {
        document.getElementById("points").hidden = false;
        points = managerPicks.entry_history.points;
        updateTeamInfo("Points", points);
        rating = 100 - managerPicks.entry_history.percentile_rank;
        updateTeamInfo("GW Rating", rating + '%');
    }
    else
    {
        document.getElementById("points").hidden = true;
        rating = (predictedPoints / 70) * 100;
        updateTeamInfo("GW Rating", parseInt(rating) + '%');
    }
}

async function calculateSeasonPoints() {
    let seasonPoints = 0;
    let totalIdealPoints = 0;

    let history = null;
    if (managerId > 0) {
        history = await getManagerHistory(managerId);
    }

    for (let i = 0; i < gameweeks.length; i++) {
        const gw = gameweeks[i];
        let gwPoints = 0;

        let histEvent = history ? history.current.find(e => e.event === gw.id) : null;

        if (histEvent && histEvent.points > 0) {
            gwPoints += histEvent.points - histEvent.event_transfers_cost;
        }
        else if (gw.id >= getUpcomingGameweek().id) {
            myPlayers.forEach(player => {
                let fixture = getPlayerFixture(player, gw.id);
                player.predicted_points = calculatePlayerPredictedPoints(player, fixture, gw.id);
            });

            const bestPlayers = optimizeTeam(myPlayers);
            bestPlayers.forEach(player => {
                gwPoints += player.isCaptain ? (player.predicted_points * 2) : player.predicted_points;
            });
        }

        let maxIdeal = getIdealMaxPointsForGW(gw.id, calculatePlayerPredictedPoints, allPlayers, fixtures);
        
        seasonPoints += gwPoints;
        totalIdealPoints += maxIdeal;
    }

    let overallRating = Math.min(100, (seasonPoints / totalIdealPoints) * 100);
    updateTeamInfo('Overall Rating', Math.round(overallRating) + '%');
    updateTeamInfo('Season Points', parseInt(seasonPoints));
}

// Global object to track the number of players per position
const filledSlots = {
    gk: 0,
    def: 0,
    mid: 0,
    fwd: 0
};

// Define the maximum allowed players per position
const maxSlots = {
    gk: 2,  // Max 2 Goalkeepers
    def: 5, // Max 5 Defenders
    mid: 5, // Max 5 Midfielders
    fwd: 3  // Max 3 Forwards
};

// Track available slots by position
const availableSlots = {
    gk: ['pos1', 'pos2'],
    def: ['pos3', 'pos4', 'pos5', 'pos6', 'pos7'],
    mid: ['pos8', 'pos9', 'pos10', 'pos11', 'pos12'],
    fwd: ['pos13', 'pos14', 'pos15']
};

let predictedPoints = 0;

 // Function to update the team UI
function updateTeamUI() {
    // Clear existing players from rows
    document.querySelectorAll('.row').forEach(row => row.innerHTML = '');

    predictedPoints = 0;
    bankBalance = 100.0;
    if (managerId > 0 && managerPicks && managerPicks.entry_history) {
        let bank = managerPicks.entry_history.bank / 10;
        let originalCost = 0;
        if (managerPicks.picks) {
            managerPicks.picks.forEach(pick => {
                let p = allPlayers.find(x => x.id == pick.element);
                if (p) originalCost += p.now_cost / 10;
            });
        }
        bankBalance = bank + originalCost;
    }
    let subs = 0;
    const filledPositions = {
        gk: 0,
        def: 0,
        mid: 0,
        fwd: 0
    };

    // Track available slot indices per position
    const availableSlotsCopy = {
        gk: [...availableSlots.gk],
        def: [...availableSlots.def],
        mid: [...availableSlots.mid],
        fwd: [...availableSlots.fwd]
    };

    // Iterate through each player and update the UI
    myPlayers.forEach(player => {
        const positionPrefix = pitchPositionMap[player.element_type];
        filledPositions[positionPrefix]++;
        if (player.isSub) subs++;

        // Assign a slot ID to the player
        assignSlotId(player, availableSlotsCopy);

        // Render the player element
        const playerElement = renderPlayerElement(player);

        // Determine the row based on the player's type and status
        const rowId = player.isSub ? 'subs' : getRowIdForElementType(player.element_type);

        // Append the player element to the appropriate row
        const row = document.getElementById(rowId);
        appendPlayerToRow(row, playerElement, player);

        // Update fixtures and predicted points
        predictedPoints = updatePlayerFixturesAndPoints(playerElement, player, predictedPoints);

        // Setup player actions (like swapping, removing, etc.)
        setupPlayerActions(playerElement, player);

        // Update bank balance
        bankBalance -= player.now_cost / 10;
        if (selectedGameweek >= getUpcomingGameweek().id) {
            updateTeamInfo("Bank Balance", `${bankBalance.toFixed(1)}m`);
        }
        updateTeamInfo("Predicted Points", (predictedPoints !== '?' ? Number(predictedPoints).toFixed(0) : '?'));
    });

    // Handle missing players/ghost players
    fillMissingPlayers(filledPositions, subs);

    document.querySelectorAll('.row').forEach(row => {
        row.style.gridTemplateColumns = `repeat(${row.children.length}, 1fr)`;
    });
}

// Function to assign the next available slot to the player
function assignSlotId(player, availableSlotsCopy) {
    const positionPrefix = pitchPositionMap[player.element_type];
    if (!player.slotId) {
        player.slotId = availableSlotsCopy[positionPrefix].shift(); // Assign next available slot and remove from list
    }
}

// Function to render the HTML for the player element
function renderPlayerElement(player) {
    const playerElement = document.createElement('div');
    playerElement.className = 'player';
    playerElement.id = `player-${player.slotId}`;

    const isGK = player.element_type === 1;
    const shirtUrl = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.team_code}${isGK ? '_1' : ''}-110.webp`;
    const image = `<img src="${shirtUrl}" alt="${player.web_name}" onerror="playerImgOnerror(this, ${player.team_code}, ${player.element_type})">`;

    let priceDisplay = `£${(player.now_cost / 10).toFixed(1)}`;
    if (player.selling_price !== undefined && player.purchase_price !== undefined) {
        let cp = (player.now_cost / 10).toFixed(1);
        let sp = (player.selling_price / 10).toFixed(1);
        let pp = (player.purchase_price / 10).toFixed(1);
        if (sp !== cp || pp !== cp) {
            priceDisplay = `<span title="Current: £${cp}m | Bought: £${pp}m">£${sp}</span>`;
        }
    } else if (player.selling_price !== undefined) {
        priceDisplay = `£${(player.selling_price / 10).toFixed(1)}`;
    }

    playerElement.innerHTML = `
        ${image}
        <div class="player-info-card">
            <div class="player-header">
                <span class="player-name">${player.web_name} ${player.isCaptain ? '(C)' : player.isVice ? '(V)' : ''}</span>
                <span class="player-price">${priceDisplay}</span>
            </div>
            <div class="fixtures">
                ${Array.from({ length: 3 }, (_, i) => `
                    <div class="fixture">
                        <span class="predicted-points">0</span>
                        <span class="fixture-detail">FIX (H)</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="icon-buttons">
            <button class="icon-button"><i class="fas fa-exchange-alt"></i></button>
            <button class="icon-button"><i class="fas fa-trash"></i></button>
            <button class="icon-button"><i class="fas fa-crown ${player.isCaptain ? 'captain' : ''}"></i></button>
            <button class="icon-button"><i class="fas fa-star ${player.isVice ? 'vice' : ''}"></i></button>
            <button class="icon-button"><i class="fas fa-info-circle"></i></button>
        </div>
    `;

    return playerElement;
}

// Function to append the player to the correct row
function appendPlayerToRow(row, playerElement, player) {
    if (row) {
        if (player.isSub) {
            row.children[0].appendChild(playerElement);
        } else {
            row.appendChild(playerElement);
        }
    }
}

// Function to update player fixtures and predicted points
function updatePlayerFixturesAndPoints(playerElement, player, predictedPoints) {
    const upcomingGameweeks = gameweeks.filter(gw => gw.id >= selectedGameweek).slice(0, 3);

    playerElement.querySelectorAll('.fixture').forEach((fixtureElement, fixtureIndex) => {
        const upcomingGameweek = upcomingGameweeks[fixtureIndex];
        if (upcomingGameweek) {
            
            const playerFixture = getPlayerFixture(player, upcomingGameweek.id);
            if (playerFixture) {
                const opponentTeam = teams.find(team =>
                    team.id === (playerFixture.team_a === player.team ? playerFixture.team_h : playerFixture.team_a)
                );

                const isAway = playerFixture.team_a === player.team;
                const haText = isAway ? 'A' : 'H';
                const haClass = isAway ? 'ha-away' : 'ha-home';
                fixtureElement.querySelector('.fixture-detail').innerHTML = `${opponentTeam.short_name}<br><span class="${haClass}">(${haText})</span>`;
                
                const difficulty = isAway ? playerFixture.team_a_difficulty : playerFixture.team_h_difficulty;
                let diffClass = '';
                if (difficulty <= 2) diffClass = 'diff-easy';
                else if (difficulty === 3) diffClass = 'diff-avg';
                else if (difficulty === 4) diffClass = 'diff-hard';
                else if (difficulty >= 5) diffClass = 'diff-vhard';
                fixtureElement.className = 'fixture ' + diffClass;

                let playerPredictedPoints = calculatePlayerPredictedPoints(player, playerFixture, upcomingGameweek);

                // If it's the current gameweek and we have live data, show actual points
                let actualPoints = null;
                if (fixtureIndex === 0 && currentLiveData && currentLiveData.elements) {
                    let livePlayer = currentLiveData.elements.find(e => e.id === player.id);
                    if (livePlayer) {
                        let multiplier = 1;
                        if (managerPicks && managerPicks.picks) {
                            let pick = managerPicks.picks.find(p => p.element === player.id);
                            if (pick) multiplier = pick.multiplier;
                        }
                        actualPoints = livePlayer.stats.total_points * multiplier;
                    }
                }
                
                let valToColor = actualPoints !== null ? actualPoints : (playerPredictedPoints !== '?' ? parseFloat(playerPredictedPoints) : '?');
                let ptsClass = '';
                if (valToColor !== '?') {
                    if (player.element_type === 1 || player.element_type === 2) {
                        if (valToColor > 5.5) ptsClass = 'pts-elite';
                        else if (valToColor >= 4.0) ptsClass = 'pts-good';
                        else if (valToColor >= 2.5) ptsClass = 'pts-avg';
                        else ptsClass = 'pts-bad';
                    } else {
                        if (valToColor > 6.5) ptsClass = 'pts-elite';
                        else if (valToColor >= 4.5) ptsClass = 'pts-good';
                        else if (valToColor >= 3.0) ptsClass = 'pts-avg';
                        else ptsClass = 'pts-bad';
                    }
                }
                
                const ptsElem = fixtureElement.querySelector('.predicted-points');

                if (actualPoints !== null) {
                    ptsElem.textContent = actualPoints;
                    ptsElem.style.fontWeight = 'bold'; // Emphasize it's actual
                } else {
                    ptsElem.textContent = playerPredictedPoints === '?' ? '?' : playerPredictedPoints.toFixed(1);
                    ptsElem.style.fontWeight = 'normal';
                }
                ptsElem.className = 'predicted-points ' + ptsClass;

                if (fixtureIndex === 0 && !player.isSub) {
                    if (playerPredictedPoints !== '?') predictedPoints += playerPredictedPoints;
                }
            }
        }
    });

    return predictedPoints;
}

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

function fillMissingPlayers(filledPositions, subs) {
    // Define total players and substitutes
    const totalPlayers = 15;
    const numOfSubs = 4;
    const numOfOnFieldPlayers = totalPlayers - numOfSubs;

    // Calculate the number of players needed for each position
    const positions = ['gk', 'def', 'mid', 'fwd'];
    const missingPlayers = {};

    positions.forEach(pos => {
        missingPlayers[pos] = maxSlots[pos] - filledPositions[pos];
    });

    // Fill subs to ensure 4 substitutes, including 1 goalkeeper
    let remainingSubs = numOfSubs - subs;
    let remainingOnFieldPlayers = numOfOnFieldPlayers + subs - (filledPositions.gk + filledPositions.def + filledPositions.mid + filledPositions.fwd);

    // Generate list of players to add
    const playersToAdd = [];
    
    let count = 0;
    // Add remaining missing players as substitutes
    while (remainingSubs) {
        positions.forEach(pos => {
            const isMissing = missingPlayers[pos] > 0;
            if (isMissing && remainingSubs > 0) {
                const addToSubs = Math.min(1, remainingSubs);
                playersToAdd.push(...Array(addToSubs).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: true }));
                remainingSubs -= addToSubs;
                missingPlayers[pos] -= addToSubs;
            }
        });

        count++;
        if (count > 15) {
            break;
        }
    }

    // Add missing players to the field if there are still positions available
    positions.forEach(pos => {
        const missing = missingPlayers[pos];
        if (missing > 0 && remainingOnFieldPlayers > 0) {
            const addToField = Math.min(missing, remainingOnFieldPlayers);
            playersToAdd.push(...Array(addToField).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: false }));
            remainingOnFieldPlayers -= addToField;
            missingPlayers[pos] -= addToField;
        }
    });

    // Add empty placeholders if needed
    const maxPlayersPerPosition = {
        gk: maxSlots.gk - filledPositions.gk,
        def: maxSlots.def - filledPositions.def,
        mid: maxSlots.mid - filledPositions.mid,
        fwd: maxSlots.fwd - filledPositions.fwd
    };

    const fillPlaceholders = {
        gk: Math.max(0, maxPlayersPerPosition.gk),
        def: Math.max(0, maxPlayersPerPosition.def),
        mid: Math.max(0, maxPlayersPerPosition.mid),
        fwd: Math.max(0, maxPlayersPerPosition.fwd)
    };

    // Adjust for the total number of placeholders to fill
    const totalPlaceholders = {
        gk: fillPlaceholders.gk,
        def: fillPlaceholders.def,
        mid: fillPlaceholders.mid,
        fwd: fillPlaceholders.fwd,
        subs: numOfSubs - subs
    };

    if (playersToAdd.length > 0) {
        playersToAdd.forEach(player => {
            myPlayers.push(player);
        });
        updateTeamUI();
    }
    
    // Return the players to add and placeholders
    return {
        playersToAdd,
        totalPlaceholders
    };
}

// Helper function to determine the row ID based on player type
function getRowIdForElementType(elementType) {
    switch (elementType) {
        case 1: return 'goalkeepers';
        case 2: return 'defenders';
        case 3: return 'midfielders';
        case 4: return 'forwards';
        default: return 'subs'; // Default to subs if elementType is unknown
    }
}

playerSwap = [];

function setupPlayerActions(playerElement, player) {
    // Remove existing event listeners by cloning the node
    const newPlayerElement = playerElement.cloneNode(true);
    playerElement.replaceWith(newPlayerElement);

    // Set up captain button
    const captainButton = newPlayerElement.querySelector('.icon-button i.fa-crown').parentElement;
    if (captainButton) {
        captainButton.addEventListener('click', () => {
            captainPlayer(player);
        });
    }

    // Set up info button
    const infoButton = newPlayerElement.querySelector('.icon-button i.fa-info-circle').parentElement;
    if (infoButton) {
        infoButton.addEventListener('click', () => {
            showPlayerInfo(player);
        });
    }

    // Add other buttons' functionalities similarly
}

// Function to handle swap logic and queueing players for swap
function swapPlayer(player) {
    const index = myPlayers.findIndex(p => p.id === player.id);
    if (index === -1) return;

    // If no player is queued for swap, queue this player
    if (playerSwap.length === 0) {
        playerSwap.push(index);
        console.log(`Player at index ${index} queued for swap.`);
        return;
    }
    
    // If a player is already queued, swap with the currently queued player
    const index1 = playerSwap[0];
    const index2 = index;

    if (index1 === index2) {
        console.log('Cannot swap the same player.');
        removeSwapIndicator(index1); // Remove visual indicator if the same player is clicked twice
        playerSwap = [];
        return;
    }

    const player1 = myPlayers[index1];
    const player2 = myPlayers[index2];

    // Find the rows of the players
    const row1 = player1.isSub ? 'subs' : getRowForPlayer(player1);
    const row2 = player2.isSub ? 'subs' : getRowForPlayer(player2);

    // Allow swap if players are in the same row or one is a sub and the other is not
    if (row1 === row2 || (player1.isSub && !player2.isSub) || (!player1.isSub && player2.isSub)) {
        // Perform the swap in the array
        [myPlayers[index1], myPlayers[index2]] = [myPlayers[index2], myPlayers[index1]];

        // Swap the isSub status as well
        [myPlayers[index1].isSub, myPlayers[index2].isSub] = [myPlayers[index2].isSub, myPlayers[index1].isSub];

        // Recalculate the field and subs after swap
        const fieldPlayers = myPlayers.filter(player => !player.isSub);
        const playerCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // Count players of each type currently on the field
        fieldPlayers.forEach(player => {
            playerCounts[player.element_type]++;
        });

        const minConstraints = { 1: 1, 2: 3, 3: 2, 4: 1 };
        const maxConstraints = { 1: 1, 2: 5, 3: 5, 4: 3 };

        // Check for min and max constraints
        for (const type in playerCounts) {
            if (playerCounts[type] < minConstraints[type] || playerCounts[type] > maxConstraints[type]) {
                console.log('Invalid swap: This swap would violate formation constraints.');
                alert('Swap failed: Formation constraints violated.');
                // Swap back to original positions if constraints are violated
                [myPlayers[index1], myPlayers[index2]] = [myPlayers[index2], myPlayers[index1]];
                [myPlayers[index1].isSub, myPlayers[index2].isSub] = [myPlayers[index2].isSub, myPlayers[index1].isSub];
                removeSwapIndicator(index1); // Remove swap indicator
                removeSwapIndicator(index2);
                playerSwap = [];
                return;
            }
        }

        document.getElementById('saveButton').disabled = false;

        // After swapping, update the UI to reflect the new positions and statuses
        updateTeamUI();
        console.log(`Players swapped successfully between positions ${index1} and ${index2}.`);

        // Remove swap indicators after the swap is successful
        removeSwapIndicator(index1);
        removeSwapIndicator(index2);
        playerSwap = [];
    } else {
        console.log('Invalid swap: Players are not in the same row or cannot be swapped.');
        alert('Swap failed: Players are not in the same row or cannot be swapped.');
        removeSwapIndicator(index1); // Remove swap indicator
        removeSwapIndicator(index2);
        playerSwap = [];
    }
}

function setManager() {
    // Disable the button
    document.getElementById('setManagerButton').disabled = true;

    // Save the cookie
    document.cookie = `managerId=${managerId}; path=/; max-age=31536000`; // Cookie expires in 1 year
}

// Function to remove swap visual indicator
function removeSwapIndicator(index) {
    const playerElement = document.getElementById(`player-${myPlayers[index].slotId}`);
    if (playerElement) {
        playerElement.classList.remove('swap-queued');
    }
}

// Function to determine the row for a player
function getRowForPlayer(player) {
    if (player.element_type === 1) return 'goalkeepers';
    if (player.element_type === 2) return 'defenders';
    if (player.element_type === 3) return 'midfielders';
    if (player.element_type === 4) return 'forwards';
    return 'subs'; // Default case, should not be used for on-field players
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

async function Initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    let entryId = urlParams.get('entry');
    if (!entryId) {
        const match = document.cookie.match(new RegExp('(^| )managerId=([^;]+)'));
        if (match) entryId = match[2];
    }
    if (entryId) managerId = parseInt(entryId, 10);
    else alert('No player ID provided.');

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
    filteredPlayers = allPlayers;

    selectedGameweek = getLastGameweekId();
    await updateGameweekInfo();
}

// Function to fetch and show player info
function showPlayerInfo(player) {
    getPlayer(player.id)
        .then(response => {
            // Populate the modal with the player info
            populatePlayerModal(response, player);
            // Show the modal
            const playerInfoModal = new bootstrap.Modal(document.getElementById('playerInfoModal'));
            playerInfoModal.show();
        })
        .catch(error => console.log('Error fetching player info:', error));
}

// Function to populate the modal with player data
function populatePlayerModal(data, player) {
    // Set the player name in the modal title    // 1. Header with Photo & Key Stats
    document.getElementById('playerInfoModalLabel').innerHTML = `
        <div class="d-flex align-items-center gap-3 w-100">
            <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" 
                 style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; background: #eee;" 
                 onerror="playerImgOnerror(this, ${player.team_code})">
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
        if (player.isCaptain && predictedPoints !== undefined) {
            predictedPoints = predictedPoints / 2;
        }

        ourPredictedElem.textContent = (predictedPoints !== undefined && predictedPoints !== '?') ? Number(predictedPoints).toFixed(1) : (predictedPoints === '?' ? '?' : '0.0');
        ourPredictedElem.style.color = '#333';
        ourPredictedElem.style.textShadow = 'none';
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
function copyPlayers() {
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
    
    alert('Team copied to your main Team view for Gameweek ' + selectedGameweek + '!');
}


function applyTransfer(suggestion) {
    // Close modal
    const modalEl = document.getElementById('suggestedTransfersModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Remove outs and add ins
    suggestion.outs.forEach(pOut => {
        const idx = myPlayers.findIndex(p => p.id === pOut.id);
        if (idx !== -1) {
            myPlayers[idx] = {
                web_name: 'Player',
                now_cost: 0,
                element_type: pOut.element_type,
                isSub: myPlayers[idx].isSub,
                slotId: myPlayers[idx].slotId,
                isCaptain: false,
                isVice: false
            };
        }
    });

    suggestion.ins.forEach(inId => {
        const pIn = allPlayers.find(p => p.id === inId);
        if (pIn) {
            // Find a placeholder in myPlayers of the same element_type and replace it
            const placeholderIdx = myPlayers.findIndex(p => p.element_type === pIn.element_type && p.now_cost === 0);
            if (placeholderIdx !== -1) {
                const placeholder = myPlayers[placeholderIdx];
                myPlayers[placeholderIdx] = { ...pIn, isSub: placeholder.isSub, slotId: placeholder.slotId, isCaptain: false, isVice: false };
            } else {
                myPlayers.push({ ...pIn, isSub: true, isCaptain: false, isVice: false });
            }
        }
    });

    updateTeamUI();
}

function openSuggestedTransfersModal() {
    const modalContent = document.getElementById('suggestedTransfersContent');
    modalContent.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-success mb-3" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
            <p class="text-muted mb-0">Analysing your squad over the next 5 gameweeks...</p>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('suggestedTransfersModal'));
    modal.show();

    setTimeout(() => {
        try {
            let currentTeamIds = myPlayers.filter(p => p.now_cost > 0).map(p => p.id);
            if (currentTeamIds.length === 0) {
                modalContent.innerHTML = '<p class="text-warning p-3">Please add players to your team first.</p>';
                return;
            }

            let suggestions = calculateSuggestedTransfers(currentTeamIds, allPlayers, fixtures, selectedGameweek, bankBalance);

            if (suggestions.length === 0) {
                modalContent.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                        <h5 class="text-white mb-2">Hold Your Transfers</h5>
                        <p class="text-muted">No transfers are currently worth making. Roll your free transfer — your squad looks strong for the next 5 gameweeks.</p>
                    </div>
                `;
                return;
            }

            const positionLabels = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

            let html = `<div class="transfer-list d-flex flex-column gap-3 pb-2">`;

            suggestions.forEach((s, idx) => {
                const isHit = s.type > 1;
                const hitPoints = (s.type - 1) * 4;
                const typeLabel = s.type === 1 ? 'Free Transfer' : s.type === 2 ? '2 Transfers' : '3 Transfers';
                const typeBadgeCls = s.type === 1 ? 'bg-success' : s.type === 2 ? 'bg-warning text-dark' : 'bg-danger';
                const costDiff = s.costDiff;
                const costStr = (costDiff >= 0 ? '+' : '') + '£' + costDiff.toFixed(1) + 'm';
                const costCls = costDiff >= 0 ? 'text-success' : 'text-danger';

                const renderPlayer = (p, isSell) => {
                    const img = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}-110.webp`;
                    const pos = positionLabels[p.element_type] || '';
                    const priceCls = isSell ? 'text-danger' : 'text-success';
                    return `
                        <div class="transfer-player text-center">
                            <img src="${img}" width="44" height="auto" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'" alt="">
                            <div class="mt-1 fw-semibold text-white" style="font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">${p.web_name}</div>
                            <div class="text-muted" style="font-size:0.72rem;">${pos}</div>
                            <div class="${priceCls} fw-bold" style="font-size:0.78rem;">£${(p.now_cost / 10).toFixed(1)}m</div>
                        </div>
                    `;
                };

                const sellPlayers = s.outs.map(p => renderPlayer(p, true)).join('');
                const buyPlayers = s.ins.map(p => renderPlayer(p, false)).join('');

                html += `
                    <div class="transfer-card border border-secondary rounded-3 p-3" style="background: #1a1a1a;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge ${typeBadgeCls} px-2 py-1" style="font-size:0.75rem;">${typeLabel}</span>
                            ${isHit ? `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger px-2 py-1" style="font-size:0.72rem;">? -${hitPoints} point hit</span>` : '<span class="badge bg-success bg-opacity-25 text-success border border-success px-2 py-1" style="font-size:0.72rem;">? No hit</span>'}
                            <span class="fw-bold text-success" style="font-size:1rem;">+${s.xpDiff.toFixed(1)} <span class="text-muted fw-normal" style="font-size:0.75rem;">xP</span></span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <div class="transfer-section d-flex gap-2 justify-content-end flex-wrap" style="flex:1;">
                                ${sellPlayers}
                            </div>
                            <div class="transfer-arrow text-muted px-2" style="font-size:1.4rem;">?</div>
                            <div class="transfer-section d-flex gap-2 justify-content-start flex-wrap" style="flex:1;">
                                ${buyPlayers}
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
                            <div class="d-flex gap-3 text-muted" style="font-size:0.78rem;">
                                <span>Out xP: <strong class="text-white">${s.outXp.toFixed(1)}</strong></span>
                                <span>In xP: <strong class="text-success">${s.inXp.toFixed(1)}</strong></span>
                                <span>Cost: <strong class="${costCls}">${costStr}</strong></span>
                            </div>
                            <button class="btn btn-sm btn-outline-success" onclick='applyTransfer(${JSON.stringify({
                                type: s.type,
                                outs: s.outs.map(p => ({ id: p.id, element_type: p.element_type, web_name: p.web_name })),
                                ins: s.ins.map(p => p.id)
                            })})' style="font-size:0.78rem; padding: 4px 12px;">
                                Preview Transfer
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            modalContent.innerHTML = html;

        } catch(e) {
            console.error(e);
            modalContent.innerHTML = '<p class="text-danger p-3">Error calculating transfers. Please try recalculating predictions first.</p>';
        }
    }, 100);
}


function applyTransfer(suggestion) {
    // Close modal
    const modalEl = document.getElementById('suggestedTransfersModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    // Remove outs and add ins
    suggestion.outs.forEach(pOut => {
        const idx = myPlayers.findIndex(p => p.id === pOut.id);
        if (idx !== -1) {
            myPlayers[idx] = {
                web_name: 'Player',
                now_cost: 0,
                element_type: pOut.element_type,
                isSub: myPlayers[idx].isSub,
                slotId: myPlayers[idx].slotId,
                isCaptain: false,
                isVice: false
            };
        }
    });

    suggestion.ins.forEach(inId => {
        const pIn = allPlayers.find(p => p.id === inId);
        if (pIn) {
            // Find a placeholder in myPlayers of the same element_type and replace it
            const placeholderIdx = myPlayers.findIndex(p => p.element_type === pIn.element_type && p.now_cost === 0);
            if (placeholderIdx !== -1) {
                const placeholder = myPlayers[placeholderIdx];
                myPlayers[placeholderIdx] = { ...pIn, isSub: placeholder.isSub, slotId: placeholder.slotId, isCaptain: false, isVice: false };
            } else {
                myPlayers.push({ ...pIn, isSub: true, isCaptain: false, isVice: false });
            }
        }
    });

    isPreviewMode = true;
    updateTeamUI();
}

function openSuggestedTransfersModal() {
    const modalContent = document.getElementById('suggestedTransfersContent');
    modalContent.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-success mb-3" role="status" style="width: 2.5rem; height: 2.5rem;"></div>
            <p class="text-muted mb-0">Analysing your squad over the next 5 gameweeks...</p>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('suggestedTransfersModal'));
    modal.show();

    setTimeout(() => {
        try {
            let currentTeamIds = myPlayers.filter(p => p.now_cost > 0).map(p => p.id);
            if (currentTeamIds.length === 0) {
                modalContent.innerHTML = '<p class="text-warning p-3">Please add players to your team first.</p>';
                return;
            }

            let suggestions = calculateSuggestedTransfers(currentTeamIds, allPlayers, fixtures, selectedGameweek, bankBalance);

            if (suggestions.length === 0) {
                modalContent.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                        <h5 class="text-white mb-2">Hold Your Transfers</h5>
                        <p class="text-muted">No transfers are currently worth making. Roll your free transfer — your squad looks strong for the next 5 gameweeks.</p>
                    </div>
                `;
                return;
            }

            const positionLabels = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

            let html = `<div class="transfer-list d-flex flex-column gap-3 pb-2">`;

            suggestions.forEach((s, idx) => {
                const isHit = s.type > 1;
                const hitPoints = (s.type - 1) * 4;
                const typeLabel = s.type === 1 ? 'Free Transfer' : s.type === 2 ? '2 Transfers' : '3 Transfers';
                const typeBadgeCls = s.type === 1 ? 'bg-success' : s.type === 2 ? 'bg-warning text-dark' : 'bg-danger';
                const costDiff = s.costDiff;
                const costStr = (costDiff >= 0 ? '+' : '') + '£' + costDiff.toFixed(1) + 'm';
                const costCls = costDiff >= 0 ? 'text-success' : 'text-danger';

                const renderPlayer = (p, isSell) => {
                    const isGK = p.element_type === 1;
                    const img = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.team_code}${isGK ? '_1' : ''}-110.webp`;
                    const pos = positionLabels[p.element_type] || '';
                    const priceCls = isSell ? 'text-danger' : 'text-success';
                    return `
                        <div class="transfer-player text-center">
                            <img src="${img}" width="44" height="auto" onerror="this.src='https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-110.webp'" alt="">
                            <div class="mt-1 fw-semibold text-white" style="font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:80px;">${p.web_name}</div>
                            <div class="text-muted" style="font-size:0.72rem;">${pos}</div>
                            <div class="${priceCls} fw-bold" style="font-size:0.78rem;">£${(p.now_cost / 10).toFixed(1)}m</div>
                        </div>
                    `;
                };

                const sellPlayers = s.outs.map(p => renderPlayer(p, true)).join('');
                const buyPlayers = s.ins.map(p => renderPlayer(p, false)).join('');

                html += `
                    <div class="transfer-card border border-secondary rounded-3 p-3" style="background: #1a1a1a;">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge ${typeBadgeCls} px-2 py-1" style="font-size:0.75rem;">${typeLabel}</span>
                            ${isHit ? `<span class="badge bg-danger bg-opacity-25 text-danger border border-danger px-2 py-1" style="font-size:0.72rem;">⚠ -${hitPoints} point hit</span>` : '<span class="badge bg-success bg-opacity-25 text-success border border-success px-2 py-1" style="font-size:0.72rem;">✓ No hit</span>'}
                            <span class="fw-bold text-success" style="font-size:1rem;">+${s.xpDiff.toFixed(1)} <span class="text-muted fw-normal" style="font-size:0.75rem;">xP</span></span>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <div class="transfer-section d-flex gap-2 justify-content-end flex-wrap" style="flex:1;">
                                ${sellPlayers}
                            </div>
                            <div class="transfer-arrow text-muted px-2" style="font-size:1.4rem;">→</div>
                            <div class="transfer-section d-flex gap-2 justify-content-start flex-wrap" style="flex:1;">
                                ${buyPlayers}
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-secondary">
                            <div class="d-flex gap-3 text-muted" style="font-size:0.78rem;">
                                <span>Out xP: <strong class="text-white">${s.outXp.toFixed(1)}</strong></span>
                                <span>In xP: <strong class="text-success">${s.inXp.toFixed(1)}</strong></span>
                                <span>Cost: <strong class="${costCls}">${costStr}</strong></span>
                            </div>
                            <button class="btn btn-sm btn-outline-success" onclick='applyTransfer(${JSON.stringify({
                                type: s.type,
                                outs: s.outs.map(p => ({ id: p.id, element_type: p.element_type, web_name: p.web_name })),
                                ins: s.ins.map(p => p.id)
                            })})' style="font-size:0.78rem; padding: 4px 12px;">
                                Preview Transfer
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            modalContent.innerHTML = html;

        } catch(e) {
            console.error(e);
            modalContent.innerHTML = '<p class="text-danger p-3">Error calculating transfers. Please try recalculating predictions first.</p>';
        }
    }, 100);
}


function autoSelectStartingXI(gwId) {
    const gwData = gameweeks.find(g => g.id === gwId);
    if (!gwData) return;

    // 1. Calculate predicted_points for myPlayers
    myPlayers.forEach(p => {
        const fix = getPlayerFixture(p, gwId);
        if (fix) {
            let pts = calculatePlayerPredictedPoints(p, fix, gwData);
            p.predicted_points = pts !== '?' ? parseFloat(pts) : 0;
        } else {
            p.predicted_points = 0;
        }
    });

    // 2. Pass to optimizeTeam to get best 11
    const best11 = optimizeTeam(myPlayers);
    
    // 3. Mark isSub
    myPlayers.forEach(p => {
        p.isSub = !best11.some(b => b.id === p.id);
        p.isCaptain = false;
        p.isVice = false;
    });

    // 4. Mark Captain & Vice
    if (best11.length > 0) {
        let sortedBest = [...best11].sort((a, b) => b.predicted_points - a.predicted_points);
        const captainId = sortedBest[0].id;
        const viceId = sortedBest.length > 1 ? sortedBest[1].id : null;
        
        myPlayers.forEach(p => {
            if (p.id === captainId) p.isCaptain = true;
            if (viceId && p.id === viceId) p.isVice = true;
        });
    }
}
