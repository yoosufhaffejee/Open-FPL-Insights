function optimizeTeam(players) {

    // Find the existing captain and adjust their predicted points
    players.forEach(player => {
        if (player.isCaptain) {
            player.predicted_points /= 2;  // Divide the captain's points by 2
        }
        player.isCaptain = false;  // Reset captain flag, we will assign a new one later
    });

    // Categorize players by position (element_type)
    const gk = players.filter(p => p.element_type === 1).sort((a, b) => b.predicted_points - a.predicted_points);
    const def = players.filter(p => p.element_type === 2).sort((a, b) => b.predicted_points - a.predicted_points);
    const mid = players.filter(p => p.element_type === 3).sort((a, b) => b.predicted_points - a.predicted_points);
    const fwd = players.filter(p => p.element_type === 4).sort((a, b) => b.predicted_points - a.predicted_points);

    let bestTeam = [];
    let maxPoints = 0;

    // Try all valid formations (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD)
    for (let defCount = 3; defCount <= 5; defCount++) {
        for (let midCount = 2; midCount <= 5; midCount++) {
            for (let fwdCount = 1; fwdCount <= 3; fwdCount++) {
                // Ensure the total number of players is exactly 11
                if (1 + defCount + midCount + fwdCount === 11) {
                    // Select the top players for the current formation
                    const selectedGK = gk.slice(0, 1);
                    const selectedDEF = def.slice(0, defCount);
                    const selectedMID = mid.slice(0, midCount);
                    const selectedFWD = fwd.slice(0, fwdCount);

                    // Combine the selected players
                    const currentTeam = [...selectedGK, ...selectedDEF, ...selectedMID, ...selectedFWD];

                    // Calculate total points for the current team
                    const currentPoints = currentTeam.reduce((sum, player) => sum + player.predicted_points, 0);

                    // Check if this is the best team so far
                    if (currentPoints > maxPoints) {
                        maxPoints = currentPoints;
                        bestTeam = currentTeam;
                    }
                }
            }
        }
    }

    // Set the captain as the player with the highest predicted points
    if (bestTeam.length > 0) {
        let highestPointsPlayer = bestTeam.reduce((prev, current) => (prev.predicted_points > current.predicted_points ? prev : current), bestTeam[0]);

        // Mark the highest points player as captain
        bestTeam.forEach(player => {
            player.isCaptain = player.id === highestPointsPlayer.id;
            if (player.isCaptain) {
                player.predicted_points = player.predicted_points * 2;
            }
        });
    }

    return bestTeam;
}