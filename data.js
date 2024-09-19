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

const loadHistoricalData = (isRoot = true) => {
    fetch(isRoot ? 'fpl_data.csv' : '../../fpl_data.csv')
        .then(response => response.text())
        .then(csvText => {
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
            //console.log(data);
        })
        .catch(error => console.error('Error fetching the CSV file:', error));
}

// Initialize the page after fetching data
const setupPage = async () => {
    await fetchOverview();
    await fetchFixtures();
    await fetchGameweeks();

    // Initialize other functionalities or UI components here
    try {
        loadHistoricalData();
        Initialize(); // Ensure this function is defined elsewhere
    } catch (error) {
        //console.log("Init skipped");
    }

    try {
        loadHistoricalData(false);
        updateGameweek(); // Ensure this function is defined elsewhere
    } catch (error) {
        //console.log("Init Managers skipped");
    }
};

// Start the process
setupPage();