const fs = require('fs');
const filepath = 'c:/Users/Yoosuf/Documents/Open-FPL-Insights/pages/managers/managers.js';
let code = fs.readFileSync(filepath, 'utf8');

// 1. Remove the DOMContentLoaded listener completely
const startIdx = code.indexOf("document.addEventListener('DOMContentLoaded', async () => {");
const endIdx = code.indexOf("});\n\nfunction addPlayers(picks) {") + 4; // Including the '});\n'

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + code.substring(endIdx);
    console.log("Removed DOMContentLoaded listener");
}

// 2. Inject managerId extraction into Initialize()
const initTarget = `async function Initialize() {
    if (!gameweeks || gameweeks.length === 0) {`;

const initReplacement = `async function Initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    let entryId = urlParams.get('entry');
    if (!entryId) {
        const match = document.cookie.match(new RegExp('(^| )managerId=([^;]+)'));
        if (match) entryId = match[2];
    }
    if (entryId) managerId = parseInt(entryId, 10);
    else alert('No player ID provided.');

    if (!gameweeks || gameweeks.length === 0) {`;

code = code.replace(initTarget, initReplacement);

// 3. Make Initialize await updateGameweekInfo
code = code.replace("updateGameweekInfo();\n}", "await updateGameweekInfo();\n}");

fs.writeFileSync(filepath, code);
console.log("Initialize patched in managers.js");
