// predictPoints.js - Algorithm Router
// Use this file to easily switch between different algorithms!

const ACTIVE_ALGORITHM = "V1"; // Change to "GPT" or "CLAUDE" to swap algorithms globally

function getExpectedPoints(player, fixture) {
    if (ACTIVE_ALGORITHM === "GPT") {
        return getExpectedPoints_gpt(player, fixture);
    } else if (ACTIVE_ALGORITHM === "CLAUDE") {
        return getExpectedPoints_claude(player, fixture);
    } else {
        return getExpectedPoints_v1(player, fixture);
    }
}

function clearPredictionCache() {
    if (ACTIVE_ALGORITHM === "GPT") {
        return clearPredictionCache_gpt();
    } else if (ACTIVE_ALGORITHM === "CLAUDE") {
        return clearPredictionCache_claude();
    } else {
        return clearPredictionCache_v1();
    }
}
