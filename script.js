document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of filteredPlayers
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});

document.getElementById('prevGameweek').addEventListener('click', () => {
    // Logic to go to the previous game week
    console.log('Previous game week');
});

document.getElementById('nextGameweek').addEventListener('click', () => {
    // Logic to go to the next game week
    console.log('Next game week');
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
    const position = document.querySelector('.position-button[data-position].selected')?.getAttribute('data-position') || '0';
    const maxPrice = document.getElementById('price-range').value;

    let result = filteredPlayers;

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

function canAddPlayer(positionType) {
    const positionPrefix = positionMap[positionType];
    return filledSlots[positionPrefix] < maxSlots[positionPrefix];
}

function updateTeamUI() {
    // Reset the filledSlots count at the start of each update
    for (let position in filledSlots) {
        filledSlots[position] = 0;
    }

    // Clear UI
    var playerElements = document.querySelectorAll(".player");
    playerElements.forEach(playerElement => {
        if (playerElement) {
            // Update the player name
            playerElement.querySelector('h5').textContent = 'Player';

            // Update the player image (e.g., jersey image)
            playerElement.querySelector('img').src = 'assets/empty-jersey.png';

            // Update the fixtures and predicted points
            const fixtureElements = playerElement.querySelectorAll('.fixture');
            fixtureElements.forEach(fixtureElement => {
                fixtureElement.querySelector('.predicted-points').textContent = 0;
                fixtureElement.querySelector('.fixture-detail').textContent = 'FIX (H)';
            });
        }
    });

    let overallRating = 0;
    let predictedPoints = 0;
    let gameweekRating = 0;
    bankBalance = 100;

    // Determine the upcoming gameweeks
    const upcomingGameweeks = gameweeks.filter(gw => !gw.finished).slice(0, 3);

    // Iterate through each player
    myPlayers.forEach(player => {
        // Update bank balance and format to 2 decimal places
        bankBalance -= player.now_cost / 10;
        const formattedBalance = bankBalance.toFixed(1);
        updateTeamInfo("Bank Balance", formattedBalance + "m");

        // Calc points
        predictedPoints += ((parseFloat(player.ep_next) + parseFloat(player.form))/2);
        updateTeamInfo("Predicted Points", parseInt(predictedPoints));

        const positionPrefix = positionMap[player.element_type];

        if (positionPrefix) {
            // Determine the correct slot ID
            const slotId = `${positionPrefix}${++filledSlots[positionPrefix]}`;

            // Get the player element by ID
            const playerElement = document.getElementById(slotId);

            if (playerElement) {
                // Update the player name
                playerElement.querySelector('h5').textContent = `${player.web_name} (${player.now_cost/10}m)` || 'Player (7.0m)';

                // Update the player image (e.g., jersey image)
                playerElement.querySelector('img').src = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png` || 'assets/empty-jersey.png';

                // Update the fixtures and predicted points
                const fixtureElements = playerElement.querySelectorAll('.fixture');
                
                // Loop through each upcoming gameweek and find relevant fixtures for the player
                upcomingGameweeks.forEach((upcomingGameweek, index) => {
                    const playerFixture = fixtures.find(fixture => 
                        fixture.event === upcomingGameweek.id && 
                        (fixture.team_a === player.team || fixture.team_h === player.team)
                    );

                    if (playerFixture && fixtureElements[index]) {
                        let playerTeam = teams.find(team => team.id === player.team);

                        // Determine if the match is home or away
                        let isHomeFixture = false;
                        let opponentTeam;

                        if (playerFixture.team_a === player.team) {
                            const homeTeam = teams.find(team => team.id === playerFixture.team_h);
                            opponentTeam = homeTeam;
                            fixtureElements[index].querySelector('.fixture-detail').textContent = `${homeTeam.short_name} (A)`;
                        } else {
                            isHomeFixture = true;
                            const awayTeam = teams.find(team => team.id === playerFixture.team_a);
                            opponentTeam = awayTeam;
                            fixtureElements[index].querySelector('.fixture-detail').textContent = `${awayTeam.short_name} (H)`;
                        }

                        // Set predicted points
                        if (index === 0) {
                            fixtureElements[index].querySelector('.predicted-points').textContent = player.ep_next;
                        }
                        if (index === 1) {
                            let expectedPoints = 0;
                            if (opponentTeam.strength <= 3) {
                                let initialExpectedPoints = (parseFloat(player.form) + parseFloat(player.ep_next)) / 2;
                                let strengthAdjustment = (opponentTeam.strength * 10) / 100;
                                expectedPoints = initialExpectedPoints + (initialExpectedPoints * strengthAdjustment);
                            }
                            else {
                                let initialExpectedPoints = (parseFloat(player.form) + parseFloat(player.ep_next)) / 2;
                                let strengthAdjustment = (opponentTeam.strength * 10) / 100;
                                expectedPoints = initialExpectedPoints - (initialExpectedPoints * strengthAdjustment);
                            }

                            fixtureElements[index].querySelector('.predicted-points').textContent = expectedPoints.toFixed(1);
                        }
                        if (index === 2) {
                            let expectedPoints = 0;
                            if (opponentTeam.strength <= 3) {
                                let initialExpectedPoints = (parseFloat(player.form) + parseFloat(player.ep_next)) / 2;
                                let strengthAdjustment = (opponentTeam.strength * 10) / 100;
                                expectedPoints = initialExpectedPoints + (initialExpectedPoints * strengthAdjustment);
                            }
                            else {
                                let initialExpectedPoints = (parseFloat(player.form) + parseFloat(player.ep_next)) / 2;
                                let strengthAdjustment = (opponentTeam.strength * 10) / 100;
                                expectedPoints = initialExpectedPoints - (initialExpectedPoints * strengthAdjustment);
                            }

                            fixtureElements[index].querySelector('.predicted-points').textContent = expectedPoints.toFixed(1);
                        }
                    }
                });

                // Set up event listeners or other dynamic behaviors
                setupPlayerActions(playerElement, player);
            }
        }
    });
}

function setupPlayerActions(playerElement, player) {
    // Example: Set up swap button
    const swapButton = playerElement.querySelector('.icon-button .fa-exchange-alt');
    if (swapButton) {
        swapButton.addEventListener('click', () => {
            swapPlayer(player);
        });
    }

    // Example: Set up trash button
    const trashButton = playerElement.querySelector('.icon-button .fa-trash');
    if (trashButton) {
        trashButton.addEventListener('click', () => {
            removePlayer(player);
        });
    }

    // Example: Set up captain button
    const captainButton = playerElement.querySelector('.icon-button .fa-crown');
    if (captainButton) {
        captainButton.addEventListener('click', () => {
            captainPlayer(player);
        });
    }

    // Example: Set up vice button
    const viceButton = playerElement.querySelector('.icon-button .fa-star');
    if (viceButton) {
        viceButton.addEventListener('click', () => {
            vicePlayer(player);
        });
    }

    // Example: Set up info button
    const infoButton = playerElement.querySelector('.icon-button .fa-info-circle');
    if (infoButton) {
        infoButton.addEventListener('click', () => {
            showPlayerInfo(player);
        });
    }

    // Add other buttons' functionalities similarly
}

function swapPlayer(player) {

}

function removePlayer(player) {
    // Find the index of the player to remove
    const playerIndex = myPlayers.findIndex(p => p.id === player.id);
    
    // Check if the player exists in the array
    if (playerIndex !== -1) {
        // Remove the player from the array
        myPlayers.splice(playerIndex, 1);
        
        // Optionally, update the UI to reflect the change
        updateTeamUI();
    } else {
        console.log(`Player with ID ${player.Id} not found.`);
    }
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

function loadPlayers() {
    // Get the cookies and split them into an array
    const cookies = document.cookie.split(';');

    // Find the myPlayers cookie
    const myPlayersCookie = cookies.find(cookie => cookie.trim().startsWith('myPlayers='));

    if (myPlayersCookie) {
        // Extract the JSON string from the cookie and parse it
        const idsJSON = myPlayersCookie.split('=')[1];
        const playerIds = JSON.parse(idsJSON);

        // Reconstruct myPlayers using player IDs from allPlayers
        myPlayers = playerIds.map(id => allPlayers.find(player => player.id === id));

        myPlayers.forEach(player => {
            // Calculate filled slots
            const positionPrefix = positionMap[player.element_type];
            if (positionPrefix) {
                ++filledSlots[positionPrefix]
            }
        });
        
        updateTeamUI();
    }
}

function savePlayers() {
    // Disable the Save button
    document.getElementById('saveButton').disabled = true;

    // Extract player IDs from the myPlayers array
    const playerIds = myPlayers.map(player => player.id);

    // Convert the playerIds array to a JSON string
    const idsJSON = JSON.stringify(playerIds);

    // Save the JSON string in a cookie
    document.cookie = `myPlayers=${idsJSON}; path=/; max-age=31536000`; // Cookie expires in 1 year
}

function resetPlayers() {
    // Reset your myPlayers array (example: clear all players)
    myPlayers = [];

    // Enable the Save button again (if needed)
    document.getElementById('saveButton').disabled = false;
    updateTeamUI();

    // Update Grid
    grid.forceRender();
}

let grid = null;
// Function to display filteredPlayers (you can customize this)
function displayPlayers(filteredPlayers) {
    filteredPlayers.sort((a, b) => b.total_points - a.total_points);

    if (grid) {
        grid.updateGridOptions({
            rowData: filteredPlayers
        })
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
                                  bankBalance <= params.data.now_cost/10;
                button.innerText = '+';
                button.addEventListener('click', () => {
                  myPlayers.push(allPlayers.find(player => player.id == params.data.id));
                  grid.refreshCells();
                  updateTeamUI();
                  document.getElementById('saveButton').disabled = false;
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
    allPlayers = data.elements;
    filteredPlayers = allPlayers;

    getGameweeks().then(data => {
        gameweeks = data;

        getFixtures().then(data => {
            fixtures = data;

            selectBestTeam(allPlayers);
    
            // Load the players from the cookie when the page loads
            loadPlayers();
            
            // Initial display of all filteredPlayers
            displayPlayers(filteredPlayers);
        });
    });
}).catch(error => {
    console.error('Error:', error);
});