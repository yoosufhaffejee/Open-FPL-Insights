function getTeamShortName(teamId) {
    return teams.find(t => t.id == teamId).short_name;
}

// Function to format date as "Sat, 14 Sep 16:00"
function formatFixtureDate(kickoffTime) {
    const options = {
        weekday: 'short',  // e.g., "Sat"
        day: 'numeric',    // e.g., "14"
        month: 'short',    // e.g., "Sep"
        hour: '2-digit',   // e.g., "16"
        minute: '2-digit'  // e.g., "00"
    };
    return new Date(kickoffTime).toLocaleString(undefined, options); // Remove unwanted comma
}