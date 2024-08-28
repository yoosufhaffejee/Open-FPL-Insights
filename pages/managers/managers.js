document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const entryId = urlParams.get('entry');

    if (entryId) {
        try {
            // Replace with the actual method to fetch player data
            const playerData = await getPlayerData(entryId);
            displayPlayerData(playerData);
        } catch (error) {
            console.error('Error fetching player data:', error);
            alert('Failed to fetch player data.');
        }
    } else {
        alert('No player ID provided.');
    }
});

const getPlayerData = async (entryId) => {
    // Dummy function, replace with actual API call
    return {
        player_name: 'John Doe',
        team_name: 'Doe United',
        total_points: 120,
        rank: 1
    };
};

const displayPlayerData = (data) => {
    const playerDetailsDiv = document.getElementById('playerDetails');
    playerDetailsDiv.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">${data.player_name}</h5>
                <p class="card-text"><strong>Team Name:</strong> ${data.team_name}</p>
                <p class="card-text"><strong>Total Points:</strong> ${data.total_points}</p>
                <p class="card-text"><strong>Rank:</strong> ${data.rank}</p>
            </div>
        </div>
    `;
};