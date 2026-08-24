// predictPoints.js - Algorithm Router
// Use this file to easily switch between different algorithms!

const ACTIVE_ALGORITHM = "V1"; // Change to "GPT" or "CLAUDE" to swap algorithms globally

function getExpectedPoints(player, fixture) {
    if (ACTIVE_ALGORITHM === "GPT") return getExpectedPoints_gpt(player, fixture);
    if (ACTIVE_ALGORITHM === "CLAUDE") return getExpectedPoints_claude(player, fixture);
    return getExpectedPoints_v1(player, fixture);
}

function calculateExpectedPointsCore(player, fixture) {
    if (ACTIVE_ALGORITHM === "GPT") return calculateExpectedPointsCore_gpt(player, fixture);
    if (ACTIVE_ALGORITHM === "CLAUDE") return calculateExpectedPointsCore_claude(player, fixture);
    return calculateExpectedPointsCore_v1(player, fixture);
}

function clearPredictionCache() {
    if (ACTIVE_ALGORITHM === "GPT") return clearPredictionCache_gpt();
    if (ACTIVE_ALGORITHM === "CLAUDE") return clearPredictionCache_claude();
    return clearPredictionCache_v1();
}

// Caching abstraction for data.js
function initPredictionCacheForCalc() {
    if (ACTIVE_ALGORITHM === "GPT") predictionCache_gpt = {};
    else if (ACTIVE_ALGORITHM === "CLAUDE") predictionCache_claude = {};
    else predictionCache_v1 = {};
}

function setPredictionCacheValue(key, value) {
    if (ACTIVE_ALGORITHM === "GPT") predictionCache_gpt[key] = value;
    else if (ACTIVE_ALGORITHM === "CLAUDE") predictionCache_claude[key] = value;
    else predictionCache_v1[key] = value;
}

function savePredictionCache() {
    if (ACTIVE_ALGORITHM === "GPT") {
        localStorage.setItem("fpl_predictions_v5_gpt", JSON.stringify(predictionCache_gpt));
    } else if (ACTIVE_ALGORITHM === "CLAUDE") {
        localStorage.setItem("fpl_predictions_v5_claude", JSON.stringify(predictionCache_claude));
    } else {
        localStorage.setItem("fpl_predictions_v5_v1", JSON.stringify(predictionCache_v1));
    }
}
