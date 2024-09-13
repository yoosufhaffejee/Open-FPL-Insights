let teams = [];
let gameweeks = [];
let fixtures = [];
let allPlayers = [];
let selectedGW = 1;
let historicalData = [];

// Fetch general data
const fetchOverview = async () => {
    try {
        const data = await getOverview();
        teams = data.teams;
        allPlayers = data.elements;
        console.log('Teams and players data loaded.');
    } catch (error) {
        console.error('Error fetching overview data:', error);
    }
};

// Fetch fixtures data
const fetchFixtures = async () => {
    try {
        fixtures = await getFixtures();
        console.log('Fixtures data loaded.');
    } catch (error) {
        console.error('Error fetching fixtures data:', error);
    }
};

// Fetch gameweeks data
const fetchGameweeks = async () => {
    try {
        gameweeks = await getGameweeks();
        selectedGW = gameweeks.find(gameweek => gameweek.finished === false);
        console.log('Gameweeks data loaded.');
    } catch (error) {
        console.error('Error fetching gameweeks data:', error);
    }
};

const loadHistoricalData = () => {
    fetch('fpl_data.csv')
        .then(response => response.text())
        .then(csvText => {
            const data = parseCSV(csvText);
            historicalData = data;
            console.log(data);
        })
        .catch(error => console.error('Error fetching the CSV file:', error));
}

// Initialize the page after fetching data
const setupPage = async () => {
    await fetchOverview();
    await fetchFixtures();
    await fetchGameweeks();
    loadHistoricalData();

    // Initialize other functionalities or UI components here
    try {
        Initialize(); // Ensure this function is defined elsewhere
    } catch (error) {
        console.log("Init skipped")
    }

    try {
        updateGameweek(); // Ensure this function is defined elsewhere
    } catch (error) {
        console.log("Init skipped")
    }
};

// Start the process
setupPage();