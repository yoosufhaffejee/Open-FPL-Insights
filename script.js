//https://resources.premierleague.com/premierleague/photos/filteredPlayers/110x140/p118748.png
document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of filteredPlayers
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});


const proxyURL = 'https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?';
const baseURL = 'https://fantasy.premierleague.com/api/';

const reqType = {
    bootstrap: 'bootstrap-static/', //Overview
    element: 'element-summary/', //Players (playderID)
    events: 'events/', // Get all gameweeks
    event: 'event/',  //A selected gameweek
    entry: 'entry/', //Get a team
    elementTypes: 'element-types/', // Get all player positions
    fixtures: 'fixtures/', //Get all fixtures
    gameweekFixtures: 'fixtures/?event/', //Get all fixtures for a specified gameweek (gameweek number)
    gameweekLive: 'event/gw?/live/', //Get GW live data
    managerTeam: 'entry/teamId?/',
    teams: 'teams/', //Get all teams,
    leagueClassicStanding: 'leagues-classic/' //Get league standing at current gameweek.
}

const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    const response = await fetch(proxyURL + endpointUrl);
    const myJson = await response.json();
    return myJson
}

const getBootstrap = async () => {
    const data = await doCORSRequest(reqType.bootstrap);
    return data;
}

const getGameweeks = async () => {
    const data = await doCORSRequest(reqType.events);
    return data;
}

const getLeague = async (id) => {
    const data = await doCORSRequest(`${reqType.leagueClassicStanding}${id}/standings/`);
    return data;
}

const getPlayer = async (id) => {
    const data = await doCORSRequest(`${reqType.element}${id}/`);
    return data;
}

const getFixtures = async () => {
    const data = await doCORSRequest(reqType.fixtures);
    return data;
}

const getTeam = async (id) => {
    const data = await doCORSRequest(`${reqType.entry}/${id}/`);
    return data;
}

const getTeamyByGW = async (id, gameweek) => {
    const data = await doCORSRequest(`${reqType.entry}/${id}/${reqType.event}/${gameweek}/picks/`);
    return data;
}

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
            fixtures.forEach((fixture, index) => {
                if (fixtureElements[index]) {
                    fixtureElements[index].querySelector('.predicted-points').textContent = 0;
                    fixtureElements[index].querySelector('.fixture-detail').textContent = 'FIX (H)';
                }
            });
        }
    });

    let overallRating = 0;
    let predictedPoints = 0;
    let gameweekRating = 0;
    bankBalance = 100;

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
                fixtures.forEach((fixture, index) => {
                    if (fixtureElements[index]) {
                        fixtureElements[index].querySelector('.predicted-points').textContent = fixture.points || 0;
                        fixtureElements[index].querySelector('.fixture-detail').textContent = fixture.detail || '';
                    }
                });

                //TODO: Use the element not player
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
        grid.updateConfig({
            data: filteredPlayers,
        }).forceRender();

        return;
    }

    grid = new gridjs.Grid({
        columns: [
            { 
                name: 'Actions',
                formatter: (cell, row) => {
                  return gridjs.h('button', {
                    className: 'btn btn-primary',
                    disabled: myPlayers.some(player => player?.web_name === row.cells[5].data) || !canAddPlayer(row.cells[4].data) || bankBalance <= row.cells[8].data,
                    onClick: () => {
                        myPlayers.push(allPlayers.find(player => player.id == row.cells[1].data));
                        grid.forceRender();
                        updateTeamUI();
                        document.getElementById('saveButton').disabled = false;
                    }
                  }, '+');
                }
            },
            {
                id: 'id',
                name: "ID",
                hidden: true
            },
            {
                id: 'code',
                name: "Code",
                hidden: true
            },
            {
                id: 'photo',
                name: "Photo",
                hidden: true
            },
            {
                id: 'element_type',
                name: "Element Type",
                hidden: true
            },
            {
                id: 'web_name',
                name: "Web Name",
                width: '150vw'
            },
            {
                id: 'first_name',
                name: "First Name",
                hidden: true
            },
            {
                id: 'second_name',
                name: "Second Name",
                hidden: true
            },
            {
                id: 'now_cost',
                name: "Price",
                data: (row) => (row.now_cost / 10),
                width: '150vw'
            },
            {
                id: 'total_points',
                name: "Total Points",
                width: '200vw'
            },
            {
                id: 'form',
                name: "Form",
                data: (row) => parseFloat(row.form),
                width: '150vw'
            },
            {
                id: 'ep_this',
                name: "Predicted Points",
                data: (row) => parseFloat(row.ep_this),
                width: '200vw'
            },
            {
                id: 'ep_next',
                name: "Next Predicted Points",
                data: (row) => parseFloat(row.ep_next),
                width: '250vw'
            },
            {
                id: 'chance_of_playing_this_round',
                name: "Chance of Playing This Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '430vw'
            },
            {
                id: 'chance_of_playing_next_round',
                name: "Chance of Playing Next Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '430vw'
            },
            {
                id: 'dreamteam_count',
                name: "Dreamteam Count",
                width: '250vw'
            },
            {
                id: 'event_points',
                name: "Event Points",
                width: '200vw'
            },
            {
                id: 'in_dreamteam',
                name: "In Dreamteam",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False",
                width: '200vw'
            },
            {
                id: 'points_per_game',
                name: "Points per Game",
                data: (row) => parseFloat(row.points_per_game),
                width: '200vw'
            },
            {
                id: 'selected_by_percent',
                name: "Selected by Percent (%)",
                data: (row) => parseFloat(row.selected_by_percent),
                width: '300vw'
            },
            {
                id: 'special',
                name: "Special",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False",
                width: '150vw'
            },
            {
                id: 'squad_number',
                name: "Squad Number",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '200vw'
            },
            {
                id: 'status',
                name: "Status",
                width: '150vw'
            },
            {
                id: 'team',
                name: "Team",
                width: '150vw'
            },
            {
                id: 'team_code',
                name: "Team Code",
                width: '150vw'
            },
            {
                id: 'transfers_in',
                name: "Transfers In",
                width: '200vw'
            },
            {
                id: 'transfers_in_event',
                name: "Transfers In Event",
                width: '200vw'
            },
            {
                id: 'transfers_out',
                name: "Transfers Out",
                width: '200vw'
            },
            {
                id: 'transfers_out_event',
                name: "Transfers Out Event",
                width: '300vw'
            },
            {
                id: 'value_form',
                name: "Value Form",
                data: (row) => parseFloat(row.value_form),
                width: '200vw'
            },
            {
                id: 'value_season',
                name: "Value Season",
                data: (row) => parseFloat(row.value_season),
                width: '200vw'
            },
            {
                id: 'minutes',
                name: "Minutes",
                width: '150vw'
            },
            {
                id: 'goals_scored',
                name: "Goals Scored",
                width: '200vw'
            },
            {
                id: 'assists',
                name: "Assists",
                width: '150vw'
            },
            {
                id: 'clean_sheets',
                name: "Clean Sheets",
                width: '200vw'
            },
            {
                id: 'goals_conceded',
                name: "Goals Conceded",
                width: '200vw'
            },
            {
                id: 'own_goals',
                name: "Own Goals",
                width: '150vw'
            },
            {
                id: 'penalties_saved',
                name: "Penalties Saved",
                width: '200vw'
            },
            {
                id: 'penalties_missed',
                name: "Penalties Missed",
                width: '200vw'
            },
            {
                id: 'yellow_cards',
                name: "Yellow Cards",
                width: '200vw'
            },
            {
                id: 'red_cards',
                name: "Red Cards",
                width: '150vw'
            },
            {
                id: 'saves',
                name: "Saves",
                width: '150vw'
            },
            {
                id: 'bonus',
                name: "Bonus",
                width: '150vw'
            },
            {
                id: 'bps',
                name: "BPS",
                width: '150vw'
            },
            {
                id: 'influence',
                name: "Influence",
                data: (row) => parseFloat(row.influence),
                width: '150vw'
            },
            {
                id: 'creativity',
                name: "Creativity",
                data: (row) => parseFloat(row.creativity),
                width: '150vw'
            },
            {
                id: 'threat',
                name: "Threat",
                data: (row) => parseFloat(row.threat),
                width: '150vw'
            },
            {
                id: 'ict_index',
                name: "ICT Index",
                data: (row) => parseFloat(row.ict_index),
                width: '150vw'
            },
            {
                id: 'starts',
                name: "Starts",
                width: '150vw'
            },
            {
                id: 'expected_goals',
                name: "Expected Goals",
                data: (row) => parseFloat(row.expected_goals),
                width: '200vw'
            },
            {
                id: 'expected_assists',
                name: "Expected Assists",
                data: (row) => parseFloat(row.expected_assists),
                width: '200vw'
            },
            {
                id: 'expected_goal_involvements',
                name: "Expected Goal Involvements",
                data: (row) => parseFloat(row.expected_goal_involvements),
                width: '430vw'
            },
            {
                id: 'expected_goals_conceded',
                name: "Expected Goals Conceded",
                data: (row) => parseFloat(row.expected_goals_conceded),
                width: '430vw'
            },
            {
                id: 'influence_rank',
                name: "Influence Rank",
                width: '200vw'
            },
            {
                id: 'influence_rank_type',
                name: "Influence Rank Type",
                width: '200vw'
            },
            {
                id: 'creativity_rank',
                name: "Creativity Rank",
                width: '200vw'
            },
            {
                id: 'creativity_rank_type',
                name: "Creativity Rank Type",
                width: '200vw'
            },
            {
                id: 'threat_rank',
                name: "Threat Rank",
                width: '200vw'
            },
            {
                id: 'threat_rank_type',
                name: "Threat Rank Type",
                width: '200vw'
            },
            {
                id: 'ict_index_rank',
                name: "ICT Index Rank",
                width: '200vw'
            },
            {
                id: 'ict_index_rank_type',
                name: "ICT Index Rank Type",
                width: '200vw'
            },
            {
                id: 'corners_and_indirect_freekicks_order',
                name: "Corners and Indirect Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '200vw'
            },
            {
                id: 'corners_and_indirect_freekicks_text',
                name: "Corners and Indirect Freekicks Text",
                width: '200vw'
            },
            {
                id: 'direct_freekicks_order',
                name: "Direct Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '200vw'
            },
            {
                id: 'direct_freekicks_text',
                name: "Direct Freekicks Text",
                width: '200vw'
            },
            {
                id: 'penalties_order',
                name: "Penalties Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '200vw'
            },
            {
                id: 'penalties_text',
                name: "Penalties Text",
                width: '200vw'
            },
            {
                id: 'expected_goals_per_90',
                name: "Expected Goals per 90",
                width: '200vw'
            },
            {
                id: 'saves_per_90',
                name: "Saves per 90",
                width: '200vw'
            },
            {
                id: 'expected_assists_per_90',
                name: "Expected Assists per 90",
                width: '430vw'
            },
            {
                id: 'expected_goal_involvements_per_90',
                name: "Expected Goal Involvements per 90",
                width: '430vw'
            },
            {
                id: 'expected_goals_conceded_per_90',
                name: "Expected Goals Conceded per 90",
                width: '430vw'
            },
            {
                id: 'goals_conceded_per_90',
                name: "Goals Conceded per 90",
                width: '430vw'
            },
            {
                id: 'now_cost_rank',
                name: "Now Cost Rank",
                width: '200vw'
            },
            {
                id: 'now_cost_rank_type',
                name: "Now Cost Rank Type",
                width: '200vw'
            },
            {
                id: 'form_rank',
                name: "Form Rank",
                width: '200vw'
            },
            {
                id: 'form_rank_type',
                name: "Form Rank Type",
                width: '200vw'
            },
            {
                id: 'points_per_game_rank',
                name: "Points per Game Rank",
                width: '200vw'
            },
            {
                id: 'points_per_game_rank_type',
                name: "Points per Game Rank Type",
                width: '200vw'
            },
            {
                id: 'selected_rank',
                name: "Selected Rank",
                width: '200vw'
            },
            {
                id: 'selected_rank_type',
                name: "Selected Rank Type",
                width: '200vw'
            },
            {
                id: 'starts_per_90',
                name: "Starts per 90",
                width: '200vw'
            },
            {
                id: 'clean_sheets_per_90',
                name: "Clean Sheets per 90",
                width: '200vw'
            },
            {
                id: 'news',
                name: "News",
                width: '300vw'
            },
            {
                id: 'news_added',
                name: "News Added",
                data: (row) => new Date(row.news_added).toISOString(),
                width: '200vw'
            },
            {
                id: 'cost_change_event',
                name: "Cost Change Event",
                width: '300vw'
            },
            {
                id: 'cost_change_event_fall',
                name: "Cost Change Event Fall",
                width: '300vw'
            },
            {
                id: 'cost_change_start',
                name: "Cost Change Start",
                width: '300vw'
            },
            {
                id: 'cost_change_start_fall',
                name: "Cost Change Start Fall",
                width: '300vw'
            }
        ],
        data: filteredPlayers,
        fixedHeader: true,
        resizable: true,
        search: true,
        sort: true,
        autoWidth: true,
        pagination: {
            limit: 10,
            summary: true
        }
    }).render(document.getElementById("dataGrid"));
}

//Fetch data and render the grid once the data is resolved
getBootstrap().then(data => {
    teams = data.teams;
    allPlayers = data.elements;
    filteredPlayers = allPlayers;

    // Load the players from the cookie when the page loads
    loadPlayers();

    // Initial display of all filteredPlayers
    displayPlayers(filteredPlayers);
}).catch(error => {
    console.error('Error:', error);
});