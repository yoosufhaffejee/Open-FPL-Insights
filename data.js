let teams = [];
let gameweeks = [];
let fixtures = [];
let allPlayers = [];
let gameSettings = null;
let selectedGW = 1;

let db;


// Fetch general data
const fetchOverview = async (bypassCache = false) => {
    try {
        const data = await getOverview(bypassCache);
        teams = data.teams;
        allPlayers = data.elements;
        
        // Helper to blend early season stats with a realistic price-based proxy
        allPlayers.forEach(player => {
            const cost = player.now_cost / 10;
            const type = player.element_type;
            const minutes = player.minutes || 0;
            const weight = Math.min(1.0, minutes / 450); // Fully trust actual stats after ~5 games (450 mins)
            
            // xG Proxy
            let pxG = 0.01;
            if (type === 4) pxG = Math.max(0, (cost - 4.5) * 0.08 + 0.2);
            else if (type === 3) pxG = Math.max(0, (cost - 4.5) * 0.06 + 0.1);
            else if (type === 2) pxG = Math.max(0, (cost - 4.0) * 0.03 + 0.03);
            player.expected_goals_per_90 = (parseFloat(player.expected_goals_per_90) || 0) * weight + pxG * (1 - weight);
            
            // xA Proxy
            let pxA = 0.01;
            if (type === 4) pxA = Math.max(0, (cost - 4.5) * 0.04 + 0.1);
            else if (type === 3) pxA = Math.max(0, (cost - 4.5) * 0.06 + 0.1);
            else if (type === 2) pxA = Math.max(0, (cost - 4.0) * 0.04 + 0.05);
            player.expected_assists_per_90 = (parseFloat(player.expected_assists_per_90) || 0) * weight + pxA * (1 - weight);
            
            // Clean Sheet Proxy
            let pCS = 0.0;
            if (type === 1 || type === 2) pCS = Math.max(0.1, (cost - 4.0) * 0.1 + 0.2);
            else if (type === 3) pCS = Math.max(0.1, (cost - 4.5) * 0.08 + 0.2);
            player.clean_sheets_per_90 = (parseFloat(player.clean_sheets_per_90) || 0) * weight + pCS * (1 - weight);
            
            // xGC Proxy (Goals Conceded)
            let pxGC = 1.5;
            if (type === 1 || type === 2) pxGC = Math.max(0.5, 2.5 - (cost - 4.0) * 0.4);
            player.expected_goals_conceded_per_90 = (parseFloat(player.expected_goals_conceded_per_90) || 0) * weight + pxGC * (1 - weight);
        });
        
        gameSettings = data.game_settings;
        //console.log('Teams and players data loaded.');
    } catch (error) {
        console.error('Error fetching overview data:', error);
    }
};

// Fetch fixtures data
const fetchFixtures = async () => {
    try {
        fixtures = await getFixtures();
        //console.log('Fixtures data loaded.');
    } catch (error) {
        console.error('Error fetching fixtures data:', error);
    }
};

// Fetch gameweeks data
const fetchGameweeks = async () => {
    try {
        gameweeks = await getGameweeks();
        selectedGW = gameweeks.find(gameweek => gameweek.finished === false);
        //console.log('Gameweeks data loaded.');
    } catch (error) {
        console.error('Error fetching gameweeks data:', error);
    }
};

const getBasePath = () => {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src && src.endsWith('data.js')) {
            return src.replace('data.js', '');
        }
    }
    return '';
};

const loadHistoricalData = async () => {
    try {
        const sqlPromise = initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        const dataPromise = fetch(getBasePath() + 'fpl_data.sqlite').then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            return res.arrayBuffer();
        });
        
        const [SQL, buf] = await Promise.all([sqlPromise, dataPromise]);
        db = new SQL.Database(new Uint8Array(buf));
    } catch (error) {
        console.error('Error fetching the SQLite db:', error);
    }
}

// Initialize the page after fetching data
const setupPage = async () => {
    await fetchOverview();
    await fetchFixtures();
    await fetchGameweeks();

    if (!gameweeks || gameweeks.length === 0) {
        if (window.fplGameUpdating) {
            document.body.innerHTML = `
                <div class="container mt-5 text-center text-white p-5 border border-info rounded" style="background-color: #37003c; z-index: 10000; position: relative;">
                    <img src="https://logo.premierleague.com/img/lion-dark.svg" alt="FPL Logo" style="width: 150px; margin-bottom: 20px;">
                    <h2 class="text-white fw-bold mb-4">The game is updating and will be available soon.</h2>
                    <p class="fs-5">Please check back later.</p>
                    <p class="text-light opacity-75">FYI: The game usually becomes available as soon as the first match of the gameweek kicks off.</p>
                    <button class="btn btn-light fw-bold mt-4 px-4 py-2" onclick="window.location.reload()">Refresh</button>
                </div>
            `;
        } else {
            document.body.innerHTML = `
                <div class="container mt-5 text-center text-white p-5 border border-danger rounded bg-dark" style="z-index: 10000; position: relative;">
                    <h3 class="text-danger">Failed to load FPL Data</h3>
                    <p>Your network might be blocking the API requests.</p>
                    <p>Try switching from mobile data to Wi-Fi, or use a VPN.</p>
                    <button class="btn btn-primary mt-3" onclick="window.location.reload()">Retry</button>
                </div>
            `;
        }
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
        return;
    }

    // Call page-specific initializers if they exist
    if (typeof Initialize === 'function') {
        await Initialize();
    }
    if (typeof updateGameweek === 'function') {
        await updateGameweek();
    }

    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 300);
    }
};

// Start the process
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPage);
} else {
    setupPage();
}
let isCalculating = false;

window.calculateAllPredictions = async () => {
    if (isCalculating) return;
    isCalculating = true;

    const modalHTML = `
    <div class="modal fade show" id="calcModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.8); z-index: 10000;">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content text-center p-4 bg-dark text-white border border-secondary">
                <h4 id="calcStatus">Downloading FPL Data...</h4>
                <div class="progress mt-3" style="height: 25px;">
                    <div id="calcProgress" class="progress-bar progress-bar-striped progress-bar-animated bg-success text-center fw-bold" role="progressbar" style="width: 0%; line-height: 25px;">0%</div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    const progressText = document.getElementById("calcProgress");
    const statusText = document.getElementById("calcStatus");

    try {
        const sqlPromise = initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });

        const response = await fetch(getBasePath() + "fpl_data.sqlite");
        const reader = response.body.getReader();
        const contentLength = +response.headers.get("Content-Length") || 37015552;
        let receivedLength = 0;
        let chunks = [];

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            let percent = Math.round((receivedLength / contentLength) * 100);
            progressText.style.width = percent + "%";
            progressText.textContent = percent + "%";
        }

        statusText.textContent = "Loading Database...";
        let buf = new Uint8Array(receivedLength);
        let position = 0;
        for(let chunk of chunks) {
            buf.set(chunk, position);
            position += chunk.length;
        }

        const [SQL] = await Promise.all([sqlPromise]);
        db = new SQL.Database(buf);

        statusText.textContent = "Calculating Predictions...";
        progressText.style.width = "0%";
        progressText.textContent = "0%";

        clearPredictionCache();
        initPredictionCacheForCalc();

        const targetFixtures = fixtures;
        let totalCombos = allPlayers.length * targetFixtures.length;
        let doneCombos = 0;

        for (let player of allPlayers) {
            for (let fixture of targetFixtures) {
                if (fixture.team_a === player.team || fixture.team_h === player.team) {
                    let expectedPoints = calculateExpectedPointsCore(player, fixture);
                    const cacheKey = `${player.id}_${fixture.id}`;
                    if (typeof expectedPoints === 'object') {
                        setPredictionCacheValue(cacheKey, Number(expectedPoints.xPoints.toFixed(2)));
                    } else {
                        setPredictionCacheValue(cacheKey, Number(expectedPoints.toFixed(2)));
                    }
                }
                doneCombos++;
                if (doneCombos % 1000 === 0) {
                    let percent = Math.round((doneCombos / totalCombos) * 100);
                    progressText.style.width = percent + "%";
                    progressText.textContent = percent + "%";
                    await new Promise(r => setTimeout(r, 0));
                }
            }
            let ep = calculateExpectedPointsCore(player, null);
            if (typeof ep === 'object') {
                setPredictionCacheValue(`${player.id}_no_fixture`, Number(ep.xPoints.toFixed(2)));
            } else {
                setPredictionCacheValue(`${player.id}_no_fixture`, Number(ep.toFixed(2)));
            }
        }

        savePredictionCache();
        statusText.textContent = "Done!";
        progressText.style.width = "100%";
        progressText.textContent = "100%";

        setTimeout(() => {
            document.getElementById("calcModal").remove();
            isCalculating = false;
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error("Error calculating predictions:", error);
        statusText.textContent = "Error occurred";
        progressText.classList.remove("bg-success");
        progressText.classList.add("bg-danger");
        setTimeout(() => {
            document.getElementById("calcModal").remove();
            isCalculating = false;
        }, 3000);
    }
}



function checkPredictionsCache() {
    if (typeof hasValidPredictionCache !== 'function') return;
    
    if (!hasValidPredictionCache()) {
        const banner = document.createElement("div");
        banner.className = "alert alert-warning alert-dismissible fade show text-center";
        banner.style.margin = "10px";
        banner.innerHTML = `<strong>Predictions not calculated!</strong> Click <a href="#" class="alert-link" onclick="calculateAllPredictions(); return false;">here</a> to run the calculation. <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
        const nav = document.querySelector("nav");
        if(nav) nav.after(banner);
    }
}

// Call checkPredictionsCache when page is loaded
window.addEventListener("DOMContentLoaded", () => {
    setTimeout(checkPredictionsCache, 1000);
});



let errorLogs = [];

function showErrorLogsModal() {
    let modal = document.getElementById("errorLogsModal");
    if (!modal) {
        const modalHTML = `
        <div class="modal fade show" id="errorLogsModal" tabindex="-1" style="display: block; background: rgba(0,0,0,0.8); z-index: 10050;">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content bg-dark text-white border border-danger">
                    <div class="modal-header border-danger">
                        <h5 class="modal-title text-danger">Error Logs</h5>
                        <button type="button" class="btn-close btn-close-white" onclick="document.getElementById('errorLogsModal').remove()"></button>
                    </div>
                    <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                        <pre id="errorLogsContent" class="text-start" style="white-space: pre-wrap; font-size: 12px; color: #fff;"></pre>
                    </div>
                    <div class="modal-footer border-danger">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('errorLogsModal').remove()">Close</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML("beforeend", modalHTML);
        modal = document.getElementById("errorLogsModal");
    }
    const content = document.getElementById("errorLogsContent");
    content.textContent = errorLogs.join("\n\n");
}

function logError(msg, url, lineNo, columnNo, error) {
    const errorDetails = [
        `Time: ${new Date().toLocaleTimeString()}`,
        `Message: ${msg}`,
        `URL: ${url}`,
        `Line: ${lineNo}, Column: ${columnNo}`,
        `Error: ${error ? error.stack || error : "N/A"}`
    ].join("\n");
    errorLogs.push(errorDetails);
    showErrorLogsModal();
}

window.onerror = function (msg, url, lineNo, columnNo, error) {
    logError(msg, url, lineNo, columnNo, error);
    return false;
};

window.onunhandledrejection = function (event) {
    const msg = event.reason ? event.reason.message || event.reason : "Unhandled promise rejection";
    logError(msg, window.location.href, 0, 0, event.reason);
};



window.addEventListener("DOMContentLoaded", () => {
    // Check if we should show the Managers tab
    let showManagers = false;
    
    // 1. Is URL managers.html?
    if (window.location.pathname.includes("managers.html")) {
        showManagers = true;
    }
    
    // 2. Is there an entry in URL?
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("entry")) {
        showManagers = true;
    }
    
    // 3. Is managerId set in cookies?
    if (document.cookie.includes("managerId=")) {
        const cookieVal = document.cookie.split("; ").find(row => row.startsWith("managerId="));
        if (cookieVal) {
            const val = cookieVal.split("=")[1];
            if (val && val !== "0" && val !== "") {
                showManagers = true;
            }
        }
    }
    
    if (showManagers) {
        const tab = document.getElementById("nav-managers-tab");
        if (tab) {
            tab.style.display = "";
        }
    }
});

