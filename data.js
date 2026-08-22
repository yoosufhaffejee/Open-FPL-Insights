let teams = [];
let gameweeks = [];
let fixtures = [];
let allPlayers = [];
let selectedGW = 1;
let historicalData = [];

// Store historical data in a lookup table based on player names for faster lookup
const historicalDataCache = new Map();

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
        const response = await fetch(getBasePath() + 'fpl_data.csv');
        if (!response.ok) throw new Error('Network response was not ok');
        const csvText = await response.text();
        const data = parseCSV(csvText);
        historicalData = data;

        // Build cache
        historicalData.forEach(entry => {
            let playerName = entry.name;
            if (!historicalDataCache.has(playerName)) {
                historicalDataCache.set(playerName, []);
            }
            historicalDataCache.get(playerName).push(entry);
        });
    } catch (error) {
        console.error('Error fetching the CSV file:', error);
    }
}

// Initialize the page after fetching data
const setupPage = async () => {
    await fetchOverview();
    await fetchFixtures();
    await fetchGameweeks();

    await loadHistoricalData();

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