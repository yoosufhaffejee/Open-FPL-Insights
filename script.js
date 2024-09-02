document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of filteredPlayers
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});

let selectedGameweek = 1;

document.getElementById('prevGameweek').addEventListener('click', () => {
    // Logic to go to the previous game week
    navigateGameweek('prev');
});

document.getElementById('nextGameweek').addEventListener('click', () => {
    // Logic to go to the next game week
    navigateGameweek('next');
});

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
function updateGameweekInfo() {
    const gameweekInfo = document.getElementById('gameweekInfo');
    const gameweekDeadline = document.getElementById('gameweekDeadline');

    // Find the gameweek object for the current selected gameweek
    const currentGameweek = gameweeks.find(gw => gw.id === selectedGameweek);

    if (currentGameweek) {
        // Update the UI with the current gameweek info
        gameweekInfo.textContent = `Gameweek ${currentGameweek.id}`;
        gameweekDeadline.textContent = `Deadline: ${new Date(currentGameweek.deadline_time).toLocaleString()}`;
    }
}

// Add event listeners for the filter controls
document.getElementById('team-select').addEventListener('change', function() {
    filterByTeam(this.value);
});

document.querySelectorAll('.position-button').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.position-button').forEach(btn => btn.classList.remove('selected'));
        this.classList.add('selected');
        filterByPosition(this.getAttribute('data-position'));
    });
});

const priceRange = document.getElementById('price-range');
priceRange.addEventListener('input', function() {
    filterByPrice(this.value);
    document.getElementById('price-value').textContent = this.value;
});

let bankBalance = 100;
let teams = [];
let gameweeks = [];
let fixtures = [];
let allPlayers = [];
let myPlayers = [];
let filteredPlayers = [];

// Function to populate the team dropdown
function populateTeamFilter() {
    const teamSelect = document.getElementById('team-select');

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
const positionMap = {
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
    const positionPrefix = positionMap[positionType];
    return positionPrefix && filledSlots[positionPrefix] < availableSlots[positionPrefix].length;
}

// Function to add a player
function addPlayer(player) {
    const positionPrefix = positionMap[player.element_type];

    // Check if the player already exists in the team
    const playerExists = myPlayers.some(existingPlayer => existingPlayer.id === player.id);
    if (playerExists) {
        console.log(`Player ${player.web_name} is already in the team.`);
        return; // Exit the function if the player is already in the team
    }

    // Check if there are available slots for this player type
    if (positionPrefix && canAddPlayer(player.element_type)) {
        const currentFilledSlots = filledSlots[positionPrefix];

        // Assign the next available slot for this position
        const slotId = availableSlots[positionPrefix][currentFilledSlots];

        if (slotId) {  // Ensure slotId is valid and available
            // Assign the slot ID to the player
            player.slotId = slotId;

            // Determine if the player is a substitute based on their position
            player.isSub = ['pos2', 'pos7', 'pos12', 'pos15'].includes(slotId);

            // Add the player to the myPlayers array
            myPlayers.push(player);

            // Update the filled slots count
            filledSlots[positionPrefix]++;

            // Update the UI to reflect the new player
            updateTeamUI();
        } else {
            console.log(`No available slots for ${positionPrefix} to add player ${player.web_name}.`);
        }
    } else {
        console.log(`Cannot add player ${player.web_name}. No available slots or invalid position.`);
    }
}

// Function to remove a player
function removePlayer(player) {
    // Find the index of the player to remove
    const playerIndex = myPlayers.findIndex(p => p.id === player.id);

    // Check if the player exists in the array
    if (playerIndex !== -1) {
        // Get the player's assigned slot ID
        const positionPrefix = positionMap[player.element_type];
        const slotId = myPlayers[playerIndex].slotId;

        // Remove the player from the array
        myPlayers.splice(playerIndex, 1);

        // Decrement the filled slot count for this position
        filledSlots[positionPrefix]--;

        // Clear the player slot in the UI
        const playerElement = document.getElementById(slotId);
        if (playerElement) {
            playerElement.querySelector('h5').textContent = 'Player';
            playerElement.querySelector('img').src = 'assets/empty-jersey.png';
            playerElement.querySelectorAll('.fixture').forEach(fixtureElement => {
                fixtureElement.querySelector('.predicted-points').textContent = 0;
                fixtureElement.querySelector('.fixture-detail').textContent = 'FIX (H)';
            });
        }

        // Update the UI to reflect the changes
        updateTeamUI();
    } else {
        console.log(`Player with ID ${player.id} not found.`);
    }

    // Check if any players are left; if not, enable the 'autoPickButton'
    if (myPlayers.length <= 0) {
        document.getElementById('autoPickButton').disabled = false;
    }
}

// Function to update the team UI
function updateTeamUI() {
    // Clear existing players from rows
    document.querySelectorAll('.row').forEach(row => row.innerHTML = '');

    let bankBalance = 100;
    let predictedPoints = 0;

    // Determine upcoming gameweeks
    const upcomingGameweeks = gameweeks.filter(gw => gw.id >= selectedGameweek).slice(0, 3);

    // Iterate through each player and update the UI
    myPlayers.forEach(player => {
        // Create or select the player element
        const playerElement = document.createElement('div');
        playerElement.className = 'player';
        playerElement.id = `player-${player.slotId}`;

        // Setup the HTML for the player element
        playerElement.innerHTML = `
            <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png" alt="${player.web_name}">
            <h5>${player.web_name} (${(player.now_cost / 10).toFixed(1)}m)</h5>
            <div class="fixtures">
                ${Array.from({ length: 3 }, (_, i) => `
                    <div class="fixture">
                        <span class="predicted-points">0</span>
                        <span class="fixture-detail">FIX (H)</span>
                    </div>
                `).join('')}
            </div>
            <div class="icon-buttons">
                <button class="icon-button"><i class="fas fa-exchange-alt"></i></button>
                <button class="icon-button"><i class="fas fa-trash"></i></button>
                <button class="icon-button"><i class="fas fa-crown"></i></button>
                <button class="icon-button"><i class="fas fa-star"></i></button>
                <button class="icon-button"><i class="fas fa-info-circle"></i></button>
            </div>
        `;

        // Determine the row based on the player's type and status
        const rowId = player.isSub ? 'subs' : getRowIdForElementType(player.element_type);
        
        // Append player element to the appropriate row
        const row = document.getElementById(rowId);
        if (row) {
            if (player.isSub) {
                row.children[0].appendChild(playerElement);
            } else {
                row.appendChild(playerElement);
            }
        }

        // Update fixtures and predicted points
        playerElement.querySelectorAll('.fixture').forEach((fixtureElement, fixtureIndex) => {
            const upcomingGameweek = upcomingGameweeks[fixtureIndex];
            if (upcomingGameweek) {
                let isHome = false;

                const playerFixture = fixtures.find(fixture => {
                    if (fixture.event === upcomingGameweek.id) {
                        if (fixture.team_a === player.team) {
                            return true;
                        }
                        if (fixture.team_h === player.team) {
                            isHome = true;
                            return true;
                        }
                    }
                    return false;
                });

                if (playerFixture) {
                    const opponentTeam = teams.find(team => 
                        team.id === (playerFixture.team_a === player.team ? playerFixture.team_h : playerFixture.team_a)
                    );

                    fixtureElement.querySelector('.fixture-detail').textContent = `${opponentTeam.short_name} (${playerFixture.team_a === player.team ? 'A' : 'H'})`;

                    let initialExpectedPoints = getExpectedPoints(player, playerFixture);
                    if (getUpcomingGameweek() == upcomingGameweek) {
                        let formBasedPoints = (parseFloat(player.form) + parseFloat(player.ep_next)) / 2;
                        initialExpectedPoints = (initialExpectedPoints + formBasedPoints) / 2;
                    }

                    const strengthAdjustmentHA = (opponentTeam.strength * 10) / 100;
                    const strengthAdjustment10 = (opponentTeam.strength * 10) / 100;
                    const strengthAdjustment15 = (opponentTeam.strength * 15) / 100;
                    const strengthAdjustment20 = (opponentTeam.strength * 20) / 100;

                    if (opponentTeam.strength == 2) {
                        initialExpectedPoints += (initialExpectedPoints * strengthAdjustment20);
                    }

                    if (opponentTeam.strength == 4) {
                        initialExpectedPoints -= (initialExpectedPoints * strengthAdjustment10);
                    }

                    if (opponentTeam.strength == 5) {
                        initialExpectedPoints -= (initialExpectedPoints * strengthAdjustment15);
                    }

                    if (isHome) {
                        initialExpectedPoints += (initialExpectedPoints * strengthAdjustmentHA);
                    }

                    fixtureElement.querySelector('.predicted-points').textContent = initialExpectedPoints.toFixed(1);

                    if (fixtureIndex == 0 && !player.isSub) {
                        predictedPoints += initialExpectedPoints;
                    }
                }
            }
        });

        // Setup player actions (like swapping players)
        setupPlayerActions(playerElement, player);

        // Update bank balance
        bankBalance -= player.now_cost / 10;
        updateTeamInfo("Bank Balance", `${bankBalance.toFixed(1)}m`);

        // Update predicted points
        updateTeamInfo("Predicted Points", predictedPoints.toFixed(0));
    });
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
            const index = myPlayers.findIndex(p => p.slotId === player.slotId);
            if (index === -1) return;

            if (playerSwap.length === 0) {
                playerSwap.push(index);
            } else if (playerSwap.length === 1) {
                swapPlayer(playerSwap[0], index);
                playerSwap = [];
            }
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

// Function to swap two players between positions
function swapPlayer(index1, index2) {
    if (index1 === index2) return; // No need to swap the same player

    const player1 = myPlayers[index1];
    const player2 = myPlayers[index2];

    // Find the rows of the players
    const row1 = player1.isSub ? 'subs' : getRowForPlayer(player1);
    const row2 = player2.isSub ? 'subs' : getRowForPlayer(player2);

    // Allow swap if players are in the same row or if one is a substitute and the other is not
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
                console.log("Invalid swap: This swap would violate formation constraints.");
                // Swap back to original positions if constraints are violated
                [myPlayers[index1], myPlayers[index2]] = [myPlayers[index2], myPlayers[index1]];
                [myPlayers[index1].isSub, myPlayers[index2].isSub] = [myPlayers[index2].isSub, myPlayers[index1].isSub];
                return;
            }
        }

        // After swapping, update the UI to reflect the new positions and statuses
        updateTeamUI();
        console.log(`Players swapped successfully between positions ${index1} and ${index2}.`);
    } else {
        console.log("Invalid swap: Players are not in the same row and cannot be swapped.");
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

function captainPlayer(player) {

}

function vicePlayer(player) {

}

function showPlayerInfo(player) {

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
        myPlayers = players.map(({ id, slotId, isSub }) => {
            const player = allPlayers.find(player => player.id === id);
            if (player) {
                player.slotId = slotId;
                player.isSub = isSub; // Set the isSub property

                // Calculate filled slots
                const positionPrefix = positionMap[player.element_type];
                if (positionPrefix) {
                    filledSlots[positionPrefix]++;
                }
            }
            return player;
        }).filter(player => player !== undefined); // Filter out any undefined players
        
        // Ensure the Auto Pick button is disabled if players are loaded
        document.getElementById('autoPickButton').disabled = myPlayers.length > 0;

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
        isSub: player.isSub // Include the isSub property
    }));

    // Convert the playerData array to a JSON string
    const dataJSON = JSON.stringify({ selectedGameweek, players: playerData });

    // Save the JSON string in a cookie
    document.cookie = `myPlayersGW${selectedGameweek}=${dataJSON}; path=/; max-age=31536000`; // Cookie expires in 1 year
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

    if (myPlayers.length <= 0) {
        // Select the best team from allPlayers
        myPlayers = selectBestTeam(allPlayers);

        // Assign slotIds to the auto-picked players
        myPlayers.forEach((player, index) => {
            const positionPrefix = positionMap[player.element_type];
            if (positionPrefix && filledSlots[positionPrefix] < maxSlots[positionPrefix]) {
                // Assign the next available slot for this position
                const slotId = availableSlots[positionPrefix][filledSlots[positionPrefix]];

                // Set the player's slotId
                player.slotId = slotId;

                // Determine if the player is a substitute based on their position
                player.isSub = ['pos2', 'pos7', 'pos12', 'pos15'].includes(slotId);

                // Increment filledSlots count if player is not a sub
                if (!player.isSub) {
                    filledSlots[positionPrefix]++;
                }
            }
        });

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

    // Grid Options: Contains all of the Data Grid configurations
    const gridOptions = {
        rowData: filteredPlayers,
        defaultColDef: { 
            sortable: true,
            filter: true,
            resizable: true,
        },
        pagination: true,
        paginationPageSize: 10,
        paginationPageSizeSelector: [10, 20, 50, 100, 1000],
        columnDefs: [
            {
              headerName: 'Actions',
              width: 85,
              pinned: 'left',
              filter: false,
              cellRenderer: (params) => {
                const button = document.createElement('button');
                button.className = 'btn btn-primary';
                button.disabled = myPlayers.some(player => player?.web_name == params.data.web_name) || 
                                  !canAddPlayer(params.data.element_type) || 
                                  bankBalance + 5 <= params.data.now_cost/10;
                button.innerText = '+';
                button.addEventListener('click', () => {
                  //myPlayers.push(allPlayers.find(player => player.id == params.data.id));
                  addPlayer(allPlayers.find(player => player.id == params.data.id));
                  updateTeamUI();
                  grid.refreshCells();
                  document.getElementById('saveButton').disabled = false;
                  document.getElementById('autoPickButton').disabled = true;
                });
                return button;
              }
            },
            { headerName: 'ID', field: 'id', hide: true },
            { headerName: 'Code', field: 'code', hide: true },
            { headerName: 'Photo', field: 'photo', hide: true },
            { headerName: 'Element Type', field: 'element_type', hide: true },
            { headerName: 'Web Name', width: 150, field: 'web_name', floatingFilter: true, pinned: 'left' },
            { headerName: 'First Name', field: 'first_name', hide: true },
            { headerName: 'Second Name', field: 'second_name', hide: true },
            {
              headerName: 'Price',
              field: 'now_cost',
              width: 100,
              valueGetter: (params) => params.data.now_cost / 10
            },
            { headerName: 'Total Points', width: 150, field: 'total_points' },
            {
              headerName: 'Form',
              field: 'form',
              width: 100,
              valueGetter: (params) => parseFloat(params.data.form)
            },
            {
              headerName: 'Predicted Points',
              field: 'ep_this',
              width: 150,
              valueGetter: (params) => parseFloat(params.data.ep_this)
            },
            {
              headerName: 'Next Predicted Points',
              field: 'ep_next',
              width: 150,
              valueGetter: (params) => parseFloat(params.data.ep_next)
            },
            {
              headerName: 'Chance of Playing This Round (%)',
              field: 'chance_of_playing_this_round',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
              headerName: 'Chance of Playing Next Round (%)',
              field: 'chance_of_playing_next_round',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            { headerName: 'Dreamteam Count', field: 'dreamteam_count', width: 250 },
            { headerName: 'Event Points', field: 'event_points' },
            {
              headerName: 'In Dreamteam',
              field: 'in_dreamteam',
              valueFormatter: (params) => params.value === null ? "N/A" : params.value ? "True" : "False"
            },
            {
              headerName: 'Points per Game',
              field: 'points_per_game',
              valueGetter: (params) => parseFloat(params.data.points_per_game)
            },
            {
              headerName: 'Selected by Percent (%)',
              field: 'selected_by_percent',
              valueGetter: (params) => parseFloat(params.data.selected_by_percent)
            },
            {
              headerName: 'Special',
              field: 'special',
              valueFormatter: (params) => params.value === null ? "N/A" : params.value ? "True" : "False"
            },
            {
              headerName: 'Squad Number',
              field: 'squad_number',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            { headerName: 'Status', field: 'status' },
            { headerName: 'Team', field: 'team' },
            { headerName: 'Team Code', field: 'team_code' },
            { headerName: 'Transfers In', field: 'transfers_in' },
            { headerName: 'Transfers In Event', field: 'transfers_in_event' },
            { headerName: 'Transfers Out', field: 'transfers_out' },
            { headerName: 'Transfers Out Event', field: 'transfers_out_event', width: 300 },
            {
              headerName: 'Value Form',
              field: 'value_form',
              valueGetter: (params) => parseFloat(params.data.value_form)
            },
            {
              headerName: 'Value Season',
              field: 'value_season',
              valueGetter: (params) => parseFloat(params.data.value_season)
            },
            { headerName: 'Minutes', field: 'minutes' },
            { headerName: 'Goals Scored', field: 'goals_scored' },
            { headerName: 'Assists', field: 'assists' },
            { headerName: 'Clean Sheets', field: 'clean_sheets' },
            { headerName: 'Goals Conceded', field: 'goals_conceded' },
            { headerName: 'Own Goals', field: 'own_goals' },
            { headerName: 'Penalties Saved', field: 'penalties_saved' },
            { headerName: 'Penalties Missed', field: 'penalties_missed' },
            { headerName: 'Yellow Cards', field: 'yellow_cards' },
            { headerName: 'Red Cards', field: 'red_cards' },
            { headerName: 'Saves', field: 'saves' },
            { headerName: 'Bonus', field: 'bonus' },
            { headerName: 'BPS', field: 'bps' },
            {
              headerName: 'Influence',
              field: 'influence',
              valueGetter: (params) => parseFloat(params.data.influence)
            },
            {
              headerName: 'Creativity',
              field: 'creativity',
              valueGetter: (params) => parseFloat(params.data.creativity)
            },
            {
              headerName: 'Threat',
              field: 'threat',
              valueGetter: (params) => parseFloat(params.data.threat)
            },
            {
              headerName: 'ICT Index',
              field: 'ict_index',
              valueGetter: (params) => parseFloat(params.data.ict_index)
            },
            { headerName: 'Starts', field: 'starts' },
            {
              headerName: 'Expected Goals',
              field: 'expected_goals',
              valueGetter: (params) => parseFloat(params.data.expected_goals)
            },
            {
              headerName: 'Expected Assists',
              field: 'expected_assists',
              valueGetter: (params) => parseFloat(params.data.expected_assists)
            },
            {
              headerName: 'Expected Goal Involvements',
              field: 'expected_goal_involvements',
              valueGetter: (params) => parseFloat(params.data.expected_goal_involvements)
            },
            {
              headerName: 'Expected Goals Conceded',
              field: 'expected_goals_conceded',
              valueGetter: (params) => parseFloat(params.data.expected_goals_conceded)
            },
            { headerName: 'Influence Rank', field: 'influence_rank' },
            { headerName: 'Influence Rank Type', field: 'influence_rank_type' },
            { headerName: 'Creativity Rank', field: 'creativity_rank' },
            { headerName: 'Creativity Rank Type', field: 'creativity_rank_type' },
            { headerName: 'Threat Rank', field: 'threat_rank' },
            { headerName: 'Threat Rank Type', field: 'threat_rank_type' },
            { headerName: 'ICT Index Rank', field: 'ict_index_rank' },
            { headerName: 'ICT Index Rank Type', field: 'ict_index_rank_type' },
            {
              headerName: 'Corners and Indirect Freekicks Order',
              field: 'corners_and_indirect_freekicks_order',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'corners_and_indirect_freekicks_text',
                headerName: "Corners and Indirect Freekicks Text",
            },
            {
              headerName: 'Direct Freekicks Order',
              field: 'direct_freekicks_order',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'direct_freekicks_text',
                headerName: "Direct Freekicks Text",
            },
            {
              headerName: 'Penalties Order',
              field: 'penalties_order',
              valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'penalties_text',
                headerName: "Penalties Text",
            },
            {
              headerName: 'Expected Goals per 90',
              field: 'expected_goals_per_90',
              valueGetter: (params) => parseFloat(params.data.expected_goals_per_90)
            },
            {
              headerName: 'Saves per 90',
              field: 'saves_per_90',
              valueGetter: (params) => parseFloat(params.data.saves_per_90)
            },
            {
              headerName: 'Expected Assists per 90',
              field: 'expected_assists_per_90',
              valueGetter: (params) => parseFloat(params.data.expected_assists_per_90)
            },
            {
              headerName: 'Expected Goal Involvements per 90',
              field: 'expected_goal_involvements_per_90',
              valueGetter: (params) => parseFloat(params.data.expected_goal_involvements_per_90)
            },
            {
              headerName: 'Expected Goals Conceded per 90',
              field: 'expected_goals_conceded_per_90',
              valueGetter: (params) => parseFloat(params.data.expected_goals_conceded_per_90)
            },
            { headerName: 'Goals Conceded per 90', field: 'goals_conceded_per_90' },
            { field: 'now_cost_rank', headerName: "Now Cost Rank" },
            { field: 'now_cost_rank_type', headerName: "Now Cost Rank Type" },
            {
                field: 'form_rank',
                headerName: "Form Rank",
            },
            {
                field: 'form_rank_type',
                headerName: "Form Rank Type",
            },
            {
                field: 'points_per_game_rank',
                headerName: "Points per Game Rank",
            },
            {
                field: 'points_per_game_rank_type',
                headerName: "Points per Game Rank Type",
            },
            {
                field: 'selected_rank',
                headerName: "Selected Rank",
            },
            {
                field: 'selected_rank_type',
                headerName: "Selected Rank Type",
            },
            {
                field: 'starts_per_90',
                headerName: "Starts per 90",
            },
            {
                field: 'clean_sheets_per_90',
                headerName: "Clean Sheets per 90",
            },
            {
                field: 'news',
                headerName: "News",
            },
            {
                field: 'news_added',
                headerName: "News Added",
            },
            {
                field: 'cost_change_event',
                headerName: "Cost Change Event",
            },
            {
                field: 'cost_change_event_fall',
                headerName: "Cost Change Event Fall",
            },
            {
                field: 'cost_change_start',
                headerName: "Cost Change Start",
            },
            {
                field: 'cost_change_start_fall',
                headerName: "Cost Change Start Fall",
            },
          ]
    };

    // Your Javascript code to create the Data Grid
    const myGridElement = document.querySelector('#myGrid');
    grid = agGrid.createGrid(myGridElement, gridOptions);
}

//Fetch data and render the grid once the data is resolved
getOverview().then(data => {
    teams = data.teams;
    populateTeamFilter();

    allPlayers = data.elements;
    filteredPlayers = allPlayers;

    getGameweeks().then(data => {
        gameweeks = data;
        selectedGameweek = getUpcomingGameweek().id;
        updateGameweekInfo();

        getFixtures().then(data => {
            fixtures = data;
    
            // Load the players from the cookie when the page loads
            loadPlayers();
            
            // Initial display of all filteredPlayers
            displayPlayers(filteredPlayers);
        });
    });
}).catch(error => {
    console.error('Error:', error);
});

// Function to get the upcoming gameweek where 'finished' is false
function getUpcomingGameweek() {
    // Find the first gameweek where 'finished' is false
    return gameweeks.find(gameweek => gameweek.finished === false);
}