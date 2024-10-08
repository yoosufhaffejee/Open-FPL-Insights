function getTeamShortName(teamId) {
    return teams.find(t => t.id == teamId).short_name;
}

function formatFixtureDate(kickoffTime) {
    const options = {
        weekday: 'long',  // e.g., "Saturday"
        day: 'numeric',   // e.g., "14"
        month: 'long',    // e.g., "September"
        year: 'numeric',  // e.g., "2024"
    };
    
    return new Date(kickoffTime).toLocaleDateString(undefined, options);
}

// Function to format date as "Sat, 14 Sep 16:00"
function formatFixtureDateTime(kickoffTime) {
    const options = {
        weekday: 'short',  // e.g., "Sat"
        day: 'numeric',    // e.g., "14"
        month: 'short',    // e.g., "Sep"
        hour: '2-digit',   // e.g., "16"
        minute: '2-digit'  // e.g., "00"
    };
    return new Date(kickoffTime).toLocaleString(undefined, options); // Remove unwanted comma
}

// Function to get the upcoming gameweek where 'finished' is false
function getUpcomingGameweek() {
    // Find the first gameweek where 'finished' is false
    return gameweeks.find(gameweek => gameweek.finished === false);
}

function getLastGameweekId() {
    // Find the first gameweek where 'finished' is true
    return getUpcomingGameweek().id - 1;
}

// Helper function to get team details by ID
function getTeamById(teamId) {
    return teams.find(team => team.id === teamId);
}

// Helper function to get the difficulty class based on difficulty rating
function getDifficultyClass(difficulty) {
    switch (difficulty) {
        case 2:
            return 'bg-success'; // Green
        case 3:
            return 'bg-secondary'; // Grey
        case 4:
            return 'bg-warning'; // Yellow
        case 5:
            return 'bg-danger'; // Red
        default:
            return 'bg-light'; // Default
    }
}

// Helper function to map position to elementType
function getKeyByValue(pos) {
    const map = {
        gk: 1,  // Example mapping
        def: 2,
        mid: 3,
        fwd: 4
    };
    return map[pos];
}

function parseCSV(csvText) {
    const rows = csvText.split('\n').map(row => row.split(','));
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
        let obj = {};
        row.forEach((value, index) => {
            obj[headers[index]] = value;
        });
        return obj;
    });
    return data;
}

function getOpponentTeam(playerTeamId, fixture) {
    if (playerTeamId == fixture.team_a) {
        return teams.find(t => t.id == fixture.team_h).name;
    }

    if (playerTeamId == fixture.team_h) {
        return teams.find(t => t.id == fixture.team_a).name;
    }
}