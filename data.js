let teams = [];
let gameweeks = [];
let fixtures = [];
let allPlayers = [];
let selectedGW = 1;

let db;


// Fetch general data
const fetchOverview = async () => {
    try {
        const data = await getOverview();
        teams = data.teams;
        allPlayers = data.elements;
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
        document.body.innerHTML = `
            <div class="container mt-5 text-center text-white p-5 border border-danger rounded bg-dark" style="z-index: 10000; position: relative;">
                <h3 class="text-danger">Failed to load FPL Data</h3>
                <p>Your network might be blocking the API requests.</p>
                <p>Try switching from mobile data to Wi-Fi, or use a VPN.</p>
                <button class="btn btn-primary mt-3" onclick="window.location.reload()">Retry</button>
            </div>
        `;
        const loader = document.getElementById('global-loader');
        if (loader) loader.style.display = 'none';
        return;
    }

    // Call page-specific initializers if they exist
    if (typeof Initialize === 'function') {
        Initialize();
    }
    if (typeof updateGameweek === 'function') {
        updateGameweek();
    }

    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 300);
    }
};

// Start the process
setupPage();
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
        predictionCache = {};

        const remainingFixtures = fixtures.filter(f => !f.finished);
        let totalCombos = allPlayers.length * remainingFixtures.length;
        let doneCombos = 0;

        for (let player of allPlayers) {
            for (let fixture of remainingFixtures) {
                if (fixture.team_a === player.team || fixture.team_h === player.team) {
                    let expectedPoints = calculateExpectedPointsCore(player, fixture);
                    const cacheKey = `${player.id}_${fixture.id}`;
                    predictionCache[cacheKey] = expectedPoints;
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
            predictionCache[`${player.id}_no_fixture`] = ep;
        }

        localStorage.setItem("fpl_predictions", JSON.stringify(predictionCache));
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
    const stored = localStorage.getItem("fpl_predictions");
    if (!stored || Object.keys(JSON.parse(stored)).length === 0) {
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
                        <pre id="errorLogsContent" class="text-start" style="white-space: pre-wrap; font-size: 12px;"></pre>
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

