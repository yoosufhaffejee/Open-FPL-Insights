document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of filteredPlayers
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});

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
function navigateGameweek(direction) {
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
    updateGameweekInfo();

    // Load the team for the current selectedGameweek
    loadPlayers(selectedGameweek);

    // Call your update function to refresh UI
    updateTeamUI();
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

    // Live GW
    if (currentGameweek.started && !currentGameweek.finished) {
        await getLiveData(currentGameweek.id);
    }
    else {
        await getLatestPicks(currentGameweek.id);
    }
}

async function getLatestPicks(gameweek) {
    managerPicks = [];
    document.getElementById("points").hidden = true;

    if (gameweek <= getLastGameweekId() && managerId > 0) {
        managerPicks = await getManagerPicks(managerId, gameweek);
    }

    rating = 0;
    points = 0;
    if (managerPicks.entry_history) {
        document.getElementById("points").hidden = false;
        points = managerPicks.entry_history.points;
        updateTeamInfo("Points", points);
        updateTeamInfo("Bank Balance", (managerPicks.entry_history.bank / 10) + 'm');
        rating = 100 - managerPicks.entry_history.percentile_rank;
        updateTeamInfo("GW Rating", rating + '%');
    }
    else
    {
        rating = (predictedPoints / 70) * 100;
        updateTeamInfo("GW Rating", parseInt(rating) + '%');
    }

    if (managerPicks.picks) {
        addPlayers(managerPicks.picks);
    }
}

async function getLiveData(gameweek) {
    document.getElementById("points").hidden = false;
    liveData = await getGameweek(gameweek);

    points = 0;
    myPlayers.forEach(player => {
        if (!player.isSub && player.id) {
            const element = liveData.elements.find(p => p.id == player.id);
            if (element) {
                points += element.stats.total_points;
            }
        }
    });

    updateTeamInfo("Points", points);
}

function addPlayers(picks) {
    myPlayers = [];
    picks.forEach((pick, index) => {
        let player = allPlayers.find(p => p.id == pick.element);

        player.isCaptain = pick.is_captain;
        player.isVice = pick.is_vice_captain;

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

// Add event listeners for the filter controls
const teamSelectElement = document.getElementById('team-select');

if (teamSelectElement) {
    teamSelectElement.addEventListener('change', function() {
        filterByTeam(this.value);
    });
} else {
    console.error('Element with ID "team-select" does not exist.');
}


document.querySelectorAll('.position-button').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.position-button').forEach(btn => btn.classList.remove('selected'));
        this.classList.add('selected');
        filterByPosition(this.getAttribute('data-position'));
    });
});

const priceRange = document.getElementById('price-range');

if (priceRange) {
    priceRange.addEventListener('input', function() {
        filterByPrice(this.value);
        const priceValue = document.getElementById('price-value');
        if (priceValue) {
            priceValue.textContent = this.value;
        } else {
            console.error('Element with ID "price-value" does not exist.');
        }
    });
} else {
    console.error('Element with ID "price-range" does not exist.');
}

let bankBalance = 100;
let myPlayers = [];
let filteredPlayers = [];
let managerPicks = [];
let liveData = [];
let managerId = 0;
let rating = 0;
let points = 0;
let seasonPoints = 0;
let overallRating = 0;

// Function to populate the team dropdown
function populateTeamFilter() {
    const teamSelect = document.getElementById('team-select');

    if (!teamSelect) {
        return;
    }

    // Clear any existing options (if needed)
    teamSelect.innerHTML = ''; 

    // Add the default "All" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '0';
    defaultOption.textContent = 'All';
    teamSelect.appendChild(defaultOption);

    // Add an option for each team in the teams array
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
    });
}

// Function to filter by team
function filterByTeam(teamId) {
    if (teamId === '0') {
        filteredPlayers = allPlayers;
    } else {
        filteredPlayers = allPlayers.filter(player => player.team == teamId);
    }
    applyFilters();
}

// Function to filter by position
function filterByPosition(position) {
    if (position === '0') {
        filteredPlayers = allPlayers;
    } else {
        filteredPlayers = allPlayers.filter(player => player.element_type == position);
    }
    applyFilters();
}

// Function to filter by price
function filterByPrice(maxPrice) {
    filteredPlayers = allPlayers.filter(player => player.now_cost/10 <= parseFloat(maxPrice));
    applyFilters();
}

// Function to apply combined filters (position and price)
function applyFilters() {
    const teamId = document.getElementById('team-select').value;
    const position = document.querySelector('.position-button[data-position].selected')?.getAttribute('data-position') || '0';
    const maxPrice = document.getElementById('price-range').value;

    let result = filteredPlayers;

    // Apply team filter
    if (teamId !== '0') {
        result = result.filter(player => player.team == teamId);
    }

    // Apply position filter
    if (position !== '0') {
        result = result.filter(player => player.element_type == position);
    }

    // Apply price filter
    result = result.filter(player => player.now_cost/10 <= parseFloat(maxPrice));

    // Display the filtered result
    displayPlayers(result);
}

// Define a mapping of element types to position prefixes
const pitchPositionMap = {
    1: 'gk',  // Goalkeepers
    2: 'def', // Defenders
    3: 'mid', // Midfielders
    4: 'fwd'  // Forwards
};

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

// Function to check if a player can be added to a specific position
function canAddPlayer(positionType) {
    const positionPrefix = pitchPositionMap[positionType];
    // Ensure the number of filled slots for the position is less than the max slots allowed
    return positionPrefix && filledSlots[positionPrefix] < availableSlots[positionPrefix].length;
}

// Function to add a player by replacing the first available empty slot
function addPlayer(player) {
    // Ensure the team has 15 players
    if (myPlayers.length > 15) {
        console.log('Team already has 15 players. Cannot add more.');
        return;
    }

    const positionPrefix = pitchPositionMap[player.element_type];

    // Check if the player already exists in the team
    const playerExists = myPlayers.some(existingPlayer => existingPlayer.id === player.id);
    if (playerExists) {
        console.log(`Player ${player.web_name} is already in the team.`);
        return; // Exit the function if the player is already in the team
    }

    // Find the first ghost player of the same position (gk, def, mid, fwd)
    const emptyPlayerIndex = myPlayers.findIndex(p => p.element_type === player.element_type && p.now_cost === 0 && p.web_name === 'Player');

    if (emptyPlayerIndex !== -1) {
        // Replace the ghost player with the new player
        myPlayers[emptyPlayerIndex] = {
            ...player,
            isSub: myPlayers[emptyPlayerIndex].isSub, // Maintain the same sub status
            slotId: myPlayers[emptyPlayerIndex].slotId, // Keep the same slotId
            isCaptain: myPlayers[emptyPlayerIndex].isCaptain, // Keep the same cap
            isVice: myPlayers[emptyPlayerIndex].isVice // Keep the same vice
        };

        // Increment the filled slots for this position
        filledSlots[positionPrefix]++;

        // Update the UI to reflect the new player
        updateTeamUI();
    } else {
        console.log(`No available ghost players in ${positionPrefix} to add player ${player.web_name}.`);
    }
}

// Function to remove a player
function removePlayer(player) {
    // Find the index of the player to remove
    const playerIndex = myPlayers.findIndex(p => p.id === player.id);

    // Check if the player exists in the array
    if (playerIndex !== -1) {
        // Get the player's assigned position prefix (gk, def, mid, fwd)
        const positionPrefix = pitchPositionMap[player.element_type];

        // Remove the player from the array
        myPlayers.splice(playerIndex, 1);

        // Decrement the filled slot count for this position
        filledSlots[positionPrefix]--;

        // Refresh Grid
        if (grid) {
            grid.updateGridOptions({ rowData: filteredPlayers });
        }

        // Update the UI to reflect the changes
        updateTeamUI();
    } else {
        console.log(`Player with ID ${player.id} not found.`);
    }


}

let predictedPoints = 0;

 // Function to update the team UI

function validateAndFixFormation() {
    if (!myPlayers || myPlayers.length !== 15) return;
    
    let field = myPlayers.filter(p => !p.isSub);
    let gkCount = field.filter(p => p.element_type === 1).length;
    let defCount = field.filter(p => p.element_type === 2).length;
    let midCount = field.filter(p => p.element_type === 3).length;
    let fwdCount = field.filter(p => p.element_type === 4).length;

    let isValid = (field.length === 11) && 
                  (gkCount === 1) && 
                  (defCount >= 3 && defCount <= 5) && 
                  (midCount >= 2 && midCount <= 5) && 
                  (fwdCount >= 1 && fwdCount <= 3);

    if (isValid) return; // Everything is fine, respect user's choices

    console.log("Formation is invalid. Auto-correcting to a valid FPL formation based on predicted points.");

    // Create a temporary array sorted by position and points
    let sortedPlayers = [...myPlayers].sort((a, b) => {
        if (a.element_type !== b.element_type) return a.element_type - b.element_type;
        return (b.predicted_points || 0) - (a.predicted_points || 0);
    });

    let gks = sortedPlayers.filter(p => p.element_type === 1);
    let defs = sortedPlayers.filter(p => p.element_type === 2);
    let mids = sortedPlayers.filter(p => p.element_type === 3);
    let fwds = sortedPlayers.filter(p => p.element_type === 4);

    let starters = [];
    let subs = [];

    // 1. Mandatory minimums: 1 GK, 3 DEF, 2 MID, 1 FWD
    if (gks.length > 0) starters.push(gks.shift());
    for(let i=0; i<3 && defs.length > 0; i++) starters.push(defs.shift());
    for(let i=0; i<2 && mids.length > 0; i++) starters.push(mids.shift());
    if (fwds.length > 0) starters.push(fwds.shift());

    // 2. Remaining 4 spots for outfielders
    let remainingOutfielders = [...defs, ...mids, ...fwds];
    remainingOutfielders.sort((a,b) => (b.predicted_points || 0) - (a.predicted_points || 0));

    while (starters.length < 11 && remainingOutfielders.length > 0) {
        starters.push(remainingOutfielders.shift());
    }

    // 3. The rest are subs
    if (gks.length > 0) subs.push(gks.shift());
    subs.push(...remainingOutfielders);

    // Apply isSub to the original myPlayers objects
    starters.forEach(p => {
        let original = myPlayers.find(orig => orig.id === p.id);
        if (original) original.isSub = false;
    });
    
    subs.forEach(p => {
        let original = myPlayers.find(orig => orig.id === p.id);
        if (original) original.isSub = true;
    });
}

function updateTeamUI() {
    validateAndFixFormation();

    // Clear existing players from rows
    document.querySelectorAll('.row').forEach(row => row.innerHTML = '');

    let bankBalance = 100;
    let predictedPoints = 0;
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

    // Sort players: Field players first, then Subs sorted by position (GK first)
    myPlayers.sort((a, b) => {
        if (a.isSub !== b.isSub) return a.isSub ? 1 : -1;
        if (a.isSub && b.isSub) return a.element_type - b.element_type;
        return 0;
    });

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
        updateTeamInfo("Bank Balance", `${bankBalance.toFixed(1)}m`);
        updateTeamInfo("Predicted Points", (predictedPoints !== '?' ? Number(predictedPoints).toFixed(0) : '?'));
    
    // Ensure Auto Pick button is disabled only when 15 real players exist
    const realPlayersCount = myPlayers.filter(p => p.now_cost > 0).length;
    const btn = document.getElementById("autoPickButton");
    if (btn) btn.disabled = realPlayersCount === 15;
    });
    
    if (rating <= 0) {
        rating = (predictedPoints / 70) * 100;
        updateTeamInfo("GW Rating", parseInt(rating) + '%');
    }

    // Handle missing players/ghost players
    fillMissingPlayers(filledPositions, subs);
}

async function calculateSeasonPoints() {
    let seasonPoints = 0;
    let overallRating = 0;

    // Normal for loop to handle async operations correctly
    for (let i = 0; i < gameweeks.length; i++) {
        const gw = gameweeks[i];

        let gwPoints = 0;
        let gwRating = 0;

        myPlayers = [];
        await getLatestPicks(gw.id); // Will wait for this promise to resolve before continuing

        if (myPlayers.length > 0) {
            gwPoints += points;
        }
        else {
            loadPlayers(gw.id);  // Assuming this function doesn't need to be awaited

            myPlayers.forEach(player => {
                // Update fixtures and predicted points
                let fixture = getPlayerFixture(player, gw.id);
                player.predicted_points = calculatePlayerPredictedPoints(player, fixture, gw.id);
            });

            const bestPlayers = optimizeTeam(myPlayers);
            bestPlayers.forEach(player => {
                gwPoints += player.predicted_points;
            });
        }

        if (gwRating <= 0) {
            gwRating = (gwPoints / 70) * 100;
        }

        seasonPoints += gwPoints;
        overallRating += gwRating;
    };

    updateTeamInfo("Overall Rating", parseInt(overallRating/gameweeks.length) + '%');
    updateTeamInfo("Season Points", parseInt(seasonPoints));
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

    playerElement.innerHTML = `
        ${image}
        <div class="player-info-card">
            <div class="player-header">
                <span class="player-name">${player.web_name} ${player.isCaptain ? '(C)' : player.isVice ? '(V)' : ''}</span>
                <span class="player-price">£${(player.now_cost / 10).toFixed(1)}</span>
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

                fixtureElement.querySelector('.fixture-detail').innerHTML = `${opponentTeam.short_name}<br>(${playerFixture.team_a === player.team ? 'A' : 'H'})`;

                let playerPredictedPoints = calculatePlayerPredictedPoints(player, playerFixture, upcomingGameweek);

                fixtureElement.querySelector('.predicted-points').textContent = playerPredictedPoints === '?' ? '?' : playerPredictedPoints.toFixed(1);

                // Add up all the players predicted points for the current GW
                if (fixtureIndex === 0) {
                    player.predicted_points = playerPredictedPoints;
                    if (!player.isSub) {
                        if (playerPredictedPoints !== '?') predictedPoints += playerPredictedPoints;
                    }
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

    // FPL Model averaging removed
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
    const fieldPlayersToAdd = [];
    const subsToAdd = [];
    
    let count = 0;
    // Add remaining missing players as substitutes
    while (remainingSubs) {
        positions.forEach(pos => {
            const isMissing = missingPlayers[pos] > 0;
            if (isMissing && remainingSubs > 0) {
                const addToSubs = Math.min(1, remainingSubs);
                subsToAdd.push(...Array(addToSubs).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: true }));
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
            fieldPlayersToAdd.push(...Array(addToField).fill({ web_name: 'Player', now_cost: 0, element_type: getKeyByValue(pos), isSub: false }));
            remainingOnFieldPlayers -= addToField;
            missingPlayers[pos] -= addToField;
        }
    });

    const playersToAdd = [...fieldPlayersToAdd, ...subsToAdd];

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
    
    // Set up swap button
    const swapButton = newPlayerElement.querySelector('.icon-button i.fa-exchange-alt').parentElement;

    if (swapButton) {
        swapButton.addEventListener('click', () => {
            // Visually indicate that this player is selected for swapping
            newPlayerElement.classList.add('swap-queued');

            // Call swapPlayer logic to handle both selecting and swapping
            swapPlayer(player);
        });
    }

    // Set up trash button
    const trashButton = newPlayerElement.querySelector('.icon-button i.fa-trash').parentElement;
    if (trashButton) {
        trashButton.addEventListener('click', () => {
            removePlayer(player);
        });
    }

    // Set up captain button
    const captainButton = newPlayerElement.querySelector('.icon-button i.fa-crown').parentElement;
    if (captainButton) {
        captainButton.addEventListener('click', () => {
            captainPlayer(player);
        });
    }

    // Set up vice button
    const viceButton = newPlayerElement.querySelector('.icon-button i.fa-star').parentElement;
    if (viceButton) {
        viceButton.addEventListener('click', () => {
            vicePlayer(player);
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

// Function to set the captain
function captainPlayer(player) {
    if (player.isVice) {
        player.isVice = false;

        let oldCaptain = myPlayers.find(p => p.isCaptain);
        oldCaptain.isVice = true;
    }

    // Set isCaptain = false for all players
    myPlayers.forEach(p => p.isCaptain = false);

    // Set isCaptain = true for the selected player
    player.isCaptain = true;

    // Enable save button
    document.getElementById('saveButton').disabled = false;

    // Update the UI to reflect the change
    updateTeamUI();
}

function vicePlayer(player) {
    if (player.isCaptain) {
        player.isCaptain = false;
        
        let oldVice = myPlayers.find(p => p.isVice);
        oldVice.isCaptain = true;
    }

    // Set isVice = false for all players
    myPlayers.forEach(p => p.isVice = false);

    // Set isCaptain = true for the selected player
    player.isVice = true;

    // Enable save button
    document.getElementById('saveButton').disabled = false;
    
    // Update the UI to reflect the change
    updateTeamUI();
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
    // Set the player name in the modal title
    document.getElementById('playerInfoModalLabel').innerHTML = `
    <img src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;" onerror="playerImgOnerror(this, ${player.team_code}, ${player.element_type})">
    ${player.first_name} ${player.second_name}`;

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
        
        const upcomingGameweek = gameweeks.find(gw => gw.id >= selectedGameweek);
        const gwNum = upcomingGameweek ? upcomingGameweek.id : selectedGameweek;
        
        const fplTitle = document.getElementById('modal-fpl-title');
        const ourTitle = document.getElementById('modal-our-title');
        if (fplTitle) fplTitle.textContent = `FPL Model (GW${gwNum})`;
        if (ourTitle) ourTitle.textContent = `Our Algorithm (GW${gwNum})`;
        
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
        
        // Populate Breakdown Card
        const breakdownCard = document.getElementById('modal-breakdown-card');
        const breakdownBody = document.getElementById('modal-our-breakdown');
        if (breakdownCard && breakdownBody) {
            breakdownCard.style.display = 'block';
            let playChance = 100;
            if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round !== undefined) playChance = player.chance_of_playing_next_round;
            else if (player.chance_of_playing_this_round !== null && player.chance_of_playing_this_round !== undefined) playChance = player.chance_of_playing_this_round;
            
            let html = '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Play Prob:</span><span class="text-info">' + playChance + '%</span></div>';
            
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
                let ptsPerCS = player.element_type === 3 ? 1 : 4;
                let expectedCSPts = (xCS * ptsPerCS).toFixed(1);
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Clean Sheet:</span><span class="text-success">' + (xCS*100).toFixed(0) + '% <span class="text-white-50 small">(' + expectedCSPts + ' pts)</span></span></div>';
            }

            // DEFCON (Only for DEF/MID)
            let defCon = parseFloat(player.defensive_contribution_per_90) || 0;
            if (defCon > 0 && (player.element_type === 2 || player.element_type === 3)) {
                let threshold = (player.element_type === 2) ? 10 : 12;
                let prob = Math.pow(defCon / threshold, 2) * 0.5;
                if (prob > 0.95) prob = 0.95;
                let expectedDefconPts = (prob * 2).toFixed(1);
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
            
            // Base Appearance & Bonus
            let bonus = player.minutes > 0 ? (player.bonus / (player.minutes / 90)) : 0;
            if (bonus > 0) {
                html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>BPS / 90:</span><span class="text-success">' + bonus.toFixed(2) + ' <span class="text-white-50 small">(' + bonus.toFixed(1) + ' pts)</span></span></div>';
            }
            
            html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Base Appearance:</span><span class="text-success">60m+ <span class="text-white-50 small">(2.0 pts)</span></span></div>';
            html += '<div class="d-flex justify-content-between border-bottom pb-1 mb-1 border-secondary"><span>Form & FDR Adj:</span><span class="text-warning fst-italic">Applied</span></div>';
            
            if (predictedPoints !== undefined) {
                html += '<div class="d-flex justify-content-between pt-1 mt-1 border-top border-secondary fw-bold text-white"><span>Final Prediction:</span><span class="text-success">' + predictedPoints.toFixed(1) + ' pts</span></div>';
            }
            
            breakdownBody.innerHTML = html;
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

// Usage examples
// updateTeamInfo("Overall Rating", overallRating + "%");
// updateTeamInfo("Predicted Points", predictedPoints);
// updateTeamInfo("GW Rating", "83%");
// updateTeamInfo("Bank Balance", bankBalance + "m");

function loadPlayers(gameweek = selectedGameweek) {
    filledSlots["gk"] = 0;
    filledSlots["def"] = 0;
    filledSlots["mid"] = 0;
    filledSlots["fwd"] = 0;

    // Function to parse cookies
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    // Attempt to load the cookie for the specified gameweek
    let myPlayersCookie = getCookie(`myPlayersGW${gameweek}`);

    // If no data exists for the specified gameweek, load the last saved gameweek
    if (!myPlayersCookie) {
        // Loop backwards through gameweeks to find the most recent saved team
        for (let gw = gameweek - 1; gw >= gameweeks[0].id; gw--) {
            myPlayersCookie = getCookie(`myPlayersGW${gw}`);
            if (myPlayersCookie) {
                let gwTeam = JSON.parse(myPlayersCookie);
                if (gwTeam.players.length >= 15) {
                    break;
                }
            }
        }
    }
    else {
        let gwTeam = JSON.parse(myPlayersCookie);
        if (gwTeam.players.length < 15) {
            // Loop backwards through gameweeks to find the most recent saved team
            for (let gw = gameweek - 1; gw >= gameweeks[0].id; gw--) {
                myPlayersCookie = getCookie(`myPlayersGW${gw}`);
                if (myPlayersCookie) {
                    let gwTeam = JSON.parse(myPlayersCookie);
                    if (gwTeam.players.length >= 15) {
                        break;
                    }
                }
            }
        }
    }

    // If still no data found, default to the upcoming gameweek
    if (!myPlayersCookie) {
        const upcomingGameweek = getUpcomingGameweek();
        if (upcomingGameweek) {
            myPlayersCookie = getCookie(`myPlayersGW${upcomingGameweek.id}`);
        }
    }

    if (myPlayersCookie) {
        // Parse the JSON string
        const { players } = JSON.parse(myPlayersCookie);

        // Reconstruct myPlayers using player IDs from allPlayers
        myPlayers = players.map(({ id, slotId, isSub, isCaptain, isVice }) => {
            const player = allPlayers.find(player => player.id === id);
            if (player) {
                player.slotId = slotId;
                player.isSub = isSub; // Set the isSub property
                player.isCaptain = isCaptain;
                player.isVice = isVice;

                // Calculate filled slots
                const positionPrefix = pitchPositionMap[player.element_type];
                if (positionPrefix) {
                    filledSlots[positionPrefix]++;
                }
            }
            return player;
        }).filter(player => player !== undefined); // Filter out any undefined players
        
        

        // Update the UI to reflect the loaded team
        updateTeamUI();
    } else {
        // No data found for any gameweek, handle this case if needed
        console.log('No saved team data available.');
    }
}

function savePlayers() {
    // Disable the Save button
    document.getElementById('saveButton').disabled = true;

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
}

function loadManagerId() {
    const cookies = document.cookie.split('; ');
    
    for (let cookie of cookies) {
        if (cookie.startsWith('managerId=')) {
            managerId = cookie.split('=')[1];
            return;
        }
    }

    console.log('No manager ID found in cookie.');
}

function resetPlayers() {
    // Reset your myPlayers array (example: clear all players)
    myPlayers = [];

    // Reset filledSlots count for each position
    for (let position in filledSlots) {
        filledSlots[position] = 0;
    }

    // Enable the Save and Auto Pick buttons again
    document.getElementById('saveButton').disabled = false;
    document.getElementById('autoPickButton').disabled = false;

    updateTeamUI();

    // Update Grid if needed
    if (typeof grid !== 'undefined') {
        grid.refreshCells();
    }
}

// Function to auto-pick players
function autoPickPlayers() {
    document.getElementById('autoPickButton').disabled = true;

    if (allPlayers) {
        // Select the best team from allPlayers while keeping existing picks
        myPlayers = selectBestTeam(allPlayers, myPlayers || []);

        // Reset filledSlots before re-assigning
        for (let position in filledSlots) {
            filledSlots[position] = 0;
        }

        // First pass: mark already slotted players
        myPlayers.forEach(player => {
            if (player.slotId) {
                const positionPrefix = pitchPositionMap[player.element_type];
                filledSlots[positionPrefix]++;
            }
        });

        // Second pass: assign slots to new players
        myPlayers.forEach(player => {
            if (!player.slotId) {
                const positionPrefix = pitchPositionMap[player.element_type];
                // Find next available slot
                for (let i = 0; i < availableSlots[positionPrefix].length; i++) {
                    const candidateSlot = availableSlots[positionPrefix][i];
                    if (!myPlayers.find(p => p.slotId === candidateSlot)) {
                        player.slotId = candidateSlot;
                        player.isSub = ['pos2', 'pos7', 'pos12', 'pos15'].includes(candidateSlot);
                        filledSlots[positionPrefix]++;
                        break;
                    }
                }
            }
        });
        if (grid) { grid.updateGridOptions({ rowData: filteredPlayers }); }

        updateTeamUI();
    }
}

let grid = null;
// Function to display filteredPlayers (you can customize this)
function displayPlayers(filteredPlayers) {
    filteredPlayers.sort((a, b) => b.total_points - a.total_points);

    if (grid) {
        grid.updateGridOptions({
            rowData: filteredPlayers
        });
        return;
    }
    
    setupGridOptions(filteredPlayers);

    // Your Javascript code to create the Data Grid
    const myGridElement = document.querySelector('#myGrid');
    if (myGridElement) {
        grid = agGrid.createGrid(myGridElement, gridOptions);
    }
}

async function Initialize() {
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

    populateTeamFilter();
    filteredPlayers = allPlayers;

    loadManagerId();
    await calculateSeasonPoints();
    
    selectedGameweek = getUpcomingGameweek().id;
    await updateGameweekInfo();

    // Load the players from the cookie when the page loads
    loadPlayers();
                
    // Initial display of all filteredPlayers
    displayPlayers(filteredPlayers); 
}

